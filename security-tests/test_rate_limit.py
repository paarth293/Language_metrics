#!/usr/bin/env python3
"""
test_rate_limit.py
───────────────────
Fix (errors.md #N2): this file was previously 0 bytes and silently counted
as [PASS] (SECURITY_REPORT.md's own table listed it as "NOT IMPLEMENTED —
file is empty"). Adds a real check of the per-IP login limit in
apps/admin-panel/src/lib/rate-limit.ts (10 attempts / 15 minutes, enforced
in auth-service.ts's `ipKey` check).

ONLY targets http://localhost — never a production URL.
Requires: requests  (pip install requests)

NOTE: this test intentionally trips the per-IP limit, which will also
lock out any OTHER login attempts from this machine for the rest of the
15-minute window (by design — that's what the limiter is for). Don't run
this against a shared dev server you're actively testing logins against.
"""

import sys
import time
import requests

TARGET = "http://localhost:3001"
LOGIN_ENDPOINT = f"{TARGET}/api/auth/login"
SAFETY_CHECK = "localhost"

IP_MAX_ATTEMPTS = 10  # must match auth-service.ts's IP_MAX_ATTEMPTS


def safety_guard():
    if SAFETY_CHECK not in TARGET:
        print(f"[ABORT] Target '{TARGET}' is not localhost. Refusing to run.")
        sys.exit(1)


def get_csrf(session: requests.Session) -> str:
    session.get(f"{TARGET}/login", timeout=15)
    return session.cookies.get("csrf_token", "")


def test_per_ip_limit_trips_after_max_attempts():
    safety_guard()
    print(f"\n[test_rate_limit] Check: per-IP limit trips after {IP_MAX_ATTEMPTS} attempts")

    session = requests.Session()
    tripped_at = None
    # Use a different email each attempt so this exercises the per-IP limiter
    # specifically, not the per-email one (which trips at a lower count of 5).
    for attempt in range(1, IP_MAX_ATTEMPTS + 3):
        csrf = get_csrf(session)
        r = session.post(
            LOGIN_ENDPOINT,
            data={
                "email": f"rate-limit-probe-{attempt}@example.invalid",
                "password": "wrong-password",
                "csrf_token": csrf,
            },
            headers={"Origin": TARGET, "content-type": "application/x-www-form-urlencoded"},
            allow_redirects=False,
            timeout=15,
        )
        print(f"  Attempt {attempt}: status {r.status_code}")
        if r.status_code == 429:
            tripped_at = attempt
            break
        time.sleep(0.1)

    if tripped_at is not None and tripped_at <= IP_MAX_ATTEMPTS + 2:
        print(f"[PASS] Per-IP rate limit tripped at attempt {tripped_at} (expected around {IP_MAX_ATTEMPTS}).")
        return True
    print(f"[FAIL] Per-IP rate limit never tripped within {IP_MAX_ATTEMPTS + 2} attempts.")
    return False


if __name__ == "__main__":
    try:
        requests.get(TARGET, timeout=5)
    except requests.exceptions.ConnectionError:
        print(f"[SKIP] No server reachable at {TARGET}. Start it with `npm run dev -w admin-panel` and re-run.")
        sys.exit(3)

    ok = test_per_ip_limit_trips_after_max_attempts()
    sys.exit(0 if ok else 1)
