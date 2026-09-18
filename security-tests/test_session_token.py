#!/usr/bin/env python3
"""
test_session_token.py
──────────────────────
Fix (errors.md #N2): this file was previously 0 bytes and silently counted
as [PASS]. Adds real checks that the RS256 session cookie is actually being
verified by proxy.ts (apps/admin-panel/src/proxy.ts) rather than just its
presence being trusted.

ONLY targets http://localhost — never a production URL.
Requires: requests  (pip install requests)
Requires: a running `npm run dev -w admin-panel` on port 3001.
"""

import sys
import requests

TARGET = "http://localhost:3001"
SAFETY_CHECK = "localhost"


def safety_guard():
    if SAFETY_CHECK not in TARGET:
        print(f"[ABORT] Target '{TARGET}' is not localhost. Refusing to run.")
        sys.exit(1)


def test_no_session_redirects_to_login():
    """A protected page with no session cookie at all must redirect to /login."""
    safety_guard()
    print("\n[test_session_token] Check: no cookie -> redirected to /login")

    r = requests.get(f"{TARGET}/", allow_redirects=False, timeout=15)
    print(f"  Status: {r.status_code}, Location: {r.headers.get('Location')}")
    if r.status_code in (302, 307) and "/login" in (r.headers.get("Location") or ""):
        print("[PASS] Unauthenticated request to '/' redirected to /login.")
        return True
    print(f"[FAIL] Expected a redirect to /login, got {r.status_code}.")
    return False


def test_garbage_access_token_is_rejected():
    """A syntactically-invalid access-token cookie must be treated as unauthenticated
    (proxy.ts's verifySession() must actually verify the RS256 signature, not just
    check that the cookie exists)."""
    safety_guard()
    print("\n[test_session_token] Check: forged/garbage access token is rejected")

    cookies = {"lm_admin_access_token": "not-a-real-jwt.definitely-invalid.signature"}
    r = requests.get(f"{TARGET}/", cookies=cookies, allow_redirects=False, timeout=15)
    print(f"  Status: {r.status_code}, Location: {r.headers.get('Location')}")
    if r.status_code in (302, 307) and "/login" in (r.headers.get("Location") or ""):
        print("[PASS] Forged access token correctly rejected, redirected to /login.")
        return True
    print(f"[FAIL] Expected rejection of a forged token, got {r.status_code}.")
    return False


def test_none_alg_token_is_rejected():
    """A JWT using alg=none (classic signature-bypass attempt) must be rejected.
    This is a base64url-encoded {"alg":"none","typ":"JWT"} header + a plausible
    payload + an empty signature segment — jose's jwtVerify must reject it
    outright since the panel only accepts RS256 (see lib/auth.ts)."""
    safety_guard()
    print("\n[test_session_token] Check: alg=none token is rejected")

    forged = (
        "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0"  # {"alg":"none","typ":"JWT"}
        ".eyJzdWIiOiJhdHRhY2tlciIsImlzU3VwZXJBZG1pbiI6dHJ1ZX0"  # {"sub":"attacker","isSuperAdmin":true}
        "."
    )
    cookies = {"lm_admin_access_token": forged}
    r = requests.get(f"{TARGET}/", cookies=cookies, allow_redirects=False, timeout=15)
    print(f"  Status: {r.status_code}, Location: {r.headers.get('Location')}")
    if r.status_code in (302, 307) and "/login" in (r.headers.get("Location") or ""):
        print("[PASS] alg=none token correctly rejected.")
        return True
    print(f"[FAIL] Expected rejection of an alg=none token, got {r.status_code}.")
    return False


if __name__ == "__main__":
    try:
        requests.get(TARGET, timeout=5)
    except requests.exceptions.ConnectionError:
        print(f"[SKIP] No server reachable at {TARGET}. Start it with `npm run dev -w admin-panel` and re-run.")
        sys.exit(3)

    results = [
        test_no_session_redirects_to_login(),
        test_garbage_access_token_is_rejected(),
        test_none_alg_token_is_rejected(),
    ]
    sys.exit(0 if all(results) else 1)
