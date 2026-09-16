"""Restore unmodified upstream media, checking size and Git blob SHA-1.

Optional partial ZIP recovery avoids downloading already available bytes.
Usage: python tools/restore-upstream-assets.py [TREE_JSON] [PARTIAL_ZIP]
       python tools/restore-upstream-assets.py --verify-only
"""
import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import shutil
import struct
import subprocess
import sys
import time
import urllib.parse
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMMIT = '5ac771e3e1a4f69794dddd07c9893033247cdd39'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('tree', nargs='?', default=str(ROOT / 'docs/upstream-tree.json'))
parser.add_argument('partial_zip', nargs='?')
parser.add_argument('--verify-only', action='store_true', help='Check all assets without network access')
args = parser.parse_args()
TREE = json.loads(pathlib.Path(args.tree).read_text(encoding='utf-8'))
if TREE['sha'] != COMMIT:
    raise SystemExit('Manifest does not match the pinned upstream commit')
FILES = {e['path']: e for e in TREE['tree'] if e['type'] == 'blob'
         and e['path'].startswith(('comic-art/', 'comic-audio/'))}


def valid(data, entry):
    return len(data) == entry['size'] and hashlib.sha1(
        b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == entry['sha']


def save(name, data):
    if name not in FILES or not valid(data, FILES[name]):
        return False
    target = ROOT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return True


def recover(zip_path):
    raw = pathlib.Path(zip_path).read_bytes()
    pos, count = 0, 0
    while True:
        pos = raw.find(b'PK\x03\x04', pos)
        if pos < 0 or len(raw) < pos + 30:
            break
        fields = struct.unpack_from('<IHHHHHIIIHH', raw, pos)
        method, compressed, name_len, extra_len = fields[3], fields[7], fields[9], fields[10]
        start = pos + 30 + name_len + extra_len
        name = raw[pos + 30:pos + 30 + name_len].decode('utf-8')
        relative = name.split('/', 1)[1] if '/' in name else ''
        try:
            if method == 8:
                decoder = zlib.decompressobj(-15)
                data = decoder.decompress(raw[start:])
                if not decoder.eof:
                    break
                end = len(raw) - len(decoder.unused_data)
            elif method == 0:
                end = start + compressed
                data = raw[start:end]
            else:
                pos = start
                continue
            count += save(relative, data)
            pos = max(start, end)
        except zlib.error:
            pos = start
    print(f'Recovered and verified {count} media files from ZIP', flush=True)


def download(name):
    target = ROOT / name
    if target.exists() and valid(target.read_bytes(), FILES[name]):
        return name, True, 'existing'
    urls = ['https://yaoyuzhang1.github.io/socrates-question/',
            f'https://raw.githubusercontent.com/yaoyuzhang1/socrates-question/{COMMIT}/']
    error = ''
    partial = b''
    for attempt in range(20):
        try:
            result = subprocess.run([shutil.which('curl') or 'curl', '--fail', '--silent', '--show-error',
                '--include', '--location', '--max-time', '35',
                '--range', f'{len(partial)}-',
                urls[0 if attempt % 4 != 3 else 1] + urllib.parse.quote(name)],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            header, _, body = result.stdout.partition(b'\r\n\r\n')
            while body.startswith(b'HTTP/'):
                header, _, body = body.partition(b'\r\n\r\n')
            expected = f'bytes {len(partial)}-'.encode()
            if b' 206 ' in header and expected in header:
                partial += body
            elif b' 200 ' in header:
                partial = body
            if save(name, partial):
                return name, True, 'downloaded'
            if len(partial) >= FILES[name]['size']:
                partial = b''
            error = 'size or Git blob checksum mismatch'
        except Exception as exc:
            error = str(exc)
        time.sleep(min(attempt + 1, 4))
    return name, False, error


if args.verify_only:
    invalid = [name for name, entry in FILES.items()
               if not (ROOT / name).is_file() or not valid((ROOT / name).read_bytes(), entry)]
    print(json.dumps({'expected': len(FILES), 'verified': len(FILES) - len(invalid),
                      'missing_or_invalid': invalid}))
    sys.exit(bool(invalid))
if args.partial_zip:
    recover(args.partial_zip)
print(f'Expected {len(FILES)} media files, {sum(e["size"] for e in FILES.values())} bytes', flush=True)
missing = []
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    for index, (name, ok, detail) in enumerate(pool.map(download, FILES), 1):
        if not ok:
            missing.append(name)
        if detail != 'existing' or index % 50 == 0:
            print(f'{index}/{len(FILES)} {name}: {detail}', flush=True)
print(json.dumps({'verified': len(FILES) - len(missing), 'missing': missing}), flush=True)
sys.exit(bool(missing))
