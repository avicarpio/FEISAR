"""Dev server for the site: like `python3 -m http.server`, but tells the browser not to cache,
so a normal refresh always loads the latest HTML, CSS, JS and model.

Usage: python3 tools/serve.py [port]   (default 8097, serves the repository root)
"""
import functools
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8097
http.server.ThreadingHTTPServer(("", port), functools.partial(NoCache, directory=root)).serve_forever()
