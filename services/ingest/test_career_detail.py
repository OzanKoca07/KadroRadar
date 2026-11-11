import unittest,json,hashlib,urllib.error
from career_detail import parse_detail,enrich_report,DetailError,SCOPE
from career_rss import parse_career_feed,REGISTRY
from pathlib import Path
from copy import deepcopy
class DetailTests(unittest.TestCase):
 def setUp(self):
  self.report=parse_career_feed(Path(__file__).with_name('fixtures').joinpath('career-synthetic.xml').read_bytes());self.row=next(r for r in self.report['rows'] if r['categoryCode']=='PERSONNEL');self.row['sourceUrl']='https://kariyerkapisi.gov.tr/IlanDetay?i=10000000-0000-0000-0000-000000000001'
  self.obj={'kurumAdi':'SYNTHETIC Kurum','ilanBaslik':'SYNTHETIC notice','basTarih':'2026-10-12T08:00:00','bitTarih':'2026-10-30T17:00:00','ilanMetni':'SYNTHETIC PRIVATE BODY','kontenjan':9}
 def test_observed_offset_free_contract_preserves_calendar_without_instant(self):
  result=parse_detail(self.row,self.obj,'a'*64);self.assertEqual(result['organization'],'SYNTHETIC Kurum');self.assertEqual(result['quota'],9);self.assertIsNone(result['applicationEndAt']);self.assertEqual(result['applicationDatesVerification'],'CALENDAR_VERIFIED');self.assertEqual(result['applicationDates']['end']['raw'],self.obj['bitTarih']);self.assertNotIn('ilanMetni',json.dumps(result));self.assertNotIn('SYNTHETIC PRIVATE BODY',json.dumps(result))
 def test_explicit_offsets_and_calendar_validation(self):
  obj={**self.obj,'basTarih':'2026-10-12T08:00:00+03:00','bitTarih':'2026-10-30T17:00:00+03:00'};self.assertEqual(parse_detail(self.row,obj,'b'*64)['applicationDatesVerification'],'VERIFIED')
  obj['basTarih']='2026-02-30T08:00:00+03:00';self.assertEqual(parse_detail(self.row,obj,'b'*64)['applicationDatesVerification'],'UNKNOWN')
 def test_schema_and_identity_rejected(self):
  for obj in ([],{},dict(self.obj,kurumAdi='')):
   with self.assertRaises(ValueError):parse_detail(self.row,obj,'c'*64)
  with self.assertRaises(ValueError):parse_detail(dict(self.row,sourceUrl='https://evil.test/a'),self.obj,'c'*64)
 def test_policy_before_network(self):
  calls=[]
  with self.assertRaises(ValueError):enrich_report(self.report,REGISTRY['career'],lambda *a:calls.append(a))
  self.assertEqual(calls,[])
 def licensed(self):
  source=deepcopy(REGISTRY['career']);source.update(enabled=True,rightsAssessment={'status':'LICENSE_VERIFIED','evidence':{'kind':'LICENSE','url':'https://example.test/SYNTHETIC-LICENSE','sha256':'a'*64,'scopeUrl':source['feed'],'scopes':['AUTOMATED_FEED_ACCESS','MOBILE_METADATA','COMMERCIAL_USE',SCOPE],'attribution':'SYNTHETIC TEST ONLY','verifiedAt':'2020-01-01T00:00:00Z','validUntil':'2035-01-01T00:00:00Z'}});source['indexingPolicy']['automatedAccess']='ALLOWED';return source
 def test_bounded_requests_and_forbidden_fallback(self):
  source=self.licensed();calls=[]
  def fetch(path,body=None):
   calls.append(path)
   if body is None:return None
   raise DetailError('DETAIL_FORBIDDEN')
  result=enrich_report(self.report,source,fetch);self.assertEqual(len(result['rows']),len(self.report['rows']));self.assertIsNone(result['rows'][0]['applicationEndAt']);self.assertEqual(result['rows'][0]['organizationVerification'],'UNKNOWN');self.assertEqual(len(calls),2)
 def test_rate_limit_never_retried(self):
  def fetch(path,body=None):
   if body is None:return None
   raise DetailError('DETAIL_RATE_LIMITED',7200)
  with self.assertRaises(urllib.error.HTTPError) as e:enrich_report(self.report,self.licensed(),fetch)
  self.assertEqual(e.exception.retry_after_seconds,7200)
 def test_separate_scope_and_robots_gate(self):
  source=self.licensed();source['rightsAssessment']['evidence']['scopes'].remove(SCOPE);calls=[]
  with self.assertRaises(ValueError):enrich_report(self.report,source,lambda *a:calls.append(a))
  self.assertEqual(calls,[])
  with self.assertRaises(DetailError):enrich_report(self.report,self.licensed(),lambda *a:b'User-agent: *\nDisallow: /api/\n')
 def test_304_still_rechecks_details_without_advancing_feed_identity(self):
  import tempfile,os
  from unittest.mock import patch
  from career_rss import sync
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'state.json';p.write_text(json.dumps({'transport':{'documentSha256':self.report['documentSha256'],'knownGuids':[self.row['guidHash']]},'detailRows':[self.row]}),encoding='utf-8')
   def metadata(path,body=None):return None if body is None else json.dumps(self.obj).encode()
   with patch.dict(os.environ,{'CAREER_DETAIL_ENRICHMENT_ENABLED':'true'}),patch('career_rss.REGISTRY',{'career':self.licensed()}),patch('career_rss.check_robots'),patch('rss_transport.fetch_feed',return_value={'notModified':True}),patch('career_detail.request_metadata',side_effect=metadata):r=sync(p)
   self.assertTrue(r['notModified']);self.assertEqual(r['transport']['documentSha256'],self.report['documentSha256']);self.assertEqual(r['rows'][0]['organization'],'SYNTHETIC Kurum');self.assertIsNone(r['rows'][0]['applicationEndAt'])
if __name__=='__main__':unittest.main()
