"""Reproducible code-native SVG artwork; PNGs rendered with the existing PyMuPDF runtime."""
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'apps' / 'mobile' / 'assets'
ASSETS.mkdir(exist_ok=True)
MARK = '''<g fill="none" stroke="{color}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
<path d="M512 426C438 380 362 379 294 395V662C375 646 446 654 512 698C578 654 649 646 730 662V395C650 376 574 389 512 426ZM512 426V698"/>
<path d="M352 476C390 474 426 482 459 500M352 548C390 546 426 554 459 572M628 232C692 232 744 282 744 346M628 174C724 174 802 252 802 346"/>
</g><circle cx="628" cy="346" r="20" fill="{color}"/>'''
for name, background, color in [
    ('icon', '#B42335', '#FFFFFF'),
    ('adaptive-foreground', None, '#FFFFFF'),
    ('splash', None, '#B42335'),
]:
    rect = f'<rect width="1024" height="1024" fill="{background}"/>' if background else ''
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">' + rect + MARK.format(color=color) + '</svg>'
    (ASSETS / (name + '.svg')).write_text(svg, encoding='utf-8')
    with fitz.open(stream=svg.encode(), filetype='svg') as document:
        page=document[0]
        page.get_pixmap(matrix=fitz.Matrix(1024/page.rect.width,1024/page.rect.height),alpha=not bool(background)).save(ASSETS / (name + '.png'))
print('PASS: original book/radar SVG artwork and 1024px PNG assets generated')
