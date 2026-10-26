"""Strict HTML/XLSX table adapter. Unsupported/ambiguous rows block approval.

No guessed metadata, formula evaluation, OCR, or degree-code matching.
"""
import io,re,zipfile,unicodedata
from pathlib import Path
from decimal import Decimal
from html.parser import HTMLParser
from xml.etree import ElementTree as ET

def norm(value):
    return unicodedata.normalize('NFC',str(value)).replace('İ','i').replace('I','ı').lower().strip()

def cells(path):
    content=Path(path).read_bytes()
    if len(content)>64*1024*1024:raise ValueError('Document resource limit')
    if content[:2]==b'PK':
        rows=[]
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            if len(archive.infolist())>500 or sum(item.file_size for item in archive.infolist())>64*1024*1024:raise ValueError('Spreadsheet expanded-size limit')
            def xml(name):
                data=archive.read(name)
                if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():raise ValueError('Unsafe worksheet XML')
                return ET.fromstring(data)
            shared=[]
            if 'xl/sharedStrings.xml' in archive.namelist():shared=[''.join(node.itertext()) for node in xml('xl/sharedStrings.xml')]
            sheets=[name for name in archive.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml',name)]
            if len(sheets)!=1:raise ValueError('Single worksheet required; choose source table explicitly')
            for row in xml(sheets[0]).findall('.//{*}row'):
                values=[]
                for cell in row.findall('{*}c'):
                    if cell.find('{*}f') is not None:raise ValueError('Formula cells require manual verification')
                    inline=cell.find('{*}is')
                    raw=''.join(inline.itertext()) if inline is not None else cell.findtext('{*}v') or ''
                    values.append(shared[int(raw)] if cell.get('t')=='s' else raw)
                if any(values):rows.append(values)
        return rows,'xlsx'
    if content.startswith(bytes.fromhex('d0cf11e0')):raise ValueError('Legacy XLS not supported; official XLSX/HTML/PDF or reviewed conversion required')
    text=content.decode('utf-8-sig')
    if '<table' not in text.lower():raise ValueError('Unsupported document format')
    class Table(HTMLParser):
        def __init__(self):super().__init__();self.rows=[];self.row=None;self.value=None
        def handle_starttag(self,tag,attrs):
            if tag=='tr':self.row=[]
            if tag in ('td','th') and self.row is not None:self.value=[]
        def handle_data(self,data):
            if self.value is not None:self.value.append(data)
        def handle_endtag(self,tag):
            if tag in ('td','th') and self.value is not None:self.row.append(' '.join(' '.join(self.value).split()));self.value=None
            if tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
    parser=Table();parser.feed(text)
    # Header/period must be present in source, never supplied by an operator hint.
    return [[re.sub('<[^>]+>',' ',text[:text.lower().index('<table')])]]+parser.rows,'html'

def table_metadata(path):
    from osym_web import metadata_from_text
    rows,kind=cells(path);header=[]
    for row in rows:
        if row and re.fullmatch(r'[123]\d{8}',row[0]):break
        header.append(' '.join(row))
    meta=metadata_from_text(' '.join(header))
    if not meta['year'] or not meta['education']:raise ValueError('Official KPSS period/education header required')
    return {**meta,'pageCount':1,'format':kind}

def parse_table(path,education=None):
    metadata=table_metadata(path)
    if education and education!=metadata['education']:raise ValueError('Education/source mismatch')
    table,kind=cells(path);rows=[];errors=[]
    for number,values in enumerate(table,1):
        if not values or not re.fullmatch(r'[123]\d{8}',values[0]):continue
        try:
            if len(values)!=8:raise ValueError('Eight source columns required')
            code,institution,title,quota,placed,vacant,low,high=values
            if code[0]!={'BACHELOR':'3','ASSOCIATE':'2','HIGH_SCHOOL':'1'}[metadata['education']]:raise ValueError('Education/code mismatch')
            quota,placed,vacant=map(int,[quota,placed,vacant])
            if quota<1 or placed<0 or quota!=placed+vacant:raise ValueError('Quota integrity failure')
            if placed==0 and low in ('--','0','0,00000') and high in ('--','0','0,00000'):low=high=None
            else:
                low,high=Decimal(low.replace(',','.')),Decimal(high.replace(',','.'))
                if not 0<low<=high<=100 or any(x.as_tuple().exponent < -5 for x in (low,high)):raise ValueError('Score precision/range failure')
            if not institution or not title or '\ufffd' in institution+title:raise ValueError('Source text invalid')
            rows.append(dict(positionCode=code,institutionRawName=institution,title=title,city=institution.split(' / ')[1] if ' / ' in institution else '',quota=quota,placedCount=placed,vacantCount=vacant,minScore=format(low,'.5f') if low is not None else None,maxScore=format(high,'.5f') if high is not None else None,sourcePage=1,rawRecord={'format':kind,'row':number,'cells':values}))
        except (ValueError,ArithmeticError) as error:errors.append({'row':number,'raw':values,'error':str(error)})
    if not rows:errors.append({'error':'No supported placement rows'})
    if len({r['positionCode'] for r in rows})!=len(rows):errors.append({'error':'Duplicate codes'})
    return rows,errors
