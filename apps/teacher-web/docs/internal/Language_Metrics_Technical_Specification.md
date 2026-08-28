# Language Metrics — Full Platform Technical Specification & Delivery Blueprint

**Prepared for:** Internship delivery (Aug 16 – Sep 15, 2026)
**Project:** Language-learning platform — booking, live classes, payments, coin economy
**Stack (as specified):** Node.js + Express · PostgreSQL / Supabase · Prisma ORM · React (Teacher + Admin portals) · Razorpay · LiveKit

---

## 1. Executive Summary

Language Metrics is a two-sided marketplace connecting language learners with teachers for live, paid classes. Students discover teachers, book time slots, pay using an in-app coin currency (topped up via Razorpay), and attend classes through embedded live video (LiveKit). Teachers manage their availability, deliver sessions, and track earnings through a dedicated portal. Admins oversee the whole platform — users, payments, disputes, and content — through an admin portal.

This document is the complete build blueprint: every module, the database design, the API surface, the security architecture, and the scaling plan needed to take this from zero to a live, production-hardened platform.

---

## 2. Objectives & Success Criteria

| Goal | Target |
|---|---|
| Daily active visitors | ~15,000/day, sustained |
| Uptime | 99.9% (≈43 min downtime/month budget) |
| API response time (p95) | < 400ms for non-video endpoints |
| Payment success rate | > 98% of initiated transactions |
| Live class join success rate | > 99% |
| Zero critical security incidents | Pen-tested before public launch |
| Booking double-book rate | 0% (hard DB-level constraint) |

**A note on scope, honestly stated:** going from an empty repo to a fully hardened, load-tested platform that comfortably and *safely* handles 15,000 daily visitors is realistically a multi-month effort for a small team, not a one-month build. That doesn't change what you should build — this spec gives you the complete, correct architecture from day one so you never have to rip anything out later. What it does mean practically: treat the 1-month internship window as delivering Phases 1–6 below (a fully functional, securely-coded MVP on solid scalable foundations), then treat load-testing to the full 15k number and hardening as an explicit post-launch phase before you actually market to that volume. This keeps the milestone-based stipend structure honest and keeps you from cutting security corners under deadline pressure.

---

## 3. User Roles & Permissions

| Role | Capabilities |
|---|---|
| **Student** | Sign up, browse teachers/courses, book & pay for sessions, buy coins, join live classes, rate teachers, view booking history, earn/spend coins |
| **Teacher** | Set availability, accept/manage bookings, host live classes, view earnings, upload materials, view student roster |
| **Admin** | Manage users, approve/suspend teachers, view all bookings/payments, issue refunds, grant/adjust coins, view platform analytics, manage content/courses |
| **Superadmin** (optional, recommended) | Everything Admin can do + manage other admins, access audit logs, rotate API keys |

Every role above must be enforced **server-side** on every request — never trust a role flag sent from the client.

---

## 4. Functional Requirements by Module

### 4.1 Authentication & Account Management
- Email/password signup with email verification (magic link or OTP)
- Login with JWT access token (short-lived) + refresh token (httpOnly cookie)
- Password reset flow (time-limited signed token, single use)
- Role-based signup: student vs. teacher (teacher accounts require admin approval before going live)
- Profile management (name, photo, bio, languages taught/learning, timezone)
- Account deactivation / deletion (soft delete + data export, for compliance)
- Optional: Google OAuth login for lower signup friction

### 4.2 Student-Facing Web App
- Landing/marketing pages (SEO-friendly)
- Teacher discovery: search & filter by language, price, rating, availability
- Teacher profile pages with reviews and available slots
- Booking flow (see 4.5)
- Coin wallet + purchase flow (see 4.6)
- "My Classes" dashboard — upcoming, past, cancelled
- Live class join screen
- Ratings & reviews after a completed session
- Notification center

### 4.3 Teacher Portal
- Availability calendar (recurring + one-off slots, timezone-aware)
- Booking requests & upcoming class list
- Session materials upload
- Earnings dashboard (coins earned → payout tracking)
- Student roster & session history
- Profile & rate management (subject to admin approval on changes)

### 4.4 Admin Portal
- User management (search, view, suspend, verify teachers)
- Booking oversight (all bookings, filters, manual cancel/refund)
- Payment & coin ledger view (full audit trail, exportable)
- Manual coin grants/adjustments (always logged)
- Course/language catalog management
- Dispute/refund handling queue
- Platform analytics dashboard (signups, bookings, revenue, DAU trend)
- Content moderation (reviews, profile photos, reported users)

### 4.5 Booking System
- Teacher defines availability windows (with buffer time between sessions)
- Student selects a slot → system locks it (short TTL hold, e.g. 5 min) while payment/coin deduction completes
- **Atomic, DB-constrained** double-booking prevention (unique constraint on teacher_id + slot_start, or an exclusion constraint for overlapping ranges)
- Booking states: `pending → confirmed → completed | cancelled | no_show`
- Cancellation policy engine (e.g., free cancel > 12h before, partial coin refund otherwise — configurable)
- Rescheduling flow (cancels + rebooks atomically)
- Timezone handling: store all timestamps in UTC, render in user's local timezone client-side
- Automated reminder notifications (24h, 1h before class)

### 4.6 Coin (Virtual Currency) System
- Every student has a `Wallet` with a `balance` field
- Coins purchased in packages via Razorpay (e.g., ₹500 → 500 coins, with possible bonus tiers)
- Every balance change is recorded as an **immutable ledger entry** (`CoinTransaction`) — balance is never edited directly, it's derived/reconciled from the ledger. This is non-negotiable for auditability and dispute resolution.
- Booking a class = a `debit` transaction; cancellation refund = a `credit` transaction; admin grant = a `credit` transaction with an `admin_id` and `reason`
- Teacher payout logic: coins earned per completed session convert to a payout amount at a defined rate — tracked separately from student-facing coins

### 4.7 Payments (Razorpay)
- Razorpay Checkout for coin package purchases
- Server creates a Razorpay `order` first (amount fixed server-side — **never trust a client-submitted amount**)
- Client completes checkout → Razorpay redirects/returns payment_id + signature
- Server verifies the payment via Razorpay webhook (HMAC signature check) as the **source of truth**, not the client callback alone
- Idempotent webhook processing (store processed `event_id`s, ignore duplicates/retries)
- Coins credited only after webhook-verified success
- Refund handling (admin-triggered, hits Razorpay refund API, logged in ledger)
- Invoice/receipt generation per transaction

### 4.8 Live Class System (LiveKit)
- On booking confirmation, a `Session` record is created holding a unique LiveKit room name
- Room access tokens generated **server-side only**, scoped to that specific user + room + time window, short expiry
- Join endpoint verifies: is this user the enrolled student or assigned teacher for this exact session, and is it within the allowed join window (e.g., 10 min before to end time)? Only then issue a token.
- Session lifecycle: room auto-created on first join, auto-closed after class end time
- Attendance tracking (join/leave timestamps logged)
- Optional: server-side recording via LiveKit Egress, stored in object storage (S3/Supabase Storage) with signed URLs
- Basic in-call tools: mute/camera controls, chat (LiveKit data channel), screen share

### 4.9 Notifications
- Transactional email (booking confirmation, payment receipt, class reminder) via a provider like Resend/SendGrid
- In-app notification center
- Optional: SMS/WhatsApp reminders (via a provider like MSG91/Twilio) for class start times — high value for reducing no-shows

### 4.10 AI Developer Integration Points
The offer letter mentions collaborating with an AI Developer on API contracts — exact AI features aren't specified in the letter, so treat this as a placeholder to confirm early. Common fits for a language platform: pronunciation scoring, personalized lesson recommendations, an AI conversation-practice bot, or auto-generated session notes. Whatever it is, expose it as a clean internal API contract (e.g., `POST /api/ai/pronunciation-score`) rather than tightly coupling the AI service into core booking/payment logic — this keeps the two workstreams independent and lets the AI service be swapped or scaled separately.

---

## 5. System Architecture

```
                         ┌─────────────────────┐
                         │   Cloudflare (CDN,   │
                         │   WAF, DDoS shield)  │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
        ┌────────▼───────┐ ┌────────▼────────┐ ┌───────▼────────┐
        │ Student Web App │ │  Teacher Portal  │ │  Admin Portal   │
        │   (React)       │ │    (React)       │ │   (React)       │
        └────────┬────────┘ └────────┬─────────┘ └───────┬────────┘
                 │                    │                    │
                 └────────────────────┼────────────────────┘
                                      │  HTTPS / REST (JSON)
                          ┌───────────▼────────────┐
                          │   Load Balancer         │
                          └───────────┬────────────┘
                     ┌────────────────┼────────────────┐
             ┌───────▼──────┐ ┌───────▼──────┐ ┌────────▼─────┐
             │ API Node #1  │ │ API Node #2  │ │ API Node #N  │  (stateless,
             │ Express.js   │ │ Express.js   │ │ Express.js   │   autoscaled)
             └───────┬──────┘ └───────┬──────┘ └────────┬─────┘
                     └────────────────┼─────────────────┘
              ┌───────────────────────┼───────────────────────┐
     ┌────────▼────────┐   ┌──────────▼─────────┐   ┌─────────▼────────┐
     │ PostgreSQL       │   │  Redis              │   │ Job Queue        │
     │ (Supabase,       │   │ (cache, rate-limit, │   │ (BullMQ on Redis)│
     │  via Prisma)     │   │  token blacklist)   │   │ webhooks, email  │
     └──────────────────┘   └─────────────────────┘   └──────────────────┘

     External services:  Razorpay (payments)  ·  LiveKit Cloud (video)
                          Resend/SendGrid (email)  ·  Sentry (errors)
```

Key architecture decisions:
- **Stateless API layer** — no in-memory session state, so any node can handle any request → horizontal scaling is trivial
- **Redis** sits in the critical path for rate-limiting and caching, not just as a nice-to-have
- **Webhooks (Razorpay) and heavy async work go through a job queue**, never processed inline in the request that triggers them
- **All third-party secrets and API keys live only on the backend** — the React apps never see Razorpay secret keys or LiveKit API secrets, only public/anon keys where applicable

---

## 6. Database Schema (Prisma-style)

```prisma
enum Role {
  STUDENT
  TEACHER
  ADMIN
  SUPERADMIN
}

enum BookingStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum TxnType {
  PURCHASE      // coins bought via Razorpay
  DEBIT_BOOKING // coins spent on a booking
  REFUND        // coins refunded
  ADMIN_GRANT   // manual admin adjustment
  TEACHER_PAYOUT// coins converted to teacher earnings
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  role          Role
  isVerified    Boolean  @default(false)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())

  studentProfile TeacherProfile?
  teacherProfile TeacherProfile?
  wallet         Wallet?
  bookingsAsStudent Booking[] @relation("StudentBookings")
  auditLogs      AuditLog[]
}

model TeacherProfile {
  id            String   @id @default(uuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id])
  bio           String?
  languages     String[]
  hourlyRateCoins Int
  isApproved    Boolean  @default(false)
  rating        Float    @default(0)
  availability  Availability[]
}

model Availability {
  id         String   @id @default(uuid())
  teacherId  String
  teacher    TeacherProfile @relation(fields: [teacherId], references: [id])
  startTime  DateTime // UTC
  endTime    DateTime // UTC
  isRecurring Boolean @default(false)
}

model Booking {
  id          String   @id @default(uuid())
  studentId   String
  teacherId   String
  slotStart   DateTime // UTC
  slotEnd     DateTime // UTC
  status      BookingStatus @default(PENDING)
  coinsSpent  Int
  createdAt   DateTime @default(now())

  student     User @relation("StudentBookings", fields: [studentId], references: [id])
  session     LiveSession?

  @@unique([teacherId, slotStart]) // hard DB-level double-booking guard
}

model LiveSession {
  id           String   @id @default(uuid())
  bookingId    String   @unique
  booking      Booking  @relation(fields: [bookingId], references: [id])
  roomName     String   @unique
  startedAt    DateTime?
  endedAt      DateTime?
  recordingUrl String?
}

model Wallet {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  balance   Int      @default(0) // derived/reconciled from ledger; never edited directly
  transactions CoinTransaction[]
}

model CoinTransaction {
  id        String   @id @default(uuid())
  walletId  String
  wallet    Wallet   @relation(fields: [walletId], references: [id])
  type      TxnType
  amount    Int      // positive or negative
  reference String?  // booking id, razorpay payment id, admin id, etc.
  reason    String?
  createdAt DateTime @default(now())
}

model Payment {
  id              String   @id @default(uuid())
  userId          String
  razorpayOrderId String   @unique
  razorpayPaymentId String? @unique
  amountPaise     Int
  status          String   // created | paid | failed | refunded
  webhookEventId  String?  @unique // idempotency guard
  createdAt       DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(uuid())
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  action    String   // e.g. "COIN_GRANT", "TEACHER_APPROVED", "REFUND_ISSUED"
  targetId  String?
  metadata  Json?
  createdAt DateTime @default(now())
}

model Review {
  id        String   @id @default(uuid())
  bookingId String   @unique
  rating    Int
  comment   String?
  createdAt DateTime @default(now())
}
```

---

## 7. API Design (core contracts)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Create account, send verification email |
| POST | `/api/auth/login` | Public | Returns access token + sets refresh cookie |
| POST | `/api/auth/refresh` | Refresh cookie | Rotates + returns new access token |
| POST | `/api/auth/logout` | Auth | Revokes refresh token |
| GET | `/api/teachers` | Public | Search/filter teachers |
| GET | `/api/teachers/:id/availability` | Public | Open slots for a teacher |
| POST | `/api/bookings` | Student | Create booking (locks slot, deducts coins atomically) |
| PATCH | `/api/bookings/:id/cancel` | Student/Teacher | Cancel per policy, triggers refund logic |
| GET | `/api/bookings/me` | Auth | List own bookings |
| POST | `/api/wallet/purchase-order` | Student | Creates Razorpay order for a coin package |
| POST | `/api/webhooks/razorpay` | Signature-verified | Razorpay event receiver (source of truth for payment success) |
| GET | `/api/wallet/me` | Student | Balance + transaction history |
| POST | `/api/sessions/:bookingId/token` | Student/Teacher | Issues a scoped, short-lived LiveKit join token |
| POST | `/api/admin/coins/grant` | Admin | Manual coin adjustment (always writes AuditLog) |
| GET | `/api/admin/analytics` | Admin | DAU, revenue, booking trend data |
| POST | `/api/admin/teachers/:id/approve` | Admin | Approve a pending teacher application |

Every endpoint above must run through: auth middleware → role check → request-body schema validation (zod/Joi) → business logic → response. No shortcuts on any of these four, even for "quick" admin routes.

---

## 8. Third-Party Integration Notes

**Razorpay**
- Use server-side Orders API; amount is always computed server-side from a fixed price table, never accepted from the client
- Verify every webhook using the `X-Razorpay-Signature` header (HMAC-SHA256 with your webhook secret) before processing
- Treat the webhook — not the browser redirect callback — as the actual confirmation of payment

**LiveKit**
- Use LiveKit Cloud (managed) rather than self-hosting initially — self-hosting media servers at this stage adds ops burden with no benefit until volume justifies it
- Generate access tokens server-side using the LiveKit server SDK, scoped to one room + one identity + short TTL
- Never expose your LiveKit API secret to any frontend code

**Supabase**
- Use Supabase for managed Postgres + connection pooling (Supavisor) + optionally Storage for recordings/materials
- Even though Prisma is the primary data-access layer, enable Row Level Security (RLS) on your tables as a defense-in-depth measure in case any client ever talks to Supabase directly

---

## 9. Security Architecture

This is the section to take most seriously given the "no one can infiltrate or bypass" requirement — nothing here is optional for a platform that will handle real money and real video sessions.

**Authentication & session security**
- Passwords hashed with bcrypt or argon2 (never anything weaker), with a sensible cost factor
- Short-lived JWT access tokens (~15 min) + httpOnly, secure, sameSite refresh cookies with rotation on every use
- Maintain a revocation list (Redis) for refresh tokens so logout/password-change actually invalidates sessions immediately
- Account lockout / exponential backoff after repeated failed logins
- Recommend TOTP-based 2FA for admin and superadmin accounts specifically, given their blast radius

**Authorization**
- Centralized RBAC middleware — every route explicitly declares which roles may access it
- Resource-level ownership checks in addition to role checks (a teacher can only modify *their own* sessions, not any session)

**Input handling**
- Schema validation (zod/Joi) on every request body/query/params — reject unknown fields rather than silently ignoring them
- Prisma's parameterized queries prevent SQL injection by default — avoid raw SQL; if unavoidable, always parameterize
- Sanitize any user-generated content that gets rendered as HTML (bios, reviews) to prevent stored XSS

**API-level protections**
- Rate limiting via Redis-backed middleware, with tighter limits specifically on `/auth/login`, `/auth/signup`, and password reset endpoints
- Helmet.js for secure headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Strict CORS allow-list — only your actual frontend domains, never `*`
- Request body size limits
- Generic error responses in production — never leak stack traces or internal details to the client

**Payment-specific security**
- Never trust a client-submitted amount for anything
- Idempotency on webhook processing (store and check `event_id`) so retried webhooks can't double-credit coins
- Razorpay itself handles PCI compliance for card data — you should never see or store raw card numbers

**Live-class security**
- Join tokens are short-lived, scoped to one room + one verified identity, generated only after confirming the requester is the enrolled student or assigned teacher for that exact booking
- Room names are unguessable (UUID-based, not sequential)

**Infrastructure security**
- Cloudflare (or equivalent) in front of everything for basic DDoS mitigation and a WAF layer
- Database has no public internet exposure — only reachable from your backend's network
- All traffic over TLS 1.2+, HSTS enabled
- Secrets live in environment variables / a secret manager — never committed to git, `.env` in `.gitignore` from commit zero
- Automated dependency vulnerability scanning (npm audit / Dependabot / Snyk) on a schedule, not just once
- Principle of least privilege on every database credential and API key

**Auditability**
- Every admin action that touches money, coins, or account status writes an immutable `AuditLog` entry — this is your dispute-resolution and incident-investigation lifeline
- Watch for anomalies (a sudden spike in coin grants, refunds, or failed logins) — a simple alert on unusual admin-action volume is cheap insurance

**Compliance**
- Under India's Digital Personal Data Protection Act (DPDP Act, 2023), you'll want a clear privacy policy, a defined data retention/deletion policy, and a way for users to request account/data deletion
- Keep this in mind from the schema design stage — retrofitting deletion/export flows later is painful

**Before you call it "production ready"**
- Run an automated scan (OWASP ZAP) against staging before launch
- A lightweight third-party penetration test before real marketing spend starts is worth the cost given this handles live payments

---

## 10. Scalability & Performance Engineering (for the 15k DAU target)

A useful distinction: **15,000 daily *visitors* is not 15,000 concurrent users.** With realistic usage patterns (browsing, booking, occasional live classes) your actual concurrent peak is likely in the low hundreds to low thousands, not 15k simultaneous connections. Design for real headroom above your estimated peak, and validate with load testing rather than guessing.

- **Stateless API servers** behind a load balancer — scale horizontally by adding instances, no sticky sessions needed
- **Connection pooling** to Postgres via Supabase's pooler (Supavisor/PgBouncer) — this is critical, since unpooled connections are the #1 way a Node app falls over under load
- **Redis caching** for hot, frequently-read data (teacher search results, availability calendars) to take load off Postgres
- **Background job queue** (BullMQ on Redis) for anything that doesn't need to block the HTTP response: webhook processing, emails, certificate generation, coin ledger reconciliation
- **Database indexing** on every foreign key and every frequently filtered column (`teacherId + slotStart`, `userId + createdAt`, booking `status`)
- **CDN** for all static frontend assets and images
- **Autoscaling** on your hosting platform (Render/Railway/Fly.io for simplicity, or AWS ECS/Fargate for more control) based on CPU/memory thresholds
- **Circuit breakers** around third-party calls (Razorpay, LiveKit) so an outage on their end degrades gracefully instead of cascading into your whole API
- **Load testing before go-live** — script realistic user journeys (browse → book → pay → join class) with k6 or Artillery, and actually run them at ~1.5x your expected peak before trusting the number

---

## 11. Infrastructure & DevOps

- **Branching**: `main` (production) / `staging` / feature branches via PRs — protect `main`, require review
- **CI/CD**: GitHub Actions — lint + type-check + test + build on every PR; auto-deploy `staging` on merge to `staging`; manual-approval deploy to production on merge to `main`
- **Environments**: local (docker-compose with Postgres + Redis), staging (mirrors prod, used for milestone demos), production
- **Hosting suggestion**: Backend on Render/Railway/Fly.io; Frontend(s) on Vercel/Netlify; DB on Supabase; Redis on Upstash
- **Backups**: automated daily DB backups with point-in-time recovery, and actually test a restore at least once before launch
- **Secrets**: platform secret manager or a tool like Doppler — never in the repo, ever

---

## 12. Testing Strategy

- **Unit tests** (Jest) — especially coin-ledger math and booking-conflict logic, since bugs here cost real money or double-bookings
- **Integration tests** (Supertest) against a real test database for every API route
- **E2E tests** (Playwright) for the critical path: signup → login → book → pay → join live class
- **Manual QA checklist** run before each milestone demo/payout
- **Load tests** (k6) before final delivery
- **Security scan** (OWASP ZAP) before final delivery

---

## 13. Monitoring & Observability

- **Error tracking**: Sentry, frontend and backend
- **Structured logging**: pino/winston with request IDs for traceability
- **Uptime monitoring**: UptimeRobot/Better Uptime pinging a `/health` endpoint
- **Alerting**: Slack/email on error-rate spikes, downtime, or failed webhook processing

---

## 14. Project Phases & Timeline

Mapped directly onto the milestone structure already defined in the offer letter's payment schedule.

| Phase | Window | Deliverables | Ties to Milestone |
|---|---|---|---|
| **Phase 1** — Foundation | Aug 16–22 | Repo setup, CI/CD, DB schema, Auth (signup/login/roles), base portal scaffolds | Milestone 1 (start) |
| **Phase 2–3** — Core & Booking | Aug 23–29 | Teacher/Admin portal core screens, availability calendar, full booking flow with conflict-safe slot locking | Milestone 2 — Booking system ready |
| **Phase 4** — Payments & Coins | Aug 30–Sep 5 | Razorpay integration, coin wallet + ledger, admin coin tools, notifications | — |
| **Phase 5** — Live Classes | Sep 6–12 | LiveKit integration, scoped join tokens, session lifecycle, attendance tracking | Milestone 3 — Live classes working |
| **Phase 6** — Hardening & Delivery | Sep 13–15 | Security pass, automated tests, load test, deployment, docs, certificate generation | Milestone 4 — Final delivery & deployment |

---

## 15. Environment Variables Checklist

```
DATABASE_URL=
DIRECT_URL=                 # for Prisma migrations via Supabase pooler
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
REDIS_URL=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=
EMAIL_PROVIDER_API_KEY=
SENTRY_DSN=
CORS_ALLOWED_ORIGINS=
```

---

## 16. Suggested Repository Structure

```
language-metrics/
├── apps/
│   ├── api/                 # Express + Prisma backend
│   │   ├── src/
│   │   │   ├── modules/     # auth, bookings, wallet, sessions, admin
│   │   │   ├── middleware/  # auth, rbac, validation, rateLimit
│   │   │   ├── jobs/        # BullMQ workers
│   │   │   └── lib/
│   │   └── prisma/schema.prisma
│   ├── student-web/         # React
│   ├── teacher-portal/      # React
│   └── admin-portal/        # React
├── packages/
│   └── shared-types/        # shared TS types/contracts across apps
├── .github/workflows/
└── docker-compose.yml
```

---

## 17. Production-Readiness Checklist

- [ ] All secrets in env vars, none in git history
- [ ] RBAC enforced on every route
- [ ] Payment amounts always computed server-side
- [ ] Webhook signature verification + idempotency in place
- [ ] Booking slot uniqueness enforced at the DB level
- [ ] LiveKit tokens scoped, short-lived, server-issued only
- [ ] Rate limiting live on auth + payment endpoints
- [ ] Automated backups tested with a real restore
- [ ] Error tracking + uptime monitoring wired up and alerting to a real channel
- [ ] Load test run at ≥1.5x expected peak concurrency
- [ ] Security scan run against staging
- [ ] Privacy policy, ToS, and data deletion flow in place
