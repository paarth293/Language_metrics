# Plan for #12: the private-key finding, and secret scanning in CI (GATE)

Branch: `fix/phase3-security`. `.gitleaksignore` has not been touched.

## The finding

| | |
|---|---|
| Test | `test:payments` › `09-secret-scan` › "no private key material anywhere in git history" |
| Where | commit `159f42f` (2026-08-28, paarth293, "student dashboard + teacher dashboard added"), `apps/student-web/src/lib/tokens.ts:22` |
| What | `const DEV_PRIVATE_KEY = \`-----BEGIN RSA PRIVATE KEY-----…\`` and a `DEV_PUBLIC_KEY`. These were a development fallback for signing login JWTs: `process.env.JWT_PRIVATE_KEY ?? DEV_PRIVATE_KEY`. |
| Removed | the same day, in `61076cb` ("Fix security pipeline and ESLint errors"). No current code refers to it. |
| Still in history | yes, on `Priyanshu`, `main` and every branch since. History is not rewritten (your rule). |
| Already ignored by gitleaks | yes: `.gitleaksignore` line 2 is `159f42f…:apps/student-web/src/lib/tokens.ts:private-key:22`. Only our own `09-secret-scan` test does not honour it. |

### Is it a real key? No (checked locally; nothing was printed)

| Block | base64 chars | decoded bytes | Parses with Node `crypto`? |
|---|---|---|---|
| Private (`MIIEog…` header, which claims ~1,190 bytes, i.e. 2048-bit RSA) | 293 | 219 | **no** (`ERR_OSSL_UNSUPPORTED`) |
| Public | 321 | 240 | **no** (lines of 65 chars, which is not valid PEM) |

The block is a truncated or made-up placeholder in key format. It cannot sign or verify anything. A deployment that fell back to it would have failed on the first login (`importPKCS8` throws) rather than issuing tokens. So no session could ever have been signed with it, and there is nothing to rotate.

What I can't verify: that every deployment between `159f42f` and `61076cb` really had `JWT_PRIVATE_KEY` set. That only affects whether logins failed for a few hours on 2026-08-28. It is not a security exposure.

## Decision needed

- **Option A (recommended): confirm it's a false positive and allowlist this one finding in both tools.**
  - `.gitleaksignore` stays as it is: the entry already exists, so the file needs no change.
  - `09-secret-scan` learns to read `.gitleaksignore` and skip findings at exactly those `commit:file` pairs. The ignore list then lives in one place, and any **new** private key anywhere still fails.
  - Then `test:payments` passes fully, so it can block in CI.
- **Option B: keep the test failing on purpose** as a standing reminder, and add `test:payments` to CI as non-blocking (`continue-on-error`). That keeps a red check on every PR, so I don't recommend it.

## CI changes (after your answer)

1. **`test:payments` in CI:** a job in `quality.yml` (every PR) running `npm run test:payments`. It needs no secrets, because the harness uses a fake DB and a fake Cashfree. It needs `fetch-depth: 0`, since `09-secret-scan` reads the whole history.
2. **gitleaks on every PR, full history:** today it runs only when admin login, the proxy, the schema or the security tests change (`security.yml` path filter). I'll move it into its own workflow with no path filter, `fetch-depth: 0` and the existing `.gitleaks.toml` and `.gitleaksignore`.
   - **Risk:** gitleaks isn't installed here, so I can't see what a full-history scan finds. The leaked **LiveKit key (#11) is in history** and will very likely fail it.
   - With your OK, I'll download the pinned gitleaks release binary (checked against its published SHA-256, as the workflow already does for osv-scanner) and run it locally against the full history. Before enabling the job, I'll show you every finding with the secret masked.
   - Any further ignore entries (for example the LiveKit key, **after you revoke it**) go through this same gate.

## Questions for your "go"

1. Option A or B? (Recommended: A.)
2. May I download the pinned gitleaks binary to run the full-history scan locally first? (Recommended: yes.)

---

## Outcome of option A (done, `636bd2a`)

- `09-secret-scan` honours `.gitleaksignore` (exact commit + file only). A second test fails if the accepted list ever differs from the real findings. `.gitleaksignore` was not changed.
- `test:payments` passes fully (217 passed, 2 skipped) and runs on every PR (`payment-security` job, full history).

## Full-history gitleaks scan (run locally, 2026-10-20) — still a GATE

gitleaks 8.21.2: the Windows release was checked against the release's `checksums.txt` (SHA-256 `f238c85e…ef133`). The scan used the repo's `.gitleaks.toml` and `.gitleaksignore`, `--log-opts="--all --no-textconv --no-ext-diff"`, and `--redact`. It scanned 596 commits and found **19 findings**. None is a live secret:

| Findings | Rule | Where | What it is |
|---|---|---|---|
| 11 | database-url-inline | test files from 2026-10-19 (`env.test.ts` ×3, `global-error.test.tsx` ×3, `error.test.tsx`, `api/health/route.test.ts`, `logger/index.test.ts`, `issue-08c-payment-logging.test.ts`) | Fake `postgresql://app:…@db.example.test/…` strings that test redaction (5 are mine, from #8f) |
| 2 | private-key | `packages/logger/src/index.test.ts:98`, `tests/payment-security/09-secret-scan.test.ts:19` | A fake `-----BEGIN PRIVATE KEY-----\nMIIabc…` fixture, and the scan's own regex |
| 2 | database-url-inline | `README.md:45` @ `d76295b` | `postgresql://user:…@localhost:5432/…` documentation placeholder |
| 1 | private-key | `README.md:71` @ `159f42f` | `JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."` documentation placeholder |
| 3 | hardcoded-admin-username/password, static-session-token | `apps/admin-panel/src/app/login/actions.ts:10-12` @ `935c1e3` (2026-08-20) | The first mock admin login (`admin` / an 8-character placeholder-style password), replaced on 2026-08-25. **Make sure no real admin account uses that password.** |
| 1 | generic-api-key | `apps/student-web/src/app/api/v1/routes.test.ts:127` @ `fc5f3be` | A test value starting with `test` |

**Gap:** the default gitleaks rules do **not** detect the leaked LiveKit key pair (#11, `fc5f3be` `.env.example:78-79`), so "gitleaks on every PR" alone would not have caught #11.

### Proposed next step (needs your "go")

1. Add the 19 fingerprints above to `.gitleaksignore`. They're all fixtures or placeholders; I'd rather not allowlist whole test folders, since that would hide a real secret pasted into a test.
2. Add a `livekit-credentials` rule to `.gitleaks.toml` (`LIVEKIT_API_(KEY|SECRET)` assigned a non-empty literal). **After you revoke the key in LiveKit Cloud**, add its fingerprint to `.gitleaksignore` too.
3. Move the gitleaks job out of `security.yml`'s path filter, into a workflow on every PR with `fetch-depth: 0` and the same flags as above.

Until then, gitleaks still runs only on the admin/security paths, and `09-secret-scan` (now in CI on every PR) covers payment secrets and private keys across the whole history.
