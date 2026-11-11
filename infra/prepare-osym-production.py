"""Read-only source dry-run. No database connection; no publication."""
import argparse, hashlib, json, sys
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services/ingest'))
from import_historical import document_metadata,parse_document
from osym_web import discover,fetch

def digest(data):return hashlib.sha256(data).hexdigest()
def prepare(refresh=False,catalog_path=None):
    catalog_file=Path(catalog_path).resolve() if catalog_path else ROOT/'.local/osym-expansion/catalog.json'
    source=catalog_file.parent
    catalog=json.loads(catalog_file.read_text(encoding='utf-8'))
    cache=source/'cache'
    documents=[dict(d) for d in catalog['documents'] if d['status']=='PARSED' and (d['year'],d['round'])!=(2024,1)]
    index=next(p for p in catalog['discoveredPeriods'] if (p['year'],p['round'])==(2024,1))
    index_file=cache/(digest(index['indexUrl'].encode())+'.bin')
    if not index_file.exists():raise ValueError('Observed 2024/1 index cache missing; fetch the official observed index first')
    links=discover(index_file.read_text(encoding='utf-8-sig'),index['indexUrl'])
    for education,local,expected in [('BACHELOR','reference/minmaxlisans29072024.pdf',504),('ASSOCIATE','.local/osym/minmaxonl29072024.pdf',346),('HIGH_SCHOOL','.local/osym/minmaxort29072024.pdf',69)]:
        link=next(d for d in links if d['education']==education)
        existing=next((d for d in catalog['documents'] if (d['year'],d['round'],d['education'])==(2024,1,education) and d['status']=='PARSED'),None)
        local_file=Path(existing['file']) if existing else ROOT/local
        data=local_file.read_bytes()
        live=False
        if refresh:
            actual=None
            for attempt in range(2):
                try:actual=fetch(link['url'],64*1024*1024);break
                except (TimeoutError,OSError):
                    if attempt:raise
            if digest(actual)!=digest(data):raise ValueError('Live 2024/1 bytes differ; no import: '+education)
            key=digest(link['url'].encode());(cache/(key+'.bin')).write_bytes(actual);(cache/(key+'.json')).write_text(json.dumps({'url':link['url'],'sha256':digest(actual)}))
            live=True
        else:
            key=digest(link['url'].encode());saved=cache/(key+'.bin')
            if not saved.exists() or digest(saved.read_bytes())!=digest(data):raise ValueError('2024/1 official download verification required: use --refresh-2024')
        documents.append({**link,'period':'2024/1','documentUrl':link['url'],'documentSha256':digest(data),'file':str(local_file.resolve()),'indexUrl':index['indexUrl'],'indexSha256':digest(index_file.read_bytes()),'publishedAt':index['publishedAt'],'parsed':expected,'sourceMode':'LIVE_MATCH' if live else 'VERIFIED_REAL_CACHE'})
    reports=[]
    for d in documents:
        data=Path(d['file']).read_bytes()
        if digest(data)!=d['documentSha256']:raise ValueError('Source SHA mismatch')
        index_data=(cache/(digest(d['indexUrl'].encode())+'.bin')).read_bytes()
        if digest(index_data)!=d['indexSha256']:raise ValueError('Index SHA mismatch')
        observed=discover(index_data.decode('utf-8-sig'),d['indexUrl'])
        if not any(link['url']==d['documentUrl'] and all(link[k]==d[k] for k in ('year','round','education')) for link in observed):raise ValueError('Document not observed on official index')
        m=document_metadata(d['file']);rows,errors=parse_document(d['file'],d['education'])
        if errors or len(rows)!=d['parsed'] or any(m[k]!=d[k] for k in ('year','round','education')):raise ValueError('Unresolved count/metadata error')
        d.update(rows=rows,errors=0,unknownScores=sum(r['minScore'] is None for r in rows),unknownCities=sum(not r['city'] for r in rows),qualificationCodesVerified=False)
        reports.append({k:d[k] for k in ('period','year','round','education','documentUrl','documentSha256','indexUrl','indexSha256','publishedAt','parsed','errors','unknownScores','unknownCities','qualificationCodesVerified')})
    if len(documents)!=21 or len({(d['year'],d['round'],d['education']) for d in documents})!=21:raise ValueError('21 independent sources required')
    documents.sort(key=lambda d:(0 if (d['year'],d['round'],d['education'])==(2024,1,'BACHELOR') else 1,d['year'],d['round'],d['education']))
    target=ROOT/'.local/osym-production';target.mkdir(parents=True,exist_ok=True)
    payload={'preparedAt':datetime.now(timezone.utc).isoformat(),'documents':documents,'databaseWrites':0}
    (target/'verified-sources.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    public={'preparedAt':payload['preparedAt'],'documents':reports,'expectedTotal':sum(d['parsed'] for d in documents),'levels':{e:sum(d['parsed'] for d in documents if d['education']==e) for e in ('BACHELOR','ASSOCIATE','HIGH_SCHOOL')},'previous8196Excluded2024AssociateAndSecondary':True,'productionTransferred':0}
    (ROOT/'packages/osym-production-sources.json').write_text(json.dumps(public,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in public.items() if k!='documents'}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh-2024',action='store_true');parser.add_argument('--catalog');args=parser.parse_args();prepare(args.refresh_2024,args.catalog)
