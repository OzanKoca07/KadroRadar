"""Read the ministry's advertised RSS feed into a local review queue.

No publication or database writes. Run with Python 3.11+.
"""
import argparse
import hashlib
import json
import re
import os
import socket
import ssl
import urllib.error
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urljoin
from source_rights import require_network_permission

FEED = 'https://enerji.gov.tr/RSS/15?t=1'
USER_AGENT = 'KadroRadar/0.1 (official RSS reader)'
REGISTRY = json.loads((Path(__file__).resolve().parents[2] / 'packages' / 'official-sources.json').read_text(encoding='utf-8'))

def official_url(value, source_id='energy'):
    parsed = urlsplit(value)
    source = REGISTRY.get(source_id)
    if not source or source_id == 'ilan' or source.get('rightsAssessment', {}).get('status') == 'RESTRICTED' or parsed.scheme != 'https' or parsed.hostname not in source['hosts'] or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError('Unapproved source URL')
    return value

def validate_outbound_dns(value, source_id='energy'):
    import ipaddress
    official_url(value, source_id)
    addresses = socket.getaddrinfo(urlsplit(value).hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError('Non-public source DNS rejected')
    # Fetching remains restricted to registered hosts and redirects are rejected.
    # DNS pinning is not implemented; enforce egress filtering at deployment too.

def parse_feed_report(content):
    if len(content) > 2_000_000 or b'<!DOCTYPE' in content.upper() or b'<!ENTITY' in content.upper():
        raise ValueError('Unsafe or oversized XML')
    root = ET.fromstring(content)
    if root.tag != 'rss' or root.find('channel') is None:
        raise ValueError('Unexpected feed structure')
    rows, unresolved = [], []
    document_hash = hashlib.sha256(content).hexdigest()
    items = root.findall('./channel/item')
    for ordinal, item in enumerate(items, 1):
        title = (item.findtext('title') or '').strip()
        if not re.search(r'personel|işçi|uzman yardımc|müfettiş yardımc', title, re.I):
            continue
        if not re.search(r'alım|alın|giriş sınav', title, re.I):
            continue
        if re.search(r'sonuç|kazanan|yerleş|hak kazanan|adayların listesi|sözlü sınav', title, re.I):
            continue
        raw_url = (item.findtext('link') or '').strip()
        if not raw_url:
            unresolved.append({'title': title, 'issue': 'MISSING_OFFICIAL_DETAIL_URL',
                               'rawSourceReference': {'feedUrl': FEED, 'itemOrdinal': ordinal,
                                   'documentSha256': document_hash,
                                   'itemSha256': hashlib.sha256(ET.tostring(item)).hexdigest()},
                               'announcedAtRaw': item.findtext('pubDate') or item.findtext('PublishStartDate'),
                               'verificationStatus': 'UNKNOWN', 'publishable': False})
            continue
        try:
            url = official_url(urljoin(FEED, raw_url))
        except ValueError:
            raise ValueError('Feed contains an unapproved announcement link: ' + raw_url)
        record = {'title': title, 'sourceUrl': url, 'organization': 'T.C. Enerji ve Tabii Kaynaklar Bakanlığı',
                  'announcedAtRaw': item.findtext('pubDate'), 'status': 'PENDING_REVIEW',
                  'applicationStartAt': None, 'applicationEndAt': None, 'applicationUrl': None}
        lowered = title.casefold()
        record['eventType'] = 'CANCELLATION' if 'iptal' in lowered else 'EXTENSION' if re.search(r'süre.*uzat|tarih.*uzat', lowered) else 'RECRUITMENT'
        record['eventVerified'] = False  # Title is a review hint, never a cancellation/extension authorization.
        record['contentHash'] = hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        record['rawSourceReference'] = {'feedUrl': FEED, 'itemOrdinal': ordinal,
                                      'documentSha256': document_hash,
                                      'itemSha256': hashlib.sha256(ET.tostring(item)).hexdigest()}
        rows.append(record)
    return {'rows': rows, 'unresolved': unresolved, 'documentSha256': document_hash,
            'itemCount': len(items), 'positionRows': 0, 'verificationStatus': 'REQUIRES_REVIEW'}

def parse_feed(content):
    report = parse_feed_report(content)
    if report['unresolved']:
        raise ValueError('Personnel item has no detail URL; cannot stage feed URL as announcement')
    return report['rows']

def check_robots(source_id='energy', feed=FEED):
    parsed = urlsplit(feed)
    robots_url = f'https://{parsed.hostname}/robots.txt'
    validate_outbound_dns(robots_url, source_id)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs): return None
    request = urllib.request.Request(robots_url, headers={'User-Agent': USER_AGENT, 'Accept': 'text/plain'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=10) as response:
            content = response.read(256_001)
            if len(content)>256_000 or b'<html' in content.lower() or b'<!doctype' in content.lower():
                raise ValueError('ROBOTS_RESPONSE_REQUIRES_REVIEW')
            text = content.decode('utf-8-sig')
    except urllib.error.HTTPError as error:
        if error.code == 404: return {'status': 'NOT_PUBLISHED'}
        raise  # Includes 403/429/redirect; never bypass or immediately retry.
    rules = urllib.robotparser.RobotFileParser(robots_url)
    rules.parse(text.splitlines())
    if not rules.can_fetch('KadroRadar', feed): raise ValueError('ROBOTS_DISALLOWED')
    delay = rules.crawl_delay('KadroRadar')
    planned = max(REGISTRY[source_id].get('scanIntervalHours', int(os.environ.get('ANNOUNCEMENT_SCAN_INTERVAL_HOURS', '96')))*3600, REGISTRY[source_id].get('indexingPolicy', {}).get('minIntervalSeconds', 3600))
    if delay is not None and delay > planned: raise ValueError('ROBOTS_RATE_REQUIRES_REVIEW')
    return {'status': 'ALLOWED', 'url': robots_url, 'sha256': hashlib.sha256(content).hexdigest()}

def sync(output):
    require_network_permission(REGISTRY['energy'], FEED, require_enabled=True)
    robots = check_robots()
    state = json.loads(output.read_text(encoding='utf-8')) if output.exists() else {'rows': {}, 'etag': None, 'lastModified': None}
    headers = {'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, text/xml'}
    if state.get('etag'): headers['If-None-Match'] = state['etag']
    if state.get('lastModified'): headers['If-Modified-Since'] = state['lastModified']
    request = urllib.request.Request(FEED, headers=headers)
    validate_outbound_dns(FEED)
    # Reject redirects: never follow a source-controlled URL to another host.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs): return None
    try:
        response = urllib.request.build_opener(NoRedirect).open(request, timeout=15)
    except urllib.error.HTTPError as error:
        if error.code == 304:
            return {'found': 0, 'new': 0, 'changed': 0, 'duplicate': 0, 'notModified': True}
        raise
    with response:
        content = response.read(2_000_001)
        report = parse_feed_report(content)
        rows = report['rows']
        new = changed = duplicate = 0
        for row in rows:
            old = state['rows'].get(row['sourceUrl'])
            if old is None: new += 1
            elif old['contentHash'] != row['contentHash']: changed += 1
            else: duplicate += 1
            state['rows'][row['sourceUrl']] = row
        state.update(etag=response.headers.get('ETag'), lastModified=response.headers.get('Last-Modified'),
                     lastSuccess=datetime.now(timezone.utc).isoformat(), found=len(rows), new=new, changed=changed, duplicate=duplicate,
                     unresolved=report['unresolved'], documentSha256=report['documentSha256'], itemCount=report['itemCount'], robots=robots)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(output)
    return {**{key: state[key] for key in ('found', 'new', 'changed', 'duplicate', 'lastSuccess')},
            'unresolvedCount': len(state['unresolved']), 'documentSha256': state['documentSha256']}

def classify_error(error):
    if isinstance(error, ValueError) and str(error) in ('SOURCE_RESTRICTED','SOURCE_REVIEW_REQUIRED','SOURCE_LICENSE_INVALID','SOURCE_OPERATOR_DISABLED'): return str(error)
    if isinstance(error, urllib.error.HTTPError):
        if error.code == 304: return 'NOT_MODIFIED'
        if error.code == 403: return 'FORBIDDEN'
        if error.code == 429: return 'RATE_LIMITED'
        if 300 <= error.code < 400: return 'REDIRECT'
        return 'HTTP_ERROR'
    reason = getattr(error, 'reason', error)
    if isinstance(reason, ValueError) and str(reason) == 'ROBOTS_DISALLOWED': return 'ROBOTS_DISALLOWED'
    if isinstance(reason, ValueError) and str(reason) == 'ROBOTS_RATE_REQUIRES_REVIEW': return 'ROBOTS_RATE_REQUIRES_REVIEW'
    if isinstance(reason, ValueError) and str(reason) == 'ROBOTS_RESPONSE_REQUIRES_REVIEW': return 'ACCESS_REVIEW_REQUIRED'
    if isinstance(reason, socket.gaierror): return 'DNS'
    if isinstance(reason, ssl.SSLError): return 'TLS'
    if isinstance(reason, (TimeoutError, socket.timeout)): return 'TIMEOUT'
    if isinstance(reason, (ValueError, ET.ParseError)): return 'PARSE_OR_VALIDATION'
    return 'NETWORK'

def stage(rows, api):
    target = urlsplit(api)
    if target.scheme != 'https' and not (target.scheme == 'http' and target.hostname in ('localhost', '127.0.0.1')):
        raise ValueError('HTTPS staging API required')
    token = os.environ.get('ANNOUNCEMENT_INGEST_CREDENTIAL')
    if not token: raise ValueError('ANNOUNCEMENT_INGEST_CREDENTIAL required')
    request = urllib.request.Request(api.rstrip('/') + '/admin/announcement-imports', data=json.dumps({'rows': rows}).encode(), headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, method='POST')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs): return None
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        return json.load(response)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--fixture', type=Path, help='Offline test input; never reported as live')
    parser.add_argument('--stage-api', help='API root ending in /api/v1')
    parser.add_argument('--report', action='store_true', help='Offline review report including unresolved references; no staging')
    args = parser.parse_args()
    try:
        if args.fixture:
            if args.report:
                if args.stage_api: raise ValueError('Review report cannot be staged as verified announcements')
                report = parse_feed_report(args.fixture.read_bytes())
                print(json.dumps({**report, 'mode': 'OPERATOR_SUPPLIED_RSS', 'liveFetch': False}))
                raise SystemExit(0)
            rows = parse_feed(args.fixture.read_bytes())
            result = {'mode': 'fixture', 'found': len(rows)}
        else:
            result = sync(args.output)
            rows = list(json.loads(args.output.read_text(encoding='utf-8'))['rows'].values())
            result['mode'] = 'live'
        if args.stage_api: result['staging'] = stage(rows, args.stage_api)
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'status': classify_error(error), 'errorType': type(error).__name__}))
        raise SystemExit(1)
