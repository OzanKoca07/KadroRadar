import argparse, json, re, hashlib, os
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from pathlib import Path
from decimal import Decimal
import fitz
import unicodedata

def document_metadata(path):
    if Path(path).read_bytes()[:5]!=b'%PDF-':
        from historical_tables import table_metadata
        return table_metadata(path)
    with fitz.open(str(path)) as doc:
        if doc.needs_pass or not 1<=len(doc)<=600:raise ValueError('PDF resource limit')
        text=doc[0].get_text().replace('\u00a0',' ').replace('\u00ad','-')
        normalized=text.replace('İ','i').replace('ı','i').lower()
        period=re.search(r'kpss\s*[-–]\s*(20\d{2})\s*/\s*(\d+)',normalized)
        education='ASSOCIATE' if re.search(r'ön\s*lisans',normalized) else 'HIGH_SCHOOL' if 'ortaöğretim' in normalized else 'BACHELOR' if 'lisans' in normalized else None
        if not period or not education:raise ValueError('Official KPSS period/education header required')
        return {'year':int(period[1]),'round':int(period[2]),'education':education,'pageCount':len(doc)}

def parse_pdf(path,education=None):
    if Path(path).stat().st_size>64*1024*1024:raise ValueError('PDF resource limit')
    actual=document_metadata(path)
    if education is not None and actual['education']!=education:raise ValueError('Education/source mismatch')
    doc=fitz.open(str(path))
    prefix={'BACHELOR':'3','ASSOCIATE':'2','HIGH_SCHOOL':'1'}[actual['education']]
    rows=[]; errors=[]
    for page_no,page in enumerate(doc,1):
        lines=[x.strip().replace('\u00a0',' ').replace('\u00ad','-') for x in page.get_text().splitlines() if x.strip()]
        starts=[i for i,x in enumerate(lines) if re.fullmatch(r'[123]\d{8}',x)]
        for j,start in enumerate(starts):
            part=lines[start:starts[j+1] if j+1<len(starts) else len(lines)]
            try:
                if not part[0].startswith(prefix):raise ValueError('Education/code prefix mismatch')
                k=next(i for i,x in enumerate(part) if re.fullmatch(r'\d{1,3}[,.]\d{5}(?: +\d{1,3}[,.]\d{5})?|[-–—]{1,2}(?: +[-–—]{1,2})?',x))
                quota,placed,vacant=map(int,part[k-3:k])
                scores=part[k].split()
                if len(scores)==1:scores.append(part[k+1])
                if placed==0 and all(re.fullmatch(r'[-–—]{1,2}',x) for x in scores):low=high=None
                else:
                    if not all(re.fullmatch(r'\d{1,3}[,.]\d{5}',x) for x in scores):raise ValueError('Two exact five-decimal score cells required')
                    low,high=[Decimal(x.replace(',','.')) for x in scores]
                if placed==0 and low==0 and high==0: low=high=None
                if not quota>=placed>=0 or vacant!=quota-placed:raise ValueError('Quota integrity failure')
                if not ((placed==0 and low is None) or (placed>0 and low is not None and high is not None and 0<low<=high<=100)):raise ValueError('Score/count integrity failure')
                institution=part[1];title=' '.join(part[2:k-3])
                if not institution or not title:raise ValueError('Missing institution/title')
                if any('\ufffd' in x for x in (institution,title)):raise ValueError('Unrecoverable source encoding; manual review required')
                institution=unicodedata.normalize('NFC',institution);title=unicodedata.normalize('NFC',title)
                rows.append(dict(positionCode=part[0],institutionRawName=institution,title=title,city=institution.split(' / ')[1] if ' / ' in institution else '',quota=quota,placedCount=placed,vacantCount=vacant,minScore=format(low,'.5f') if low is not None else None,maxScore=format(high,'.5f') if high is not None else None,sourcePage=page_no,rawRecord=part))
            except (ValueError,AssertionError,StopIteration,IndexError) as e:
                errors.append(dict(code=part[0],page=page_no,raw=part,error=str(e)))
    if len(set(x['positionCode'] for x in rows))!=len(rows):errors.append({'error':'Duplicate codes'})
    doc.close()
    if not rows:errors.append({'error':'No supported placement rows'})
    return rows,errors

def parse_document(path,education=None):
    if Path(path).stat().st_size>64*1024*1024:raise ValueError('Document resource limit')
    if Path(path).read_bytes()[:5]==b'%PDF-':return parse_pdf(path,education)
    from historical_tables import parse_table
    return parse_table(path,education)

def postgres_connection_string():
    """Translate Prisma's schema query option into a libpq-compatible DSN."""
    url = os.environ.get('DATABASE_URL', '').strip()
    if not url:
        # libpq supports PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT.
        return None
    parts = urlsplit(url)
    if parts.scheme not in ('postgresql', 'postgres'):
        raise ValueError('DATABASE_URL must be a PostgreSQL URL')
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    schema = query.pop('schema', None)
    if schema and schema != 'public':
        raise ValueError('Importer currently supports only the public PostgreSQL schema')
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

def commit(rows,errors,path,year,round_no,education):
    if errors: raise ValueError('Unresolved rows: import blocked')
    actual=document_metadata(path)
    if (actual['year'],actual['round'],actual['education'])!=(year,round_no,education):raise ValueError('Period/education mismatch')
    import psycopg
    from uuid import uuid4
    sha=hashlib.sha256(Path(path).read_bytes()).hexdigest()
    with psycopg.connect(postgres_connection_string() or "") as conn:
        with conn.cursor() as c:
            c.execute('SELECT pg_advisory_xact_lock(hashtext(%s))',('historical:'+sha,))
            c.execute('SELECT "id" FROM "ImportBatch" WHERE "sourceSha256"=%s ORDER BY "createdAt" LIMIT 1',(sha,))
            previous=c.fetchone()
            if previous:return previous[0]
            c.execute('INSERT INTO "SourceDocument" ("id","originalFilename","sha256","sourceOrganization") VALUES (%s,%s,%s,%s) ON CONFLICT ("sha256") DO UPDATE SET "sha256"=EXCLUDED."sha256" RETURNING "id"',(str(uuid4()),Path(path).name,sha,'ÖSYM'))
            source=c.fetchone()[0]
            c.execute('INSERT INTO "PlacementRound" ("id","year","sequenceNo","educationLevel") VALUES (%s,%s,%s,%s) ON CONFLICT ("year","sequenceNo","educationLevel") DO UPDATE SET "year"=EXCLUDED."year" RETURNING "id"',(str(uuid4()),year,round_no,education))
            round_id=c.fetchone()[0]
            batch=str(uuid4())
            c.execute('INSERT INTO "ImportBatch" ("id","sourceSha256","rowCount","errorCount") VALUES (%s,%s,%s,%s)',(batch,sha,len(rows),0))
            for r in rows:
                c.execute('SELECT 1 FROM "HistoricalPlacement" WHERE "roundId"=%s AND "positionCode"=%s',(round_id,r['positionCode']))
                if c.fetchone():raise ValueError('Existing placement conflict; manual reconciliation required')
                c.execute('INSERT INTO "ImportRow" ("id","batchId","positionCode","raw","issues","sourcePage") VALUES (%s,%s,%s,%s::jsonb,%s::jsonb,%s)',(str(uuid4()),batch,r['positionCode'],json.dumps(r,ensure_ascii=False),'[]',r['sourcePage']))
                c.execute('INSERT INTO "HistoricalPlacement" ("id","roundId","sourceDocumentId","positionCode","institutionRawName","title","city","quota","placedCount","vacantCount","minScore","maxScore","sourcePage","rawRecord") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb) ON CONFLICT ("roundId","positionCode") DO NOTHING',(str(uuid4()),round_id,source,r['positionCode'],r['institutionRawName'],r['title'],r['city'],r['quota'],r['placedCount'],r['vacantCount'],r['minScore'],r['maxScore'],r['sourcePage'],json.dumps(r['rawRecord'],ensure_ascii=False)))
    return batch

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--file',required=True);p.add_argument('--year',type=int,default=2024);p.add_argument('--round',type=int,default=1);p.add_argument('--education',choices=['BACHELOR','ASSOCIATE','HIGH_SCHOOL'])
    g=p.add_mutually_exclusive_group(required=True);g.add_argument('--dry-run',action='store_true');g.add_argument('--commit',action='store_true');g.add_argument('--parse-json',action='store_true')
    a=p.parse_args();rows,errors=parse_document(a.file)
    if a.parse_json:print(json.dumps({'rows':rows,'errors':errors,'metadata':document_metadata(a.file)},ensure_ascii=True));raise SystemExit(0)
    print(json.dumps({'parsed':len(rows),'unresolved':len(errors),'issues':errors[:10]},ensure_ascii=False))
    if a.dry_run:Path('historical-staging.json').write_text(json.dumps({'rows':rows,'errors':errors},ensure_ascii=False,indent=2))
    else:print('STAGED (not approved):',commit(rows,errors,a.file,a.year,a.round,a.education or document_metadata(a.file)['education']))
