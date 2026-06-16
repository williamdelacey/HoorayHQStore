from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
from datetime import datetime


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
            email = data.get('email', '').strip()
        except Exception:
            email = ''

        if not email or '@' not in email:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok": false, "error": "Invalid email"}')
            return

        signed_up_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        webhook_url = os.environ.get('Zoho_trigger_signup', '')

        if webhook_url:
            payload = json.dumps({'email': email, 'signed_up_at': signed_up_at}).encode('utf-8')
            req = urllib.request.Request(
                webhook_url,
                data=payload,
                headers={'Content-Type': 'application/json'}
            )
            try:
                urllib.request.urlopen(req, timeout=5)
            except Exception as e:
                print(f'Zoho webhook failed: {e}')

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b'{"ok": true}')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
