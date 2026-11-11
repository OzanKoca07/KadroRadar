"""Test-only network replacement: actual downloaded bytes with checked URL/hash.

Never imported by production adapters and never fabricates an official document.
"""
import os,sys,json,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import osym_web
cache=Path(os.environ['OSYM_TEST_CACHE']).resolve()
def cached(url,limit):
    key=hashlib.sha256(url.encode()).hexdigest();info=json.loads((cache/(key+'.json')).read_text(encoding='utf-8'));data=(cache/(key+'.bin')).read_bytes()
    if info['url']!=url or info['sha256']!=hashlib.sha256(data).hexdigest() or len(data)>limit:raise ValueError('Real-source test cache integrity failure')
    return data
osym_web.fetch=cached
print(json.dumps({**osym_web.main(),'testTransport':'CACHED_REAL_OFFICIAL_DOCUMENTS'},ensure_ascii=True))
