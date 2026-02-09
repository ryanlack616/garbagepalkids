import ftplib
from pathlib import Path

env = {}
for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    if '=' in line:
        k, v = line.split('=', 1)
        v = v.strip().strip('"').strip("'")
        env[k.strip()] = v

ftp = ftplib.FTP_TLS('pixie-ss1-ftp.porkbun.com')
ftp.login(env['FTP_USER'], env['FTP_PASS'])
ftp.prot_p()

for fname in ['index.html', 'app.js']:
    local = Path(fname)
    print(f'  uploading {fname} ({local.stat().st_size:,} bytes)...')
    with open(local, 'rb') as f:
        ftp.storbinary(f'STOR /{fname}', f)
    print(f'  done: {fname}')

ftp.quit()
print('Updated at https://garbagepalkids.lol/')
