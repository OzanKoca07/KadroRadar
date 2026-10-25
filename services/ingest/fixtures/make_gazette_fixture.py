"""Generate a clearly synthetic offline PDF; never a real Gazette publication."""
import sys
from pathlib import Path
import fitz

def make(path):
    fonts=[Path('C:/Windows/Fonts/arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]
    font=next((p for p in fonts if p.exists()),None)
    if not font:raise RuntimeError('Fixture font unavailable')
    with fitz.open() as document:
        page=document.new_page(width=595,height=842);page.insert_font(fontname='fixture',fontfile=str(font))
        page.insert_text((30,35),'SYNTHETIC TEST ONLY - 1 Ekim 2026 Sayı : 99999\nÖrnek Üniversitesi Rektörlüğünden:\n4/B SÖZLEŞMELİ PERSONEL ALIM İLANI',fontname='fixture',fontsize=10)
        xs=[30,160,210,320,565];y1,y2=130,230
        for x in xs:page.draw_line((x,y1),(x,y2))
        page.draw_line((30,y1),(565,y1));page.draw_line((30,y2),(565,y2))
        for index,text in enumerate(['Destek Personeli','2','KPSS P94\n2024','En az60 puan.\nOrtaöğretim mezunu olmak.']):page.insert_text((xs[index]+5,y1+20),text,fontname='fixture',fontsize=9)
        page=document.new_page();page.insert_font(fontname='fixture',fontfile=str(font));page.insert_text((30,40),'1 Ekim 2026 Sayı : 99999\nBaşvuru tarihi belirtilmemiştir.\nTEST FIXTURE\n9999/1-1',fontname='fixture',fontsize=10)
        document.save(path)

if __name__=='__main__':make(sys.argv[1])
