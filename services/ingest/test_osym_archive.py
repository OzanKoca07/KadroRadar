import unittest,tempfile,zipfile,json,os,re,hashlib
from pathlib import Path
from xml.sax.saxutils import escape
from osym_web import discover,discover_archive,discover_qualifications,metadata_from_text,index_url,published_date
from import_historical import parse_document,parse_pdf

class ArchiveTests(unittest.TestCase):
 def test_central_periods_only_and_no_guessed_links(self):
  html='<a href="/observed">24 Temmuz 2026 KPSS-2026/1: Bazı Kamu Kurum ve Kuruluşların Sayısal Bilgiler</a><a href="/health">KPSS-2025/5 Sağlık Bakanlığı Sayısal Bilgiler</a><a href="https://evil.test/a">KPSS-2025/1 Bazı Kamu Kurum Sayısal Bilgiler</a>'
  found=discover_archive(html,'https://osym.gov.tr/archive');self.assertEqual(len(found),1);self.assertEqual(found[0]['indexUrl'],'https://osym.gov.tr/observed');self.assertEqual(found[0]['publishedAt'],'2026-07-24')
 def test_levels_and_ambiguous_label(self):
  for label,value in [('ÖN LİSANS','ASSOCIATE'),('ORTAÖĞRETİM','HIGH_SCHOOL'),('LİSANS','BACHELOR')]:self.assertEqual(metadata_from_text('KPSS-2025/2 '+label)['education'],value)
  self.assertIsNone(metadata_from_text('Lisans / Ön Lisans')['education'])
 def test_nested_labels_relative_links_and_formats(self):
  html='<a href="https://dokuman.osym.gov.tr/observed.xlsx"><b>KPSS-2025/2</b> En Büyük Puanlar (Lisans)</a><a href="https://dokuman.osym.gov.tr/not-observed.pdf">Kılavuz</a>'
  links=discover(html,'https://osym.gov.tr/observed');self.assertEqual(len(links),1);self.assertEqual((links[0]['year'],links[0]['round'],links[0]['format']),(2025,2,'xlsx'))
 def test_qualification_sources_never_enable_matching(self):
  links=discover_qualifications('<a href="https://dokuman.osym.gov.tr/real.pdf">Ön Lisans Mezunları İçin Nitelik Kodları</a>','https://osym.gov.tr/guide');self.assertEqual(links[0]['education'],'ASSOCIATE');self.assertFalse(links[0]['verifiedForMatching'])
 def test_official_index_boundary(self):
  for url in ['http://osym.gov.tr/a','https://osym.gov.tr.evil.test/a','https://user:pw@osym.gov.tr/a','https://osym.gov.tr:444/a']:
   with self.assertRaises(ValueError):index_url(url)
  self.assertEqual(index_url('https://osym.gov.tr/real'),'https://osym.gov.tr/real')
 def test_dates_not_inferred_from_pdf_name(self):
  self.assertIsNone(published_date('minmaxort07012025.pdf'));self.assertEqual(published_date('7 Ocak 2026'),'2026-01-07')
 def test_observed_link_period_must_match_actual_pdf(self):
  from unittest.mock import patch
  import osym_web
  with tempfile.TemporaryDirectory() as folder:
   output=Path(folder)/'document.pdf';url='https://dokuman.osym.gov.tr/not-live-fixture.pdf'
   html=('<a href="'+url+'">KPSS-2026/1 En Büyük Puanlar (Lisans)</a>').encode()
   source=Path(__file__).resolve().parents[2]/'reference/minmaxlisans29072024.pdf'
   with patch.object(osym_web,'fetch',side_effect=[html,source.read_bytes()]),patch('sys.argv',['osym_web','--index','https://osym.gov.tr/fixture','--document',url,'--output',str(output)]):
    with self.assertRaisesRegex(ValueError,'disagrees'):osym_web.main()
   self.assertFalse(output.exists())
 def test_html_precision_empty_scores_and_duplicate(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'table.html';header='<h1>KPSS-2025/2 Puanlar (Lisans)</h1>'
   row='<tr>'+''.join('<td>'+x+'</td>' for x in ['301000001','DOĞRULAMA / İZMİR / MERKEZ','MÜHENDİS','1','1','0','100,00000','100,00000'])+'</tr>'
   path.write_text(header+'<table>'+row+'</table>',encoding='utf-8');rows,errors=parse_document(path);self.assertEqual(errors,[]);self.assertEqual(rows[0]['maxScore'],'100.00000');self.assertEqual(rows[0]['city'],'İZMİR')
   path.write_text(header+'<table>'+row+row+'</table>',encoding='utf-8');self.assertTrue(parse_document(path)[1])
   path.write_text(header+'<table>'+row.replace('100,00000','99,123456')+'</table>',encoding='utf-8');self.assertTrue(parse_document(path)[1])
 def test_xlsx_and_formula_rejection(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'source.xlsx'
   values=[['KPSS-2025/1 Puanlar (Ön Lisans)'],['201000001','KURUM / ANKARA / MERKEZ','TEKNİKER','2','0','2','--','--']]
   def save(formula=False):
    body=''.join('<row>'+''.join('<c t="inlineStr">'+('<f>1+1</f>' if formula else '')+'<is><t>'+escape(value)+'</t></is></c>' for value in row)+'</row>' for row in values)
    with zipfile.ZipFile(path,'w') as archive:archive.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+body+'</sheetData></worksheet>')
   save();rows,errors=parse_document(path);self.assertEqual(errors,[]);self.assertIsNone(rows[0]['minScore']);self.assertEqual(rows[0]['vacantCount'],2)
   save(True)
   with self.assertRaisesRegex(ValueError,'Formula'):parse_document(path)
 def test_legacy_binary_is_explicitly_unsupported(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'legacy.xls';path.write_bytes(bytes.fromhex('d0cf11e0')+b'fixture')
   with self.assertRaisesRegex(ValueError,'Legacy XLS'):parse_document(path)

@unittest.skipUnless(os.environ.get('OSYM_REAL_CATALOG'),'Real downloaded catalog not configured; not a live import')
class RealDocuments(unittest.TestCase):
 def test_all_selected_real_documents_and_row_coverage(self):
  import fitz
  catalog=json.loads(Path(os.environ['OSYM_REAL_CATALOG']).read_text(encoding='utf-8'));self.assertEqual(len(catalog['documents']),18)
  for document in catalog['documents']:
   with self.subTest(period=document['period'],education=document['education']):
    path=Path(document['file']);self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),document['documentSha256']);rows,errors=parse_pdf(path,document['education']);self.assertEqual(errors,[]);self.assertEqual(len(rows),document['parsed'])
    with fitz.open(path) as source:tokens=sum(len(re.findall(r'(?m)^[123]\d{8}\s*$',page.get_text())) for page in source)
    self.assertEqual(tokens,len(rows),'No printed source row may be silently omitted')
