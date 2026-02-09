"""
Resilient FTP Deploy — upload web/ contents to garbagepalkids.lol
Skips files that already exist with the same size.
Reconnects on connection drops.
"""

import os
import ftplib
import sys
import time
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / '.env'

def load_env():
    env = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, v = line.split('=', 1)
                v = v.strip()
                if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                    v = v[1:-1]
                env[k.strip()] = v
    return env


def connect(env):
    host = env.get('FTP_HOST', 'pixie-ss1-ftp.porkbun.com')
    user = env.get('FTP_USER', '')
    passwd = env.get('FTP_PASS', '')
    ftp = ftplib.FTP_TLS(host, timeout=30)
    ftp.login(user, passwd)
    ftp.prot_p()
    return ftp


def get_remote_size(ftp, path):
    try:
        return ftp.size(path)
    except:
        return None


def ensure_dir(ftp, path):
    parts = path.strip('/').split('/')
    current = ''
    for part in parts:
        current += f'/{part}'
        try:
            ftp.cwd(current)
        except ftplib.error_perm:
            try:
                ftp.mkd(current)
            except ftplib.error_perm:
                pass


def deploy():
    env = load_env()
    remote_dir = '/'
    web_dir = Path(__file__).resolve().parent / 'web'

    if not web_dir.exists():
        print(f'ERROR: web/ directory not found')
        sys.exit(1)

    # Collect all files
    all_files = sorted([p for p in web_dir.rglob('*') if p.is_file()])
    print(f'Found {len(all_files)} files to deploy\n')

    ftp = None
    uploaded = 0
    skipped = 0
    batch_count = 0

    for local_path in all_files:
        rel = local_path.relative_to(web_dir).as_posix()
        remote_path = f'{remote_dir}/{rel}'
        local_size = local_path.stat().st_size

        # Connect/reconnect
        if ftp is None:
            print('Connecting...')
            ftp = connect(env)
            ftp.cwd(remote_dir)
            batch_count = 0

        # Check if file exists with same size
        try:
            remote_size = get_remote_size(ftp, remote_path)
            if remote_size == local_size:
                skipped += 1
                continue
        except:
            pass

        # Ensure parent dirs
        parent = '/'.join(remote_path.split('/')[:-1])
        if parent and parent != remote_dir:
            ensure_dir(ftp, parent)
            ftp.cwd(remote_dir)

        # Upload with retry
        for attempt in range(3):
            try:
                print(f'  ↑ {rel} ({local_size:,} bytes)')
                with open(local_path, 'rb') as f:
                    ftp.storbinary(f'STOR {remote_path}', f)
                uploaded += 1
                batch_count += 1
                break
            except Exception as e:
                print(f'  ✗ Error: {e}')
                if attempt < 2:
                    print(f'  Reconnecting (attempt {attempt + 2}/3)...')
                    time.sleep(2)
                    try:
                        ftp.quit()
                    except:
                        pass
                    ftp = connect(env)
                    ftp.cwd(remote_dir)
                    batch_count = 0
                else:
                    print(f'  FAILED after 3 attempts: {rel}')

        # Reconnect every 50 files to prevent timeout
        if batch_count >= 50:
            try:
                ftp.quit()
            except:
                pass
            ftp = None

    if ftp:
        try:
            ftp.quit()
        except:
            pass

    print(f'\nDone! Uploaded: {uploaded}, Skipped (same size): {skipped}')
    print(f'Live at: https://garbagepalkids.lol/')


if __name__ == '__main__':
    deploy()
