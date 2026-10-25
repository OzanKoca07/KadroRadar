"""Heuristic release gate; scans candidate files and all reachable Git blobs.

Reports locations/rules only, never credential values. Not a security audit.
Known public local-development/fixture passwords are counted separately.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RULES = {
    'private-key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'github-token': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
    'aws-key': re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'api-token': re.compile(rb'\b(?:sk-proj-[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9]{32,}|AIza[A-Za-z0-9_-]{30,}|ExponentPushToken\[[A-Za-z0-9_-]{20,}\])'),
    'credential-url': re.compile(rb'\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/\'"`]+:([^\s@\'"`]+)@[^\s\'"`]+'),
    'literal-secret': re.compile(rb'''(?i)\b(?:password|api_key|jwt_secret|session_secret|access_token|client_secret)\s*[:=]\s*["']([^"'\r\n]{8,})["']'''),
}
PUBLIC_TEST_VALUES = {b'kadro_local', b'test_only', b'test-only', b'test-only-password', b'password123', b'fixture-only', b'REPLACE_ME', b'your-secret', b'placeholder', b'pw'}

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

findings, known, scanned = [], set(), 0

def scan(data, location):
    global scanned
    scanned += 1
    if b'\0' in data[:8192]:
        return
    for rule, pattern in RULES.items():
        for match in pattern.finditer(data):
            value = match.group(1) if match.lastindex else match.group(0)
            if rule == 'credential-url' and value in PUBLIC_TEST_VALUES:
                known.add(location)
                continue
            if rule == 'literal-secret' and (value in PUBLIC_TEST_VALUES or b'process.env' in value or b'random' in value or b'${' in value or b'example' in value or b'test' in value.lower()):
                known.add(location)
                continue
            findings.append({'location':location,'rule':rule,'line':data[:match.start()].count(b'\n')+1})

files = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').decode().split('\0')
for file in sorted(set(filter(None, files))):
    path = ROOT / file
    if path.is_file() and not (file.startswith('apps/admin/src/') and file.endswith('.js')):
        if path.name.startswith('.env') and not path.name.endswith('.example'):
            findings.append({'location':file,'rule':'environment-file'})
        if path.suffix.lower() in {'.dump','.backup','.jks','.keystore','.p12','.pfx','.key'}:
            findings.append({'location':file,'rule':'private-artifact'})
        scan(path.read_bytes(), 'worktree:'+file)

staged = git('diff','--cached','--name-only','--diff-filter=ACMR','-z').decode().split('\0')
for file in filter(None, staged):
    scan(git('show', ':'+file), 'staged:'+file)

objects = git('rev-list','--objects','--all').decode().splitlines()
batch = subprocess.Popen(['git','cat-file','--batch'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
for entry in objects:
    oid, _, name = entry.partition(' ')
    batch.stdin.write((oid+'\n').encode());batch.stdin.flush()
    header = batch.stdout.readline().decode().split()
    size = int(header[2]);data = batch.stdout.read(size);batch.stdout.read(1)
    if header[1] == 'blob':
        scan(data,'history:'+oid[:12]+':'+name)
batch.stdin.close();batch.wait()
report = {'status':'PASS' if not findings else 'REVIEW_REQUIRED','scannedObjectsAndFiles':scanned,'knownPublicTestCredentialLocations':len(known),'findings':findings,'limitations':'Heuristic patterns; manual review required. Public local/fixture credentials are not production credentials and must never be reused.'}
destination=ROOT/'.local/release/secret-scan.json';destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
sys.exit(bool(findings))
