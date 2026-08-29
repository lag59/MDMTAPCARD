#!/usr/bin/env python3
"""Desktop-assisted NFC flow for ACS ACR122U-A9 and similar readers.

This script keeps the API source-of-truth workflow, while letting you perform the
physical write/read step with your desktop NFC tooling.

Flow:
1) Login as admin/authorized NFC writer
2) Reserve tag via API (prepare)
3) You write URL to card using ACR122U software
4) You read back the URL and paste it
5) Script confirms write back to API

No third-party dependencies required (stdlib only).
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys
import urllib.error
import urllib.request
from typing import Any


DEFAULT_API_BASE = "http://localhost:8000"
DEFAULT_EMAIL = "admin@mdmcreation.com"


def _post_json(url: str, payload: dict[str, Any], token: str | None = None) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        detail = body
        try:
            parsed = json.loads(body) if body else {}
            if isinstance(parsed, dict) and parsed.get("detail"):
                detail = str(parsed["detail"])
        except Exception:
            pass
        raise RuntimeError(f"HTTP {exc.code} on {url}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error calling {url}: {exc}") from exc


def login(api_base: str, email: str, password: str) -> str:
    url = f"{api_base.rstrip('/')}/api/v1/auth/login"
    payload = _post_json(url, {"email": email, "password": password})
    token = payload.get("access_token")
    if not token:
        raise RuntimeError("Login succeeded but no access_token was returned")
    return str(token)


def prepare_tag(api_base: str, token: str, profile_id: str) -> dict[str, Any]:
    url = f"{api_base.rstrip('/')}/api/v1/profiles/{profile_id}/nfc/prepare"
    return _post_json(url, {}, token=token)


def confirm_tag(
    api_base: str,
    token: str,
    tag_id: str,
    verified_url: str,
    tag_uid: str | None,
    tag_type: str | None,
    capacity_bytes: int | None,
) -> dict[str, Any]:
    url = f"{api_base.rstrip('/')}/api/v1/nfc-tags/{tag_id}/confirm"
    body: dict[str, Any] = {"verified_url": verified_url.strip()}
    if tag_uid:
        body["tag_uid"] = tag_uid
    if tag_type:
        body["tag_type"] = tag_type
    if capacity_bytes is not None:
        body["capacity_bytes"] = capacity_bytes
    return _post_json(url, body, token=token)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Desktop-assisted NFC prepare/write/confirm flow")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE, help="API base URL (default: http://localhost:8000)")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help="Login email")
    parser.add_argument("--password", help="Login password (omit to prompt securely)")
    parser.add_argument("--profile-id", help="Profile UUID to prepare a new NFC tag")
    parser.add_argument("--tag-id", help="Existing tag UUID (for --confirm-only mode)")
    parser.add_argument("--confirm-only", action="store_true", help="Skip prepare and only confirm an already-written tag")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.confirm_only and not args.tag_id:
        print("Error: --confirm-only requires --tag-id", file=sys.stderr)
        return 2

    if not args.confirm_only and not args.profile_id:
        print("Error: provide --profile-id for prepare+confirm flow", file=sys.stderr)
        return 2

    password = args.password or getpass.getpass("Password: ")

    try:
        token = login(args.api_base, args.email, password)
        print("\n✅ Authenticated")

        prepared: dict[str, Any] = {}
        tag_id = args.tag_id
        expected_url = None

        if not args.confirm_only:
            prepared = prepare_tag(args.api_base, token, args.profile_id)
            tag_id = str(prepared.get("tag_id"))
            expected_url = str(prepared.get("profile_url"))

            print("\n🧾 Tag prepared")
            print(f"tag_id:      {tag_id}")
            print(f"profile_url: {expected_url}")
            print(f"tag_token:   {prepared.get('tag_token')}")
            print(f"hw_type:     {prepared.get('hardware_type')}")

            print("\nNow write this URL to the physical tag using your ACR122U tool:")
            print(f"  {expected_url}")
            print("\nUse a single NDEF URI record, then read it back and paste it below.")

        print("\n--- Confirm write ---")
        readback_url = input("Read-back URL from tag: ").strip()
        if not readback_url:
            print("Error: read-back URL is required", file=sys.stderr)
            return 2

        if expected_url and readback_url != expected_url:
            print("\n⚠️  Read-back URL does not exactly match prepared URL.")
            print(f"Expected: {expected_url}")
            print(f"Actual:   {readback_url}")
            proceed = input("Continue and submit confirmation anyway? (y/N): ").strip().lower()
            if proceed not in {"y", "yes"}:
                print("Cancelled.")
                return 1

        tag_uid = input("Tag UID (optional): ").strip() or None
        tag_type = input("Tag type (optional, e.g. NTAG213): ").strip() or None
        capacity_raw = input("Capacity bytes (optional): ").strip()
        capacity_bytes = int(capacity_raw) if capacity_raw else None

        result = confirm_tag(
            api_base=args.api_base,
            token=token,
            tag_id=str(tag_id),
            verified_url=readback_url,
            tag_uid=tag_uid,
            tag_type=tag_type,
            capacity_bytes=capacity_bytes,
        )

        print("\n📡 API confirmation response:")
        print(json.dumps(result, indent=2))

        if result.get("success"):
            print("\n✅ Done: tag verified in backend.")
            return 0

        print("\n❌ Backend marked write as failed. Check URL match and retry.")
        return 1

    except Exception as exc:
        print(f"\n❌ {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
