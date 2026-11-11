"""Preserve raw source dates. No implicit timezone and no 23:59 closing time."""
import re
from datetime import datetime,date

def parse_date(value):
 result={'precision':'UNKNOWN','raw':value if isinstance(value,str) and len(value)<=80 else None,'date':None,'instant':None}
 if not isinstance(value,str):return result
 if not re.fullmatch(r'20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?)?',value):return result
 try:
  if len(value)==10:date.fromisoformat(value);result.update(precision='DATE_ONLY',date=value);return result
  d=datetime.fromisoformat(value.replace('Z','+00:00'))
  suffix=re.search(r'([+-])(\d{2}):(\d{2})$',value)
  if suffix and (int(suffix[2])>14 or int(suffix[3])>59 or int(suffix[2])==14 and int(suffix[3])!=0):return result
  result.update(precision='OFFSET_DATETIME' if d.utcoffset() is not None else 'LOCAL_DATETIME',date=value[:10],instant=d.isoformat() if d.utcoffset() is not None else None)
 except ValueError:pass
 return result

def date_pair(start,end):
 a,b=parse_date(start),parse_date(end);exact=a['precision']=='OFFSET_DATETIME' and b['precision']=='OFFSET_DATETIME'
 valid=bool(a['date'] and b['date']) and (datetime.fromisoformat(a['instant'])<=datetime.fromisoformat(b['instant']) if exact else a['precision']!='OFFSET_DATETIME' and b['precision']!='OFFSET_DATETIME' and a['date']<=b['date'])
 return {'start':a,'end':b,'mode':('INSTANT' if exact else 'CALENDAR') if valid else 'UNKNOWN','calendarVerified':valid}
