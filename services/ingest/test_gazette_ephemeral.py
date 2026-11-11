import copy
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch,MagicMock
from gazette_ephemeral import TransientBody,collect_ephemeral,PARSER_VERSION
from gazette_download import DownloadError
from official_gazette import parse_pdf
from test_gazette_download import licensed,DAY,INDEX,ROOT
from fixtures.make_gazette_fixture import make

PDF=ROOT+'ilanlar/eskiilanlar/2026/10/20261001-4-1.pdf'
HTML=PDF[:-4]+'.htm'

class EphemeralTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.directory=Path(self.temp.name);file=self.directory/'synthetic.pdf';make(file);self.pdf=file.read_bytes();file.unlink()
        self.index=('<h2>1 Ekim 2026 Tarihli ve 99999 Sayılı Resmî Gazete</h2><a href="'+PDF+'">Personel ilanı</a>').encode()
        self.calls=[]
    def fetch(self,url,maximum,previous=None,sink=None,**kwargs):
        self.calls.append((url,previous))
        if previous:return {'notModified':True}
        body=b'User-agent: *\nAllow: /\n' if url.endswith('robots.txt') else self.index if url==INDEX else self.pdf
        if sink:
            for n in range(0,len(body),1024):sink.write(body[n:n+1024])
            return {'notModified':False,'bytes':len(body),'etag':'"SYNTHETIC"'}
        return {'notModified':False,'body':body,'etag':'"SYNTHETIC"'}
    def collect(self,**kwargs):return collect_ephemeral(DAY,source=licensed(),fetch=self.fetch,**kwargs)
    def test_ram_and_temp_same_parser_hash_rows(self):
        a=self.collect();b=self.collect(ram_bytes=0)
        self.assertEqual(a['documents'][0]['parsed'],b['documents'][0]['parsed'])
        self.assertEqual(a['documents'][0]['sha256'],hashlib.sha256(self.pdf).hexdigest())
        self.assertEqual(a['metrics']['ramDocuments'],1);self.assertEqual(b['metrics']['tempDocuments'],1)
        self.assertEqual(a['metrics']['persistentDocumentBytes'],0)
    def test_ram_never_creates_file(self):
        with TransientBody(self.directory) as body:
            body.write(self.pdf);self.assertIsNone(body.path);self.assertEqual(len(body.parse(PDF)['candidates']),1)
        self.assertEqual(list(self.directory.iterdir()),[])
    def test_temp_cleanup_success_and_broken_pdf(self):
        for data in [self.pdf,b'%PDF-corrupt']:
            with TransientBody(self.directory,0) as body:
                body.write(data);file=body.path;self.assertTrue(file.is_file())
                if data is self.pdf:body.parse(PDF)
                else:
                    with self.assertRaisesRegex(ValueError,'BROKEN_PDF'):body.parse(PDF)
            self.assertFalse(file.exists())
    def test_size_and_disk_budget_cleanup(self):
        with TransientBody(self.directory,0,maximum=16) as body:
            with self.assertRaisesRegex(DownloadError,'SIZE_LIMIT'):body.write(b'x'*17)
        with patch('gazette_ephemeral.shutil.disk_usage',return_value=type('Disk',(),{'free':0})()),TransientBody(self.directory,0) as body:
            with self.assertRaisesRegex(DownloadError,'TEMP_SPACE_LIMIT'):body.write(self.pdf)
        self.assertEqual(list(self.directory.iterdir()),[])
    def test_304_without_pdf_does_not_reparse(self):
        a=self.collect();self.calls=[]
        with patch('gazette_ephemeral.parse_pdf',side_effect=AssertionError('MUST_NOT_REPARSE')):
            b=self.collect(previous=a['transport'])
        self.assertEqual(b['documents'],[]);self.assertEqual(b['unchangedDocuments'],[{'url':PDF,'sha256':a['documents'][0]['sha256'],'parsedAgain':False}])
        self.assertEqual(b['metrics']['downloadBytes'],0);self.assertEqual(b['metrics']['pdfDownloads'],0)
    def test_304_without_successful_parse_is_rejected(self):
        previous={'documents':{PDF:{'url':PDF,'sha256':'a'*64,'etag':'"SYNTHETIC"','parserVersion':PARSER_VERSION}}}
        def broken(url,*a,**kwargs):return {'notModified':True} if url==PDF else self.fetch(url,*a,**kwargs)
        with self.assertRaisesRegex(DownloadError,'UNEXPECTED_304'):collect_ephemeral(DAY,previous,licensed(),fetch=broken)
    def test_new_parser_forces_unconditional_download(self):
        a=self.collect();a['transport']['documents'][PDF]['parserVersion']='obsolete'
        self.calls=[];b=self.collect(previous=a['transport']);self.assertEqual(b['metrics']['pdfDownloads'],1)
        self.assertIsNone(next(p for u,p in self.calls if u==PDF))
    def test_failed_fetch_preserves_authoritative_previous_state(self):
        previous=self.collect()['transport'];before=copy.deepcopy(previous);count=0
        def fail(url,*a,**kwargs):
            nonlocal count
            if url==PDF:count+=1;raise DownloadError('TIMEOUT','HTTP_BODY')
            return self.fetch(url,*a,**kwargs)
        with self.assertRaises(DownloadError):collect_ephemeral(DAY,previous,licensed(),fetch=fail)
        self.assertEqual(count,1);self.assertEqual(previous,before)
    def test_source_gate_before_network(self):
        fetch=MagicMock()
        with self.assertRaisesRegex(ValueError,'SOURCE_REVIEW_REQUIRED'):collect_ephemeral(DAY,fetch=fetch)
        fetch.assert_not_called()
    def test_html_only_verified_facts_and_missing_html_pdf_fallback(self):
        full=('<h2>1 Ekim 2026 Sayı : 99999</h2><h3>Örnek Üniversitesi Rektörlüğünden:</h3><p>Personel alım ilanı</p><p>Başvuru başlangıç tarihi: 01.10.2026</p><p>Son başvuru tarihi: 15.10.2026</p><table><tr><th>Unvan</th><th>Kontenjan</th><th>Şartlar</th></tr><tr><td>Memur</td><td>2</td><td>Lisans KPSSP3 en az 70 puan</td></tr></table>').encode()
        self.index=self.index.replace(('<a href="'+PDF+'">').encode(),('<a href="'+HTML+'">').encode())
        def htmlfetch(url,*a,**kwargs):return {'notModified':False,'body':full,'etag':'"HTML"'} if url==HTML else self.fetch(url,*a,**kwargs)
        a=collect_ephemeral(DAY,source=licensed(),fetch=htmlfetch);self.assertEqual(a['metrics']['pdfDownloads'],0);self.assertEqual(a['documents'][0]['format'],'html');self.assertEqual(a['documents'][0]['parsed']['metrics']['positionRows'],1)
        saved=self.index;self.index=full
        embedded=self.collect();self.assertEqual(embedded['documents'][0]['url'],INDEX);self.assertEqual(embedded['metrics']['pdfDownloads'],0)
        again=self.collect(previous=embedded['transport']);self.assertEqual(again['documents'],[]);self.assertEqual(again['unchangedDocuments'][0]['url'],INDEX)
        self.index=saved
        self.index+=('<a href="'+PDF+'">PDF</a>').encode()
        def thin(url,*a,**kwargs):return {'notModified':False,'body':b'<p>personnel title only</p>','etag':'"THIN"'} if url==HTML else self.fetch(url,*a,**kwargs)
        b=collect_ephemeral(DAY,source=licensed(),fetch=thin);self.assertEqual(b['metrics']['pdfDownloads'],1);self.assertEqual(len(b['documents'][0]['parsed']['candidates']),1)
    def test_forbidden_rate_tls_redirect_no_retry(self):
        for code in ['FORBIDDEN','RATE_LIMITED','TLS_ERROR','REDIRECT']:
            calls=[]
            def fail(url,*a,**kwargs):
                if url==PDF:calls.append(url);raise DownloadError(code,'TLS' if code=='TLS_ERROR' else 'HTTP_HEADERS')
                return self.fetch(url,*a,**kwargs)
            with self.subTest(code=code),self.assertRaises(DownloadError):collect_ephemeral(DAY,source=licensed(),fetch=fail)
            self.assertEqual(len(calls),1)
    def test_empty_challenge_html_cannot_be_successful_empty_scan(self):
        self.index=b'<html>Maintenance</html>'
        with self.assertRaisesRegex(DownloadError,'INDEX_CONTENT_REVIEW'):self.collect()

if __name__=='__main__':unittest.main()
