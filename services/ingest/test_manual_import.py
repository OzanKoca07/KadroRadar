import tempfile
import unittest
from pathlib import Path
from manual_import import load_records, validate

class ManualTests(unittest.TestCase):
    def test_turkish_csv_and_duplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'rows.csv'
            path.write_text('başlık;kurum;kaynak;kontenjan\nİşçi alımı;Test;https://enerji.gov.tr/test;2\nİşçi alımı;Test;https://enerji.gov.tr/test;2\n', encoding='utf-8-sig')
            result = validate(load_records(path))
            self.assertEqual(result['accepted'], 1)
            self.assertEqual(result['rejected'], 1)
            self.assertEqual(result['rows'][0]['quota'], 2)

    def test_wrong_host(self):
        self.assertEqual(validate([{'title':'Test','organization':'Test','sourceUrl':'https://127.0.0.1'}])['rejected'],1)

    def test_missing_fields(self):
        self.assertEqual(validate([{}])['rejected'],1)

if __name__ == '__main__': unittest.main()
