import unittest,tempfile,subprocess,sys
from pathlib import Path
from osym_web import discover
from import_historical import parse_pdf,document_metadata
class OsymTests(unittest.TestCase):
 def test_only_observed_official_links(self):
  html='<a href="https://dokuman.osym.gov.tr/actual.pdf">En küçük puanlar (Ön Lisans)</a><a href="https://evil.test/a.pdf">puanlar</a><a href="http://dokuman.osym.gov.tr/a.pdf">puanlar</a>'
  result=discover(html,'https://www.osym.gov.tr/results');self.assertEqual(len(result),1);self.assertEqual(result[0]['url'],'https://dokuman.osym.gov.tr/actual.pdf')
 def test_three_levels_and_mismatch(self):
  with tempfile.TemporaryDirectory() as directory:
   for education in ['BACHELOR','ASSOCIATE','HIGH_SCHOOL']:
    path=Path(directory)/(education+'.pdf');subprocess.run([sys.executable,str(Path(__file__).parent/'fixtures/make_historical_fixture.py'),str(path),education],check=True)
    rows,errors=parse_pdf(path,education);self.assertEqual(len(rows),1);self.assertEqual(errors,[]);self.assertEqual(document_metadata(path)['education'],education)
    with self.assertRaisesRegex(ValueError,'mismatch'):parse_pdf(path,'BACHELOR' if education!='BACHELOR' else 'ASSOCIATE')
