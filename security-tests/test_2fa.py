#!/usr/bin/env python3
"""
test_2fa.py
───────────
Asserts that login fails without a valid TOTP code when 2FA
is enabled for the admin account.

ONLY targets http://localhost — never a production URL.

NOTE: This test will FAIL / SKIP until 2FA is implemented.
      The current admin panel has no 2FA — this documents the gap.

Requires: pyotp  (pip install pyotp)
"""

import sys
import os
import requests

# Force UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Config ──────────────────────────────────────────────────
TARGET = "http://localhost:3001"
LOGIN_ENDPOINT = f"{TARGET}/api/auth/login"
SAFETY_CHECK = "localhost"

# The TOTP secret would be stored in the DB / env once 2FA is implemented
TOTP_SECRET = os.environ.get("ADMIN_TOTP_SECRET", "")
# ────────────────────────────────────────────────────────────


def safety_guard():
    if SAFETY_CHECK not in TARGET:
        print(f"[ABORT] Target '{TARGET}' is not localhost. Refusing to run.")
        sys.exit(1)


def check_2fa_endpoint_exists() -> bool:
    """Check if the login form has a totp_code field (2FA is implemented)."""
    resp = requests.get(f"{TARGET}/login", timeout=15)
    return "totp" in resp.text.lower() or "2fa" in resp.text.lower() or "authenticator" in resp.text.lower()


def test_login_without_totp_is_rejected():
    """Login with correct credentials but no TOTP code should fail if 2FA is on."""
    safety_guard()
    print(f"\n[test_2fa] Check: 2FA gate on login endpoint")

    if not check_2fa_endpoint_exists():
        print("[SKIP] ⚠️  2FA is NOT yet implemented (no totp_code field in login form).")
        print("       This is a PENDING security requirement.")
        print("       To implement: add TOTP seed to admin account and require OTP on login.")
        sys.exit(3)

    session = requests.Session()

    # Attempt 1: correct creds, wrong/missing TOTP
    r_csrf = session.get(TARGET + "/login", timeout=15)
    csrf_token = session.cookies.get("csrf_token", "")
    
    print("\n  Attempt with correct credentials but missing TOTP code:")
    r = session.post(
        LOGIN_ENDPOINT,
        data={"email": "admin@languagemetrics.com", "password": "Password123!", "totp_code": "000000", "csrf_token": csrf_token},
        headers={"Origin": TARGET},
        allow_redirects=False,
        timeout=15,
    )
    print(f"  Status: {r.status_code}")
    if r.status_code in (401, 403) or (
        r.status_code in (302, 307) and "/login" in r.headers.get("Location", "")
    ):
        print("[PASS] ✅ Login correctly rejected with missing/wrong TOTP code.")
    else:
        print(f"[FAIL] ❌ Login succeeded without valid TOTP (got {r.status_code}).")
        sys.exit(1)

    # Attempt 2: correct creds + valid TOTP
    if TOTP_SECRET:
        try:
            import pyotp
            totp = pyotp.TOTP(TOTP_SECRET)
            valid_code = totp.now()

            # We need CSRF token for the valid TOTP attempt because Attempt 1 used it up (or because it is required)
            # Actually, Attempt 1 already got a response. Let's get a fresh CSRF token
            r_csrf = session.get(TARGET + "/login", timeout=15)
            csrf_token = session.cookies.get("csrf_token", "")

            print(f"\n  Attempt with correct credentials + valid TOTP ({valid_code}):")
            r2 = session.post(
                LOGIN_ENDPOINT,
                data={"email": "admin@languagemetrics.com", "password": "Password123!", "totp_code": valid_code, "csrf_token": csrf_token},
                headers={"Origin": TARGET},
                allow_redirects=False,
                timeout=15,
            )
            print(f"  Status: {r2.status_code}")
            if r2.status_code in (200, 302, 307):
                print("[PASS] ✅ Login succeeded with valid TOTP code.")
                sys.exit(0)
            else:
                print(f"[FAIL] ❌ Login failed even with valid TOTP ({r2.status_code}).")
                sys.exit(1)
        except ImportError:
            print("[SKIP] pyotp not installed. Run: pip install pyotp")
            sys.exit(3)
    else:
        print("\n[INFO] ADMIN_TOTP_SECRET not set — skipping valid-TOTP attempt.")
        sys.exit(0)


if __name__ == "__main__":
    test_login_without_totp_is_rejected()
