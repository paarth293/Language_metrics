# Language Metrics — Admin Panel: Security & Production Notes

This document captures the security posture of the admin panel for production
deployment. **It is a living note — keep it updated as the codebase evolves.**

## Non-negotiable security guarantees (already implemented)

1. **No hardcoded credentials.** The original build had a hardcoded
   `admin` / `12345678` login in `src/app/login/actions.ts`. It has been
   removed. Admins are provisioned exclusively through
   `scripts/create-admin.mjs`, which bcrypt-hashes (cost 12) the password
   before it reaches the database.

2. **Session token (JWT), signed and verified.**
   - Sessions are JWTs (`jsonwebtoken`) held in an **httpOnly, Secure (in
     production), SameSite=strict** cookie — never in `localStorage`.
   - Every request re-verifies the signature, issuer, audience and expiry via
     `src/lib/auth.ts:verifySession`. A cookie alone grants nothing.
   - Every page request reloads the admin's **current** DB row (status, role,
     permissions) through `src/lib/guards.ts:requireAdmin`, so suspensions and
     role changes take effect immediately.
   - `JWT_SECRET` is validated at module load: the app refuses to start without
     it or with a secret < 32 chars (`src/lib/auth.ts`).

3. **Login hardening** (`src/app/login/actions.ts`):
   - Per-IP rate limiting (10 attempts / 15 min) via `src/lib/rate-limit.ts`.
   - Account lockout after 5 failed attempts (15 min).
   - **Timing-safe comparison**: unknown emails are compared against a dummy
     bcrypt hash so response timing does not leak whether an account exists.
   - Every login attempt (success/failure/lockout/rate-limit) is persisted to
     the `LoginAttempt` table for forensic review.
   - CSRF defense in depth via `src/lib/security.ts` (SameSite=strict is the
     primary control).

4. **RBAC** (`src/lib/permissions.ts` + `src/lib/rbac.ts`): role presets
   (Super / Finance / Teacher / Support / Content admin) with granular
   per-user permission overrides. The sidebar and all API routes filter by
   permission. Super Admin has every permission.

5. **Complete audit logging** (`src/lib/audit.ts`): every privileged mutation
   (teacher approval/suspension, payout marking, logout) is written to
   `AdminAuditLog` against the acting admin, and privileged events also land in
   `SecurityEvent`. Viewable in the **Audit Logs** and **Security** pages.

6. **Security headers** (`next.config.ts`): Strict-Transport-Security,
   X-Content-Type-Options, X-Frame-Options (DENY), Referrer-Policy,
   Permissions-Policy, and a Content-Security-Policy; `poweredByHeader` off.

7. **Middleware gate** (`src/middleware.ts`): redirects unauthenticated users
   and rejects `/api` requests without a session cookie.

## Deployment checklist (before going to production)

- [ ] Set a strong `JWT_SECRET` in production env (>=32 chars, e.g.
      `openssl rand -base64 64`). Rotate if it ever leaks.
- [ ] Provision admin accounts via `create-admin.mjs` with strong, unique
      passwords. Do not reuse the default placeholder secret.
- [ ] Deploy over **TLS only**. HSTS is enabled; add your domain to the
      preload list if appropriate.
- [ ] If scaling horizontally, replace the in-memory rate limiter
      (`src/lib/rate-limit.ts`) with a shared store (Redis or DB-backed).
- [ ] Enforce RLS at the database layer per the design notes in
      `packages/database/prisma/schema.prisma` (currently RLS is documented but
      not yet wired — see below). Admin queries use the Prisma client and must
      run with least-privilege credentials, never a Supabase `service_role`
      key exposed to the client.
- [ ] Never commit any `.env` file (already git-ignored). Use
      `apps/admin-panel/.env.example` as the template.
- [ ] Add MFA / TOTP to admin logins (future enhancement; strongly recommended
      for finance-admin and super-admin roles).
- [ ] Run dependency audits (`npm audit`) in CI and pin/update packages.

## Known gaps / intentionally deferred

- **RLS policies are designed but not yet implemented** in SQL. Until they are,
  the admin panel is the access boundary; keep DB credentials off the client
  and prefer least-privilege roles.
- Email/SMS/push delivery (Communication Management) is UI + template storage
  only; actual delivery providers (Resend, SendGrid, Twilio) are not wired.
- Password reset flow for admins (generate a reset token + expiry) is not yet
  built.
- MFA for admins is not yet implemented.

## Contact Protection (spec §11)

The schema has a `SecurityEvent` table with a `CONTACT_SHARING` event type.
When chat-content scanning is implemented, phone/email/social-handle matches
should be written there so the **Security** page surfaces "Teacher attempted to
share WhatsApp number" alerts for investigation.
