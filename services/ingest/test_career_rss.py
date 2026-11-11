import hashlib
import json
import socket
import ssl
import tempfile
import unittest
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock
from career_rss import parse_career_feed, category_code, sync
from rss_transport import fetch_feed

FIXTURE=Path(__file__).parent/'fixtures'/'career-synthetic.xml'

class CareerTests(unittest.TestCase):
    def test_synthetic_contract_and_category_separation(self):
        report=parse_career_feed(FIXTURE.read_bytes())
        self.assertEqual(len(report['rows']),4)
        self.assertEqual([r['categoryCode'] for r in report['rows']],['PERSONNEL','INTERNAL','EXAM_PLACEMENT','EDUCATION'])
        row=report['rows'][0]
        self.assertEqual(row['sourceUrl'],'https://kariyerkapisi.gov.tr/ilan/synthetic-001')
        self.assertIsNone(row['organization']);self.assertIsNone(row['applicationEndAt'])
        self.assertNotIn('description',json.dumps(report));self.assertNotIn('image.png',json.dumps(report))
        self.assertIn('Sözleşmeli',row['title']);self.assertFalse(row['publishable']);self.assertFalse(report['liveFetch'])
        self.assertEqual(category_code('A Grubu Memur (Kariyer Meslek)'),'PERSONNEL')

    def test_guid_duplicates_and_conflicting_identity(self):
        raw=FIXTURE.read_bytes().decode();item=raw[raw.index('<item>'):raw.index('</item>')+7]
        report=parse_career_feed(raw.replace('</channel>',item+'</channel>').encode())
        self.assertEqual(len(report['rows']),4)
        with self.assertRaisesRegex(ValueError,'CONFLICTING_GUID'):
            parse_career_feed(raw.replace('</channel>',item.replace('SENTETİK KURUM','DEĞİŞEN KURUM')+'</channel>').encode())
        modified=parse_career_feed(raw.replace('Sözleşmeli personel alımı','Sözleşmeli personel alımı süre uzatıldı').encode())
        self.assertEqual(modified['rows'][0]['guidHash'],report['rows'][0]['guidHash'])
        self.assertNotEqual(modified['rows'][0]['contentHash'],report['rows'][0]['contentHash'])
        self.assertEqual(modified['rows'][0]['eventType'],'EXTENSION')

    def test_encodings_and_xml_security(self):
        raw=FIXTURE.read_text(encoding='utf-8')
        for encoding in ['windows-1254','iso-8859-9','utf-16']:
            doc=raw.replace('encoding="utf-8"',f'encoding="{encoding}"').replace('—','-').encode(encoding)
            self.assertEqual(len(parse_career_feed(doc)['rows']),4)
        for doc in ['<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss version="2.0"><channel/></rss>','<rss>','<html/>']:
            for encoding in ['utf-8','utf-16']:
                with self.assertRaises((ValueError,ET.ParseError)):parse_career_feed(doc.encode(encoding))

    def test_bad_host_and_missing_link_are_quarantined(self):
        raw=FIXTURE.read_text(encoding='utf-8')
        for url in ['http://kariyerkapisi.gov.tr/ilan/x','https://127.0.0.1/x','https://kariyerkapisi.gov.tr.evil.example/x','https://user@kariyerkapisi.gov.tr/x','https://ilan.gov.tr/x','']:
            changed=raw.replace('https://kariyerkapisi.gov.tr/ilan/synthetic-001?utm_source=test',url)
            report=parse_career_feed(changed.encode());self.assertEqual(len(report['unresolved']),1)

    def test_future_publication_is_not_application_date(self):
        report=parse_career_feed(FIXTURE.read_bytes(),now=datetime(2026,10,1,tzinfo=timezone.utc))
        self.assertIn('FUTURE_PUBLICATION_REVIEW',report['rows'][0]['issues'])
        self.assertIsNone(report['rows'][0]['applicationStartAt'])
        self.assertIn('PUBLICATION_DATE_UNKNOWN',report['rows'][2]['issues'])

    def test_policy_precedes_network_and_preserves_state(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'state.json';output.write_text('{"preserve":true}')
            with patch('socket.getaddrinfo',side_effect=AssertionError('network forbidden')):
                with self.assertRaisesRegex(ValueError,'SOURCE_REVIEW_REQUIRED'):sync(output)
            self.assertEqual(output.read_text(),'{"preserve":true}')

    def test_conditional_state_missing_hint_and_failure_atomicity(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'state.json'
            prior={'transport':{'etag':'"fixture-v1"','knownGuids':['a'*64]}}
            output.write_text(json.dumps(prior))
            with patch('career_rss.require_network_permission'),patch('career_rss.check_robots'),patch('rss_transport.fetch_feed',return_value={'notModified':True}):
                result=sync(output);self.assertEqual(result['rows'],[]);self.assertEqual(result['missingGuids'],[])
            self.assertEqual(json.loads(output.read_text()),prior)
            with patch('career_rss.require_network_permission'),patch('career_rss.check_robots'),patch('rss_transport.fetch_feed',return_value={'notModified':False,'body':FIXTURE.read_bytes(),'transport':{'etag':'"fixture-v2"','lastModified':'Wed, 28 Oct 2026 06:00:00 GMT'}}):
                result=sync(output);self.assertEqual(result['missingGuids'],['a'*64]);self.assertEqual(len(result['transport']['knownGuids']),4)
            saved=output.read_bytes()
            for error in [TimeoutError(),ssl.SSLError(),socket.gaierror()]:
                with patch('career_rss.require_network_permission'),patch('career_rss.check_robots'),patch('rss_transport.fetch_feed',side_effect=error):
                    with self.assertRaises(type(error)):sync(output)
                self.assertEqual(output.read_bytes(),saved)

    def test_transport_pins_dns_and_rejects_redirects_and_statuses(self):
        public=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('8.8.8.8',443))]
        for code in [200,304,302,403,429]:
            sock=MagicMock();response=MagicMock();response.status=code
            response.read1.side_effect=[b'<rss/>',b'']
            response.getheader.side_effect=lambda k,default=None: {'Content-Length':'6','ETag':'"fixture"'}.get(k,default)
            context=MagicMock();context.wrap_socket.return_value=sock
            with patch('socket.getaddrinfo',return_value=public),patch('socket.create_connection',return_value=sock) as connect,patch('ssl.create_default_context',return_value=context),patch('http.client.HTTPResponse',return_value=response):
                if code in [302,403,429]:
                    with self.assertRaises(urllib.error.HTTPError):fetch_feed('https://kariyerkapisi.gov.tr/RSS','career',{})
                else:
                    result=fetch_feed('https://kariyerkapisi.gov.tr/RSS','career',{'transport':{'etag':'"prior"','lastModified':'Wed, 28 Oct 2026 06:00:00 GMT'}})
                    self.assertEqual(result['notModified'],code==304)
                    request=sock.sendall.call_args.args[0];self.assertIn(b'If-None-Match: "prior"',request);self.assertIn(b'If-Modified-Since:',request)
                self.assertEqual(connect.call_args.args[0],('8.8.8.8',443))
                context.wrap_socket.assert_called_once_with(sock,server_hostname='kariyerkapisi.gov.tr')
        with patch('socket.getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]),patch('socket.create_connection') as connect:
            with self.assertRaisesRegex(ValueError,'NON_PUBLIC_DNS'):fetch_feed('https://kariyerkapisi.gov.tr/RSS','career',{})
            connect.assert_not_called()

if __name__=='__main__':unittest.main()
