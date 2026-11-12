import unittest
from application_dates import parse_date,date_pair
from official_gazette import dates_from_pages
class DateTests(unittest.TestCase):
 def test_date_only_and_local_keep_original(self):
  for value,precision in [('2026-11-06','DATE_ONLY'),('2026-11-06T17:00:00','LOCAL_DATETIME')]:
   r=parse_date(value);self.assertEqual(r['raw'],value);self.assertEqual(r['date'],'2026-11-06');self.assertEqual(r['precision'],precision);self.assertIsNone(r['instant'])
 def test_offset_invalid_and_reversed(self):
  self.assertEqual(parse_date('2026-11-06T17:00:00+03:00')['precision'],'OFFSET_DATETIME')
  for value in ['2026-02-30','2026-11-06T24:00:00','2026-11-06T17:00:00+14:01']:self.assertEqual(parse_date(value)['precision'],'UNKNOWN')
  self.assertEqual(date_pair('2026-11-07','2026-11-06')['mode'],'UNKNOWN')
 def test_explicit_gazette_calendar_dates_not_exam_dates(self):
  r=dates_from_pages([{'page':1,'text':'Başvuru başlangıç tarihi : 26.10.2026 Son başvuru tarihi : 10.11.2026 Sınav tarihi: 20.11.2026'}]);self.assertEqual(r['applicationDates']['end']['date'],'2026-11-10');self.assertEqual(r['applicationDates']['mode'],'CALENDAR');self.assertIsNone(r['applicationEndAt'])
 def test_source_hours_have_no_invented_offset(self):
  r=dates_from_pages([{'page':1,'text':'Başvuru tarihleri: 01.11.2026 - 06.11.2026 sona erecektir. Başlangıç tarihinde saat 09:00, bitiş tarihinde saat 17:00'}]);self.assertEqual(r['applicationDates']['end']['raw'],'2026-11-06T17:00:00');self.assertIsNone(r['applicationEndAt'])
if __name__=='__main__':unittest.main()
