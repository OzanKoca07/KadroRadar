import json, tempfile, unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
from unittest.mock import patch
from feed_metadata import parse_fact_feed
from official_rss import REGISTRY, sync, FEED
from source_rights import require_network_permission
from source_probe import probe

class MetadataAndRightsTests(unittest.TestCase):
 def test_registry_stays_disabled_and_restricted(self):
  self.assertTrue(all(not s['enabled'] for s in REGISTRY.values()))
  self.assertEqual(REGISTRY['ilan']['rightsAssessment']['status'],'RESTRICTED')
 def test_unknown_never_opens_socket_or_changes_cache(self):
  with tempfile.TemporaryDirectory() as folder, patch('official_rss.check_robots') as robots, patch('source_probe.socket.getaddrinfo') as dns:
   path=Path(folder)/'state.json';path.write_text('previous-complete')
   with self.assertRaisesRegex(ValueError,'SOURCE_REVIEW_REQUIRED'): sync(path)
   self.assertEqual(path.read_text(),'previous-complete');robots.assert_not_called()
   result=probe(FEED,'energy',path);self.assertEqual(result['failedPhase'],'POLICY');dns.assert_not_called()
 def test_license_must_cover_exact_endpoint_scopes_and_expiry(self):
  now=datetime.now(timezone.utc)
  evidence={'kind':'LICENSE','url':'https://example.test/SYNTHETIC-LICENSE','sha256':'a'*64,'scopeUrl':FEED,'scopes':['AUTOMATED_FEED_ACCESS','MOBILE_METADATA','COMMERCIAL_USE'],'attribution':'SYNTHETIC TEST ONLY','verifiedAt':(now-timedelta(days=1)).isoformat(),'validUntil':(now+timedelta(days=1)).isoformat()}
  source={**REGISTRY['energy'],'enabled':True,'rightsAssessment':{'status':'LICENSE_VERIFIED','evidence':evidence},'indexingPolicy':{'automatedAccess':'ALLOWED'}}
  require_network_permission(source,FEED,True)
  for altered in [{**evidence,'scopeUrl':'https://enerji.gov.tr/other'},{**evidence,'validUntil':(now-timedelta(days=1)).isoformat()},{**evidence,'scopes':['MOBILE_METADATA']}]:
   with self.assertRaises(ValueError): require_network_permission({**source,'rightsAssessment':{'status':'LICENSE_VERIFIED','evidence':altered}},FEED)
  with self.assertRaisesRegex(ValueError,'SOURCE_RESTRICTED'): require_network_permission({**source,'id':'ilan'},FEED)
 def test_rss_turkish_and_no_full_text_or_invented_fields(self):
  xml='<?xml version="1.0" encoding="iso-8859-9"?><rss><channel><item><title>İşçi alımında süre uzatıldı</title><link>/fixture-only</link><pubDate>Thu, 29 Oct 2026 10:00:00 +0300</pubDate><description>PRIVATE_FULL_TEXT</description></item></channel></rss>'.encode('iso-8859-9')
  report=parse_fact_feed(xml,'sgk','https://sgk.gov.tr/fixture-feed');self.assertEqual(report['items'][0]['title'],'İşçi alımında süre uzatıldı');self.assertEqual(report['items'][0]['eventType'],'EXTENSION');self.assertIsNone(report['items'][0]['applicationEndAt']);self.assertIsNone(report['items'][0]['organization']);self.assertNotIn('PRIVATE_FULL_TEXT',json.dumps(report));self.assertFalse(report['liveFetch'])
 def test_atom_alternate_and_dedupe(self):
  entry='<entry><title>Personel alımı iptal</title><link rel="enclosure" href="https://evil.test/image.jpg"/><link rel="alternate" href="https://www.karacadag.gov.tr/fixture"/><updated>2026-10-29T10:00:00+03:00</updated></entry>'
  report=parse_fact_feed(('<feed xmlns="http://www.w3.org/2005/Atom">'+entry+entry+'</feed>').encode(),'karacadag','https://www.karacadag.gov.tr/fixture-feed');self.assertEqual(len(report['items']),1);self.assertEqual(report['items'][0]['eventType'],'CANCELLATION');self.assertFalse(report['items'][0]['publishable'])
 def test_json_bom_and_unknown_dates_links(self):
  report=parse_fact_feed(b'\xef\xbb\xbf'+json.dumps({'items':[{'title':'Resmi duyuru','url':'https://evil.test/x','publishedAt':'unknown'}]}).encode(),'sgk','https://sgk.gov.tr/fixture-feed');item=report['items'][0];self.assertIsNone(item['sourceUrl']);self.assertIsNone(item['announcedAt']);self.assertIn('UNKNOWN_PUBLICATION_DATE',item['issues'])
 def test_malformed_entities_and_restricted_source(self):
  for data in [b'<html/>',b'<rss',b'<!DOCTYPE rss><rss/>',b'{"items":"bad"}']:
   with self.assertRaises((ValueError,Exception)): parse_fact_feed(data,'sgk','https://sgk.gov.tr/fixture-feed')
  with self.assertRaises(ValueError):parse_fact_feed(b'<rss><channel/></rss>','ilan','https://www.ilan.gov.tr/')

if __name__=='__main__': unittest.main()
