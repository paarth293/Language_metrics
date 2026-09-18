# Language Metrics - Project Analysis Summary

## Overview
Language Metrics is a production-hardened, two-sided language learning marketplace connecting students with verified teachers for live video classes.

## Quick Facts

### Project Type
- Full-stack web application (marketplace SaaS)
- B2C2C model (students + teachers + admin platform)

### Architecture
- **Monorepo** with 3 frontend apps + 2 shared packages
- **Tech Stack:** Next.js 16, React 19, TypeScript, PostgreSQL, Redis, LiveKit
- **Deployment:** Vercel (3 apps), Supabase (DB), Upstash (Redis)

### Three Applications

1. **Teacher Web** (`apps/teacher-web/`)
   - Teacher portal + student redirect
   - Availability calendar, session management, earnings tracking

2. **Student Web** (`apps/student-web/`)
   - Discovery & booking interface
   - Coin wallet, live class join, ratings

3. **Admin Panel** (`apps/admin-panel/`)
   - Platform oversight (users, payments, complaints)
   - Analytics, audit logs, teacher approvals

### Database
- **40+ Prisma models** with RLS (Row-Level Security)
- **Key design:** Coin ledger-based (immutable transactions, not direct balance edits)
- **Double-booking:** Prevented by DB constraint `@@unique([teacherId, slotStart])`

### Payment System
- **Razorpay integration** with webhook-based settlement
- **Coins:** Virtual currency (₹500 = 500 coins + bonus)
- **Ledger:** Every transaction immutably recorded for auditing

### Live Video
- **LiveKit Cloud** for managed video infrastructure
- **Scoped tokens:** Generated server-side, limited to one room + user + time window
- **No direct token exposure:** Frontend never sees API secrets

### Security Highlights
- **Authentication:** RS256 JWT + httpOnly cookies + TOTP 2FA
- **Authorization:** RBAC enforced on every request + resource-level ownership checks
- **Rate Limiting:** Redis-backed, tighter on auth endpoints
- **Payments:** Server-side amount validation, HMAC webhook verification
- **Audit Trail:** All admin actions logged to AdminAuditLog (non-repudiation)
- **Input Validation:** Zod schemas on all endpoints, HTML sanitization
- **Deployment:** Secrets in environment variables, Cloudflare WAF, TLS 1.2+

### Development Commands

```bash
# Install & setup
npm install
npx prisma generate --schema=packages/database/prisma/schema.prisma
cp .env.example .env
npx prisma db push --schema=packages/database/prisma/schema.prisma
npm run db:seed

# Development
npm run dev                    # All 3 apps
npm run dev:teacher           # Teacher web only
npm run dev:admin             # Admin panel only
npm run dev:student           # Student web only

# Quality
npm run lint                   # ESLint
npm run scan:sast             # Security scan
npm run scan:secrets          # Gitleaks
npm run test:security         # Security test suite

# Production
npm run build                  # Production build
```

### Deployment
- **Current URLs:**
  - Teacher: https://language-metrics-teacher-web.vercel.app/
  - Student: https://language-metrics-student-web.vercel.app/
  - Admin: https://language-metrics-admin-panel.vercel.app/

### Key Files
| File | Purpose |
|------|---------|
| `README.md` | Getting started guide |
| `package.json` | Workspace + dependencies |
| `packages/database/prisma/schema.prisma` | Complete DB schema |
| `apps/teacher-web/docs/internal/Language_Metrics_Technical_Specification.md` | Full tech spec (30 KB) |
| `.github/workflows/security.yml` | CI/CD pipeline |
| `security-tests/run_all.py` | Security test runner |

### Environment Variables Needed
- `DATABASE_URL`, `DIRECT_URL` (PostgreSQL)
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` (RS256)
- `REDIS_URL` (Redis/Upstash)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY` (Email service)
- `NEXT_PUBLIC_APP_URL`

### Scaling Target
- **Current capacity:** ~5-10k DAU
- **Target:** 15k DAU
- **Required before launch:** Load testing, DB optimization, Redis caching, background job queue, horizontal autoscaling

### Project Timeline
- **Phase 1:** Foundation (Aug 16-22)
- **Phase 2-3:** Core & Booking (Aug 23-29)
- **Phase 4:** Payments & Coins (Aug 30-Sep 5)
- **Phase 5:** Live Classes (Sep 6-12)
- **Phase 6:** Hardening & Delivery (Sep 13-15)

### Internship Info
- **Duration:** Aug 16 – Sep 15, 2026
- **Role:** Full Stack Developer Intern
- **Owner:** Paarth Gupta (itz.paarth2910@gmail.com)

---

## Critical Concepts

### Coin Ledger System
- **Never edit balance directly** — all changes are transactions
- **Immutable:** Once recorded, transactions can't be modified (reverse via inverse transaction)
- **Auditability:** Every coin movement has timestamp, actor, reason

### Double-Booking Prevention
- DB-level constraint (not just app logic)
- Unique index on `(teacherId, slotStart)`
- PostgreSQL enforces atomically

### Payment Flow
1. Server creates Razorpay order (amount computed server-side)
2. Client completes checkout
3. **Razorpay webhook POST** (source of truth)
4. Server verifies HMAC signature
5. Idempotency check (webhook event ID deduplication)
6. Coins credited

### LiveKit Token Security
- Tokens generated server-side only
- Scoped to one room + one identity
- Verified join request (confirm user is in booking)
- Short TTL (6 hours for sessions)

---

## Next Steps for New Team Members

1. **Read:** `README.md` (overview) → Technical Specification (deep dive)
2. **Setup:** Follow local development setup (commands above)
3. **Explore:** Start with one app, then learn shared packages
4. **Security:** Review SECURITY.md files in each app
5. **Test:** Run `npm run test:security` to understand test suite

---

**Comprehensive Project Analysis Document:** See "Language Metrics - Complete Project Analysis Report" in Documents for full details on architecture, database schema, security, testing, and deployment strategy.

Report generated: September 6, 2026