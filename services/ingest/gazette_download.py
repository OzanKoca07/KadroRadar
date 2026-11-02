"""Bounded Gazette document downloader. Disabled by registry policy by default.

Private bytes/cache and review candidates only; never publication or DB access.
The worker supplies committed transport metadata and commits new validators only
after successful staging. A CLI pilot does not bypass the source permission gate.
"""
import argparse
import hashlib
import http.client
import io
import ipaddress
import json
import queue
import re
import socket
import ssl
import threading
import time
import os
import tempfile
import urllib.robotparser
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
from official_rss import REGISTRY
from official_gazette import MAX_BYTES, decode_official_html, index_manifest, parse_notice_html, parse_pdf
from source_rights import require_network_permission

HOST = 'www.resmigazete.gov.tr'
ROOT = 'https://' + HOST + '/'
DOCUMENT_SCOPE = 'AUTOMATED_GAZETTE_DOCUMENT_ACCESS'
USER_AGENT = 'KadroRadar/0.1 (official Gazette review downloader)'


class DownloadError(Exception):
    def __init__(self, code, phase, http_status=None, timings=None):
        super().__init__(code)
        self.code, self.phase, self.http_status = code, phase, http_status
        self.timings = timings or {}


def validate_url(url, robots=False):
    try:
        u = urlsplit(url)
        if (u.scheme != 'https' or u.hostname != HOST or u.username or u.password or
                u.port not in (None, 443) or u.query or u.fragment or '\\' in url or '%' in u.path or
                any(ord(c) < 33 or ord(c) > 126 for c in url)):
            raise ValueError()
        pattern = r'/(?:eskiler|ilanlar/eskiilanlar)/(20\d{2})/(\d{2})/(20\d{6})(?:[-_]\d+)*\.(?:pdf|html?)'
        match = re.fullmatch(pattern, u.path, re.I)
        if robots and u.path == '/robots.txt':
            return u
        if not match:
            raise ValueError()
        stamp = date.fromisoformat(match[3][:4]+'-'+match[3][4:6]+'-'+match[3][6:8])
        if stamp.year != int(match[1]) or stamp.month != int(match[2]):
            raise ValueError()
        return u
    except (ValueError, TypeError, AttributeError):
        raise DownloadError('UNAPPROVED_GAZETTE_URL', 'URL') from None


def archive_url(day):
    stamp = date.fromisoformat(day)
    return ROOT + stamp.strftime('eskiler/%Y/%m/%Y%m%d.htm')


def permission(source, scheduled):
    # Preserve the existing rights/indexing gate. The additional scope must
    # explicitly cover documents, not only the root feed metadata.
    require_network_permission(source, ROOT, require_enabled=scheduled)
    if DOCUMENT_SCOPE not in source['rightsAssessment']['evidence']['scopes']:
        raise ValueError('GAZETTE_DOCUMENT_SCOPE_REQUIRED')


def public_addresses(host, timeout):
    result = queue.Queue(maxsize=1)
    def resolve():
        try:
            result.put((socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM), None))
        except Exception as error:
            result.put((None, error))
    threading.Thread(target=resolve, daemon=True).start()
    try:
        addresses, error = result.get(timeout=max(.01, timeout))
    except queue.Empty:
        raise DownloadError('TIMEOUT', 'DNS') from None
    if error:
        raise DownloadError('DNS_ERROR', 'DNS') from None
    if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
        raise DownloadError('NON_PUBLIC_DNS', 'DNS')
    return addresses


def safe_header(value):
    return value if isinstance(value, str) and len(value) <= 1024 and all(32 <= ord(c) < 127 for c in value) else None


class DeadlineSocket:
    """Recompute the total deadline for every receive, including header lines."""
    def __init__(self,sock,remaining):self.sock,self.remaining=sock,remaining
    def makefile(self,mode):
        sock,remaining=self.sock,self.remaining
        class Reader(io.RawIOBase):
            def readable(self):return True
            def readinto(self,buffer):sock.settimeout(remaining());return sock.recv_into(buffer)
        return io.BufferedReader(Reader())


def request(url, maximum, previous=None, timeout=18, robots=False):
    u = validate_url(url, robots)
    began, phase, timings, connection, response = time.monotonic(), 'DNS', {}, None, None
    def remaining():
        value = timeout-(time.monotonic()-began)
        if value <= 0:
            raise DownloadError('TIMEOUT', phase, timings=timings)
        return value
    def completed(name, at):
        timings[name] = round((time.monotonic()-at)*1000, 3)
    try:
        at = time.monotonic(); addresses = public_addresses(HOST, remaining()); completed('DNS', at)
        phase, at = 'TCP', time.monotonic()
        connection = socket.create_connection((addresses[0][4][0], 443), timeout=remaining()); completed('TCP', at)
        phase, at = 'TLS', time.monotonic(); connection.settimeout(remaining())
        connection = ssl.create_default_context().wrap_socket(connection, server_hostname=HOST); completed('TLS', at)
        phase, at = 'HTTP_HEADERS', time.monotonic(); connection.settimeout(remaining())
        headers = {'Host': HOST, 'User-Agent': USER_AGENT, 'Accept': 'application/pdf,text/html,text/plain',
                   'Accept-Encoding': 'identity', 'Connection': 'close'}
        for key, header in [('etag', 'If-None-Match'), ('lastModified', 'If-Modified-Since')]:
            value = safe_header((previous or {}).get(key))
            if value:
                headers[header] = value
        connection.sendall(('GET '+u.path+' HTTP/1.1\r\n'+''.join(k+': '+v+'\r\n' for k,v in headers.items())+'\r\n').encode('ascii'))
        response = http.client.HTTPResponse(DeadlineSocket(connection,remaining)); response.begin(); completed('HTTP_HEADERS', at)
        if response.status == 304:
            if not any(k in headers for k in ('If-None-Match', 'If-Modified-Since')):
                raise DownloadError('UNEXPECTED_304', phase, 304)
            return {'notModified': True, 'phasesMs': timings}
        if response.status != 200:
            code = {403:'FORBIDDEN', 429:'RATE_LIMITED', 404:'NOT_FOUND'}.get(response.status,
                    'REDIRECT' if 300 <= response.status < 400 else 'HTTP_ERROR')
            raise DownloadError(code, phase, response.status, timings)
        content_type = response.getheader('Content-Type', '').split(';')[0].strip().lower()
        allowed = ('text/plain',) if robots else ('application/pdf','application/octet-stream','text/html','application/xhtml+xml')
        if content_type not in allowed:
            raise DownloadError('CONTENT_TYPE_REJECTED', phase)
        if not robots and u.path.lower().endswith('.pdf') and content_type not in ('application/pdf','application/octet-stream'):
            raise DownloadError('CONTENT_TYPE_REJECTED', phase)
        if response.getheader('Content-Encoding', 'identity').lower() != 'identity':
            raise DownloadError('CONTENT_ENCODING_REJECTED', phase)
        length = response.getheader('Content-Length')
        if length is not None and (not re.fullmatch(r'\d+', length) or int(length) > maximum):
            raise DownloadError('SIZE_LIMIT', phase)
        phase, at, body = 'HTTP_BODY', time.monotonic(), bytearray()
        while True:
            connection.settimeout(remaining())
            chunk = response.read1(min(65536, maximum+1-len(body)))
            if not chunk:
                break
            body.extend(chunk)
            if len(body) > maximum:
                raise DownloadError('SIZE_LIMIT', phase)
        if length is not None and int(length) != len(body):
            raise DownloadError('INCOMPLETE_BODY', phase)
        completed('HTTP_BODY', at)
        if not robots and (u.path.lower().endswith('.pdf') != body.startswith(b'%PDF-')):
            raise DownloadError('DOCUMENT_SIGNATURE_MISMATCH', 'VALIDATION')
        if not robots and not u.path.lower().endswith('.pdf') and content_type not in ('text/html','application/xhtml+xml'):
            raise DownloadError('CONTENT_TYPE_REJECTED', 'VALIDATION')
        return {'notModified':False, 'body':bytes(body), 'contentType':content_type, 'phasesMs':timings,
                'etag':safe_header(response.getheader('ETag')), 'lastModified':safe_header(response.getheader('Last-Modified'))}
    except DownloadError:
        raise
    except Exception as error:
        code = 'TLS_ERROR' if isinstance(error, ssl.SSLError) else 'TIMEOUT' if isinstance(error, (TimeoutError,socket.timeout)) else 'NETWORK_ERROR'
        raise DownloadError(code, phase, timings=timings) from None
    finally:
        if response: response.close()
        if connection: connection.close()


def cached_document(url, directory, previous=None, fetch=request, expected_sha256=None):
    validate_url(url)
    record = previous or {}
    # One bounded retry for transient transport/502/503/504 only. No retry for
    # 403/429, redirect, invalid TLS, SSRF or document validation failures.
    for attempt in range(2):
        try:
            result = fetch(url, MAX_BYTES if url.lower().endswith('.pdf') else 2_000_000, record)
            break
        except DownloadError as error:
            if attempt or not (error.code in ('DNS_ERROR','TIMEOUT','NETWORK_ERROR') or error.http_status in (502,503,504)):
                raise
            time.sleep(.25)
    extension = '.pdf' if url.lower().endswith('.pdf') else '.html'
    if result['notModified']:
        digest = record.get('sha256', '')
        if record.get('url') != url or not re.fullmatch('[a-f0-9]{64}', digest):
            raise DownloadError('CACHE_METADATA_INVALID', 'CACHE')
        file = directory/(digest+extension)
        try:
            body = file.read_bytes()
        except OSError:
            raise DownloadError('CACHE_UNAVAILABLE', 'CACHE') from None
        if hashlib.sha256(body).hexdigest() != digest:
            raise DownloadError('CACHE_INTEGRITY', 'CACHE')
        result = {**record, **result, 'body':body}
    else:
        body = result['body']; digest = hashlib.sha256(body).hexdigest(); file = directory/(digest+extension)
    if expected_sha256 is not None and (not re.fullmatch('[a-f0-9]{64}',expected_sha256) or digest != expected_sha256):
        raise DownloadError('EXPECTED_HASH_MISMATCH', 'VALIDATION')
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if file.exists():
        if hashlib.sha256(file.read_bytes()).hexdigest() != digest:raise DownloadError('CACHE_INTEGRITY','CACHE')
    else:
        fd,name=tempfile.mkstemp(prefix='gazette-',suffix='.part',dir=directory)
        temporary=Path(name)
        try:
            with os.fdopen(fd,'wb') as out:out.write(body);out.flush();os.fsync(out.fileno())
            try:os.link(temporary,file)
            except FileExistsError:
                if hashlib.sha256(file.read_bytes()).hexdigest()!=digest:raise DownloadError('CACHE_INTEGRITY','CACHE')
        finally:temporary.unlink(missing_ok=True)
    return {k:v for k,v in {**result,'url':url,'sha256':digest,'bytes':len(body),'cacheName':file.name}.items() if k!='body'}


def robots_allowed(url, fetch=request, policy=None):
    if policy is not None:
        rules=policy.get('_rules')
        if rules is not None and not rules.can_fetch('KadroRadar',url):
            raise DownloadError('ROBOTS_DISALLOWED','ROBOTS')
        return policy
    try:
        response = fetch(ROOT+'robots.txt', 256000, None, robots=True)
    except DownloadError as error:
        if error.http_status == 404:
            return {'status':'NOT_PUBLISHED','_rules':None}
        raise
    body=response['body']
    if b'<html' in body.lower() or b'<!doctype' in body.lower():
        raise DownloadError('ROBOTS_RESPONSE_REQUIRES_REVIEW','ROBOTS')
    rules=urllib.robotparser.RobotFileParser(ROOT+'robots.txt');rules.parse(body.decode('utf-8-sig').splitlines())
    if not rules.can_fetch('KadroRadar',url):
        raise DownloadError('ROBOTS_DISALLOWED','ROBOTS')
    if rules.crawl_delay('KadroRadar') or rules.request_rate('KadroRadar'):
        raise DownloadError('ROBOTS_RATE_REQUIRES_REVIEW','ROBOTS')
    return {'status':'ALLOWED','sha256':hashlib.sha256(body).hexdigest(),'_rules':rules}


def collect(day, directory, previous=None, source=None, scheduled=False, fetch=request):
    source=source or REGISTRY['gazette'];permission(source,scheduled)
    index_url=archive_url(day);validate_url(index_url)
    previous=previous or {}; known=previous.get('documents',{}); results=[]; indexes=[]; issues=[]; receipts={};missing_documents=[]
    robots=robots_allowed(index_url,fetch)
    def download(url):
        # Robot rules must cover each resource, not only the entry index.
        robots_allowed(url,fetch,robots)
        value=cached_document(url,directory,known.get(url),fetch)
        receipts[url]={k:value.get(k) for k in ('url','sha256','etag','lastModified','cacheName')}
        return value
    def inspect_index(url):
        record=download(url)
        html,_=decode_official_html((directory/record['cacheName']).read_bytes())
        manifest=index_manifest(html,url)
        if manifest['gazetteDate'] not in (None,day):
            raise DownloadError('INDEX_DATE_MISMATCH','PARSE')
        indexes.append({'url':url,'sha256':record['sha256'],'manifest':manifest})
        return manifest
    index=inspect_index(index_url);links=list(index['links'])
    whole=[link for link in links if link['format']=='pdf' and link.get('observedDate')==day and urlsplit(link['url']).path.endswith('/'+day.replace('-','')+'.pdf') and urlsplit(link['url']).path.startswith('/eskiler/')]
    # Prefer the observed full issue over its individual notice copies. This
    # avoids creating two candidates for the same job through PDF+HTML mirrors.
    if whole:
        if any(link['format']=='pdf' and link['url'] not in [item['url'] for item in whole] for link in links):issues.append('ADDITIONAL_PDF_LINKS_REVIEW')
        links=whole
    for link in list(links):
        if link.get('section')=='MISCELLANEOUS' and link['format']=='html':
            validate_url(link['url'])
            if link.get('observedDate') != day: continue
            links.extend(inspect_index(link['url'])['links']);break
    targets=[]
    for link in links:
        if link.get('observedDate')!=day or link['format'] not in ('pdf','html'):continue
        try:validate_url(link['url'])
        except DownloadError:issues.append('UNAPPROVED_LINK_REVIEW');continue
        if link['url'] in [t['url'] for t in targets] or link['url'] in [i['url'] for i in indexes]:continue
        if link['format']=='pdf' or re.search('personel|memur|işçi|öğretim',link.get('label',''),re.I):targets.append(link)
    if len(targets)>2:issues.append('DOCUMENT_BUDGET_REVIEW')
    for link in targets[:2]:
        try:value=download(link['url'])
        except DownloadError as error:
            if error.http_status==404 and link['url'] in previous.get('snapshot',{}).get('documents',{}):
                missing_documents.append({'url':link['url'],'httpStatus':404});issues.append('DOCUMENT_MISSING_REVIEW');continue
            raise
        file=directory/value['cacheName']
        parsed=parse_pdf(file,source_url=link['url']) if link['format']=='pdf' else parse_notice_html(file,link['url'])
        if parsed.get('gazetteDate') not in (None,day):raise DownloadError('DOCUMENT_DATE_MISMATCH','PARSE')
        results.append({'url':link['url'],'sha256':value['sha256'],'format':link['format'],'cacheName':value['cacheName'],'notModified':value['notModified'],'parsed':parsed})
    if not results:issues.append('NO_DOCUMENT_LINK_REVIEW')
    # An imperfect extraction is not evidence that an old job was cancelled.
    complete=bool(results) and not issues and all(not d['parsed'].get('documentIssues') and not d['parsed'].get('metrics',{}).get('flaggedPages') for d in results)
    return {'sourceId':'gazette','date':day,'documents':results,'indexes':indexes,'issues':issues,'complete':complete,'coverageMode':'OBSERVED_WHOLE_ISSUE' if whole else 'BOUNDED_OBSERVED_NOTICES','missingDocuments':missing_documents,'networkProvenance':'LIVE_HTTPS' if fetch is request else 'MOCK_TRANSPORT',
            'documentSha256':indexes[0]['sha256'],'robots':{k:v for k,v in robots.items() if k!='_rules'},'transport':{'documents':{**known,**receipts}},
            'downloaded':any(not d.get('notModified',False) for d in results),'autoPublished':False}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date',required=True);parser.add_argument('--directory',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--state',type=Path)
    parser.add_argument('--scheduled',action='store_true');args=parser.parse_args()
    try:
        previous=json.loads(args.state.read_text(encoding='utf-8')) if args.state and args.state.exists() else {}
        report=collect(args.date,args.directory,previous,scheduled=args.scheduled)
        args.output.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        temporary=args.output.with_suffix('.tmp');temporary.write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8');temporary.chmod(0o600);temporary.replace(args.output)
        print(json.dumps({'status':'OK','documents':len(report['documents']),'autoPublished':False}))
    except Exception as error:
        allowed=('SOURCE_RESTRICTED','SOURCE_REVIEW_REQUIRED','SOURCE_LICENSE_INVALID','SOURCE_OPERATOR_DISABLED','GAZETTE_DOCUMENT_SCOPE_REQUIRED')
        code=error.code if isinstance(error,DownloadError) else str(error) if isinstance(error,ValueError) and str(error) in allowed else 'PARSE_OR_VALIDATION'
        print(json.dumps({'status':code,'phase':error.phase if isinstance(error,DownloadError) else 'POLICY_OR_PARSE',
                          'httpStatus':error.http_status if isinstance(error,DownloadError) else None,'downloaded':False,
                          'phasesMs':error.timings if isinstance(error,DownloadError) else {}}));return 1
    return 0


if __name__=='__main__':raise SystemExit(main())
