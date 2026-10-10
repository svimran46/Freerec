#!/usr/bin/env python3
"""End-to-end smoke test for the running stack (docker compose up).

Sends a file through web proxy → API → presigned upload → queue → worker →
presigned download using the debug "echo" tool, then deletes the job.

Usage: python3 scripts/smoke.py [--web http://localhost:3000]
"""

import argparse
import json
import secrets
import sys
import time
import urllib.error
import urllib.request

PAYLOAD = b"%PDF-1.7\n% freerec smoke test " + secrets.token_hex(8).encode() + b"\n"


def call(method: str, url: str, body: bytes | None = None, headers=None) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def call_json(method: str, url: str, payload=None) -> tuple[int, dict]:
    body = json.dumps(payload).encode() if payload is not None else None
    status, raw = call(method, url, body, {"content-type": "application/json"})
    return status, json.loads(raw) if raw else {}


def multipart(fields: dict[str, str], file_bytes: bytes, filename: str) -> tuple[bytes, str]:
    boundary = secrets.token_hex(16)
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        for k, v in fields.items()
    ]
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n".encode() + file_bytes + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def wait_until_up(url: str, expected: int, seconds: int = 120) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            if call("GET", url)[0] == expected:
                return
        except OSError:
            pass
        time.sleep(2)
    sys.exit(f"FAIL: {url} did not return {expected} within {seconds}s")


def check(condition: bool, message: str) -> None:
    if not condition:
        sys.exit(f"FAIL: {message}")
    print(f"ok   {message}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--web", default="http://localhost:3000")
    web = parser.parse_args().web.rstrip("/")

    wait_until_up(f"{web}/", 200)
    # 404 (not 503) means the web proxy reached the API.
    wait_until_up(f"{web}/api/jobs/not-a-job", 404)
    status, page = call("GET", f"{web}/tools/compress-image")
    check(status == 200 and b"Compress image" in page, "tool page renders")

    status, job = call_json(
        "POST",
        f"{web}/api/jobs",
        {"tool": "echo", "files": [{"name": "smoke.pdf", "size": len(PAYLOAD)}]},
    )
    check(status == 201, f"job created ({status} {job})")

    [upload] = job["uploads"]
    body, content_type = multipart(upload["fields"], PAYLOAD, "smoke.pdf")
    status, raw = call("POST", upload["url"], body, {"content-type": content_type})
    check(status in (200, 201, 204), f"presigned upload accepted ({status} {raw[:200]!r})")

    status, submitted = call_json("POST", f"{web}/api/jobs/{job['id']}/submit")
    check(status == 202, f"job submitted ({status} {submitted})")

    deadline = time.time() + 60
    while True:
        status, current = call_json("GET", f"{web}/api/jobs/{job['id']}")
        if current.get("status") in ("done", "failed", "expired") or time.time() > deadline:
            break
        time.sleep(1)
    check(current.get("status") == "done", f"job finished ({current})")

    [output] = current["outputs"]
    status, downloaded = call("GET", output["url"])
    check(status == 200 and downloaded == PAYLOAD, "output downloads byte-identical")

    status, _ = call("DELETE", f"{web}/api/jobs/{job['id']}")
    check(status == 204, "job deleted")
    status, _ = call("GET", output["url"])
    check(status in (403, 404), f"output no longer downloadable ({status})")
    print("PASS")


if __name__ == "__main__":
    main()
