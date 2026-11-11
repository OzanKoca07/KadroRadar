"""Explicit one-shot official-source diagnostic; never a scheduler or DB writer.

Pins a validated public DNS address for TCP and verifies TLS with the original
hostname. Redirects are reported, never followed. Partial bodies are not saved.
The caller must impose an overall process timeout including OS DNS resolution.
"""
import argparse
import hashlib
import http.client
import ipaddress
import json
import socket
import ssl
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from official_rss import REGISTRY, official_url, parse_feed_report, check_robots, classify_error
from source_rights import require_network_permission


def probe(url, source_id, output, timeout=15, maximum=2_000_000):
    official_url(url, source_id)
    result = {'url': url, 'sourceId': source_id, 'checkedAt': datetime.now(timezone.utc).isoformat(),
              'mode': 'EXPLICIT_LIVE_READ', 'automationEnabled': False,
              'republicationPermission': REGISTRY[source_id]['republicationPermission'],
              'phasesMs': {}, 'downloaded': False}
    phase, connection, response = 'POLICY', None, None
    started = time.monotonic()
    try:
        require_network_permission(REGISTRY[source_id], url)
        phase = 'ROBOTS'
        check_robots(source_id, url)
        phase = 'DNS'
        host = urlsplit(url).hostname
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError('Non-public DNS rejected')
        result['phasesMs']['DNS'] = round((time.monotonic()-started)*1000, 3)
        phase, began = 'TCP', time.monotonic()
        connection = socket.create_connection((addresses[0][4][0], 443), timeout=timeout)
        result['phasesMs']['TCP'] = round((time.monotonic()-began)*1000, 3)
        phase, began = 'TLS', time.monotonic()
        connection = ssl.create_default_context().wrap_socket(connection, server_hostname=host)
        result['phasesMs']['TLS'] = round((time.monotonic()-began)*1000, 3)
        phase, began = 'HTTP_HEADERS', time.monotonic()
        parsed = urlsplit(url)
        target = parsed.path or '/'
        if parsed.query: target += '?' + parsed.query
        # Control characters cannot enter a manually serialized request.
        if any(ord(c) < 33 or ord(c) > 126 for c in target):
            raise ValueError('URL must be percent encoded')
        connection.sendall(('GET '+target+' HTTP/1.1\r\nHost: '+host+
            '\r\nUser-Agent: KadroRadar/0.1 (explicit official source review)\r\nAccept: */*\r\nConnection: close\r\n\r\n').encode('ascii'))
        response = http.client.HTTPResponse(connection)
        response.begin()
        result['phasesMs']['HTTP_HEADERS'] = round((time.monotonic()-began)*1000, 3)
        result.update(httpStatus=response.status, contentType=response.getheader('Content-Type'),
                      etag=response.getheader('ETag'), lastModified=response.getheader('Last-Modified'))
        if response.status != 200:
            result['status'] = {304:'NOT_MODIFIED',403:'FORBIDDEN',429:'RATE_LIMITED'}.get(
                response.status, 'REDIRECT' if 300 <= response.status < 400 else 'HTTP_ERROR')
            return result
        phase, began = 'HTTP_BODY', time.monotonic()
        content = bytearray()
        while True:
            remaining = timeout-(time.monotonic()-began)
            if remaining <= 0: raise TimeoutError('Body deadline exceeded')
            connection.settimeout(remaining)
            chunk = response.read1(min(65536, maximum+1-len(content)))
            if not chunk: break
            content.extend(chunk)
            if len(content) > maximum: raise ValueError('Body size limit exceeded')
        expected = response.getheader('Content-Length')
        if expected is not None and int(expected) != len(content):
            raise ValueError('Incomplete HTTP body')
        result['phasesMs']['HTTP_BODY'] = round((time.monotonic()-began)*1000, 3)
        phase = 'VALIDATION'
        if source_id == 'energy': result['feed'] = parse_feed_report(bytes(content))
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix(output.suffix+'.tmp')
        temporary.write_bytes(content)
        temporary.replace(output)
        result.update(status='OK', downloaded=True, bytes=len(content), sha256=hashlib.sha256(content).hexdigest())
    except Exception as error:
        if phase == 'ROBOTS':
            result.update(status=classify_error(error), failedPhase=phase, errorType=type(error).__name__)
            return result
        result.update(status=(str(error) if isinstance(error, ValueError) and str(error) in ('SOURCE_RESTRICTED','SOURCE_REVIEW_REQUIRED','SOURCE_LICENSE_INVALID','SOURCE_OPERATOR_DISABLED') else 'TIMEOUT' if isinstance(error, (TimeoutError, socket.timeout)) else
                              'TLS_ERROR' if isinstance(error, ssl.SSLError) else
                              'DNS_ERROR' if isinstance(error, socket.gaierror) else 'ERROR'),
                      failedPhase=phase, errorType=type(error).__name__)
    finally:
        if response: response.close()
        if connection: connection.close()
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--source', choices=list(REGISTRY), required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    args = parser.parse_args()
    result = probe(args.url, args.source, args.output)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k != 'feed'}))
    raise SystemExit(0 if result['downloaded'] else 1)
