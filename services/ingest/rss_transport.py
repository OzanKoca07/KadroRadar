"""Bounded, pinned-DNS TLS feed transport. No redirects, retries or raw logging."""
import http.client
import ipaddress
import socket
import ssl
import time
import urllib.error
from urllib.parse import urlsplit
from official_rss import official_url, USER_AGENT


def fetch_feed(url, source_id, state, timeout=12):
    official_url(url, source_id)
    parsed = urlsplit(url)
    addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses): raise ValueError('NON_PUBLIC_DNS')
    target = parsed.path or '/'
    if parsed.query: target += '?' + parsed.query
    if any(ord(c) < 33 or ord(c) > 126 for c in target): raise ValueError('INVALID_REQUEST_TARGET')
    connection = None; response = None
    try:
        connection = socket.create_connection((addresses[0][4][0], 443), timeout=timeout)
        connection = ssl.create_default_context().wrap_socket(connection, server_hostname=parsed.hostname)
        headers = {'Host': parsed.hostname, 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml,application/xml', 'Accept-Encoding': 'identity', 'Connection': 'close'}
        for key, name in [('etag', 'If-None-Match'), ('lastModified', 'If-Modified-Since')]:
            value = state.get('transport', {}).get(key)
            if isinstance(value, str) and len(value) <= 1024 and all(32 <= ord(c) < 127 for c in value): headers[name] = value
        connection.sendall(('GET '+target+' HTTP/1.1\r\n'+''.join(k+': '+v+'\r\n' for k, v in headers.items())+'\r\n').encode('ascii'))
        response = http.client.HTTPResponse(connection); response.begin()
        if response.status == 304:
            if not any(k in headers for k in ('If-None-Match', 'If-Modified-Since')): raise ValueError('UNEXPECTED_304')
            return {'notModified': True}
        if response.status != 200: raise urllib.error.HTTPError(url, response.status, 'SOURCE_HTTP_STATUS', {}, None)
        if response.getheader('Content-Encoding', 'identity').lower() != 'identity': raise ValueError('UNSUPPORTED_CONTENT_ENCODING')
        body = bytearray(); began = time.monotonic()
        while True:
            remaining = timeout - (time.monotonic() - began)
            if remaining <= 0: raise TimeoutError()
            connection.settimeout(remaining)
            chunk = response.read1(min(65536, 2_000_001 - len(body)))
            if not chunk: break
            body.extend(chunk)
            if len(body) > 2_000_000: raise ValueError('FEED_SIZE_LIMIT')
        length = response.getheader('Content-Length')
        if length is not None and int(length) != len(body): raise ValueError('INCOMPLETE_BODY')
        def validator(name):
            value = response.getheader(name)
            return value if isinstance(value, str) and len(value) <= 1024 and all(32 <= ord(c) < 127 for c in value) else None
        return {'notModified': False, 'body': bytes(body), 'transport': {'etag': validator('ETag'), 'lastModified': validator('Last-Modified')}}
    finally:
        if response: response.close()
        if connection: connection.close()
