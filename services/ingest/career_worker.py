"""Ephemeral signed-runner adapter. No raw XML retention or database connection."""
import argparse
import json
import os
from pathlib import Path
from career_rss import sync
from official_rss import REGISTRY,classify_error

def collect(state,authorization,output):
    source=json.loads(authorization.read_text(encoding='utf-8'))
    if source.get('id')!='career' or source.get('feed')!=REGISTRY['career']['feed'] or source.get('hosts')!=REGISTRY['career']['hosts']:raise ValueError('SOURCE_IDENTITY_REJECTED')
    previous=json.loads(state.read_text(encoding='utf-8'))
    if previous.get('transport',{}).get('forceReparse'):
        previous['transport']={**previous['transport'],'etag':None,'lastModified':None}
        state.write_text(json.dumps(previous),encoding='utf-8')
    report=sync(state,source)
    report={**report,'sourceId':'career','networkProvenance':'LIVE_HTTPS','documentSha256':report.get('documentSha256') or previous.get('transport',{}).get('documentSha256'),'downloaded':not report['notModified']}
    output.write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8');output.chmod(0o600)
    return {'status':'OK','rows':len(report['rows']),'notModified':report['notModified']}

def main():
    p=argparse.ArgumentParser();p.add_argument('--state',type=Path,required=True);p.add_argument('--authorization',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--date');a=p.parse_args()
    try:print(json.dumps(collect(a.state,a.authorization,a.output)));return 0
    except Exception as error:print(json.dumps({'status':'FAIL','code':classify_error(error)}));return 1

if __name__=='__main__':raise SystemExit(main())
