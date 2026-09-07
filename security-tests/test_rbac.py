#!/usr/bin/env python3
"""
test_rbac.py
────────────
Fix (errors.md #N2): this file was previously 0 bytes and silently counted
as [PASS]. This adds what's realistically checkable as a black-box HTTP
test without seeded per-role credentials.

HONEST SCOPE NOTE: full role-matrix coverage (e.g. "a TEACHER_ADMIN cannot
hit /api/payouts/[id]") needs real logged-in sessions for each role preset,
which means either seeding test accounts for every role in ROLE_PRESETS
(apps/admin-panel/src/lib/permissions.ts) or calling authenticateAdmin()
directly from a Node test (like auth-service.test.ts does) instead of over
HTTP. This script only verifies the outer gate every permission-gated route
shares: requireApiAdmin() in apps/admin-panel/src/lib/api-auth.ts must
reject an unauthenticated request before any permission check even runs.
Treat a [PASS] here as "the front door is locked", not "every role
boundary is verified" — that needs the seeded-account test described above
as a follow-up.

ONLY targets http://localhost — never a production URL.
Requires: requests  (pip install requests)
Requires: a running `npm run dev -w admin-panel` on port 3001.
"""

import sys
import requests

TARGET = "http://localhost:3001"
SAFETY_CHECK = "localhost"

# Every one of these calls requireApiAdmin(request, "<permission>") before
# doing anything else (see apps/admin-panel/src/app/api/**/route.ts).
PERMISSION_GATED_ROUTES = [
    ("PATCH", "/api/payouts/00000000-0000-0000-0000-000000000000", "payouts:manage"),
    ("PATCH", "/api/teachers/00000000-0000-0000-0000-000000000000", "teachers:manage"),
    ("POST", "/api/teachers/00000000-0000-0000-0000-000000000000/status", "teachers:manage"),
]


def safety_guard():
    if SAFETY_CHECK not in TARGET:
        print(f"[ABORT] Target '{TARGET}' is not localhost. Refusing to run.")
        sys.exit(1)


def test_unauthenticated_requests_are_rejected():
    safety_guard()
    print("\n[test_rbac] Check: permission-gated API routes reject unauthenticated callers")
    all_ok = True
    for method, path, permission in PERMISSION_GATED_ROUTES:
        r = requests.request(method, f"{TARGET}{path}", json={}, timeout=15)
        ok = r.status_code == 401
        status_label = "PASS" if ok else "FAIL"
        print(f"  [{status_label}] {method} {path} (requires '{permission}') -> {r.status_code} (expected 401)")
        all_ok = all_ok and ok
    return all_ok


if __name__ == "__main__":
    try:
        requests.get(TARGET, timeout=5)
    except requests.exceptions.ConnectionError:
        print(f"[SKIP] No server reachable at {TARGET}. Start it with `npm run dev -w admin-panel` and re-run.")
        sys.exit(3)

    ok = test_unauthenticated_requests_are_rejected()
    print(
        "\n[NOTE] This only verifies the unauthenticated-rejection gate — it does NOT "
        "verify that (e.g.) a FINANCE_ADMIN is blocked from teachers:manage actions. "
        "See the module docstring for what a full role-matrix test would need."
    )
    sys.exit(0 if ok else 1)
