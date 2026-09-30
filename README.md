# Language Metrics

A full-stack language learning platform connecting students with verified language teachers for 1-on-1 live video classes.

## Deployed Environments

- **Teacher & Student Portal**: [https://language-metrics-teacher-web.vercel.app/](https://language-metrics-teacher-web.vercel.app/)
  - *Note: Student login redirects to the Student Web portal.*
- **Student Web Portal**: [https://language-metrics-student-web.vercel.app/](https://language-metrics-student-web.vercel.app/)
- **Admin Panel**: [https://language-metrics-admin-panel.vercel.app/](https://language-metrics-admin-panel.vercel.app/)

## Repository Structure

An npm-workspaces monorepo: deployable applications live in `apps/`, shared
libraries in `packages/`.

```
language-metrics/
├── apps/
│   ├── teacher-web/          # Next.js — public site, teacher dashboard, auth (port 3000)
│   ├── admin-panel/          # Next.js — admin dashboard with RBAC            (port 3001)
│   ├── student-web/          # Next.js — student dashboard + mobile API (v1)  (port 3002)
│   └── student-mobile/       # Expo / React Native student app
├── packages/
│   ├── api-contracts/        # Shared request/response types (web ↔ mobile)
│   ├── auth/                 # JWT, sessions, OAuth, email templates
│   ├── currency/             # Currency conversion and formatting
│   ├── database/             # Prisma schema, migrations, client, coin ledger
│   │   ├── prisma/           #   schema.prisma, migrations/, seed.mjs
│   │   ├── scripts/          #   one-off maintenance and seed scripts
│   │   └── src/              #   package source
│   ├── live-classes/         # Live-class service layer (access, billing, webhooks)
│   └── livekit/              # LiveKit client, metering and cost model
├── tests/
│   ├── e2e/                  # Playwright end-to-end specs
│   └── security/             # Python dynamic security suite + SAST report tooling
├── docs/                     # Architecture, runbook, specs, design, audits
└── .github/workflows/        # CI: security pipeline, mobile CI, session reconciler
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Next.js API Routes, Prisma ORM |
| Database | PostgreSQL (Supabase) |
| Cache | Redis (Upstash) |
| Auth | RS256 JWT (jose), httpOnly cookies |
| Video | LiveKit (optional) |
| Storage | S3 / Supabase Storage / Local |
| Email | Resend / Zoho SMTP |
| Payments | Razorpay |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis (optional, for production rate limiting)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate --schema=packages/database/prisma/schema.prisma

# Set up environment
cp .env.example .env
# Edit .env with your database URL, JWT keys, etc.

# Run database migrations
npm run db:migrate:deploy

# Start development servers
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# JWT (RS256 key pair)
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."

# Redis (optional)
REDIS_URL="redis://..."

# OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Generate JWT Keys

```bash
# Generate private key
openssl genpkey -algorithm RSA -out jwt-private.pem -pkeyopt rsa_keygen_bits:2048

# Generate public key
openssl rsa -pubout -in jwt-private.pem -out jwt-public.pem

# Convert to single-line for .env
awk '{printf "%s\\n", $0}' jwt-private.pem
awk '{printf "%s\\n", $0}' jwt-public.pem
```

## Scripts

```bash
npm run dev                # Start all web dev servers
npm run dev:teacher        # Start teacher-web only
npm run dev:admin          # Start admin-panel only
npm run dev:student        # Start student-web only
npm run dev:mobile         # Start the Expo mobile app
npm run build              # Production build
npm run lint               # Run ESLint
npm run test:e2e           # Playwright end-to-end tests
npm run test:livekit       # LiveKit, ledger and live-class unit tests
npm run test:security      # Run security test suite
npm run scan:sast          # Static security analysis
npm run scan:secrets       # Scan for leaked secrets
npm run db:migrate:deploy  # Apply Prisma migrations
npm run db:seed            # Seed reference data
```

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/architecture.md](docs/architecture.md) | System architecture and technical overview |
| [docs/runbook.md](docs/runbook.md) | Production on-call and operational runbook |
| [docs/livekit.md](docs/livekit.md) | Live video, metering and billing |
| [docs/specs/](docs/specs/) | Product and technical specifications |
| [docs/design/](docs/design/) | Design system, UI guide and frontend spec |
| [docs/audits/](docs/audits/) | Security/error audit log and sign-off reports |

## Features

### Student Dashboard
- **Discover** — Browse verified teachers by language, rating, and availability
- **Book Classes** — Book demo or regular classes using coins
- **Live Video** — Join 1-on-1 video sessions with whiteboard and screen sharing
- **Wallet** — Purchase coins via Razorpay, track transactions
- **Profile** — Manage language preferences and proficiency level

### Teacher Dashboard
- **Schedule** — Manage availability slots and upcoming classes
- **Students** — View student list and booking history
- **Earnings** — Track earnings and payout history
- **Sessions** — Join live classes, view session recordings
- **Profile** — Update bio, languages, rates, and documents

### Admin Panel
- **Dashboard** — Platform metrics and recent activity
- **Teacher Management** — Review applications, approve/reject teachers
- **Student Management** — View student list and activity
- **Payments** — Track payments and process payouts
- **Complaints** — Handle support tickets
- **Analytics** — Platform usage statistics
- **Settings** — Platform configuration

## Security

- **Authentication** — RS256 JWT with httpOnly cookies, 15-minute access tokens
- **Authorization** — Role-based access control (Student, Teacher, Admin)
- **Rate Limiting** — Edge + API rate limiting (Redis in production)
- **CSRF Protection** — Origin header validation + sameSite cookies
- **Input Validation** — Zod schemas on all API routes
- **File Upload** — Type validation, size limits, safe filenames
- **Security Headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options

## Database Schema

Key models: `User`, `StudentProfile`, `TeacherProfile`, `Booking`, `ClassSession`, `CoinTransaction`, `Payment`, `Payout`, `Review`, `Notification`

See `packages/database/prisma/schema.prisma` for the full schema.

## Deployment

Each Next.js app is deployed as its own Vercel project, with its Root Directory
set to `apps/<app-name>`.

```bash
npm i -g vercel
vercel
```

## License

Proprietary — Language Metrics. All rights reserved.
