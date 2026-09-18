#!/usr/bin/env python3
"""
test_csrf.py
────────────
Fix (errors.md #N2): this file was previously 0 bytes. run_all.py used to
treat an empty file's exit code 0 as [PASS], so SECURITY_REPORT.md claimed
CSRF protection was verified when zero assertions had ever run. This adds
real checks against the double-submit CSRF defense in
apps/admin-panel/src/lib/csrf.ts + auth-service.ts.

ONLY targets http://localhost — never a production URL.

Requires: requests  (pip install requests)
Requires: a running `npm run dev -w admin-panel` (or `npm start -w admin-panel`)
on port 3001, reachable from wherever this script runs.
"""

import sys
import requests

TARGET = "http://localhost:3001"
LOGIN_ENDPOINT = f"{TARGET}/api/auth/login"
SAFETY_CHECK = "localhost"


def safety_guard():
    if SAFETY_CHECK not in TARGET:
        print(f"[ABORT] Target '{TARGET}' is not localhost. Refusing to run.")
        sys.exit(1)


def test_login_without_csrf_cookie_is_rejected():
    """POST with a csrf_token form field but NO csrf_token cookie must fail.

    authenticateAdmin() calls csrfTokensMatch(csrfCookie, csrfForm) first,
    which returns false whenever either side is missing — this must never
    reach the password check.
    """
    safety_guard()
    print("\n[test_csrf] Check: login rejected when csrf_token cookie is absent")

    session = requests.Session()  # fresh session -> no csrf_token cookie yet
    r = session.post(
        LOGIN_ENDPOINT,
        data={"email": "admin@languagemetrics.com", "password": "irrelevant", "csrf_token": "some-token"},
        headers={"Origin": TARGET, "content-type": "application/x-www-form-urlencoded"},
        allow_redirects=False,
        timeout=15,
    )
    print(f"  Status: {r.status_code}")
    if r.status_code == 403:
        print("[PASS] Login correctly rejected (403) with no csrf_token cookie.")
        return True
    print(f"[FAIL] Expected 403 with no CSRF cookie, got {r.status_code}.")
    return False


def test_login_with_mismatched_csrf_is_rejected():
    """A csrf_token cookie that doesn't match the submitted form field must fail."""
    safety_guard()
    print("\n[test_csrf] Check: login rejected when csrf cookie != csrf form field")

    session = requests.Session()
    # Prime a real csrf_token cookie by visiting /login first.
    session.get(f"{TARGET}/login", timeout=15)
    real_cookie = session.cookies.get("csrf_token")
    if not real_cookie:
        print("[SKIP] /login did not set a csrf_token cookie — cannot run this check.")
        sys.exit(3)

    r = session.post(
        LOGIN_ENDPOINT,
        data={"email": "admin@languagemetrics.com", "password": "irrelevant", "csrf_token": real_cookie + "-tampered"},
        headers={"Origin": TARGET, "content-type": "application/x-www-form-urlencoded"},
        allow_redirects=False,
        timeout=15,
    )
    print(f"  Status: {r.status_code}")
    if r.status_code == 403:
        print("[PASS] Login correctly rejected (403) with a mismatched CSRF token.")
        return True
    print(f"[FAIL] Expected 403 with mismatched CSRF token, got {r.status_code}.")
    return False


def test_login_rejects_cross_origin_request():
    """A request whose Origin header doesn't match this host must be rejected
    by assertSameOrigin(), independent of the CSRF cookie/token check."""
    safety_guard()
    print("\n[test_csrf] Check: login rejected when Origin does not match Host")

    session = requests.Session()
    session.get(f"{TARGET}/login", timeout=15)
    real_cookie = session.cookies.get("csrf_token")
    if not real_cookie:
        print("[SKIP] /login did not set a csrf_token cookie — cannot run this check.")
        sys.exit(3)

    r = session.post(
        LOGIN_ENDPOINT,
        data={"email": "admin@languagemetrics.com", "password": "irrelevant", "csrf_token": real_cookie},
        headers={"Origin": "http://evil.example.com", "content-type": "application/x-www-form-urlencoded"},
        allow_redirects=False,
        timeout=15,
    )
    print(f"  Status: {r.status_code}")
    if r.status_code == 403:
        print("[PASS] Login correctly rejected (403) for a cross-origin request.")
        return True
    print(f"[FAIL] Expected 403 for a mismatched Origin, got {r.status_code}.")
    return False


if __name__ == "__main__":
    try:
        requests.get(TARGET, timeout=5)
    except requests.exceptions.ConnectionError:
        print(f"[SKIP] No server reachable at {TARGET}. Start it with `npm run dev -w admin-panel` and re-run.")
        sys.exit(3)

    results = [
        test_login_without_csrf_cookie_is_rejected(),
        test_login_with_mismatched_csrf_is_rejected(),
        test_login_rejects_cross_origin_request(),
    ]
    sys.exit(0 if all(results) else 1)
