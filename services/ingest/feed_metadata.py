"""Offline RSS2/Atom or bounded JSON metadata review. No network or publication."""
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin
from official_rss import official_url

def parse_fact_feed(data, source_id, feed_url):
    official_url(feed_url, source_id)
    if len(data) > 2_000_000 or b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
        raise ValueError('Unsafe or oversized feed')
    document_hash = hashlib.sha256(data).hexdigest()
    def local(tag): return tag.rsplit('}', 1)[-1]
    entries = []
    if (data[3:] if data.startswith(b'\xef\xbb\xbf') else data).lstrip().startswith(b'{'):
        parsed = json.loads(data.decode('utf-8-sig'))
        if not isinstance(parsed.get('items'), list): raise ValueError('JSON items required')
        entries = [(r.get('title'), r.get('url'), r.get('publishedAt')) for r in parsed['items'] if isinstance(r, dict)]
        kind = 'JSON_METADATA'
    else:
        declaration = re.search(br'encoding=[\'"]([^\'"]+)', data[:200], re.I)
        encoding = declaration.group(1).decode('ascii').lower() if declaration else 'utf-8-sig'
        if encoding not in ('utf-8', 'utf-8-sig', 'iso-8859-9', 'windows-1254'): raise ValueError('Unsupported feed encoding')
        root = ET.fromstring(data.decode(encoding))
        if local(root.tag) not in ('rss', 'feed'): raise ValueError('RSS or Atom required')
        for element in root.iter():
            if local(element.tag) not in ('item', 'entry'): continue
            fields = {local(child.tag): child for child in element}
            def text(name):
                element = fields.get(name)
                return element.text if element is not None else None
            link = fields.get('link')
            # Atom alternate links only; never use an enclosure or image as detail URL.
            links = [c for c in element if local(c.tag) == 'link' and c.get('rel', 'alternate') == 'alternate']
            url = links[0].get('href') if links and links[0].get('href') else text('link')
            entries.append((text('title'), url, text('pubDate') or text('published') or text('updated')))
        kind = 'ATOM' if local(root.tag) == 'feed' else 'RSS2'
    if len(entries) > 1000: raise ValueError('Feed item limit')
    items, seen = [], set()
    for ordinal, (title, link, date_raw) in enumerate(entries, 1):
        if not isinstance(title, str) or not title.strip() or len(title) > 500: continue
        title = ' '.join(title.split())
        issues, url, date = [], None, None
        try: url = official_url(urljoin(feed_url, link), source_id) if isinstance(link, str) and link.strip() else None
        except ValueError: issues.append('DETAIL_HOST_REVIEW_REQUIRED')
        if url is None: issues.append('MISSING_OFFICIAL_DETAIL_URL')
        try:
            value = datetime.fromisoformat(date_raw.replace('Z', '+00:00')) if 'T' in (date_raw or '') else parsedate_to_datetime(date_raw)
            if value.tzinfo is not None: date = value.isoformat()
        except (ValueError, TypeError, AttributeError): pass
        if date is None: issues.append('UNKNOWN_PUBLICATION_DATE')
        lowered = title.casefold().replace('\u0307', '')
        event = 'CANCELLATION' if 'iptal' in lowered else 'EXTENSION' if re.search(r'süre.*uzat|tarih.*uzat', lowered) else 'RECRUITMENT' if re.search(r'personel|işçi|memur|uzman yardımc', lowered) else 'CAREER_NOTICE_REVIEW'
        facts = {'title': title, 'sourceUrl': url, 'announcedAt': date, 'organization': None,
                 'eventType': event, 'applicationStartAt': None, 'applicationEndAt': None,
                 'kpssScoreType': None, 'positions': []}
        digest = hashlib.sha256(json.dumps(facts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        if digest in seen: continue
        seen.add(digest)
        items.append({**facts, 'contentHash': digest, 'verificationStatus': 'REVIEW_REQUIRED',
                      'publishable': False, 'issues': issues + ['OWNER_AND_CONDITIONS_REQUIRE_EDITOR'],
                      'rawSourceReference': {'feedUrl': feed_url, 'itemOrdinal': ordinal, 'documentSha256': document_hash}})
    return {'format': kind, 'items': items, 'documentSha256': document_hash,
            'liveFetch': False, 'contentUse': 'METADATA_REVIEW_ONLY', 'fullDocumentPublication': 'DISABLED'}
