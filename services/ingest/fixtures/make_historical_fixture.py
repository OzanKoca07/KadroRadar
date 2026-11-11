"""Explicit synthetic offline table, never real placement data."""
import sys
from pathlib import Path
import fitz
path,education=sys.argv[1:3]
nonce=sys.argv[3] if len(sys.argv)>3 else '01999999'
if not nonce.isdigit() or len(nonce)>8:raise ValueError('Fixture nonce invalid')
prefix,label={'BACHELOR':('3','Lisans'),'ASSOCIATE':('2','Ön Lisans'),'HIGH_SCHOOL':('1','Ortaöğretim')}[education]
font=Path('C:/Windows/Fonts/arial.ttf')
if not font.exists():font=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
with fitz.open() as doc:
 page=doc.new_page();page.insert_font(fontname='fixture',fontfile=str(font))
 lines=[f'KPSS-2024/1 En Küçük ve En Büyük Puanlar ({label})',prefix+nonce.zfill(8),'SENTETİK KURUM / TEST / MERKEZ','SENTETİK MEMUR','1','1','0','80,12345 80,12345']
 for i,line in enumerate(lines):page.insert_text((40,40+i*24),line,fontsize=12,fontname='fixture')
 doc.save(path)
