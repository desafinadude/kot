#!/usr/bin/env python3
"""Static server that sends NO caching headers.

Without this, phones heuristically cache index.html / js / css (the server
sends only Last-Modified) and keep showing stale builds — which is exactly
how a phone ends up with half-updated CSS. Serve this instead of
`python3 -m http.server` during development.
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"Monster City dev server (no-store) → http://localhost:{port}")
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
