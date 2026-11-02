"""Offline transport fixture. Optional real LOCAL PDF, never a live download."""
import argparse
import copy
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from gazette_download import collect,ROOT,DOCUMENT_SCOPE
from official_rss import REGISTRY
from official_gazette import parse_pdf
from fixtures.make_gazette_fixture import make

def generate(directory,output,pdf=None):
    directory.mkdir(parents=True,exist_ok=True)
    real=pdf is not None
    if pdf is None:pdf=directory/'synthetic.pdf';make(pdf)
    parsed=parse_pdf(pdf);day=parsed['gazetteDate'];stamp=day.replace('-','')
    index_url=ROOT+f'eskiler/{day[:4]}/{day[5:7]}/{stamp}.htm'
    pdf_url=index_url[:-4]+'.pdf'
    # The index and permission below are explicitly synthetic even with a real
    # local PDF. They do not assert a verified live URL or source authorization.
    month={'09':'Eylül','10':'Ekim'}[day[5:7]]
    html=(f'<h2>{int(day[8:])} {month} {day[:4]} Tarihli ve {parsed["gazetteNumber"]} Sayılı Resmî Gazete</h2><a href="{pdf_url}">SYNTHETIC OFFLINE INDEX PDF</a>').encode()
    source=copy.deepcopy(REGISTRY['gazette']);source['enabled']=True;source['indexingPolicy']['automatedAccess']='ALLOWED'
    source['rightsAssessment']={'status':'LICENSE_VERIFIED','evidence':{'kind':'LICENSE','url':'https://example.test/SYNTHETIC-LICENSE','sha256':'a'*64,'scopeUrl':ROOT,'scopes':['AUTOMATED_FEED_ACCESS','MOBILE_METADATA','COMMERCIAL_USE',DOCUMENT_SCOPE],'attribution':'SYNTHETIC TEST ONLY','verifiedAt':'2020-01-01T00:00:00Z','validUntil':'2035-01-01T00:00:00Z'}}
    def fetch(url,maximum,previous=None,**kwargs):return {'notModified':False,'body':b'User-agent: *\nAllow: /\n' if url.endswith('robots.txt') else html if url==index_url else pdf.read_bytes(),'etag':'"SYNTHETIC"'}
    report=collect(day,directory/'cache',source=source,fetch=fetch)
    report['testProvenance']='REAL_LOCAL_PDF_MOCK_TRANSPORT' if real else 'SYNTHETIC_PDF_MOCK_TRANSPORT'
    output.write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'mode':report['testProvenance'],'documents':len(report['documents']),'candidates':sum(len(d['parsed']['candidates']) for d in report['documents']),'liveDownload':False}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--directory',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--pdf',type=Path);a=p.parse_args();generate(a.directory,a.output,a.pdf)
