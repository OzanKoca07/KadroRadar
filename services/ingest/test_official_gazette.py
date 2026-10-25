import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import fitz
from official_gazette import MAX_BYTES,classify,metadata,page_quality,positions_from_table,event_type,parse_pdf,dates_from_pages,discover_index

class GazetteTests(unittest.TestCase):
    def test_html_discovery_is_observed_only(self):
        html='<a href="/eskiler/2026/09/20260924.pdf">1. Mükerrer PDF</a><a href="http://127.0.0.1/private.pdf">bad</a><a href="https://www.resmigazete.gov.tr.evil.test/a.pdf">bad</a>'
        links=discover_index(html,'https://www.resmigazete.gov.tr/')
        self.assertEqual(len(links),1);self.assertEqual(links[0]['observedDate'],'2026-09-24');self.assertTrue(links[0]['supplemental']);self.assertFalse(links[0]['verifiedDownload'])
        with self.assertRaises(ValueError):discover_index(html,'http://www.resmigazete.gov.tr/')
    def test_tender_and_court_are_not_personnel(self):
        self.assertEqual(classify('Üniversite Rektörlüğünden: 4734 sayılı kanunla ihale ilanı'), 'TENDER')
        self.assertEqual(classify('Asliye Mahkemesinden: esas no 2026/1 ilanen tebliğ'), 'COURT')

    def test_broken_encoding_and_ocr(self):
        self.assertIn('BROKEN_ENCODING', page_quality(('abc\x13\x14' * 40)))
        self.assertIn('OCR_REQUIRED', page_quality(''))

    def test_metadata_not_application_date(self):
        self.assertEqual(metadata('24 Eylül 2026 Sayı : 33380'), ('2026-09-24','33380'))
        self.assertIsNone(dates_from_pages([{'page':1,'text':'24 Eylül 2026 Sayı : 33380'}])['applicationStartAt'])

    def test_cancellation_reservation_is_not_cancellation(self):
        self.assertEqual(event_type('PERSONEL ALIM İLANI\nKurum iptal ve değişiklik yapma hakkına sahiptir.'),'RECRUITMENT')
        self.assertEqual(event_type('PERSONEL ALIM İPTAL DUYURUSU'),'CANCELLATION')
        self.assertEqual(event_type('Personel alım düzeltme ilanı'),'CORRECTION')

    def test_row_conditions_are_never_complete(self):
        rows=[['Sağlık Teknikeri','2','KPSS P93 2024','Ön lisans mezunu olmak. En az60 puan.']]
        result=positions_from_table(rows,1,0,'')
        self.assertEqual(result[0]['quota'],2)
        self.assertFalse(result[0]['requirements']['complete'])
        self.assertEqual(result[0]['requirements']['educationLevels'],['ONLISANS'])

    def test_broken_pdf(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'bad.pdf';path.write_bytes(b'%PDF-1.7\nbroken')
            with self.assertRaises(ValueError):parse_pdf(path)
            path.write_bytes(b'<html>not pdf</html>')
            with self.assertRaisesRegex(ValueError,'SIGNATURE'):parse_pdf(path)

    def test_image_or_empty_page_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'blank.pdf'
            with fitz.open() as doc:doc.new_page();doc.save(path)
            result=parse_pdf(path)
            self.assertIn('OCR_REQUIRED',result['pageReports'][0]['issues'])
            self.assertEqual(result['inspectedPages'],1)

    def test_ocr_failure_is_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'ocr.pdf'
            with fitz.open() as doc:doc.new_page();doc.save(path)
            with patch('official_gazette.ocr_page',side_effect=RuntimeError('fixture unavailable engine')):
                result=parse_pdf(path,ocr_pages={1})
            self.assertIn('OCR_UNAVAILABLE',result['pageReports'][0]['issues'])

    def test_ocr_evidence_never_changes_canonical_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'blank.pdf'
            with fitz.open() as doc:doc.new_page();doc.save(path)
            with patch('official_gazette.ocr_page',return_value={'text':'Yanlış OCR 999 personel 01/01/2027','issues':['OCR_TEXT_CONFLICT'],'canonicalFieldsChanged':False}):
                result=parse_pdf(path,ocr_pages={1})
            self.assertEqual(result['candidates'],[])
            self.assertIn('OCR_TEXT_CONFLICT',result['pageReports'][0]['issues'])
            self.assertFalse(result['pageReports'][0]['ocr']['canonicalFieldsChanged'])
            with self.assertRaisesRegex(ValueError,'OCR_PAGE_LIMIT'):parse_pdf(path,ocr_pages=set(range(1,12)))

    def test_encrypted_pdf_and_size_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'private.pdf'
            with fitz.open() as doc:doc.new_page();doc.save(path,encryption=fitz.PDF_ENCRYPT_AES_256,user_pw='fixture-password')
            with self.assertRaisesRegex(ValueError,'ENCRYPTED'):parse_pdf(path)
            path=Path(directory)/'large.pdf'
            with path.open('wb') as handle:handle.seek(MAX_BYTES);handle.write(b'0')
            with self.assertRaisesRegex(ValueError,'SIZE_LIMIT'):parse_pdf(path)

@unittest.skipUnless(os.environ.get('GAZETTE_REAL_PDF'),'Real33380 PDF path not provided; no synthetic substitute')
class RealGazette33380Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.result=parse_pdf(Path(os.environ['GAZETTE_REAL_PDF']))

    def test_document_identity_and_quality(self):
        self.assertEqual(self.result['pageCount'],140)
        self.assertEqual(self.result['inspectedPages'],140)
        self.assertEqual(self.result['gazetteNumber'],'33380')
        self.assertEqual(self.result['gazetteDate'],'2026-09-24')
        self.assertIn('BROKEN_ENCODING',self.result['pageReports'][0]['issues'])

    def test_nigde_rows_and_dates(self):
        item=next(c for c in self.result['candidates'] if 'Niğde Ömer Halisdemir' in c['organization'])
        self.assertEqual((item['sourceEvidence']['pageStart'],item['sourceEvidence']['pageEnd']),(85,89))
        self.assertEqual(item['quota'],29);self.assertEqual(len(item['positions']),8)
        self.assertEqual(sum(p['quota'] for p in item['positions'] if p['title'].startswith('Destek Personeli')),20)
        self.assertEqual(sum(p['quota'] for p in item['positions'] if p['title'].startswith('Sağlık Teknikeri')),9)
        self.assertEqual({p['requirements']['kpssScoreType'] for p in item['positions']},{'P93','P94'})
        self.assertTrue(all(p['requirements']['kpssMinimumScore']==60 for p in item['positions']))
        self.assertEqual(item['applicationStartAt'],'2026-09-24T09:00:00+03:00')
        self.assertEqual(item['applicationEndAt'],'2026-10-09T13:00:00+03:00')

    def test_atalan_conditions_and_uncertain_hours(self):
        item=next(c for c in self.result['candidates'] if 'Atalan' in c['organization'])
        self.assertEqual((item['sourceEvidence']['pageStart'],item['sourceEvidence']['pageEnd']),(90,92))
        self.assertEqual(item['quota'],1);self.assertEqual(len(item['positions']),1)
        conditions=item['positions'][0]['requirements']
        self.assertEqual(conditions['kpssScoreType'],'P93');self.assertEqual(conditions['kpssMinimumScore'],60)
        self.assertEqual(conditions['educationLevels'],['ONLISANS'])
        self.assertIn('DRIVING_LICENSE_B',conditions['certificates'])
        self.assertIn('Harita',item['positions'][0]['qualificationText'])
        self.assertIsNone(item['applicationEndAt']);self.assertIsNone(item['applicationUrl'])
        self.assertFalse(conditions['complete']);self.assertFalse(conditions['degreeCodesVerified'])
        self.assertTrue(item['sourceEvidence']['dateSuggestions'])

    def test_reimport_stable_identity(self):
        again=parse_pdf(Path(os.environ['GAZETTE_REAL_PDF']))
        self.assertEqual(self.result['sha256'],again['sha256'])
        self.assertEqual([c['identity'] for c in self.result['candidates']],[c['identity'] for c in again['candidates']])

if __name__=='__main__':unittest.main()
