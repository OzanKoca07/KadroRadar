"""HTML-first collection for disposable runners. No source bytes survive collect()."""
import hashlib
import io
import json
import os
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlsplit
from gazette_download import (request,permission,robots_allowed,validate_url,archive_url,
                             DownloadError,REGISTRY,MAX_BYTES)
from official_gazette import decode_official_html,index_manifest,parse_notice_html,parse_pdf

PARSER_VERSION='gazette-ephemeral-1'
RAM_BYTES=4*1024*1024


class TransientBody:
    """Bounded RAM -> one private temporary file, including cleanup on errors."""
    def __init__(self,directory,ram_bytes=RAM_BYTES,maximum=MAX_BYTES):
        if not 0<=ram_bytes<=RAM_BYTES or not 1<=maximum<=MAX_BYTES:raise ValueError('BODY_LIMIT')
        self.directory=Path(directory);self.ram_bytes=ram_bytes;self.maximum=maximum
        self.memory=io.BytesIO();self.file=None;self.path=None;self.size=0;self.hash=hashlib.sha256()
    def write(self,chunk):
        if self.size+len(chunk)>self.maximum:raise DownloadError('SIZE_LIMIT','HTTP_BODY')
        if self.file is None and self.size+len(chunk)>self.ram_bytes:
            if shutil.disk_usage(self.directory).free<self.maximum+16*1024*1024:raise DownloadError('TEMP_SPACE_LIMIT','TEMP')
            fd,name=tempfile.mkstemp(prefix='gazette-',suffix='.pdf',dir=self.directory)
            self.path=Path(name);self.file=os.fdopen(fd,'wb');self.file.write(self.memory.getbuffer());self.memory.close()
        (self.file if self.file else self.memory).write(chunk)
        self.size+=len(chunk);self.hash.update(chunk)
    def parse(self,url):
        if self.file:self.file.close();self.file=None;return parse_pdf(self.path,source_url=url)
        return parse_pdf(self.memory.getvalue(),source_url=url)
    def close(self):
        if self.file:self.file.close();self.file=None
        if self.path:self.path.unlink(missing_ok=True)
        self.memory.close()
    def __enter__(self):return self
    def __exit__(self,*_):self.close()


def usable_html(parsed):
    candidates=parsed.get('candidates',[])
    harmless={'HTML_SOURCE_REVIEW_REQUIRED','POSITION_COVERAGE_REQUIRES_REVIEW'}
    return bool(candidates) and all(c.get('organization') and c.get('positions') and
        (c.get('sourceEvidence',{}).get('applicationDates') or {}).get('calendarVerified') and
        not (set(c.get('issues',[]))-harmless) for c in candidates)


def collect_ephemeral(day,previous=None,source=None,scheduled=False,fetch=request,ram_bytes=RAM_BYTES):
    source=source or REGISTRY['gazette'];permission(source,scheduled)
    index_url=archive_url(day);validate_url(index_url)
    previous=previous or {};known=previous.get('documents',{})
    if not isinstance(known,dict) or len(known)>512:raise DownloadError('CACHE_METADATA_INVALID','STATE')
    robots=robots_allowed(index_url,fetch);indexes=[];results=[];unchanged=[];receipts={};issues=[];missing=[]
    metrics={'downloadBytes':0,'pdfDownloads':0,'htmlDownloads':0,'notModified':0,'ramDocuments':0,'tempDocuments':0,'persistentDocumentBytes':0}
    # TemporaryDirectory owns every spill. A failed parser/request cannot leave a PDF.
    with tempfile.TemporaryDirectory(prefix='kadroradar-gazette-') as directory:
        def get(url,html=False):
            validate_url(url);robots_allowed(url,fetch,robots)
            old=known.get(url,{})
            valid=old.get('url')==url and re.fullmatch('[a-f0-9]{64}',old.get('sha256','')) and old.get('parserVersion')==PARSER_VERSION
            conditional=old if valid and not previous.get('forceReparse') and (old.get('manifest') if html else old.get('parseStatus')=='PARSED') else None
            if html:
                value=fetch(url,2_000_000,conditional)
                if value['notModified']:
                    if not conditional:raise DownloadError('UNEXPECTED_304','STATE')
                    metrics['notModified']+=1;return old,None
                body=value['body'];digest=hashlib.sha256(body).hexdigest();metrics['downloadBytes']+=len(body);metrics['htmlDownloads']+=1
                text,_=decode_official_html(body);manifest=index_manifest(text,url)
                record={'url':url,'sha256':digest,'etag':value.get('etag'),'lastModified':value.get('lastModified'),'parserVersion':PARSER_VERSION,'manifest':manifest}
                receipts[url]=record;return record,body
            with TransientBody(directory,ram_bytes) as sink:
                # One request, no in-run PDF retry. A later due run can retry.
                value=fetch(url,MAX_BYTES,conditional,sink=sink)
                if value['notModified']:
                    if not conditional:raise DownloadError('UNEXPECTED_304','STATE')
                    metrics['notModified']+=1;unchanged.append({'url':url,'sha256':old['sha256'],'parsedAgain':False});return old,None
                if 'body' in value:sink.write(value['body']) # injected fixture transport only
                metrics['downloadBytes']+=sink.size;metrics['pdfDownloads']+=1
                metrics['tempDocuments' if sink.path else 'ramDocuments']+=1
                parsed=sink.parse(url);digest=sink.hash.hexdigest()
                if parsed['sha256']!=digest:raise DownloadError('DOCUMENT_HASH_MISMATCH','PARSE')
                record={'url':url,'sha256':digest,'etag':value.get('etag'),'lastModified':value.get('lastModified'),'parserVersion':PARSER_VERSION,'parseStatus':'PARSED'}
                receipts[url]=record;return record,parsed
        def index(url):
            rec,body=get(url,True);manifest=rec['manifest']
            if manifest.get('gazetteDate') not in (None,day):raise DownloadError('INDEX_DATE_MISMATCH','PARSE')
            indexes.append({'url':url,'sha256':rec['sha256'],'manifest':manifest});return manifest,body
        root,root_body=index(index_url);links=list(root['links']);active_url=index_url;active_body=root_body
        section=next((l for l in links if l.get('section')=='MISCELLANEOUS' and l['format']=='html' and l.get('observedDate')==day),None)
        if section:
            manifest,active_body=index(section['url']);active_url=section['url'];links=list(manifest['links'])
        # Only observed dated URLs. Pair HTML and PDF mirrors only when both links exist.
        targets=[];seen=set()
        for link in links:
            url=link['url']
            if url in seen or any(i['url']==url for i in indexes) or link.get('observedDate')!=day or link['format'] not in ('html','pdf'):continue
            try:validate_url(url)
            except DownloadError:issues.append('UNAPPROVED_LINK_REVIEW');continue
            seen.add(url);targets.append(link)
        plans=[];used=set()
        for link in sorted(targets,key=lambda l:l['format']=='pdf'):
            if link['url'] in used:continue
            stem=urlsplit(link['url']).path.rsplit('.',1)[0]
            mirror=next((l for l in targets if l['format']=='pdf' and urlsplit(l['url']).path.rsplit('.',1)[0]==stem),None) if link['format']=='html' else None
            plans.append((link,mirror));used.add(link['url'])
            if mirror:used.add(mirror['url'])
        if not plans:
            rec=receipts.get(active_url) or known.get(active_url,{})
            if active_body is None and rec.get('embeddedNotice') and rec.get('parseStatus')=='PARSED':
                unchanged.append({'url':active_url,'sha256':rec['sha256'],'parsedAgain':False})
            elif active_body is not None:
                embedded=parse_notice_html(active_body,active_url)
                if not usable_html(embedded):raise DownloadError('INDEX_CONTENT_REVIEW','PARSE')
                receipts[active_url]={**rec,'parseStatus':'PARSED','embeddedNotice':True}
                results.append({'url':active_url,'sha256':rec['sha256'],'format':'html','parsed':embedded,'notModified':False})
            else:raise DownloadError('INDEX_CONTENT_REVIEW','PARSE')
        cursors=previous.get('documentCursors',{});cursor=cursors.get(day,0)
        if not isinstance(cursor,int) or isinstance(cursor,bool) or cursor<0 or cursor>len(plans):raise DownloadError('CACHE_METADATA_INVALID','STATE')
        selected=plans[cursor:cursor+2];next_cursor=cursor+len(selected)
        for link,mirror in selected:
            url=link['url'];fmt=link['format'];discovery=None
            try:
                if fmt=='html':
                    rec,body=get(url,True)
                    if body is None:
                        # Only a prior successfully committed HTML parse may skip.
                        if rec.get('parseStatus')=='PARSED':unchanged.append({'url':url,'sha256':rec['sha256'],'parsedAgain':False});continue
                        # Index-only HTML may still lead to an observed PDF; never claim a parse.
                        parsed=None
                    else:parsed=parse_notice_html(body,url)
                    if not parsed or not usable_html(parsed):
                        if mirror:rec,parsed=get(mirror['url']);url=mirror['url'];fmt='pdf'
                        else:
                            children=[l for l in rec['manifest']['links'] if l['format']=='pdf' and l.get('observedDate')==day]
                            if len(children)==1:
                                discovery={'parentUrl':url,'parentSha256':rec['sha256'],'links':rec['manifest']['links']}
                                rec,parsed=get(children[0]['url']);url=children[0]['url'];fmt='pdf'
                            elif parsed and parsed['candidates']:issues.append('HTML_INCOMPLETE_REVIEW')
                            else:issues.append('HTML_INDEX_ONLY_REVIEW');continue
                else:rec,parsed=get(url)
            except DownloadError as error:
                if error.http_status==404 and url in previous.get('snapshot',{}).get('documents',{}):missing.append({'url':url,'httpStatus':404});issues.append('DOCUMENT_MISSING_REVIEW');continue
                raise
            if parsed is None:continue # confirmed304; no source bytes, no reparse claim
            if parsed.get('gazetteDate') not in (None,day):raise DownloadError('DOCUMENT_DATE_MISMATCH','PARSE')
            # Retain only small evidence, never bytes/cache paths. Incomplete HTML is refetched.
            if fmt=='html' and usable_html(parsed):receipts[url]['parseStatus']='PARSED'
            results.append({'url':url,'sha256':rec['sha256'],'format':fmt,'parsed':parsed,'notModified':False,**({'discovery':discovery} if discovery else {})})
    if next_cursor<len(plans):issues.append('DOCUMENT_BUDGET_REVIEW')
    transport={**previous,'forceReparse':False,'documents':{**known,**receipts},'documentCursors':{**dict(list(cursors.items())[-4:]),day:next_cursor if next_cursor<len(plans) else 0},'pendingDocumentDate':day if next_cursor<len(plans) else None}
    # Bound validators to this and the previous six publication days; DB audit remains.
    from datetime import date,timedelta
    cutoff=(date.fromisoformat(day)-timedelta(days=6)).strftime('%Y%m%d')
    transport['documents']={u:r for u,r in transport['documents'].items() if (re.search(r'/(20\d{6})(?:[-_]\d+)*\.',u) and re.search(r'/(20\d{6})(?:[-_]\d+)*\.',u)[1]>=cutoff)}
    if len(transport['documents'])>512:raise DownloadError('STATE_BUDGET_REVIEW','STATE')
    return {'sourceId':'gazette','date':day,'indexes':indexes,'documents':results,'unchangedDocuments':unchanged,'issues':issues,'complete':False,
            'coverageMode':'HTML_FIRST_BOUNDED_NOTICES','missingDocuments':missing,'networkProvenance':'LIVE_HTTPS' if fetch is request else 'MOCK_TRANSPORT',
            'documentSha256':indexes[0]['sha256'],'transport':transport,'metrics':metrics,'downloaded':bool(metrics['downloadBytes']), 'autoPublished':False}


def main():
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--date',required=True);p.add_argument('--state',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--authorization',type=Path);args=p.parse_args()
    try:
        if os.name=='posix':
            import resource
            resource.setrlimit(resource.RLIMIT_AS,(1024**3,1024**3));resource.setrlimit(resource.RLIMIT_CPU,(90,90))
        report=collect_ephemeral(args.date,json.loads(args.state.read_text(encoding='utf-8')),json.loads(args.authorization.read_text(encoding='utf-8')) if args.authorization else None,scheduled=True)
        args.output.write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8');args.output.chmod(0o600)
        print(json.dumps({'status':'OK',**report['metrics'],'documents':len(report['documents'])}));return 0
    except Exception as error:
        code=error.code if isinstance(error,DownloadError) else str(error) if str(error) in ('SOURCE_REVIEW_REQUIRED','SOURCE_LICENSE_INVALID','SOURCE_OPERATOR_DISABLED','GAZETTE_DOCUMENT_SCOPE_REQUIRED') else 'PARSE_OR_VALIDATION'
        print(json.dumps({'status':'FAIL','code':code,'phase':error.phase if isinstance(error,DownloadError) else 'POLICY_OR_PARSE'}));return 1

if __name__=='__main__':raise SystemExit(main())
