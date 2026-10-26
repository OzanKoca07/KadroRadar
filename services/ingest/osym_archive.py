"""Finite operator selection from observed ÖSYM archives. No scheduler/publication."""
import argparse,hashlib,json,time
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlsplit
from osym_web import fetch,discover,discover_archive,discover_qualifications,observed_links,metadata_from_text,normalized,index_url
from official_rss import classify_error
from import_historical import document_metadata,parse_document

def collect(archive_url,periods,destination,download=False,guides_archive=None):
    if not 1<=len(periods)<=8 or any(not __import__('re').fullmatch(r'20\d{2}/[12]',p) for p in periods):raise ValueError('Select 1-8 central placement periods explicitly')
    destination.mkdir(parents=True,exist_ok=True);cache=destination/'cache';cache.mkdir(exist_ok=True)
    def get(url,limit):
        key=hashlib.sha256(url.encode()).hexdigest();data=cache/(key+'.bin');meta=cache/(key+'.json')
        if data.exists() and meta.exists():
            info=json.loads(meta.read_text(encoding='utf-8'));content=data.read_bytes()
            if info['url']!=url or info['sha256']!=hashlib.sha256(content).hexdigest() or len(content)>limit:raise ValueError('Cached source integrity mismatch')
            return content,info
        content=fetch(url,limit);info={'url':url,'sha256':hashlib.sha256(content).hexdigest(),'retrievedAt':datetime.now(timezone.utc).isoformat()}
        data.write_bytes(content);meta.write_text(json.dumps(info),encoding='utf-8');time.sleep(1)
        return content,info
    index_url(archive_url);archive,archive_info=get(archive_url,2_000_000)
    found=discover_archive(archive.decode('utf-8-sig'),archive_url)
    catalog={'archiveUrl':archive_url,'archiveSha256':archive_info['sha256'],'discoveredPeriods':found,'documents':[],'qualifications':[],'failures':[],'mode':'OPERATOR_SELECTED_REAL_DOCUMENTS','productionTransferred':0}
    for period in periods:
        sources=[item for item in found if f"{item['year']}/{item['round']}"==period]
        if len(sources)!=1:
            catalog['failures'].append({'period':period,'status':'MISSING_OR_AMBIGUOUS_INDEX'});continue
        source=sources[0]
        try:html,info=get(source['indexUrl'],2_000_000);links=discover(html.decode('utf-8-sig'),source['indexUrl'])
        except Exception as error:catalog['failures'].append({'period':period,'status':classify_error(error)});continue
        for education in ('BACHELOR','ASSOCIATE','HIGH_SCHOOL'):
            matching=[link for link in links if (link['year'],link['round'],link['education'])==(source['year'],source['round'],education)]
            record={'period':period,'education':education,'year':source['year'],'round':source['round'],'indexUrl':source['indexUrl'],'indexSha256':info['sha256'],'publishedAt':source['publishedAt'],'productionTransferred':0,'qualificationCodesVerified':False}
            catalog['documents'].append(record)
            if len(matching)!=1:record['status']='MISSING_OR_AMBIGUOUS_DOCUMENT';continue
            record.update(matching[0]);record['documentUrl']=record['url'];record['status']='DISCOVERED'
            if not download:continue
            try:
                content,document=get(record['url'],64*1024*1024);sha=document['sha256'];path=destination/(sha+'.'+record['format']);path.write_bytes(content)
                actual=document_metadata(path)
                if any(actual[key]!=record[key] for key in ('year','round','education')):raise ValueError('Source label/document header mismatch')
                rows,errors=parse_document(path,education);record.update(documentSha256=sha,retrievedAt=document['retrievedAt'],file=str(path.resolve()),pageCount=actual['pageCount'],parsed=len(rows),errors=len(errors),status='PARSED' if not errors else 'REVIEW_REQUIRED')
                if errors:(destination/(sha+'-issues.json')).write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding='utf-8')
            except Exception as error:record.update(status=classify_error(error),error=str(error))
        (destination/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
    if guides_archive:
        try:
            index_url(guides_archive);guides,_=get(guides_archive,2_000_000)
            for url,label in observed_links(guides.decode('utf-8-sig'),guides_archive):
                meta=metadata_from_text(label);period=f"{meta['year']}/{meta['round']}"
                if period not in periods or 'bazı kamu kurum' not in normalized(label) or 'tercih kılavuzu ve tablolar' not in normalized(label):continue
                index_url(url)
                try:
                    page,guide_info=get(url,2_000_000)
                    for link in discover_qualifications(page.decode('utf-8-sig'),url):
                        qualification={**link,'period':period,'indexUrl':url,'indexSha256':guide_info['sha256'],'status':'DISCOVERED_NOT_POSITION_VERIFIED'}
                        catalog['qualifications'].append(qualification)
                        if download:
                            try:
                                document,details=get(link['url'],16*1024*1024)
                                if not document.startswith(b'%PDF-'):raise ValueError('Qualification source is not PDF')
                                file=destination/('qualification-'+details['sha256']+'.pdf');file.write_bytes(document)
                                qualification.update(sha256=details['sha256'],retrievedAt=details['retrievedAt'],file=str(file.resolve()),status='DOWNLOADED_NOT_POSITION_VERIFIED')
                            except Exception as error:qualification.update(status=classify_error(error))
                except Exception as error:catalog['failures'].append({'period':period,'guideUrl':url,'status':classify_error(error)})
        except Exception as error:catalog['failures'].append({'guideArchive':guides_archive,'status':classify_error(error)})
    (destination/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
    return catalog

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--archive',required=True);parser.add_argument('--period',action='append',required=True);parser.add_argument('--destination',type=Path,required=True);parser.add_argument('--download',action='store_true');parser.add_argument('--guides-archive');args=parser.parse_args()
    result=collect(args.archive,args.period,args.destination,args.download,args.guides_archive)
    print(json.dumps({'documents':result['documents'],'qualifications':result['qualifications'],'failures':result['failures'],'productionTransferred':0},ensure_ascii=True))
