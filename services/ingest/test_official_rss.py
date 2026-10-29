import unittest
import socket
import ssl
import tempfile
import json
import urllib.error
from pathlib import Path
from unittest.mock import patch
from official_rss import classify_error, sync
from official_rss import parse_feed, parse_feed_report, official_url, check_robots

class FeedTests(unittest.TestCase):
    def test_robots_rules_and_html_challenge(self):
        from unittest.mock import MagicMock
        for content,allowed in [(b'User-agent: *\nAllow: /\nDisallow: /uploads',True),(b'User-agent: *\nDisallow: /RSS',False),(b'User-agent: *\nAllow: /\nCrawl-delay: 1000000',False),(b'<html>CAPTCHA</html>',False)]:
            response=MagicMock();response.__enter__.return_value=response;response.read.return_value=content
            opener=MagicMock();opener.open.return_value=response
            with patch('official_rss.validate_outbound_dns'),patch('urllib.request.build_opener',return_value=opener):
                if allowed:self.assertEqual(check_robots()['status'],'ALLOWED')
                else:
                    with self.assertRaises(ValueError):check_robots()

    def test_robots_http_errors_are_not_bypassed(self):
        from unittest.mock import MagicMock
        for code in [403,429,302]:
            opener=MagicMock();opener.open.side_effect=urllib.error.HTTPError('https://enerji.gov.tr/robots.txt',code,'blocked',{},None)
            with patch('official_rss.validate_outbound_dns'),patch('urllib.request.build_opener',return_value=opener):
                with self.assertRaises(urllib.error.HTTPError):check_robots()
                self.assertEqual(opener.open.call_count,1)
    def test_linkless_source_is_quarantined_without_losing_other_items(self):
        report = parse_feed_report('<rss><channel><item><title>Sözleşmeli Bilişim Personeli Giriş Sınavı İlanı</title><PublishStartDate>10/01/2026 8:00:00 AM</PublishStartDate></item><item><title>Personel alım ilanı</title><link>/real-detail</link></item></channel></rss>'.encode())
        self.assertEqual(len(report['rows']), 1)
        self.assertEqual(len(report['unresolved']), 1)
        row = report['unresolved'][0]
        self.assertFalse(row['publishable'])
        self.assertNotIn('sourceUrl', row)
        self.assertEqual(row['rawSourceReference']['documentSha256'], report['documentSha256'])
        self.assertEqual(row['rawSourceReference']['itemOrdinal'], 1)
        self.assertEqual(report['positionRows'], 0)

    def test_title_without_result_keyword_still_excludes_winners(self):
        self.assertEqual(parse_feed_report('<rss><channel><item><title>Personel alımı atanmaya hak kazananlar</title></item></channel></rss>'.encode())['unresolved'], [])

    def test_missing_link_never_becomes_feed_url(self):
        with self.assertRaises(ValueError):
            parse_feed('<rss><channel><item><title>Personel alım ilanı</title></item></channel></rss>'.encode())
    def test_error_classes(self):
        for code, expected in [(304,'NOT_MODIFIED'),(403,'FORBIDDEN'),(429,'RATE_LIMITED'),(302,'REDIRECT')]:
            self.assertEqual(classify_error(urllib.error.HTTPError('https://enerji.gov.tr',code,'test',{},None)), expected)
        for error, expected in [(socket.gaierror(),'DNS'),(ssl.SSLError(),'TLS'),(TimeoutError(),'TIMEOUT')]:
            self.assertEqual(classify_error(error), expected)

    def test_conditional_request_304(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'state.json'
            state = {'rows': {}, 'etag': 'fixture-etag', 'lastModified': 'Fri, 23 Oct 2026 10:00:00 GMT'}
            output.write_text(json.dumps(state))
            class Opener:
                def open(self, request, timeout):
                    self_request = request
                    assert self_request.get_header('If-none-match') == 'fixture-etag'
                    assert self_request.get_header('If-modified-since') == state['lastModified']
                    raise urllib.error.HTTPError(request.full_url,304,'Not modified',{},None)
            with patch('urllib.request.build_opener', return_value=Opener()), patch('official_rss.validate_outbound_dns'), patch('official_rss.check_robots',return_value={'status':'ALLOWED'}), patch('official_rss.require_network_permission'):
                self.assertTrue(sync(output)['notModified'])
            self.assertEqual(json.loads(output.read_text()), state)
    def test_missing_dates_stay_unknown(self):
        rows = parse_feed(b'<rss><channel><item><title>Personel alimi</title><link>https://enerji.gov.tr/test</link></item></channel></rss>')
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]['applicationEndAt'])
        self.assertEqual(rows[0]['status'], 'PENDING_REVIEW')

    def test_results_are_excluded(self):
        self.assertEqual(parse_feed('<rss><channel><item><title>Personel alım sonuçları</title></item></channel></rss>'.encode()), [])

    def test_entity_rejected(self):
        with self.assertRaises(ValueError): parse_feed(b'<!DOCTYPE rss><rss><channel/></rss>')

    def test_wrong_structure(self):
        with self.assertRaises(ValueError): parse_feed(b'<html/>')

    def test_url_restrictions(self):
        for url in ['http://enerji.gov.tr/a', 'https://127.0.0.1/a', 'https://enerji.gov.tr.evil.org/a', 'https://user@enerji.gov.tr/a']:
            with self.assertRaises(ValueError): official_url(url)

if __name__ == '__main__': unittest.main()
