"""Real Firefox integration test. Requires Firefox and geckodriver, no pip/npm dependencies.

The temporary test XPI adds ONLY the local fixture host to its content-script
matches. The distributable manifest remains restricted to chatgpt.com.
"""
import contextlib
import http.server
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("packager", ROOT / "scripts/package.py")
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class Fixture(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/browser-checks.js":
            body = (ROOT / "tests/browser-checks.js").read_bytes()
            kind = "text/javascript"
        else:
            body = b'''<!doctype html><meta charset="utf-8"><title>Disposal fixture</title>
<script nonce="fixture">window.earlyStackType = typeof DisposableStack;</script>
<script nonce="fixture" src="/browser-checks.js"></script>'''
            if self.path.startswith("/fixture"):
                body += b'<iframe id="child" src="/frame"></iframe>'
            kind = "text/html"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        # No unsafe-eval, inline scripts without a nonce, or extension URLs.
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'nonce-fixture'; frame-src 'self'")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def main():
    firefox = os.environ.get("FIREFOX_BINARY") or shutil.which("firefox") or shutil.which("firefox-esr")
    driver = os.environ.get("GECKODRIVER") or shutil.which("geckodriver")
    if not firefox or not driver:
        raise SystemExit("Set FIREFOX_BINARY and GECKODRIVER to their executable paths.")
    with contextlib.ExitStack() as cleanup:
        folder = Path(cleanup.enter_context(tempfile.TemporaryDirectory(prefix="ff115-test-")))
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
        cleanup.callback(server.server_close)
        cleanup.callback(server.shutdown)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        with socket.socket() as port:
            port.bind(("127.0.0.1", 0))
            driver_port = port.getsockname()[1]
        log = cleanup.enter_context((folder / "geckodriver.log").open("w+"))
        driver_env = os.environ.copy()
        for key in ("XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_RUNTIME_DIR"):
            local_path = folder / key.lower()
            local_path.mkdir(mode=0o700)
            driver_env[key] = str(local_path)
        process = subprocess.Popen([driver, "--host", "127.0.0.1", "--port", str(driver_port)], stdout=log, stderr=log, env=driver_env, start_new_session=True)

        def stop():
            if os.name == "posix":
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGTERM)
            else:
                process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        cleanup.callback(stop)
        # Local WebDriver traffic must stay local, independent of egress proxy.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

        def request(method, route, data=None):
            body = json.dumps(data).encode() if data is not None else None
            req = urllib.request.Request(f"http://127.0.0.1:{driver_port}" + route, data=body, method=method, headers={"Content-Type": "application/json"})
            try:
                with opener.open(req, timeout=40) as response:
                    result = json.load(response)["value"]
            except urllib.error.HTTPError as error:
                raise RuntimeError(error.read().decode()) from error
            if isinstance(result, dict) and result.get("error"):
                raise RuntimeError(result)
            return result

        deadline = time.monotonic() + 15
        while True:
            try:
                request("GET", "/status")
                break
            except urllib.error.URLError:
                if process.poll() is not None or time.monotonic() >= deadline:
                    log.seek(0)
                    raise RuntimeError(log.read())
                time.sleep(0.1)

        print("Starting Firefox…", flush=True)
        session = request("POST", "/session", {"capabilities": {"alwaysMatch": {
            "browserName": "firefox",
            "moz:firefoxOptions": {"binary": firefox, "args": ["-headless"], "prefs": {
                "browser.shell.checkDefaultBrowser": False,
                "datareporting.policy.dataSubmissionEnabled": False,
                "toolkit.telemetry.reportingpolicy.firstRun": False
            }}
        }}})
        prefix = "/session/" + session["sessionId"]
        cleanup.callback(lambda: request("DELETE", prefix))
        print("Browser:", session["capabilities"]["browserVersion"])

        def execute(script):
            return request("POST", prefix + "/execute/sync", {"script": script, "args": []})

        def navigate(host="127.0.0.1"):
            request("POST", prefix + "/url", {"url": f"http://{host}:{server.server_port}/fixture"})

        navigate()
        assert execute("return typeof DisposableStack") == "undefined", "Test requires a browser without native DisposableStack"
        print("PASS baseline: API absent without the add-on")
        manifest = json.loads((ROOT / "extension/manifest.json").read_text())
        manifest["content_scripts"][0]["matches"].append("http://127.0.0.1/*")
        xpi = packager.package(folder / "test.xpi", manifest)
        request("POST", prefix + "/moz/addon/install", {"path": str(xpi), "temporary": True})
        navigate()
        results = request("POST", prefix + "/execute/async", {"script": "const done = arguments[arguments.length - 1]; window.smokeResultsPromise.then(done, error => done([{name: 'page run', passed: false, error: String(error)}]));", "args": []})
        for result in results:
            print(("PASS " if result["passed"] else "FAIL ") + result["name"])
            if not result["passed"]:
                print(json.dumps(result, indent=2))
        frame = execute("return document.getElementById('child')")
        request("POST", prefix + "/frame", {"id": frame})
        # WebDriver executes in its own sandbox: its Object constructor is not
        # the page's Object. Check actual cleanup instead of cross-realm instanceof.
        child = execute("let cleaned = false; const s = new window.DisposableStack(); s.defer(() => { cleaned = true; }); s.dispose(); return window.earlyStackType === 'function' && cleaned")
        print(("PASS " if child else "FAIL ") + "same-origin iframe injection")
        request("POST", prefix + "/frame", {"id": None})
        navigate("localhost")
        scoped = execute("return typeof DisposableStack") == "undefined"
        print(("PASS " if scoped else "FAIL ") + "unmatched host is left untouched")
        assert all(result["passed"] for result in results) and child and scoped, "Firefox integration checks failed"
        print(f"{len(results) + 3} Firefox integration checks passed")


if __name__ == "__main__":
    main()
