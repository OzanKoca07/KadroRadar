"""Explicit real-engine verification. Does not write to staging or a live source."""
import json,os,tempfile
from pathlib import Path
import fitz
from official_gazette import parse_pdf,ocr_status,fold

def main():
    status=ocr_status()
    if not status['available']:raise RuntimeError(status)
    font=Path('C:/Windows/Fonts/arial.ttf')
    if not font.exists():font=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    with tempfile.TemporaryDirectory() as directory:
        pdf=Path(directory)/'scanned.pdf'
        with fitz.open() as original:
            page=original.new_page();page.insert_font(fontname='test',fontfile=str(font))
            page.insert_text((60,80),'Niğde Ömer Halisdemir Üniversitesi',fontsize=18,fontname='test')
            page.insert_text((60,120),'Atalan Belediyesi   Sağlık Teknikeri   KPSS P93',fontsize=16,fontname='test')
            page.insert_text((60,160),'Kontenjan 29 + 1 = 30   Başvuru 23/10/2026',fontsize=16,fontname='test')
            raster=page.get_pixmap(matrix=fitz.Matrix(2,2))
            with fitz.open() as scanned:
                target=scanned.new_page();target.insert_image(target.rect,stream=raster.tobytes('png'));scanned.save(pdf)
        result=parse_pdf(pdf,ocr_pages={1});text=result['pageReports'][0]['ocr'].get('text','')
        for token in ['niğde','üniversitesi','sağlık','p93','29','30']:assert fold(token) in fold(text),(token,text)
        assert result['candidates']==[] # OCR cannot invent a canonical announcement/table.
    real=os.environ.get('GAZETTE_REAL_PDF');reports=[];coverage=[]
    if real:
        baseline=parse_pdf(real);flagged=[p['page'] for p in baseline['pageReports'] if p['issues']]
        for offset in range(0,len(flagged),5):
            selected=set(flagged[offset:offset+5]);result=parse_pdf(real,ocr_pages=selected)
            assert result['candidates']==baseline['candidates'],'OCR changed canonical recruitment data'
            reports.extend(p for p in result['pageReports'] if p['page'] in selected)
        assert all(p['ocr'] and 'text' in p['ocr'] for p in reports),reports
        coverage=[{'organization':c['organization'],'pages':[c['sourceEvidence']['pageStart'],c['sourceEvidence']['pageEnd']],'rows':len(c['positions']),'quotaSuggestion':c['quota'],'verified':('Niğde Ömer Halisdemir' in c['organization'] or 'Atalan' in c['organization']),'issues':c['issues']} for c in baseline['candidates']]
    summary={'status':'PASS','engine':status,'syntheticImagePages':1,'realPdfOcrPages':len(reports),'canonicalFieldsChanged':False,'pages':[{'page':p['page'],'characters':len(p['ocr']['text']),'issues':p['issues']} for p in reports],'candidateCoverage':coverage,'tableAccuracy':'NOT_VERIFIED_OCR_EVIDENCE_ONLY'}
    output=Path('.local/rc1-ocr-report.json');output.parent.mkdir(exist_ok=True);output.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(summary,ensure_ascii=True))
if __name__=='__main__':main()
