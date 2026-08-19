# Language Metrics

> A production-ready platform connecting language learners with verified native-speaker teachers through live 1-on-1 video sessions.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js 15](https://nextjs.org/) — App Router |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Framer Motion |
| **ORM** | [Prisma](https://prisma.io/) |
| **Database** | PostgreSQL |
| **Auth** | JWT (access token) + httpOnly refresh cookie |
| **Payments** | Razorpay (coin wallet) |
| **Language** | TypeScript (strict) |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (public)/               # Public marketing site + layout
│   ├── student/                # Student-guarded dashboard views
│   ├── teacher/                # Teacher portal views
│   ├── admin/                  # Admin verification panel
│   ├── api/                    # Thin API Route Handlers → call features/*/services
│   ├── login/                  # Auth pages
│   ├── register/
│   └── globals.css             # Design tokens + base styles
│
├── features/                   # Feature-Driven modules (domain-first)
│   ├── auth/
│   │   ├── services/           # Business logic: login, register
│   │   └── validators/         # Zod schemas for auth inputs
│   ├── student/
│   │   └── services/
│   ├── teacher/
│   │   └── services/
│   ├── admin/
│   │   └── services/
│   └── home/
│       └── components/         # Landing page sections (Hero, Pricing, CTA…)
│
├── components/                 # Generic, reusable UI (no domain logic)
│   ├── layout/                 # Navbar, Footer, Sidebar, AuthLayout, AppShell
│   ├── ui/                     # Atomic primitives: Button, Input, Badge, Logo…
│   └── ThemeProvider.tsx
│
├── lib/                        # App-wide infrastructure
│   ├── db.ts                   # Prisma client singleton
│   ├── auth.ts                 # JWT sign/verify, requireRole middleware
│   ├── auth-client.tsx         # Client-side auth context
│   ├── api.ts                  # Typed fetch wrapper
│   └── cn.ts                   # clsx + tailwind-merge utility
│
├── hooks/                      # Custom React hooks
├── types/                      # Shared TypeScript interfaces
└── prisma/
    ├── schema.prisma
    └── seed.mjs
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **PostgreSQL** database (local, [Supabase](https://supabase.com/), [Neon](https://neon.tech/), or [Railway](https://railway.app/))

### 1. Clone & Install

```bash
git clone https://github.com/paarth293/Language_metrics.git
cd Language_metrics
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, and other required variables
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to your database
npx prisma db push

# (Optional) Seed sample data
node prisma/seed.mjs
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Concepts

### Roles & Access

| Role | Description |
|------|-------------|
| `student` | Browse teachers, book sessions, manage coin wallet |
| `teacher` | Manage availability, view bookings, track earnings (requires admin approval) |
| `admin` | Verify teachers, manage disputes, view platform analytics |

### Coin Wallet
Students purchase coins via Razorpay (₹1 = 1 coin). Teachers are paid in coins which can be requested for payout.

### Authentication
JWT-based with short-lived access tokens (15m) and a long-lived httpOnly refresh cookie. See `src/lib/auth.ts`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npx prisma studio` | Open Prisma DB browser |
| `npx prisma db push` | Sync schema to database |

---

## Contributing

1. Branch off `main` → use naming convention `contributor/<your-name>` or `feature/<feature-name>`.
2. Keep commits atomic and use [Conventional Commits](https://www.conventionalcommits.org/) format: `feat:`, `fix:`, `refactor:`, `docs:`.
3. Run `npx tsc --noEmit` before opening a pull request — zero type errors required.
4. Open a Pull Request against `main`.

---

## License

Proprietary — Language Metrics © 2025. All rights reserved.
