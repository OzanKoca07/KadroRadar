"""Conservative local Gazette PDF adapter. No network access or auto-publication."""
import argparse
import contextlib
import hashlib
import io
import json
import re
import os
import shutil
import subprocess
import tempfile
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit
import fitz

MAX_BYTES = 64 * 1024 * 1024
MAX_PAGES = 600

def ocr_status():
    executable = shutil.which(os.environ.get('TESSERACT_CMD', 'tesseract'))
    if not executable:
        return {'available':False,'reason':'TESSERACT_NOT_FOUND','languages':[]}
    try:
        probe=subprocess.run([executable,'--list-langs'],capture_output=True,text=True,timeout=10,check=True)
        languages=probe.stdout.splitlines()[1:]
        return {'available':{'tur','eng'}.issubset(set(languages)),'reason':None if {'tur','eng'}.issubset(set(languages)) else 'TUR_ENG_REQUIRED','languages':languages}
    except (OSError,subprocess.SubprocessError):
        return {'available':False,'reason':'TESSERACT_PROBE_FAILED','languages':[]}

def ocr_page(page, original):
    """OCR is review evidence only; never overwrite canonical dates, quotas or tables."""
    status=ocr_status()
    if not status['available']:raise RuntimeError(status['reason'])
    scale=200/72
    if page.rect.width*page.rect.height*scale*scale>16_000_000:raise ValueError('OCR_PIXEL_LIMIT')
    with tempfile.TemporaryDirectory(prefix='kr-ocr-') as directory:
        image=Path(directory)/'page.png'
        page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False).save(image)
        output=Path(directory)/'recognized'
        subprocess.run([shutil.which(os.environ.get('TESSERACT_CMD','tesseract')),str(image),str(output),'-l','tur+eng','--psm','3'],capture_output=True,timeout=30,check=True,env={**os.environ,'OMP_THREAD_LIMIT':'1'})
        recognized=output.with_suffix('.txt')
        if recognized.stat().st_size>240000:raise ValueError('OCR_TEXT_LIMIT')
        # Windows Tesseract stdout can use the console ANSI codepage. Its text file is UTF-8.
        text=normalize(recognized.read_text(encoding='utf-8'))
    original_numbers=set(re.findall(r'\b\d+(?:[.,/]\d+)*\b',original))
    ocr_numbers=set(re.findall(r'\b\d+(?:[.,/]\d+)*\b',text))
    return {'text':text[:60000],'issues':page_quality(text)+['OCR_DERIVED_REVIEW_REQUIRED','OCR_TABLE_REQUIRES_MANUAL_REVIEW']+(['OCR_TEXT_CONFLICT'] if original_numbers!=ocr_numbers else []),'characters':len(text),'tablesVerified':False,'canonicalFieldsChanged':False}
MONTHS = {'ocak':1,'subat':2,'mart':3,'nisan':4,'mayis':5,'haziran':6,'temmuz':7,'agustos':8,'eylul':9,'ekim':10,'kasim':11,'aralik':12}

def discover_index(html,base_url):
    """Inspect explicitly supplied HTML; never guess endpoints or download documents."""
    base=urlsplit(base_url)
    if base.scheme!='https' or base.hostname!='www.resmigazete.gov.tr' or base.username or base.password or base.port not in (None,443):raise ValueError('UNAPPROVED_GAZETTE_INDEX')
    if len(html.encode('utf-8'))>2_000_000:raise ValueError('HTML_SIZE_LIMIT')
    class Links(HTMLParser):
        def __init__(self):super().__init__();self.current=None;self.items=[]
        def handle_starttag(self,tag,attrs):
            if tag=='a':self.current={'href':dict(attrs).get('href',''),'label':''}
        def handle_data(self,text):
            if self.current is not None:self.current['label']+=text
        def handle_endtag(self,tag):
            if tag=='a' and self.current is not None:self.items.append(self.current);self.current=None
    parser=Links();parser.feed(html);result=[];seen=set()
    for link in parser.items:
        if not link['href']:continue
        url=urljoin(base_url,link['href']);parts=urlsplit(url)
        if parts.scheme!='https' or parts.hostname!=base.hostname or parts.username or parts.password or parts.port not in (None,443):continue
        if url in seen:continue
        kind='pdf' if parts.path.lower().endswith('.pdf') else 'html' if parts.path.lower().endswith(('.htm','.html')) else 'navigation'
        label=compact(link['label'])
        if kind=='navigation' and not re.search(r'arsiv|ilan|arama',fold(label)):continue
        stamp=re.search(r'/(20\d{6})(?:[-_]\d+)*\.(?:pdf|html?)$',parts.path,re.I)
        observed_date=None
        if stamp:
            try:observed_date=date(int(stamp[1][:4]),int(stamp[1][4:6]),int(stamp[1][6:])).isoformat()
            except ValueError:pass
        result.append({'url':url,'label':label,'format':kind,'observedDate':observed_date,'supplemental':True if 'mukerrer' in fold(label) else None,'verifiedDownload':False,'automationEnabled':False})
        seen.add(url)
    return result

def index_manifest(html, base_url):
    """Local, operator-supplied official HTML. This is not a live fetch or permission."""
    links=discover_index(html,base_url)
    class Text(HTMLParser):
        def __init__(self):super().__init__();self.parts=[];self.hidden=0
        def handle_starttag(self,tag,attrs):
            if tag in ('script','style'):self.hidden+=1
        def handle_endtag(self,tag):
            if tag in ('script','style'):self.hidden=max(0,self.hidden-1)
        def handle_data(self,data):
            if not self.hidden:self.parts.append(data)
    parser=Text();parser.feed(html);text=compact(' '.join(parser.parts));value=fold(text)
    # The index uses "26 Ekim 2026 Tarihli ve 33412 Sayılı" rather than PDF "Sayı :".
    stamp=metadata(text)
    if not stamp:
        match=re.search(r'(\d{1,2})\s+('+'|'.join(MONTHS)+r')\s+(20\d{2})\s+tarihli\s+ve\s+(\d{4,6})\s+sayili',value)
        if match:
            try:stamp=(date(int(match[3]),MONTHS[match[2]],int(match[1])).isoformat(),match[4])
            except ValueError:pass
    # A search dropdown mentioning Mükerrer does not establish this issue as supplemental.
    issue_heading=re.search(r'tarihli\s+ve\s+\d{4,6}\s+sayili\s+(?:(\d+)\.?\s*mukerrer\s+)?resmi gazete(?:\s*\((\d+)\.?\s*mukerrer\))?',value)
    supplement_number=next((int(v) for v in issue_heading.groups() if v),None) if issue_heading else None
    for link in links:
        label=fold(link['label'])
        link['section']='TENDER' if 'ihale' in label else 'COURT' if 'yargi' in label else 'MISCELLANEOUS' if 'cesitli' in label else None
    return {'kind':'GAZETTE_INDEX','indexUrl':base_url,'htmlSha256':hashlib.sha256(html.encode('utf-8')).hexdigest(),'gazetteDate':stamp[0] if stamp else None,'gazetteNumber':stamp[1] if stamp else None,'supplementNumber':supplement_number,'links':links,'issues':[] if stamp else ['MISSING_GAZETTE_METADATA'],'provenance':'OPERATOR_SUPPLIED_HTML','liveFetch':False,'automationEnabled':False,'reviewRequired':True}

def normalize(text):
    return unicodedata.normalize('NFKC', text).replace('\u00a0', ' ').replace('\u00ad', '')

def fold(text):
    return normalize(text).translate(str.maketrans('ıİşŞğĞüÜöÖçÇâî', 'iIsSgGuUoOcCai')).lower()

def compact(text):
    return re.sub(r'\s+', ' ', normalize(text or '')).strip()

def page_quality(text):
    controls = sum(ord(c) < 32 and c not in '\n\r\t' for c in text)
    damaged = text.count('\ufffd') + controls
    if len(text.strip()) < 40:
        return ['OCR_REQUIRED']
    if damaged / max(1, len(text)) > 0.015 or re.search(r'(?:Ã.|Ä.|Å.){3}', text):
        return ['BROKEN_ENCODING', 'OCR_REVIEW_REQUIRED']
    return []

def metadata(text):
    normalized = fold(text)
    number = re.search(r'sayi\s*[:：]\s*(\d{4,6})', normalized)
    stamp = re.search(r'\b(\d{1,2})\s+(' + '|'.join(MONTHS) + r')\s+(20\d{2})\b', normalized)
    if not number or not stamp:
        return None
    try:
        return date(int(stamp[3]), MONTHS[stamp[2]], int(stamp[1])).isoformat(), number[1]
    except ValueError:
        return None

def classify(text):
    value = fold(compact(text))
    if re.search(r'ihale (?:edilecektir|ilani)|4734 sayili|artirma.*eksiltme|satilacaktir', value):
        return 'TENDER'
    if re.search(r'ilanen teblig|esas no|mahkemesinden|icra dairesinden', value):
        return 'COURT'
    if re.search(r'(?:personel|memur|isci|ogretim (?:uyesi|gorevlisi)|arastirma gorevlisi).{0,100}(?:alim|alinacak|istihdam)|(?:alim|alinacak).{0,80}(?:personel|memur|isci)', value):
        return 'PERSONNEL'
    return 'OTHER'

def event_type(text):
    # A reservation of the right to cancel at the end is NOT a cancellation notice.
    heading = fold(compact(text[:600]))
    if re.search(r'iptal (?:ilani|duyurusu)|ilani.*iptal edilmistir', heading): return 'CANCELLATION'
    if re.search(r'duzeltme (?:ilani|duyurusu)|sure uzatim', heading): return 'CORRECTION'
    return 'RECRUITMENT'

def heading(line):
    line = compact(line)
    if len(line) > 220: return None
    if re.search(r'(Rektörlüğünden|Belediye Başkanlığından|Belediye Başkanlığından|Genel Müdürlüğünden|Bakanlığından|Başkanlığından)\s*[:：]', line, re.I):
        return line.rstrip(':： ')
    return None

def evidence(page, text, table=None, row=None):
    result = {'page':page,'text':compact(text)[:12000]}
    if table is not None: result.update(table=table,row=row)
    return result

def positions_from_table(rows, page, table_no, whole_text):
    result = []
    headers = [fold(compact(cell)) for cell in rows[0]] if rows else []
    title_idx = next((i for i,h in enumerate(headers) if 'unvan' in h), None)
    quota_idx = next((i for i,h in enumerate(headers) if re.search(r'\badet\b|adedi|kontenjan|sayisi',h)), None)
    for row_no, raw in enumerate(rows):
        cells = [compact(cell) for cell in raw]
        if title_idx is not None and quota_idx is not None:
            if row_no == 0 or len(cells) <= max(title_idx, quota_idx): continue
            title, count = cells[title_idx], cells[quota_idx]
        elif len(cells) == 4 and re.search(r'personeli|teknikeri|tekniker|hemsire|memur|isci', fold(cells[0])):
            title, count = cells[0], cells[1]
        else:
            continue
        quota = re.match(r'^(\d{1,4})\b', count)
        if not title or not quota or int(quota[1]) < 1: continue
        combined = ' '.join(cells)
        value = fold(combined)
        score_types = sorted(set(re.findall(r'(?:\bkpss\s*[-/]?\s*|\b)p\s*(3|93|94)\b', value)))
        minimum = re.search(r'en az\s*(\d{1,3}(?:[.,]\d+)?)\s*puan', value)
        years = sorted(set(re.findall(r'\b(20\d{2})\b', combined)))
        if not years:
            years = sorted(set(re.findall(r'\b(20\d{2})\s+(?:yili\s+)?(?:kamu personeli secme sinavi|kpss)', fold(compact(whole_text)))))
        conditions = {'complete':False,'degreeCodesVerified':False,'otherConditions':['Genel ve özel şartlar kaynak PDF ile ayrıca incelenmelidir.']}
        if len(score_types) == 1: conditions.update(kpssRequired=True,kpssScoreType='P'+score_types[0])
        if len(score_types)==1 and minimum and float(minimum[1].replace(',','.')) <= 100: conditions['kpssMinimumScore'] = float(minimum[1].replace(',','.'))
        if len(score_types)==1 and len(years) == 1: conditions['examYears'] = [int(years[0])]
        if 'ortaogretim' in value: conditions['educationLevels'] = ['ORTAOGRETIM']
        elif re.search(r'on\s*lisans', value): conditions['educationLevels'] = ['ONLISANS']
        elif re.search(r'\blisans\b', value): conditions['educationLevels'] = ['LISANS']
        expected={'P3':'LISANS','P93':'ONLISANS','P94':'ORTAOGRETIM'}.get(conditions.get('kpssScoreType'))
        if expected and conditions.get('educationLevels') and conditions['educationLevels']!=[expected]:
            conditions.pop('kpssScoreType',None)
            conditions['otherConditions'].append('KPSS_SCORE_EDUCATION_CONFLICT')
        if re.search(r'\(?b\)?\s*sinifi\s*(?:surucu|ehliyet)|\bb\s+sinifi\s+ehliyet', value): conditions['certificates'] = ['DRIVING_LICENSE_B']
        result.append({'title':title,'quota':int(quota[1]),'requirements':conditions,'sourceEvidence':evidence(page,combined,table_no,row_no),'qualificationText':combined,'parserPositionKey':f'{page}:{table_no}:{row_no}'})
    return result

def dates_from_pages(pages):
    result = {'applicationStartAt':None,'applicationEndAt':None,'applicationUrl':None,'dateEvidence':[],'dateSuggestions':[],'dateIssues':[]}
    verified_dates=set()
    for p in pages:
        text = compact(p['text'])
        value = fold(text)
        # Explicit dates PLUS explicit start/end times; publication date is never a fallback.
        dates = re.search(r'basvuru tarihleri\s*:\s*(\d{2}\.\d{2}\.\d{4}).{0,60}?(\d{2}\.\d{2}\.\d{4}).{0,40}?sona erecektir', value)
        hours = re.search(r'baslangic tarihinde saat\s*(\d{2}[:.]\d{2}).{0,80}?bitis tarihinde saat\s*(\d{2}[:.]\d{2})', value)
        if dates and hours:
            def stamp(day,hour):
                d,m,y = map(int,day.split('.')); date(y,m,d)
                hh,mm=map(int,re.split('[:.]',hour))
                if hh>23 or mm>59: raise ValueError('Invalid source hour')
                return f'{y:04d}-{m:02d}-{d:02d}T{hh:02d}:{mm:02d}:00+03:00'
            try:
                start,end=stamp(dates[1],hours[1]),stamp(dates[2],hours[2])
                if start>end:raise ValueError('Reversed dates')
                verified_dates.add((start,end))
            except ValueError:result['dateIssues'].append('INVALID_APPLICATION_DATES')
            result['dateEvidence'].append(evidence(p['page'],text[max(0,dates.start()-30):hours.end()+40]))
        if 'basvuru' in value:
            for match in re.finditer(r'(\d{2}/\d{2}/20\d{2})\s*[-–]\s*(\d{2}/\d{2}/20\d{2})', text):
                result['dateSuggestions'].append(evidence(p['page'],text[max(0,match.start()-50):match.end()+150]))
        # Keep URLs actually printed in application instructions. Never invent HTTPS for a bare hostname.
        for match in re.finditer(r'https://kariyerkapisi\.gov\.tr/isealim\b', text):
            if 'basvuru' in value:
                result['applicationUrl']=match[0]
                result['dateEvidence'].append(evidence(p['page'],text[max(0,match.start()-100):match.end()+100]))
    if len(verified_dates)==1 and not result['dateIssues']:
        result['applicationStartAt'],result['applicationEndAt']=next(iter(verified_dates))
    elif len(verified_dates)>1:result['dateIssues'].append('CONFLICTING_APPLICATION_DATES')
    return result

def decode_official_html(data):
    """Honor a declared Turkish legacy encoding; never silently replace glyphs."""
    declared=re.search(br'charset\s*=\s*[\"\']?([a-zA-Z0-9_-]+)',data[:4096],re.I)
    encoding=declared[1].decode('ascii').lower() if declared else 'utf-8-sig'
    allowed={'utf-8':'utf-8-sig','utf-8-sig':'utf-8-sig','windows-1254':'cp1254',
             'cp1254':'cp1254','iso-8859-9':'iso-8859-9'}
    if encoding not in allowed:raise ValueError('UNSUPPORTED_HTML_CHARSET')
    return data.decode(allowed[encoding]),encoding

def parse_notice_html(path, source_url):
    """Local HTML only. Script/style contents and external resources are ignored."""
    discover_index('',source_url)  # exact-host HTTPS validation, without fetching
    data=Path(path).read_bytes()
    if len(data)>2_000_000:raise ValueError('HTML_SIZE_LIMIT')
    html,encoding=decode_official_html(data)
    class Notice(HTMLParser):
        def __init__(self):super().__init__();self.parts=[];self.tables=[];self.table=None;self.row=None;self.cell=None;self.hidden=0
        def handle_starttag(self,tag,attrs):
            if tag in ('script','style'):self.hidden+=1
            if self.hidden:return
            if tag in ('p','div','h1','h2','h3','br','tr'):self.parts.append('\n')
            if tag=='table':self.table=[];self.parts.append(f'\nKR_TABLE_{len(self.tables)}\n')
            if tag=='tr':self.row=[]
            if tag in ('td','th'):self.cell=[]
        def handle_endtag(self,tag):
            if tag in ('script','style'):self.hidden=max(0,self.hidden-1);return
            if self.hidden:return
            if tag in ('td','th') and self.cell is not None:
                if self.row is not None:self.row.append(compact(' '.join(self.cell)))
                self.cell=None;self.parts.append(' ')
            if tag=='tr' and self.row is not None:
                if self.table is not None:self.table.append(self.row)
                self.row=None
            if tag=='table' and self.table is not None:self.tables.append(self.table);self.table=None
            if tag in ('p','div','h1','h2','h3','tr'):self.parts.append('\n')
        def handle_data(self,value):
            if not self.hidden:
                self.parts.append(value)
                if self.cell is not None:self.cell.append(value)
    parser=Notice();parser.feed(html);text=normalize(''.join(parser.parts));stamp=metadata(text)
    groups=[];active=None
    for line_no,line in enumerate(text.splitlines(),1):
        org=heading(line)
        if org:
            if active:groups.append(active)
            active={'organization':org,'lines':[],'lineStart':line_no}
        if active:active['lines'].append(line)
    if active:groups.append(active)
    digest=hashlib.sha256(data).hexdigest();candidates=[]
    for group in groups:
        body='\n'.join(group['lines'])
        if classify(body)!='PERSONNEL':continue
        positions=[]
        for match in re.finditer(r'KR_TABLE_(\d+)',body):
            number=int(match[1])
            if number<len(parser.tables):positions.extend(positions_from_table(parser.tables[number],1,number,body))
        timing=dates_from_pages([{'page':1,'text':body}]);issues=timing.pop('dateIssues')+['HTML_SOURCE_REVIEW_REQUIRED','POSITION_COVERAGE_REQUIRES_REVIEW']
        if not positions:issues.append('POSITIONS_NOT_PARSED')
        if not timing['applicationEndAt'] or not timing['applicationStartAt']:issues.append('APPLICATION_DATES_REQUIRE_REVIEW')
        source={'kind':'OFFICIAL_GAZETTE','format':'HTML','encoding':encoding,'pageLocator':'LOGICAL_SECTION_NOT_PDF_PAGE','sectionStartLine':group['lineStart'],'pageStart':1,'pageEnd':1,'pdfSha256':None,'documentSha256':digest,'gazetteDate':stamp[0] if stamp else None,'gazetteNumber':stamp[1] if stamp else None,'sourceUrl':source_url,'dateEvidence':timing.pop('dateEvidence'),'dateSuggestions':timing.pop('dateSuggestions')}
        candidates.append({'identity':f'urn:kadroradar:gazette-html:{digest}:{group["lineStart"]}','organization':group['organization'],'title':group['organization']+' - Personel alım duyurusu','sourceUrl':source_url,'sourceEvidence':source,'positions':positions,'quota':sum(p['quota'] for p in positions) if positions else None,'requirements':body[:18000],'issues':issues,'reviewRequired':True,'eventType':event_type(body),**timing})
    return {'parserVersion':'gazette-html-1','format':'HTML','sha256':digest,'pageCount':1,'inspectedPages':1,'gazetteDate':stamp[0] if stamp else None,'gazetteNumber':stamp[1] if stamp else None,'documentIssues':[] if groups else ['ORGANIZATION_NOT_IDENTIFIED'],'pageReports':[{'page':1,'issues':['HTML_SOURCE_REVIEW_REQUIRED'],'textCharacters':len(text),'ocr':None}],'candidates':candidates,'metrics':{'candidateCount':len(candidates),'positionRows':sum(len(c['positions']) for c in candidates),'flaggedPages':1,'ocrAttempted':0,'ocrSucceeded':0}}

def parse_pdf(path, source_url=None, include_tables=True, ocr_pages=None):
    path = Path(path)
    if not path.is_file() or path.stat().st_size > MAX_BYTES: raise ValueError('PDF_SIZE_LIMIT')
    data = path.read_bytes()
    if not data.startswith(b'%PDF-'): raise ValueError('INVALID_PDF_SIGNATURE')
    digest = hashlib.sha256(data).hexdigest()
    try: document=fitz.open(stream=data,filetype='pdf')
    except Exception as error: raise ValueError('BROKEN_PDF') from error
    with document:
        if document.needs_pass: raise ValueError('ENCRYPTED_PDF')
        if not 1 <= len(document) <= MAX_PAGES: raise ValueError('PDF_PAGE_LIMIT')
        if ocr_pages and (len(ocr_pages)>10 or any(p<1 or p>len(document) for p in ocr_pages)): raise ValueError('OCR_PAGE_LIMIT')
        pages=[]; metadata_votes=[]; groups=[]; active=None
        for index,page in enumerate(document):
            raw_text=normalize(page.get_text(sort=False))
            text=normalize(page.get_text(sort=True))
            if len(text)>60000: raise ValueError('PAGE_TEXT_LIMIT')
            # PyMuPDF's sorted layout can remove invalid control glyphs; inspect raw text too.
            issues=sorted(set(page_quality(raw_text)+page_quality(text)))
            native_quality_issues=list(issues)
            ocr=None
            multiple_headings=len([line for line in text.splitlines() if heading(line)])>1
            if ocr_pages and index+1 in ocr_pages and (issues or multiple_headings):
                try:
                    ocr=ocr_page(page,text)
                    issues=sorted(set(issues+ocr['issues']))
                except Exception as error:
                    issues.append('OCR_UNAVAILABLE')
                    ocr={'error':str(error)[:160],'canonicalFieldsChanged':False}
            stamp=metadata(text)
            if stamp: metadata_votes.append(stamp)
            printed=re.search(r'Sayfa\s*:\s*(\d+)',text)
            entry={'page':index+1,'printedPage':int(printed[1]) if printed else None,'text':text,'issues':issues,'tables':[],'ocr':ocr}
            located_tables=[]
            if include_tables and not native_quality_issues:
                try:
                    with contextlib.redirect_stdout(io.StringIO()):
                        located_tables=[(t.bbox,t.extract()) for t in page.find_tables().tables]
                        entry['tables']=[rows for _,rows in located_tables]
                except Exception:
                    entry['issues'].append('TABLE_EXTRACTION_FAILED')
            pages.append(entry)
            # A new notice can start below the previous notice's table on the
            # SAME physical page. Assign tables by geometry, not page ownership.
            heading_y=[]
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines',[]):
                    if heading(''.join(span['text'] for span in line['spans'])):
                        heading_y.append(max(0,line['bbox'][1]-0.5))
            cuts=sorted(set([0.0,*heading_y,float(page.rect.height)]))
            segments=[entry] if len(cuts)==2 else []
            if not segments:
                for low,high in zip(cuts,cuts[1:]):
                    segment_text=normalize(page.get_text(clip=fitz.Rect(0,low,page.rect.width,high),sort=True))
                    if not segment_text.strip():continue
                    selected=[(n,rows) for n,(box,rows) in enumerate(located_tables) if low<=box[1]<high]
                    segments.append({**entry,'text':segment_text,'tables':[rows for _,rows in selected],
                                     'tableNumbers':[n for n,_ in selected]})
            for segment in segments:
                starts=[h for h in (heading(line) for line in segment['text'].splitlines()) if h]
                if starts:
                    if active:groups.append(active)
                    active={'organization':starts[0],'pages':[]}
                    if len(starts)>1:segment['issues']=segment['issues']+['MULTIPLE_ORGANIZATIONS_ON_PAGE']
                if active:
                    active['pages'].append(segment)
                    if re.search(r'\b\d{3,6}/\d{1,2}-\d{1,2}\s*$',segment['text'].strip()):groups.append(active);active=None
        if active:groups.append(active)
        chosen=Counter(metadata_votes).most_common(1)
        gazette_date,gazette_number=chosen[0][0] if chosen else (None,None)
        doc_issues=[]
        if len(set(metadata_votes))>1:doc_issues.append('CONFLICTING_GAZETTE_METADATA')
        if not chosen:doc_issues.append('MISSING_GAZETTE_METADATA')
        if document.is_repaired:doc_issues.append('PDF_REPAIRED')
        candidates=[]
        for group in groups:
            text='\n'.join(p['text'] for p in group['pages'])
            if classify(text)!='PERSONNEL':continue
            start,end=group['pages'][0]['page'],group['pages'][-1]['page']
            advertisement=re.findall(r'\b\d{3,6}/\d{1,2}-\d{1,2}\b',text)
            identity=advertisement[-1] if advertisement else hashlib.sha256(compact(text).encode()).hexdigest()[:20]
            positions=[]
            last_header=None
            for page in group['pages']:
                for ordinal,table in enumerate(page['tables']):
                    table_no=page.get('tableNumbers',list(range(len(page['tables']))))[ordinal]
                    header=[fold(compact(c)) for c in table[0]] if table else []
                    if any('unvan' in c for c in header):last_header=table[0]
                    elif last_header and table and len(table[0])==len(last_header):
                        table=[last_header,*table]
                    positions.extend(positions_from_table(table,page['page'],table_no,text))
            timing=dates_from_pages(group['pages'])
            issues=list(doc_issues)+sorted(set(issue for p in group['pages'] for issue in p['issues']))+timing.pop('dateIssues')
            if not positions:issues.append('POSITIONS_NOT_PARSED')
            if len(text)>18000:issues.append('BODY_TEXT_TRUNCATED_REVIEW_PDF')
            if not timing['applicationStartAt'] or not timing['applicationEndAt']:issues.append('APPLICATION_DATES_REQUIRE_REVIEW')
            source={'kind':'OFFICIAL_GAZETTE','gazetteDate':gazette_date,'gazetteNumber':gazette_number,'pdfSha256':digest,'pageStart':start,'pageEnd':end,'advertisementId':advertisement[-1] if advertisement else None,'sourceUrl':source_url,'dateEvidence':timing.pop('dateEvidence'),'dateSuggestions':timing.pop('dateSuggestions')}
            candidates.append({'identity':f'urn:kadroradar:gazette:{digest}:{start}:{identity}','organization':group['organization'],'title':group['organization']+' - Personel alım duyurusu','sourceUrl':source_url,'sourceEvidence':source,'positions':positions,'quota':sum(p['quota'] for p in positions) if positions else None,'requirements':text[:18000],'issues':issues+['POSITION_COVERAGE_REQUIRES_REVIEW'],'reviewRequired':True,'eventType':event_type(text),'confidence':{'grade':'REVIEW_REQUIRED','heuristicScore':max(0.1,0.8-0.15*len(issues)),'isProbability':False},**timing})
        return {'parserVersion':'gazette-1','sha256':digest,'pageCount':len(document),'inspectedPages':len(pages),'gazetteDate':gazette_date,'gazetteNumber':gazette_number,'documentIssues':doc_issues,'pageReports':[{'page':p['page'],'printedPage':p['printedPage'],'issues':p['issues'],'textCharacters':len(p['text']),'ocr':p['ocr']} for p in pages],'candidates':candidates,'metrics':{'candidateCount':len(candidates),'positionRows':sum(len(c['positions']) for c in candidates),'flaggedPages':sum(bool(p['issues']) for p in pages),'ocrAttempted':sum(p['ocr'] is not None for p in pages),'ocrSucceeded':sum(bool(p['ocr'] and 'text' in p['ocr']) for p in pages)}}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('pdf',type=Path);parser.add_argument('--index-url');parser.add_argument('--notice-url');parser.add_argument('--ocr-pages',help='Explicit flagged pages only, comma-separated, at most10');args=parser.parse_args()
    try:print(json.dumps(index_manifest(decode_official_html(args.pdf.read_bytes())[0],args.index_url) if args.index_url else parse_notice_html(args.pdf,args.notice_url) if args.notice_url else parse_pdf(args.pdf,ocr_pages=set(map(int,args.ocr_pages.split(','))) if args.ocr_pages else None),ensure_ascii=True))
    except Exception as error:print(json.dumps({'error':str(error)[:200],'errorType':type(error).__name__}));raise SystemExit(1)
