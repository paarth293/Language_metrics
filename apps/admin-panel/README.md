# Language Metrics — Admin Panel

Administrative dashboard for the Language Metrics platform, built to the
`LM_Admin_Panel_Specification.pdf` blueprint.

> **⚠️ Read `SECURITY.md` before deploying.** This panel is production-bound
> and ships hardened auth, RBAC, rate-limiting, audit logging and security
> headers.

## Stack

- **Next.js 16 (App Router)** · React 19 · TypeScript · Tailwind v4
- **Prisma + PostgreSQL** via the shared `@repo/database` package
- **jsonwebtoken** (signed session JWTs) · **bcryptjs** (password hashing)
- **zod** available for input validation

## Getting started

```bash
# 1. Install dependencies (from repo root)
npm install

# 2. Configure environment
cp apps/admin-panel/.env.example apps/admin-panel/.env
#  ...fill in DATABASE_URL, DIRECT_URL and a strong JWT_SECRET (>=32 chars)

# 3. Sync the schema to the database (additive; creates new admin tables)
cd packages/database && npx prisma db push

# 4. Provision your first admin (from repo root)
ADMIN_EMAIL=admin@yourdomain.com \
ADMIN_PASSWORD='a-very-strong-password-here' \
ADMIN_ROLE=SUPER_ADMIN \
node --env-file=.env apps/admin-panel/scripts/create-admin.mjs

# 5. Run the panel (port 3001)
npm run dev -w admin-panel
```

Optional sample content for non-production:

```bash
node --env-file=.env apps/admin-panel/scripts/seed-dev.mjs
```

## Key scripts

| Script | Purpose |
| --- | --- |
| `scripts/create-admin.mjs` | Create / rotate an admin account (bcrypt hashing) |
| `scripts/seed-dev.mjs` | Seed demo languages, courses, coupons, complaints (dev only) |

## Features (spec coverage)

Dashboard, Students, Teachers (approval / suspension / BGV / QA), Languages,
Courses, Classes, Payments, GST & Invoices, Teacher Payouts, Recordings,
Complaints, Reviews, Coupons, Notifications, Analytics, Security &
Monitoring, Legal & Documents, Settings, Admin Users & Permissions, Audit Logs.

## Security model

See [`SECURITY.md`](./SECURITY.md) for the full note. Highlights:

- No hardcoded credentials; bcrypt-hashed admin passwords only.
- HttpOnly + Secure + SameSite=strict signed session JWT.
- Per-IP rate limiting, account lockout, timing-safe login.
- Role presets + granular per-user permissions (RBAC).
- Full audit logging of every privileged action.
- Security headers + CSP; framework identity hidden.

## Production reminders

- Never commit `.env`. Use `.env.example`.
- Set a strong `JWT_SECRET` in prod (rotate on leak).
- Enforce DB-level RLS (see `SECURITY.md`); keep DB creds off the client.
