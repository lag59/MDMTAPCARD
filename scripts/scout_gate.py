#!/usr/bin/env python3
"""Fail CI only on fixable critical/high CVEs and enforce explicit exceptions for unfixed OS CVEs."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Iterable, List, Set


def run_scout_scan(image: str, extra_args: Iterable[str]) -> Set[str]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sarif", delete=False) as tmp:
        report_path = tmp.name

    cmd = [
        "docker",
        "scout",
        "cves",
        image,
        "--format",
        "sarif",
        "--output",
        report_path,
        *extra_args,
    ]

    print(f"[scout] Running: {' '.join(cmd)}")
    completed = subprocess.run(cmd, capture_output=True, text=True)

    if completed.stdout:
        print(completed.stdout)
    if completed.stderr:
        print(completed.stderr, file=sys.stderr)

    if completed.returncode != 0:
        print(f"[scout] Command failed with exit code {completed.returncode}.", file=sys.stderr)
        sys.exit(completed.returncode)

    with open(report_path, "r", encoding="utf-8") as fh:
        sarif = json.load(fh)

    rule_ids: Set[str] = set()
    for run in sarif.get("runs", []):
        for result in run.get("results", []):
            rule_id = result.get("ruleId")
            if rule_id:
                rule_ids.add(rule_id)

    return rule_ids


def load_exception_ids(exceptions_file: Path) -> Set[str]:
    with open(exceptions_file, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    allowed = data.get("allowed_cves", {})
    if not isinstance(allowed, dict):
        raise ValueError("security/scout_unfixed_os_exceptions.json must contain an object at 'allowed_cves'.")

    return set(allowed.keys())


def check_exception_review_dates(exceptions_file: Path) -> List[str]:
    with open(exceptions_file, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    today = dt.date.today()
    expired: List[str] = []

    for cve_id, meta in data.get("allowed_cves", {}).items():
        if not isinstance(meta, dict):
            continue
        review_by = meta.get("review_by")
        if not review_by:
            continue
        try:
            review_date = dt.date.fromisoformat(str(review_by))
        except ValueError:
            expired.append(f"{cve_id} has invalid review_by date: {review_by}")
            continue
        if review_date < today:
            expired.append(f"{cve_id} review_by date expired on {review_by}")

    return expired


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True, help="Image reference to scan, e.g. mdmtapcard-api:ci")
    parser.add_argument(
        "--exceptions-file",
        default="security/scout_unfixed_os_exceptions.json",
        help="Path to allowed unfixed OS CVE exceptions JSON",
    )
    args = parser.parse_args()

    exceptions_file = Path(args.exceptions_file)
    if not exceptions_file.exists():
        print(f"Exceptions file not found: {exceptions_file}", file=sys.stderr)
        return 1

    fixable_critical_high = run_scout_scan(
        image=args.image,
        extra_args=["--only-fixed", "--only-severity", "critical,high"],
    )
    if fixable_critical_high:
        print("[gate] Fixable critical/high CVEs detected:")
        for cve_id in sorted(fixable_critical_high):
            print(f"  - {cve_id}")
        return 2

    print("[gate] No fixable critical/high CVEs detected.")

    unfixed_os_critical_high = run_scout_scan(
        image=args.image,
        extra_args=["--only-unfixed", "--only-package-type", "deb", "--only-severity", "critical,high"],
    )
    allowed_ids = load_exception_ids(exceptions_file)

    unexpected = sorted(cve for cve in unfixed_os_critical_high if cve not in allowed_ids)
    expired = check_exception_review_dates(exceptions_file)

    if unfixed_os_critical_high:
        print("[gate] Unfixed OS critical/high CVEs seen:")
        for cve_id in sorted(unfixed_os_critical_high):
            print(f"  - {cve_id}")

    if unexpected:
        print("[gate] New unfixed OS critical/high CVEs are not in exceptions list:")
        for cve_id in unexpected:
            print(f"  - {cve_id}")
        return 3

    if expired:
        print("[gate] Exception review date issues:")
        for issue in expired:
            print(f"  - {issue}")
        return 4

    print("[gate] Unfixed OS critical/high CVEs are covered by explicit exceptions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
