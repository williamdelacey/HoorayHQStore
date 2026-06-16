import http.server
import json
import csv
import os
import urllib.request
from datetime import datetime
from pathlib import Path


def load_env():
    env_file = Path(__file__).parent / '.env'
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env()
Zoho_trigger_signup = os.environ.get('Zoho_trigger_signup', '')

PORT = 3000
CSV_FILE = os.path.join(os.path.dirname(__file__), 'emails.csv')


def append_email(email):
    file_exists = os.path.isfile(CSV_FILE)
    with open(CSV_FILE, 'a', newline='') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['email', 'signed_up_at'])
        writer.writerow([email, datetime.now().strftime('%Y-%m-%d %H:%M:%S')])


def send_to_zoho(email, signed_up_at):
    payload = json.dumps({'email': email, 'signed_up_at': signed_up_at}).encode('utf-8')
    req = urllib.request.Request(Zoho_trigger_signup, data=payload, headers={'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(req, timeout=5)
        print(f'  Zoho: sent {email}')
    except Exception as e:
        print(f'  Zoho: failed — {e}')


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/subscribe':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                email = data.get('email', '').strip()
            except Exception:
                email = ''

            if email and '@' in email:
                signed_up_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                append_email(email)
                send_to_zoho(email, signed_up_at)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok": true}')
                print(f'  Saved: {email}')
            else:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok": false, "error": "Invalid email"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        print(f'  {args[0]} {args[1]}')


if __name__ == '__main__':
    os.chdir(os.path.dirname(__file__))
    print(f'Serving at http://localhost:{PORT}')
    http.server.test(HandlerClass=Handler, port=PORT, bind='')
