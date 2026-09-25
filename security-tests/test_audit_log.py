#!/usr/bin/env python3
"""
test_audit_log.py
──────────────────
Fix (errors.md #N2): this file was previously 0 bytes and silently counted
as [PASS]. Audit logging (apps/admin-panel/src/lib/audit.ts) writes to the
LoginAttempt / AdminAuditLog / SecurityEvent tables, which this black-box
HTTP script has no direct read access to (no diagnostic/read endpoint
exists for them, on purpose — they shouldn't be network-readable).

HONEST SCOPE NOTE: this script can only verify audit logging INDIRECTLY —
by confirming that repeated failed attempts change externally-visible
behavior (rate limiting / lockout responses), which requires
recordLoginAttempt() and the failedLoginCount counter in auth-service.ts to
actually be running. It cannot confirm the AdminAuditLog rows themselves
look correct (event type, actor, IP). For that, either:
  (a) run `SELECT * FROM "AdminAuditLog" ORDER BY "createdAt" DESC LIMIT 5;`
      against the dev database after running this script, or
  (b) add a Vitest unit test that mocks `db.adminAuditLog.create` and
      asserts the exact call shape (same pattern as auth-service.test.ts).
This script covers (nothing) unless a live server + seeded admin account
is available; treat a [SKIP] as "not exercised", not "passed".

ONLY targets http://localhost — never a production URL.
Requires: requests  (pip install requests)
"""

import sys
import time
import requests

TARGET = "http://localhost:3001"
LOGIN_ENDPOINT = f"{TARGET}/api/auth/login"
SAFETY_CHECK = "localhost"

# Must NOT be a real admin account — this test intentionally fails login
# repeatedly to confirm attempts are being counted server-side.
PROBE_EMAIL = "audit-log-probe-account@example.invalid"


def safety_guard():
    if SAFETY_CHECK not in TARGET:
        print(f"[ABORT] Target '{TARGET}' is not localhost. Refusing to run.")
        sys.exit(1)


def get_csrf(session: requests.Session) -> str:
    session.get(f"{TARGET}/login", timeout=15)
    return session.cookies.get("csrf_token", "")


def test_repeated_failed_logins_get_rate_limited():
    """auth-service.ts rate-limits by email (5 attempts / 15 min) via
    lib/rate-limit.ts, and every attempt is recorded via
    recordLoginAttempt() regardless of outcome. If failed attempts against
    the SAME email are never being tracked, this limit would never trip —
    so tripping it is indirect evidence the attempt-recording path runs."""
    safety_guard()
    print(f"\n[test_audit_log] Check: {6} failed logins against one email trip the per-email limit")

    session = requests.Session()
    last_status = None
    last_body = None
    for attempt in range(1, 7):
        csrf = get_csrf(session)
        r = session.post(
            LOGIN_ENDPOINT,
            data={"email": PROBE_EMAIL, "password": "wrong-password", "csrf_token": csrf},
            headers={"Origin": TARGET, "content-type": "application/x-www-form-urlencoded"},
            allow_redirects=False,
            timeout=15,
        )
        last_status, last_body = r.status_code, r.text[:200]
        print(f"  Attempt {attempt}: status {r.status_code}")
        time.sleep(0.2)

    if last_status == 429:
        print("[PASS] Per-email rate limit tripped after repeated failed logins "
              "(login-attempt tracking is running server-side).")
        return True
    print(f"[FAIL] Expected 429 after 6 failed attempts, got {last_status}: {last_body}")
    return False


if __name__ == "__main__":
    try:
        requests.get(TARGET, timeout=5)
    except requests.exceptions.ConnectionError:
        print(f"[SKIP] No server reachable at {TARGET}. Start it with `npm run dev -w admin-panel` and re-run.")
        sys.exit(3)

    ok = test_repeated_failed_logins_get_rate_limited()
    print(
        "\n[NOTE] This only proves attempt-tracking runs, not that AdminAuditLog rows "
        "are well-formed. See the module docstring for a direct DB-level follow-up."
    )
    sys.exit(0 if ok else 1)
