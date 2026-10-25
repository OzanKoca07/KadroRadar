"""UTF-8 JSON/CSV review import. Default dry-run never writes to API."""
import argparse
import csv
import io
import json
from pathlib import Path
from official_rss import REGISTRY, official_url, stage

ALIASES = {'başlık': 'title', 'kurum': 'organization', 'kaynak': 'sourceUrl',
           'şehir': 'city', 'kadro': 'positionTitle', 'kontenjan': 'quota',
           'başlangıç': 'applicationStartAt', 'bitiş': 'applicationEndAt', 'başvuru': 'applicationUrl'}

def load_records(path):
    text = path.read_text(encoding='utf-8-sig')
    if path.suffix.lower() == '.json':
        rows = json.loads(text)
        if not isinstance(rows, list): raise ValueError('JSON array required')
        return rows
    dialect = csv.Sniffer().sniff(text[:4096], delimiters=',;\t')
    return [{ALIASES.get(k.strip().lower(), k.strip()): v.strip() for k, v in row.items() if k is not None} for row in csv.DictReader(io.StringIO(text), dialect=dialect)]

def validate(rows):
    accepted, errors, seen = [], [], set()
    for index, row in enumerate(rows, 1):
        try:
            if not isinstance(row, dict): raise ValueError('Object required')
            row = dict(row)
            if not row.get('title') or not row.get('organization'): raise ValueError('Title and organization required')
            source = next((key for key in REGISTRY if __import__('urllib.parse', fromlist=['urlsplit']).urlsplit(row.get('sourceUrl', '')).hostname in REGISTRY[key]['hosts']), None)
            if source is None: raise ValueError('Source hostname is not registered')
            official_url(row['sourceUrl'], source)
            if row['sourceUrl'] in seen: raise ValueError('Duplicate source URL in batch')
            if row.get('quota') not in (None, ''):
                row['quota'] = int(row['quota'])
                if row['quota'] <= 0: raise ValueError('Quota must be positive')
            else: row.pop('quota', None)
            seen.add(row['sourceUrl']); accepted.append(row)
        except (ValueError, TypeError) as error:
            errors.append({'row': index, 'error': str(error)})
    return {'rows': accepted, 'errors': errors, 'accepted': len(accepted), 'rejected': len(errors)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('file', type=Path)
    parser.add_argument('--stage-api', help='Explicitly write valid batch to staging; otherwise dry-run')
    args = parser.parse_args()
    result = validate(load_records(args.file))
    if args.stage_api:
        if result['errors']: raise SystemExit('Import rejected: fix all row errors first')
        counts = {'created': 0, 'changed': 0, 'duplicate': 0}
        for offset in range(0, len(result['rows']), 100):
            response = stage(result['rows'][offset:offset+100], args.stage_api)
            for key in counts: counts[key] += response[key]
        result['staging'] = counts
    print(json.dumps(result, ensure_ascii=False, indent=2))
