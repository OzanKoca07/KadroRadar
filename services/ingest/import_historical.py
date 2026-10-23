import argparse, json, re, hashlib, os
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from pathlib import Path
from decimal import Decimal
import fitz

def parse_pdf(path):
    doc=fitz.open(str(path))
    rows=[]; errors=[]
    for page_no,page in enumerate(doc,1):
        lines=[x.strip() for x in page.get_text().splitlines() if x.strip()]
        starts=[i for i,x in enumerate(lines) if re.fullmatch(r'30\d{7}',x)]
        for j,start in enumerate(starts):
            part=lines[start:starts[j+1] if j+1<len(starts) else len(lines)]
            try:
                k=next(i for i,x in enumerate(part) if re.fullmatch(r'\d{1,3},\d{5} +\d{1,3},\d{5}',x))
                quota,placed,vacant=map(int,part[k-3:k])
                low,high=[Decimal(x.replace(',','.')) for x in part[k].split()]
                if placed==0 and low==0 and high==0: low=high=None
                assert quota>=placed>=0 and vacant==quota-placed
                assert (placed==0 and low is None) or (placed>0 and 0<low<=high<=100)
                institution=part[1];title=' '.join(part[2:k-3])
                assert institution and title
                rows.append(dict(positionCode=part[0],institutionRawName=institution,title=title,city=institution.split(' / ')[1] if ' / ' in institution else '',quota=quota,placedCount=placed,vacantCount=vacant,minScore=str(low) if low is not None else None,maxScore=str(high) if high is not None else None,sourcePage=page_no,rawRecord=part))
            except (ValueError,AssertionError,StopIteration,IndexError) as e:
                errors.append(dict(code=part[0],page=page_no,raw=part,error=str(e)))
    if len(set(x['positionCode'] for x in rows))!=len(rows):errors.append({'error':'Duplicate codes'})
    return rows,errors

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
    import psycopg
    from uuid import uuid4
    sha=hashlib.sha256(Path(path).read_bytes()).hexdigest()
    with psycopg.connect(postgres_connection_string() or "") as conn:
        with conn.cursor() as c:
            c.execute('INSERT INTO "SourceDocument" ("id","originalFilename","sha256","sourceOrganization") VALUES (%s,%s,%s,%s) ON CONFLICT ("sha256") DO UPDATE SET "sha256"=EXCLUDED."sha256" RETURNING "id"',(str(uuid4()),Path(path).name,sha,'ÖSYM'))
            source=c.fetchone()[0]
            c.execute('INSERT INTO "PlacementRound" ("id","year","sequenceNo","educationLevel") VALUES (%s,%s,%s,%s) ON CONFLICT ("year","sequenceNo","educationLevel") DO UPDATE SET "year"=EXCLUDED."year" RETURNING "id"',(str(uuid4()),year,round_no,education))
            round_id=c.fetchone()[0]
            batch=str(uuid4())
            c.execute('INSERT INTO "ImportBatch" ("id","sourceSha256","rowCount","errorCount") VALUES (%s,%s,%s,%s)',(batch,sha,len(rows),0))
            for r in rows:
                c.execute('INSERT INTO "ImportRow" ("id","batchId","positionCode","raw","issues","sourcePage") VALUES (%s,%s,%s,%s::jsonb,%s::jsonb,%s)',(str(uuid4()),batch,r['positionCode'],json.dumps(r,ensure_ascii=False),'[]',r['sourcePage']))
                c.execute('INSERT INTO "HistoricalPlacement" ("id","roundId","sourceDocumentId","positionCode","institutionRawName","title","city","quota","placedCount","vacantCount","minScore","maxScore","sourcePage","rawRecord") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb) ON CONFLICT ("roundId","positionCode") DO NOTHING',(str(uuid4()),round_id,source,r['positionCode'],r['institutionRawName'],r['title'],r['city'],r['quota'],r['placedCount'],r['vacantCount'],r['minScore'],r['maxScore'],r['sourcePage'],json.dumps(r['rawRecord'],ensure_ascii=False)))
    return batch

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--file',required=True);p.add_argument('--year',type=int,default=2024);p.add_argument('--round',type=int,default=1);p.add_argument('--education',default='BACHELOR')
    g=p.add_mutually_exclusive_group(required=True);g.add_argument('--dry-run',action='store_true');g.add_argument('--commit',action='store_true')
    a=p.parse_args();rows,errors=parse_pdf(a.file)
    print(json.dumps({'parsed':len(rows),'unresolved':len(errors),'issues':errors[:10]},ensure_ascii=False))
    if a.dry_run:Path('historical-staging.json').write_text(json.dumps({'rows':rows,'errors':errors},ensure_ascii=False,indent=2))
    else:print('STAGED (not approved):',commit(rows,errors,a.file,a.year,a.round,a.education))
