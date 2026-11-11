"""Synthetic offline HTML/XLSX fixture; not an official source."""
import sys,zipfile
from pathlib import Path
from xml.sax.saxutils import escape
path=Path(sys.argv[1]);nonce=sys.argv[2]
if not nonce.isdigit() or len(nonce)>8:raise ValueError('Fixture nonce invalid')
rows=[['KPSS-2022/1 Puanlar (Lisans)'],['3'+nonce.zfill(8),'SENTETİK FORMAT TESTİ / İZMİR / MERKEZ','SENTETİK MEMUR','1','1','0','100,00000','100,00000']]
if path.suffix=='.xlsx':
 body=''.join('<row>'+''.join('<c t="inlineStr"><is><t>'+escape(value)+'</t></is></c>' for value in row)+'</row>' for row in rows)
 with zipfile.ZipFile(path,'w') as archive:archive.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+body+'</sheetData></worksheet>')
else:path.write_text('<table>'+''.join('<tr>'+''.join('<td>'+escape(value)+'</td>' for value in row)+'</tr>' for row in rows)+'</table>',encoding='utf-8')
