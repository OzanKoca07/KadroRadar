import copy
import hashlib
import ipaddress
import json
import os
import socket
import ssl
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch,MagicMock
from gazette_download import ROOT,HOST,DOCUMENT_SCOPE,DownloadError,DeadlineSocket,request,validate_url,permission,cached_document,collect,public_addresses
from official_rss import REGISTRY
from official_gazette import index_manifest
from fixtures.make_gazette_fixture import make

DAY='2026-10-01'
INDEX=ROOT+'eskiler/2026/10/20261001.htm'
PDF=ROOT+'eskiler/2026/10/20261001.pdf'


def licensed():
    source=copy.deepcopy(REGISTRY['gazette']);source['enabled']=True
    source['indexingPolicy']['automatedAccess']='ALLOWED'
    source['rightsAssessment']={'status':'LICENSE_VERIFIED','evidence':{'kind':'LICENSE','url':'https://example.test/SYNTHETIC-LICENSE','sha256':'a'*64,'scopeUrl':ROOT,'scopes':['AUTOMATED_FEED_ACCESS','MOBILE_METADATA','COMMERCIAL_USE',DOCUMENT_SCOPE],'attribution':'SYNTHETIC TEST ONLY','verifiedAt':'2020-01-01T00:00:00Z','validUntil':'2035-01-01T00:00:00Z'}}
    return source


class Response:
    def __init__(self,status=200,body=b'%PDF-test',headers=None):
        self.status=status;self.body=body;self.headers={'Content-Type':'application/pdf',**(headers or {})}
    def begin(self):pass
    def getheader(self,key,default=None):return self.headers.get(key,default)
    def read1(self,size):chunk,self.body=self.body[:size],self.body[size:];return chunk
    def close(self):pass


class DownloadTests(unittest.TestCase):
    def call(self,response,url=PDF):
        sock,context=MagicMock(),MagicMock();context.wrap_socket.return_value=sock
        with patch('gazette_download.socket.getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('8.8.8.8',443))]),patch('gazette_download.socket.create_connection',return_value=sock) as tcp,patch('gazette_download.ssl.create_default_context',return_value=context) as tls,patch('gazette_download.http.client.HTTPResponse',return_value=response):
            result=request(url,1024)
            tcp.assert_called_once();self.assertEqual(tcp.call_args.args[0],('8.8.8.8',443));tls.assert_called_once_with();context.wrap_socket.assert_called_once_with(sock,server_hostname=HOST)
            return result

    def test_exact_url_and_ssrf_boundaries(self):
        self.assertEqual(validate_url(PDF).hostname,HOST)
        for url in [PDF.replace('https:','http:'),PDF.replace(HOST,'127.0.0.1'),PDF.replace(HOST,HOST+'.evil.test'),PDF.replace(HOST,'user@'+HOST),PDF+'?q=1',PDF+'#fragment',PDF.replace('2026/10','2026/99'),PDF.replace('20261001','20261099'),PDF.replace('eskiler/','eskiler/../'),ROOT+'admin.pdf',PDF.replace('20261001','%32%30%32%36')]:
            with self.subTest(url=url),self.assertRaises(DownloadError):validate_url(url)

    def test_gate_precedes_any_network(self):
        fetch=MagicMock()
        with tempfile.TemporaryDirectory() as d,self.assertRaisesRegex(ValueError,'SOURCE_REVIEW_REQUIRED'):collect(DAY,Path(d),fetch=fetch)
        fetch.assert_not_called()
        source=licensed();source['rightsAssessment']['evidence']['scopes'].remove(DOCUMENT_SCOPE)
        with self.assertRaisesRegex(ValueError,'DOCUMENT_SCOPE'):permission(source,True)
        source=licensed();source['enabled']=False
        with self.assertRaisesRegex(ValueError,'SOURCE_OPERATOR_DISABLED'):permission(source,True)

    def test_dns_private_and_mixed_answers_rejected(self):
        for addresses in [['127.0.0.1'],['::1'],['169.254.169.254'],['8.8.8.8','10.0.0.1']]:
            with patch('gazette_download.socket.getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',(ip,443)) for ip in addresses]),self.assertRaisesRegex(DownloadError,'NON_PUBLIC_DNS'):public_addresses(HOST,.1)

    def test_tls_and_dns_failures_classified(self):
        with patch('gazette_download.socket.getaddrinfo',side_effect=socket.gaierror()),self.assertRaisesRegex(DownloadError,'DNS_ERROR'):public_addresses(HOST,.1)
        with patch('gazette_download.public_addresses',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('8.8.8.8',443))]),patch('gazette_download.socket.create_connection',return_value=MagicMock()),patch('gazette_download.ssl.create_default_context',side_effect=ssl.SSLCertVerificationError()),self.assertRaises(DownloadError) as error:request(PDF,1024)
        self.assertEqual((error.exception.code,error.exception.phase),('TLS_ERROR','TLS'))

    def test_verified_transport_and_stream_limits(self):
        self.assertEqual(self.call(Response())['body'],b'%PDF-test')
        for headers,body,code in [({'Content-Type':'text/html'},b'%PDF-x','CONTENT_TYPE_REJECTED'),({},b'<html>error</html>','DOCUMENT_SIGNATURE_MISMATCH'),({'Content-Type':'image/png'},b'%PDF-x','CONTENT_TYPE_REJECTED'),({'Content-Encoding':'gzip'},b'%PDF-x','CONTENT_ENCODING_REJECTED'),({'Content-Length':'2000'},b'%PDF-x','SIZE_LIMIT'),({'Content-Length':'100'},b'%PDF-x','INCOMPLETE_BODY'),({},b'%PDF-'+b'x'*1100,'SIZE_LIMIT')]:
            with self.subTest(code=code),self.assertRaisesRegex(DownloadError,code):self.call(Response(body=body,headers=headers))

    def test_redirect_and_access_controls_never_followed(self):
        for status,code in [(302,'REDIRECT'),(403,'FORBIDDEN'),(429,'RATE_LIMITED'),(404,'NOT_FOUND')]:
            with self.subTest(status=status),self.assertRaisesRegex(DownloadError,code):self.call(Response(status,headers={'Location':'https://127.0.0.1/'}))
        with self.assertRaisesRegex(DownloadError,'UNEXPECTED_304'):self.call(Response(304))

    def test_cache_304_hash_and_expected_hash(self):
        with tempfile.TemporaryDirectory() as d:
            directory=Path(d);fetch=MagicMock(return_value={'notModified':False,'body':b'%PDF-cached','etag':'"fixture"'})
            value=cached_document(PDF,directory,fetch=fetch)
            fetch.return_value={'notModified':True};cached=cached_document(PDF,directory,value,fetch)
            self.assertEqual(cached['sha256'],value['sha256']);self.assertTrue(cached['notModified'])
            with self.assertRaisesRegex(DownloadError,'EXPECTED_HASH_MISMATCH'):cached_document(PDF,directory,value,fetch,expected_sha256='b'*64)
            (directory/value['cacheName']).write_bytes(b'changed')
            with self.assertRaisesRegex(DownloadError,'CACHE_INTEGRITY'):cached_document(PDF,directory,value,fetch)
            (directory/value['cacheName']).unlink()
            with self.assertRaisesRegex(DownloadError,'CACHE_UNAVAILABLE'):cached_document(PDF,directory,value,fetch)

    def test_bounded_retry_excludes_tls_403_429_redirect(self):
        with tempfile.TemporaryDirectory() as d,patch('gazette_download.time.sleep'):
            retry=MagicMock(side_effect=[DownloadError('TIMEOUT','TCP'),{'notModified':False,'body':b'%PDF-good'}])
            cached_document(PDF,Path(d),fetch=retry);self.assertEqual(retry.call_count,2)
            for code in ['FORBIDDEN','RATE_LIMITED','REDIRECT','TLS_ERROR']:
                fetch=MagicMock(side_effect=DownloadError(code,'HTTP_HEADERS'))
                with self.assertRaises(DownloadError):cached_document(PDF,Path(d),fetch=fetch)
                self.assertEqual(fetch.call_count,1)

    def test_fixture_download_parse_and_one_robots_fetch(self):
        with tempfile.TemporaryDirectory() as d:
            directory=Path(d);pdf=directory/'synthetic.pdf';make(pdf)
            html=('<h2>1 Ekim 2026 Tarihli ve 99999 Sayılı Resmî Gazete</h2><a href="'+PDF+'">PDF Görüntüle</a>').encode()
            calls=[]
            def fetch(url,maximum,previous=None,**kwargs):
                calls.append(url)
                body=b'User-agent: *\nAllow: /\n' if url.endswith('robots.txt') else html if url==INDEX else pdf.read_bytes()
                return {'notModified':False,'body':body,'etag':'"synthetic"'}
            report=collect(DAY,directory/'cache',source=licensed(),fetch=fetch)
            self.assertEqual(calls.count(ROOT+'robots.txt'),1);self.assertEqual(len(report['documents']),1)
            self.assertEqual(len(report['documents'][0]['parsed']['candidates']),1);self.assertFalse(report['autoPublished'])
            self.assertEqual(report['date'],DAY)

    def test_robots_disallow_stops_before_index(self):
        with tempfile.TemporaryDirectory() as d:
            fetch=MagicMock(return_value={'notModified':False,'body':b'User-agent: *\nDisallow: /\n'})
            with self.assertRaisesRegex(DownloadError,'ROBOTS_DISALLOWED'):collect(DAY,Path(d),source=licensed(),fetch=fetch)
            self.assertEqual(fetch.call_count,1)

    def test_total_header_deadline_and_timeout_phase(self):
        sock=MagicMock();calls=[]
        def remaining():
            calls.append(1)
            if len(calls)>1:raise DownloadError('TIMEOUT','HTTP_HEADERS')
            return .01
        def read(buffer):buffer[:2]=b'ab';return 2
        sock.recv_into.side_effect=read
        with self.assertRaisesRegex(DownloadError,'TIMEOUT'):DeadlineSocket(sock,remaining).makefile('rb').read(3)
        response=Response();response.begin=MagicMock(side_effect=socket.timeout())
        with self.assertRaises(DownloadError) as error:self.call(response)
        self.assertEqual((error.exception.code,error.exception.phase),('TIMEOUT','HTTP_HEADERS'))

    def test_legacy_wrapper_and_bounded_cursor(self):
        section=ROOT+'ilanlar/eskiilanlar/2026/10/20261001-4.htm'
        legacy='http://www.resmigazete.gov.tr/main.aspx?main='+section.replace('https:','http:')
        root_html='<h2>1 Ekim 2026 Tarihli ve 99999 Sayılı Resmî Gazete</h2><a href="'+legacy+'">Çeşitli İlanlar</a><a href="'+PDF+'">PDF</a>'
        links=index_manifest(root_html,INDEX)['links']
        self.assertTrue(any(l['url']==section and l['linkResolution']=='OBSERVED_MAIN_TARGET_HTTPS_CANDIDATE' for l in links))
        self.assertFalse(index_manifest('<a href="http://www.resmigazete.gov.tr/main.aspx?main=https://evil.test/20261001.pdf">PDF</a>',INDEX)['links'])
        urls=[ROOT+'ilanlar/eskiilanlar/2026/10/20261001-4-'+str(i)+'.pdf' for i in range(1,4)]
        with tempfile.TemporaryDirectory() as d:
            directory=Path(d);pdf=directory/'fixture.pdf';make(pdf);calls=[]
            def fetch(url,maximum,previous=None,**kwargs):
                calls.append(url)
                body=b'User-agent: *\nAllow: /\n' if url.endswith('robots.txt') else root_html.encode() if url==INDEX else ''.join('<a href="'+u+'">PDF</a>' for u in urls).encode() if url==section else pdf.read_bytes()
                return {'notModified':False,'body':body}
            first=collect(DAY,directory/'cache',source=licensed(),fetch=fetch)
            self.assertEqual([x['url'] for x in first['documents']],urls[:2]);self.assertNotIn(PDF,calls)
            self.assertEqual(first['transport']['pendingDocumentDate'],DAY)
            second=collect(DAY,directory/'cache',first['transport'],licensed(),fetch=fetch)
            self.assertEqual([x['url'] for x in second['documents']],urls[2:]);self.assertIsNone(second['transport']['pendingDocumentDate'])

    def test_failed_refresh_preserves_cached_bytes(self):
        with tempfile.TemporaryDirectory() as d,patch('gazette_download.time.sleep'):
            directory=Path(d);good=cached_document(PDF,directory,fetch=MagicMock(return_value={'notModified':False,'body':b'%PDF-original'}))
            before=(directory/good['cacheName']).read_bytes()
            with self.assertRaises(DownloadError):cached_document(PDF,directory,good,MagicMock(side_effect=DownloadError('TIMEOUT','HTTP_BODY')))
            self.assertEqual((directory/good['cacheName']).read_bytes(),before)

    def test_document_404_is_review_hint_not_cancellation(self):
        with tempfile.TemporaryDirectory() as d:
            def fetch(url,maximum,previous=None,**kwargs):
                if url.endswith('robots.txt'):return {'notModified':False,'body':b'User-agent: *\nAllow: /\n'}
                if url==INDEX:return {'notModified':False,'body':('<h2>1 Ekim 2026 Tarihli ve 99999 Sayılı Resmî Gazete</h2><a href="'+PDF+'">PDF</a>').encode()}
                raise DownloadError('NOT_FOUND','HTTP_HEADERS',404)
            report=collect(DAY,Path(d),{'snapshot':{'documents':{PDF:{'date':DAY,'rowRefs':{}}}}},licensed(),fetch=fetch)
            self.assertEqual(report['missingDocuments'],[{'url':PDF,'httpStatus':404}]);self.assertFalse(report['complete']);self.assertFalse(report['autoPublished'])


if __name__=='__main__':unittest.main()
