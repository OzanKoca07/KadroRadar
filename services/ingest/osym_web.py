"""Operator-triggered public ÖSYM document retrieval; no scheduler or guessed URLs."""
import argparse,json,re
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit
from urllib.request import Request,build_opener,HTTPRedirectHandler
from official_rss import validate_outbound_dns
def fetch(url,limit):
    validate_outbound_dns(url,'osym')
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    with build_opener(NoRedirect).open(Request(url,headers={'User-Agent':'KadroRadar operator document review','Accept':'text/html,application/pdf'}),timeout=15) as response:
        content=response.read(limit+1)
        if len(content)>limit:raise ValueError('SOURCE_SIZE_LIMIT')
        return content
def discover(html,base):
    class Links(HTMLParser):
        def __init__(self):super().__init__();self.href=None;self.label='';self.results=[]
        def handle_starttag(self,tag,attrs):
            if tag=='a':self.href=dict(attrs).get('href');self.label=''
        def handle_data(self,data):
            if self.href:self.label+=data
        def handle_endtag(self,tag):
            if tag=='a' and self.href:
                url=urljoin(base,self.href)
                if urlsplit(url).hostname=='dokuman.osym.gov.tr' and urlsplit(url).scheme=='https' and urlsplit(url).path.lower().endswith('.pdf') and re.search('puanlar',self.label,re.I):self.results.append({'url':url,'label':self.label.strip()})
                self.href=None
    parser=Links();parser.feed(html);return parser.results
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--index',required=True);parser.add_argument('--document');parser.add_argument('--output',type=Path);args=parser.parse_args()
    if urlsplit(args.index).hostname!='www.osym.gov.tr':raise ValueError('Official ÖSYM index required')
    links=discover(fetch(args.index,2_000_000).decode('utf-8'),args.index)
    if args.document:
        if not args.output or args.document not in [link['url'] for link in links]:raise ValueError('Document must be observed on supplied official index')
        content=fetch(args.document,64*1024*1024)
        if not content.startswith(b'%PDF-'):raise ValueError('PDF required')
        args.output.write_bytes(content)
    print(json.dumps({'links':links,'downloaded':bool(args.document)},ensure_ascii=True))
