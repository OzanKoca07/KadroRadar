"""Fail-closed network gate; a public URL or robots allow is not a reuse license."""
from datetime import datetime, timezone
from urllib.parse import urlsplit
import re

def require_network_permission(source, value, require_enabled=False):
    status = source.get('rightsAssessment', {}).get('status')
    if source.get('id') == 'ilan' or status == 'RESTRICTED':
        raise ValueError('SOURCE_RESTRICTED')
    evidence = source.get('rightsAssessment', {}).get('evidence') or {}
    if status != 'LICENSE_VERIFIED':
        raise ValueError('SOURCE_REVIEW_REQUIRED')
    try:
        uri = urlsplit(evidence['url'])
        verified = datetime.fromisoformat(evidence['verifiedAt'].replace('Z', '+00:00'))
        until = datetime.fromisoformat(evidence['validUntil'].replace('Z', '+00:00'))
        valid = (evidence['kind'] in ('LICENSE', 'WRITTEN_AUTHORIZATION') and
                 uri.scheme == 'https' and uri.hostname and not uri.username and not uri.password and not uri.query and not uri.fragment and
                 re.fullmatch('[a-f0-9]{64}', evidence['sha256']) and
                 evidence['scopeUrl'] == source.get('feed') == value and
                 set(('AUTOMATED_FEED_ACCESS', 'MOBILE_METADATA', 'COMMERCIAL_USE')).issubset(evidence['scopes']) and
                 evidence['attribution'].strip() and verified <= datetime.now(timezone.utc) < until)
    except (KeyError, TypeError, ValueError):
        valid = False
    if not valid: raise ValueError('SOURCE_LICENSE_INVALID')
    if source.get('indexingPolicy', {}).get('automatedAccess') != 'ALLOWED':
        raise ValueError('SOURCE_REVIEW_REQUIRED')
    if require_enabled and source.get('enabled') is not True: raise ValueError('SOURCE_OPERATOR_DISABLED')
