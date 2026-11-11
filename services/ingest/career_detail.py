"""Official public detail metadata only. Network requires a separate proven scope.
The observed real response uses offset-free dates: they remain UNKNOWN.
No token/cookie, original body, logo, HTML or inferred timezone is published.
"""
import hashlib,json,re,socket,ssl,http.client,time,urllib.robotparser,urllib.error
from datetime import datetime
from urllib.parse import urlsplit,parse_qs
from source_rights import require_network_permission
from gazette_download import public_addresses,DeadlineSocket
from rss_transport import retry_after_seconds
HOST='api.kariyerkapisi.gov.tr'
PATH='/api/ilan/GetIlanPreviewPublic'
SCOPE='AUTOMATED_CAREER_DETAIL_ACCESS'
class DetailError(Exception):
 def __init__(self,code,retry=None):super().__init__(code);self.retry_after_seconds=retry

def request_metadata(path,body=None,timeout=5):
 if path not in ('/robots.txt',PATH) or path=='/robots.txt' and body is not None:raise DetailError('DETAIL_TARGET_REJECTED')
 if path==PATH and (not isinstance(body,dict) or set(body)!={'ilanGuid'} or not isinstance(body['ilanGuid'],str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',body['ilanGuid'],re.I)):raise DetailError('DETAIL_IDENTITY_REJECTED')
 began=time.monotonic();connection=None;response=None
 def remaining():
  left=timeout-(time.monotonic()-began)
  if left<=0:raise TimeoutError()
  return left
 try:
  addresses=public_addresses(HOST,remaining());connection=socket.create_connection((addresses[0][4][0],443),timeout=remaining());connection.settimeout(remaining());connection=ssl.create_default_context().wrap_socket(connection,server_hostname=HOST)
  payload=json.dumps(body).encode() if body is not None else b''
  headers={'Host':HOST,'Accept':'application/json,text/plain','Accept-Encoding':'identity','Connection':'close','User-Agent':'KadroRadar/0.1 (official metadata index)'}
  if body is not None:headers.update({'Content-Type':'application/json','Content-Length':str(len(payload))})
  connection.sendall((('POST' if body is not None else 'GET')+' '+path+' HTTP/1.1\r\n'+''.join(k+': '+v+'\r\n' for k,v in headers.items())+'\r\n').encode()+payload)
  response=http.client.HTTPResponse(DeadlineSocket(connection,remaining));response.begin()
  if response.status==404 and path=='/robots.txt':return None
  if response.status==204:raise DetailError('DETAIL_NOT_FOUND')
  if response.status!=200:raise DetailError({401:'DETAIL_AUTH_REQUIRED',403:'DETAIL_FORBIDDEN',429:'DETAIL_RATE_LIMITED'}.get(response.status,'DETAIL_REDIRECT' if 300<=response.status<400 else 'DETAIL_HTTP_ERROR'),retry_after_seconds(response.getheader('Retry-After')) if response.status==429 else None)
  mime=response.getheader('Content-Type','').split(';')[0].strip().lower()
  if response.getheader('Content-Encoding','identity')!='identity' or mime not in (('text/plain',) if path=='/robots.txt' else ('application/json',)):raise DetailError('DETAIL_TYPE_REJECTED')
  data=response.read(1000001)
  if len(data)>1000000:raise DetailError('DETAIL_SIZE_LIMIT')
  length=response.getheader('Content-Length')
  if length is not None and (not length.isdigit() or int(length)!=len(data)):raise DetailError('DETAIL_INCOMPLETE_BODY')
  return data
 finally:
  if response:response.close()
  if connection:connection.close()

def parse_detail(row,obj,response_sha256):
 u=urlsplit(row['sourceUrl']);guid=parse_qs(u.query).get('i',[''])[0]
 if u.scheme!='https' or u.hostname!='kariyerkapisi.gov.tr' or u.path.lower()!='/ilandetay' or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',guid,re.I) or not re.fullmatch('[a-f0-9]{64}',response_sha256):raise ValueError('DETAIL_IDENTITY_REJECTED')
 if not isinstance(obj,dict) or not isinstance(obj.get('kurumAdi'),str) or not 1<=len(obj['kurumAdi'].strip())<=500 or not isinstance(obj.get('ilanBaslik'),str) or not obj['ilanBaslik'].strip():raise ValueError('DETAIL_SCHEMA_REVIEW')
 result={**row,'organization':obj['kurumAdi'].strip(),'organizationVerification':'VERIFIED','issues':[v for v in row['issues'] if v!='EMPLOYER_REQUIRES_EDITOR'],'detailEvidence':{'requestGuid':guid,'sourceUrl':row['sourceUrl'],'responseSha256':response_sha256,'endpoint':'https://'+HOST+PATH,'officialNoticeId':obj.get('ilN_NO') if isinstance(obj.get('ilN_NO'),str) and len(obj['ilN_NO'])<=100 else None}}
 quota=obj.get('kontenjan')
 if type(quota) is int and 1<=quota<=100000:result.update(quota=quota,quotaVerification='VERIFIED')
 from application_dates import date_pair
 dates=date_pair(obj.get('basTarih'),obj.get('bitTarih'));result['applicationDates']=dates
 result.update(applicationStartAt=dates['start']['raw'] if dates['mode']=='INSTANT' else None,applicationEndAt=dates['end']['raw'] if dates['mode']=='INSTANT' else None,applicationDatesVerification='VERIFIED' if dates['mode']=='INSTANT' else 'CALENDAR_VERIFIED' if dates['mode']=='CALENDAR' else 'UNKNOWN')
 result['issues']=[v for v in result['issues'] if v not in ('APPLICATION_DATES_UNKNOWN','DETAIL_TIMEZONE_OR_DATES_UNKNOWN')]
 if dates['mode']=='UNKNOWN':result['issues'].append('APPLICATION_DATES_UNKNOWN')
 if dates['mode']!='INSTANT':result['issues'].append('DETAIL_TIMEZONE_OR_DATES_UNKNOWN')
 result['detailEvidence']['sourceLocalTimes']={k:obj[k] for k in ('basTarih','bitTarih') if isinstance(obj.get(k),str) and len(obj[k])<=40}
 result['rssContentHash']=row.get('rssContentHash',row['contentHash'])
 result['contentHash']=hashlib.sha256(json.dumps([result['rssContentHash'],result['organization'],result['applicationStartAt'],result['applicationEndAt'],result.get('quota'),dates,result['detailEvidence']],sort_keys=True,ensure_ascii=False).encode()).hexdigest()
 return result

def enrich_report(report,source,fetch=None,cursor=0):
 fetch=fetch or request_metadata
 require_network_permission(source,source['feed'],require_enabled=True)
 if SCOPE not in source['rightsAssessment']['evidence']['scopes']:raise ValueError('CAREER_DETAIL_SCOPE_REQUIRED')
 robots=fetch('/robots.txt');rules=urllib.robotparser.RobotFileParser()
 if robots is not None:
  if b'<html' in robots.lower() or b'<!doctype' in robots.lower():raise DetailError('DETAIL_ROBOTS_REVIEW')
  rules.parse(robots.decode('utf-8-sig').splitlines())
  if not rules.can_fetch('KadroRadar','https://'+HOST+PATH) or rules.crawl_delay('KadroRadar') or rules.request_rate('KadroRadar'):raise DetailError('DETAIL_ROBOTS_REVIEW')
 rows=[];checked=0;errors=[];began=time.monotonic()
 candidates=[i for i,r in enumerate(report['rows']) if r['categoryCode']=='PERSONNEL'];offset=cursor%len(candidates) if candidates else 0
 order=candidates[offset:]+candidates[:offset];results={}
 for index in order:
  if checked>=20 or time.monotonic()-began>8:break
  row=report['rows'][index]
  checked+=1
  try:
   guid=parse_qs(urlsplit(row['sourceUrl']).query)['i'][0];data=fetch(PATH,{'ilanGuid':guid});results[index]=parse_detail(row,json.loads(data),hashlib.sha256(data).hexdigest())
  except Exception as error:
   if isinstance(error,DetailError) and str(error)=='DETAIL_RATE_LIMITED':
    failure=urllib.error.HTTPError('https://'+HOST+PATH,429,'DETAIL_RATE_LIMITED',{},None);failure.retry_after_seconds=error.retry_after_seconds;raise failure
   code=str(error) if isinstance(error,DetailError) else 'DETAIL_TLS_FAILURE' if isinstance(error,ssl.SSLError) else 'DETAIL_TIMEOUT' if isinstance(error,TimeoutError) else 'DETAIL_VALIDATION_OR_NETWORK';errors.append(code);results[index]={**row,'organization':None,'organizationVerification':'UNKNOWN','applicationStartAt':None,'applicationEndAt':None,'applicationDatesVerification':'UNKNOWN','applicationDates':{'start':{'raw':None},'end':{'raw':None},'mode':'UNKNOWN'},'issues':sorted(set(row['issues']+['APPLICATION_DATES_UNKNOWN','EMPLOYER_REQUIRES_EDITOR'])),'contentHash':hashlib.sha256((row.get('rssContentHash',row['contentHash'])+code).encode()).hexdigest()}
   # Never retry or continue requests after access denial/rate limiting.
   if code in ('DETAIL_AUTH_REQUIRED','DETAIL_FORBIDDEN','DETAIL_RATE_LIMITED','DETAIL_REDIRECT','DETAIL_ROBOTS_REVIEW'):break
  time.sleep(.25)
 rows=[results.get(i,r) for i,r in enumerate(report['rows'])]
 return {**report,'rows':rows,'detailMetrics':{'nextCursor':(offset+checked)%len(candidates) if candidates else 0,**{'checked':checked,'enriched':sum('detailEvidence' in r for r in rows),'errors':errors,'bounded':True}}}
