"""Offline, registry-bound adapters. No implicit network, scheduling or publication."""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from official_rss import REGISTRY, official_url, parse_feed_report
from official_gazette import decode_official_html, parse_notice_html, parse_pdf, index_manifest


class OfficialSourceAdapter:
    source_id = None
    capability = 'LINK_DISCOVERY_ONLY'

    def review(self, file, url):
        official_url(url, self.source_id)
        data = Path(file).read_bytes()
        if len(data) > 2_000_000: raise ValueError('SOURCE_SIZE_LIMIT')
        html, encoding = decode_official_html(data)
        class Links(HTMLParser):
            def __init__(self): super().__init__(); self.links=[]; self.current=None; self.hidden=0
            def handle_starttag(self, tag, attrs):
                if tag in ('script','style'): self.hidden+=1
                if not self.hidden and tag=='a': self.current={'href':dict(attrs).get('href',''),'title':''}
            def handle_data(self, value):
                if not self.hidden and self.current is not None: self.current['title']+=value
            def handle_endtag(self, tag):
                if tag in ('script','style'): self.hidden=max(0,self.hidden-1)
                if tag=='a' and self.current is not None: self.links.append(self.current); self.current=None
        parser=Links(); parser.feed(html)
        links=[]; seen=set()
        for link in parser.links:
            title=' '.join(link['title'].split())
            if not re.search(r'personel|işçi|memur|öğretim|araştırma görevlisi|uzman yardımc',title,re.I): continue
            if not link['href'] or link['href'].startswith('#'): continue
            target=urljoin(url,link['href'])
            try: official_url(target,self.source_id)
            except ValueError: continue
            if target in seen: continue
            seen.add(target)
            links.append({'title':title,'sourceUrl':target,'organization':None,'positions':[],
                          'verificationStatus':'REVIEW_REQUIRED','issues':['DETAIL_DOCUMENT_REQUIRED','INSTITUTION_NOT_VERIFIED'],
                          'applicationStartAt':None,'applicationEndAt':None,'publishable':False})
        return self.envelope(data,url,{'encoding':encoding,'links':links,'candidates':[],
                              'issues':['DISCOVERY_ONLY_NO_VERIFIED_NOTICE_FIELDS']})

    def envelope(self,data,url,parsed):
        source=REGISTRY[self.source_id]
        return {**parsed,'adapter':type(self).__name__,'sourceId':self.source_id,'sourceUrl':url,
                'sourceOrganization':source['organization'],'documentSha256':hashlib.sha256(data).hexdigest(),
                'mode':'OPERATOR_SUPPLIED_DOCUMENT','liveFetch':False,'automationEnabled':False,
                'automationPermission':source['automationPermission'],'republicationPermission':source['republicationPermission'],
                'indexingPolicy':source.get('indexingPolicy'),'contentUse':'FACTS_AND_OFFICIAL_LINKS_ONLY','fullDocumentPublication':'DISABLED',
                'verificationStatus':'REVIEW_REQUIRED','capability':self.capability}


class SbbPublicAnnouncementsAdapter(OfficialSourceAdapter): source_id='sbb'
class CareerGatewayAdapter(OfficialSourceAdapter): source_id='career'
class IskurPublicJobsAdapter(OfficialSourceAdapter): source_id='iskur'


class OfficialInstitutionRssAdapter(OfficialSourceAdapter):
    source_id='energy'
    capability='RSS_CANDIDATES'
    def review(self,file,url):
        official_url(url,self.source_id)
        if url != REGISTRY[self.source_id]['feed']: raise ValueError('REGISTERED_FEED_REQUIRED')
        data=Path(file).read_bytes()
        return self.envelope(data,url,parse_feed_report(data))


class OfficialGazetteAdapter(OfficialSourceAdapter):
    source_id='gazette'
    capability='PDF_HTML_NOTICES_AND_INDEX'
    def review(self,file,url):
        official_url(url,self.source_id)
        data=Path(file).read_bytes()
        if data.startswith(b'%PDF-'): parsed=parse_pdf(file,source_url=url)
        else:
            if len(data)>2_000_000: raise ValueError('HTML_SIZE_LIMIT')
            parsed=parse_notice_html(file,url)
            parsed['index']=index_manifest(decode_official_html(data)[0],url)
        return self.envelope(data,url,parsed)


ADAPTERS={adapter.source_id:adapter for adapter in [OfficialGazetteAdapter,SbbPublicAnnouncementsAdapter,
          CareerGatewayAdapter,IskurPublicJobsAdapter,OfficialInstitutionRssAdapter]}


def review_many(inputs):
    """A rejected document/source does not suppress other source results."""
    results=[]
    for item in inputs:
        try: results.append(ADAPTERS[item['sourceId']]().review(item['file'],item['sourceUrl']))
        except Exception as error: results.append({'sourceId':item.get('sourceId'),'status':'ERROR',
            'errorType':type(error).__name__,'verificationStatus':'REVIEW_REQUIRED','automationEnabled':False})
    return results


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',choices=list(ADAPTERS),required=True)
    parser.add_argument('--file',type=Path,required=True);parser.add_argument('--url',required=True);args=parser.parse_args()
    try: print(json.dumps(ADAPTERS[args.source]().review(args.file,args.url),ensure_ascii=True))
    except Exception as error:
        print(json.dumps({'status':'ERROR','errorType':type(error).__name__}));raise SystemExit(1)
