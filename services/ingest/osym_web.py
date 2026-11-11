"""Bounded operator-triggered ÖSYM archive/documents; never guesses document URLs."""
import argparse,json,re,hashlib,unicodedata
from datetime import datetime,timezone
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit
from urllib.request import Request,build_opener,HTTPRedirectHandler
from official_rss import validate_outbound_dns,classify_error as error_class

INDEX_HOSTS={'osym.gov.tr','www.osym.gov.tr'}
def normalized(text):
    return unicodedata.normalize('NFC',text).replace('İ','i').replace('I','ı').lower()

def metadata_from_text(text):
    text=normalized(text)
    period=re.search(r'kpss\s*[-–]?\s*(20\d{2})\s*/\s*(\d+)',text)
    levels=[]
    if re.search(r'ön\s*lisans',text):levels.append('ASSOCIATE')
    if re.search(r'orta\s*öğretim',text):levels.append('HIGH_SCHOOL')
    if re.search(r'\blisans\b',re.sub(r'ön\s*lisans','',text)):levels.append('BACHELOR')
    education=levels[0] if len(levels)==1 else None
    return {'year':int(period[1]) if period else None,'round':int(period[2]) if period else None,'education':education}

def index_url(url):
    value=urlsplit(url)
    if value.scheme!='https' or value.hostname not in INDEX_HOSTS or value.username or value.password or value.port not in (None,443):raise ValueError('Official HTTPS ÖSYM index required')
    return url

class Links(HTMLParser):
    def __init__(self):super().__init__();self.href=None;self.label=[];self.results=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':self.href=dict(attrs).get('href');self.label=[]
    def handle_data(self,data):
        if self.href:self.label.append(data)
    def handle_endtag(self,tag):
        if tag=='a':
            if self.href:self.results.append((self.href,' '.join(' '.join(self.label).split())))
            self.href=None

def observed_links(html,base):
    index_url(base);parser=Links();parser.feed(html)
    return [(urljoin(base,href),label) for href,label in parser.results]

def published_date(text):
    months=['ocak','şubat','mart','nisan','mayıs','haziran','temmuz','ağustos','eylül','ekim','kasım','aralık']
    match=re.search(r'\b(\d{1,2})\s+('+'|'.join(months)+r')\s+(20\d{2})\b',normalized(text))
    if not match:return None
    return datetime(int(match[3]),months.index(match[2])+1,int(match[1])).date().isoformat()

def discover_archive(html,base):
    result=[];seen=set()
    for url,label in observed_links(html,base):
        if urlsplit(url).hostname not in INDEX_HOSTS:continue
        meta=metadata_from_text(label);text=normalized(label)
        if meta['round'] not in (1,2) or 'bazı kamu kurum' not in text or 'sayısal bilgiler' not in text:continue
        index_url(url)
        if url in seen:continue
        seen.add(url);result.append({'indexUrl':url,'label':label,'publishedAt':published_date(label),**meta})
    return result

def discover_qualifications(html,base):
    result=[]
    for url,label in observed_links(html,base):
        if urlsplit(url).hostname=='dokuman.osym.gov.tr' and urlsplit(url).scheme=='https' and 'nitelik kod' in normalized(label):
            result.append({'url':url,'label':label,'education':metadata_from_text(label)['education'],'verifiedForMatching':False})
    return result
def fetch(url,limit):
    validate_outbound_dns(url,'osym')
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    with build_opener(NoRedirect).open(Request(url,headers={'User-Agent':'KadroRadar operator document review','Accept':'text/html,application/pdf'}),timeout=30) as response:
        content=response.read(limit+1)
        if len(content)>limit:raise ValueError('SOURCE_SIZE_LIMIT')
        return content
def discover(html,base):
    result=[];seen=set()
    for url,label in observed_links(html,base):
        value=urlsplit(url);suffix=Path(value.path).suffix.lower()
        if value.hostname!='dokuman.osym.gov.tr' or value.scheme!='https' or value.username or value.password or value.port not in (None,443) or suffix not in ('.pdf','.xlsx','.xls','.html','.htm'):continue
        if 'puanlar' not in normalized(label) or url in seen:continue
        seen.add(url);result.append({'url':url,'label':label,'format':suffix[1:],**metadata_from_text(label)})
    return result

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--index',required=True);parser.add_argument('--archive',action='store_true');parser.add_argument('--archive-source');parser.add_argument('--qualifications',action='store_true');parser.add_argument('--document');parser.add_argument('--output',type=Path);args=parser.parse_args()
    index_url(args.index);raw=fetch(args.index,2_000_000);html=raw.decode('utf-8-sig')
    if args.archive:
        if args.document:raise ValueError('Archive mode never downloads documents')
        return {'periods':discover_archive(html,args.index),'indexUrl':args.index,'indexSha256':hashlib.sha256(raw).hexdigest()}
    if args.qualifications:return {'links':discover_qualifications(html,args.index),'indexUrl':args.index,'verifiedForMatching':False}
    links=discover(html,args.index);evidence=None
    if args.document:
        selected=next((link for link in links if link['url']==args.document),None)
        if not args.output or not selected or not selected['education'] or not selected['year']:raise ValueError('Document must have period/education and be observed on supplied official index')
        content=fetch(args.document,64*1024*1024)
        from import_historical import document_metadata
        args.output.write_bytes(content)
        actual=document_metadata(args.output)
        if any(actual[key]!=selected[key] for key in ('year','round','education')):
            args.output.unlink(missing_ok=True);raise ValueError('Document header disagrees with official link label')
        evidence={'indexUrl':args.index,'indexSha256':hashlib.sha256(raw).hexdigest(),'documentUrl':args.document,'documentSha256':hashlib.sha256(content).hexdigest(),'retrievedAt':datetime.now(timezone.utc).isoformat(),'publishedAt':published_date(re.sub('<[^>]+>',' ',html)),**selected}
        if args.archive_source:
            index_url(args.archive_source);archive=fetch(args.archive_source,2_000_000)
            observed=next((item for item in discover_archive(archive.decode('utf-8-sig'),args.archive_source) if item['indexUrl']==args.index),None)
            if not observed or any(observed[key]!=actual[key] for key in ('year','round')):raise ValueError('Index period not observed on archive')
            evidence.update(archiveUrl=args.archive_source,archiveSha256=hashlib.sha256(archive).hexdigest(),publishedAt=observed['publishedAt'])
    return {'links':links,'downloaded':bool(args.document),'evidence':evidence}

if __name__=='__main__':
    try:print(json.dumps(main(),ensure_ascii=True))
    except Exception as error:
        print(json.dumps({'status':error_class(error),'error':str(error)},ensure_ascii=True));raise SystemExit(1)
