"""Kariyer Kapisi metadata adapter. Offline by default; network requires source rights.

Descriptions/enclosures are never retained or fetched. Feed metadata is not
verified application conditions and cannot itself authorize publication.
"""
import argparse
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode
from official_rss import REGISTRY, official_url, check_robots, classify_error
from source_rights import require_network_permission


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value.casefold().replace('ı', 'i')) if not unicodedata.combining(c))


def category_code(value):
    value = normalized(value)
    if 'gorevde yuksel' in value or 'unvan degisik' in value: return 'INTERNAL'
    if 'egitim' in value or 'burs' in value: return 'EDUCATION'
    if 'merkezi yerlestirme' in value or 'osym' in value or 'sinav' in value: return 'EXAM_PLACEMENT'
    if any(s in value for s in ('sozlesmeli personel', 'a grubu memur', 'b grubu memur', 'isci', 'akademik personel')): return 'PERSONNEL'
    return 'OTHER'


def canonical_url(value, feed):
    value = official_url(urljoin(feed, value), 'career')
    u = urlsplit(value)
    if '\\' in value or any(ord(c) < 33 for c in value) or len(value) > 2048: raise ValueError('INVALID_DETAIL_URL')
    query = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True) if not k.lower().startswith('utm_')]
    result = urlunsplit(('https', u.hostname, u.path or '/', urlencode(sorted(query)), ''))
    if urlsplit(result).path.rstrip('/').casefold() in ('', '/rss'): raise ValueError('DETAIL_URL_REQUIRED')
    return result


def parse_career_feed(data, feed_url=None, now=None):
    feed_url = feed_url or REGISTRY['career']['feed']
    official_url(feed_url, 'career')
    if len(data) > 2_000_000: raise ValueError('FEED_SIZE_LIMIT')
    # Decode before checking DTD; UTF-16 byte interleaving must not bypass the check.
    declaration = re.search(br'encoding=[\'"]([^\'"]+)', data[:200], re.I)
    encoding = declaration.group(1).decode('ascii').lower() if declaration else 'utf-8-sig'
    if data.startswith((b'\xff\xfe', b'\xfe\xff')): encoding = 'utf-16'
    if encoding not in ('utf-8', 'utf-8-sig', 'utf-16', 'iso-8859-9', 'windows-1254'): raise ValueError('FEED_ENCODING')
    text = data.decode(encoding)
    if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper(): raise ValueError('UNSAFE_XML')
    root = ET.fromstring(text)
    if root.tag != 'rss' or root.attrib.get('version') != '2.0' or root.find('channel') is None: raise ValueError('RSS2_REQUIRED')
    items = root.findall('./channel/item')
    if len(items) > 1000: raise ValueError('FEED_ITEM_LIMIT')
    now = now or datetime.now(timezone.utc)
    digest = hashlib.sha256(data).hexdigest()
    rows, unresolved, seen = [], [], {}
    for ordinal, item in enumerate(items, 1):
        title = ' '.join((item.findtext('title') or '').split())
        guid = (item.findtext('guid') or '').strip()
        categories = [' '.join((c.text or '').split()) for c in item.findall('category')]
        category = categories[0] if len(categories) == 1 else None
        issues = ['APPLICATION_DATES_UNKNOWN', 'EMPLOYER_REQUIRES_EDITOR', 'CONDITIONS_UNKNOWN']
        if not title or len(title) > 1000 or not guid or len(guid) > 1024 or len(categories) > 20 or any(len(c) > 250 for c in categories):
            unresolved.append({'itemOrdinal': ordinal, 'issue': 'INVALID_IDENTITY_OR_TITLE'}); continue
        try: url = canonical_url((item.findtext('link') or '').strip(), feed_url)
        except ValueError:
            unresolved.append({'itemOrdinal': ordinal, 'issue': 'INVALID_OFFICIAL_DETAIL_URL'}); continue
        date = None
        try:
            parsed = parsedate_to_datetime(item.findtext('pubDate'))
            if parsed.tzinfo is not None: date = parsed.astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, AttributeError, OverflowError): pass
        if date is None: issues.append('PUBLICATION_DATE_UNKNOWN')
        if date and parsed > now: issues.append('FUTURE_PUBLICATION_REVIEW')
        category_id = category_code(category or '')
        if not category: issues.append('CATEGORY_AMBIGUOUS')
        lower = normalized(title)
        event = 'CANCELLATION' if 'iptal' in lower else 'EXTENSION' if re.search(r'(sure|tarih).*uzat', lower) else 'RECRUITMENT'
        guid_hash = hashlib.sha256(guid.encode()).hexdigest()
        facts = {'sourceId': 'career', 'guidHash': guid_hash, 'sourceUrl': url, 'title': title,
                 'category': category, 'categories': categories, 'categoryCode': category_id,
                 'organization': None, 'organizationVerification': 'UNKNOWN', 'announcedAt': date,
                 'applicationStartAt': None, 'applicationEndAt': None, 'applicationUrl': None,
                 'quota': None, 'city': None, 'kpssScoreType': None, 'positions': [],
                 'eventType': event, 'eventVerified': False}
        content_hash = hashlib.sha256(json.dumps(facts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        if guid_hash in seen:
            if seen[guid_hash] != content_hash: raise ValueError('CONFLICTING_GUID')
            continue
        seen[guid_hash] = content_hash
        rows.append({**facts, 'contentHash': content_hash, 'issues': issues,
                     'publishable': False, 'verificationStatus': 'REVIEW_REQUIRED',
                     'rawSourceReference': {'feedUrl': feed_url, 'guidHash': guid_hash,
                                            'documentSha256': digest, 'itemOrdinal': ordinal}})
    return {'sourceId': 'career', 'format': 'RSS2', 'rows': rows, 'unresolved': unresolved,
            'itemCount': len(items), 'documentSha256': digest, 'positionRows': 0,
            'liveFetch': False, 'fullDocumentPublication': 'DISABLED'}


def sync(output):
    source = REGISTRY['career']; feed = source['feed']
    require_network_permission(source, feed, require_enabled=True)
    check_robots('career', feed)
    from rss_transport import fetch_feed
    state = json.loads(output.read_text(encoding='utf-8')) if output.exists() else {}
    result = fetch_feed(feed, 'career', state)
    if result['notModified']:
        return {'notModified': True, 'rows': [], 'unresolved': [], 'missingGuids': [], 'transport': state.get('transport', {})}
    report = parse_career_feed(result['body'], feed)
    # An incomplete/invalid snapshot must not generate disappearance signals or advance validators.
    if report['unresolved']: raise ValueError('INCOMPLETE_FEED_REVIEW_REQUIRED')
    current = [row['guidHash'] for row in report['rows']]
    missing = sorted(set(state.get('transport', {}).get('knownGuids', [])) - set(current))
    transport = {**result['transport'], 'documentSha256': report['documentSha256'], 'knownGuids': current}
    payload = {**report, 'liveFetch': True, 'notModified': False, 'missingGuids': missing, 'transport': transport}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp'); temporary.write_text(json.dumps({'transport': transport}), encoding='utf-8'); temporary.replace(output)
    return payload


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--fixture', type=Path); parser.add_argument('--url'); parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        if args.fixture: result = parse_career_feed(args.fixture.read_bytes(), args.url)
        elif args.output: result = sync(args.output)
        else: raise ValueError('FIXTURE_OR_OUTPUT_REQUIRED')
        print(json.dumps(result, ensure_ascii=True))
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and str(error) in ('INCOMPLETE_FEED_REVIEW_REQUIRED', 'CONFLICTING_GUID', 'UNSAFE_XML', 'RSS2_REQUIRED') else classify_error(error)
        print(json.dumps({'status': code, 'errorType': type(error).__name__})); raise SystemExit(1)
