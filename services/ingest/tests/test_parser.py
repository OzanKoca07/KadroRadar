import unittest
from pathlib import Path
from services.ingest.import_historical import parse_pdf
class TestSource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.rows,cls.errors=parse_pdf(Path(__file__).resolve().parents[3]/'reference/minmaxlisans29072024.pdf')
 def test_first(self):
  r=next(x for x in self.rows if x['positionCode']=='301016450')
  self.assertEqual((r['title'],r['quota'],r['minScore']),('BİLGİSAYAR İŞLETMENİ',1,'83.42293'))
 def test_second(self):
  r=next(x for x in self.rows if x['positionCode']=='301016457')
  self.assertEqual((r['title'],r['minScore']),('PSİKOLOG','88.39749'))
 def test_integrity(self):
  self.assertEqual(len(self.rows),len({r['positionCode'] for r in self.rows}))
  self.assertTrue(all(x['quota']==x['placedCount']+x['vacantCount'] for x in self.rows))

class TestConnectionString(unittest.TestCase):
 def test_prisma_schema_option_removed(self):
  from unittest.mock import patch
  from services.ingest.import_historical import postgres_connection_string
  with patch.dict('os.environ', {'DATABASE_URL': 'postgresql://user:pw@localhost:5432/db?schema=public'}, clear=True):
   self.assertEqual(postgres_connection_string(), 'postgresql://user:pw@localhost:5432/db')
 def test_libpq_env_fallback(self):
  from unittest.mock import patch
  from services.ingest.import_historical import postgres_connection_string
  with patch.dict('os.environ', {}, clear=True):
   self.assertIsNone(postgres_connection_string())
