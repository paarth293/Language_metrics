# Language Metrics

> A full-stack language learning marketplace that connects students with verified native-speaker teachers for live 1-on-1 video sessions.

---

## 🚀 Live Apps

| App | URL | Description |
|-----|-----|-------------|
| **Main Web App** | [language-metrics-teacher-web.vercel.app](https://language-metrics-teacher-web.vercel.app) | Public landing page, student & teacher dashboards |
| **Admin Panel** | [language-metrics.vercel.app](https://language-metrics.vercel.app) | Internal dashboard for platform administrators |

---

## 📦 Monorepo Structure

This project is structured as an **npm workspaces monorepo** with two independent Next.js applications sharing a single PostgreSQL database via a common Prisma package.

```
Language_metrics/
├── apps/
│   ├── teacher-web/        # Main web app (port 3000) — landing page, auth, student & teacher dashboards
│   └── admin-panel/        # Admin dashboard (port 3001) — internal operations panel
├── packages/
│   └── database/           # Shared Prisma schema, migrations & generated client
├── docs/                   # Project specification documents
├── .env.example            # Environment variable template
└── package.json            # Root workspace configuration
```

### `apps/teacher-web` — Main Web App (`:3000`)
The primary public-facing application. Serves:
- **Landing page** — marketing site for prospective students and teachers
- **Authentication** — student & teacher registration/login
- **Student dashboard** — browse teachers, book sessions, manage coin wallet
- **Teacher dashboard** — manage schedule, view bookings, track earnings

### `apps/admin-panel` — Admin Panel (`:3001`)
A completely separate, internally-accessed Next.js application. Provides platform administrators with tools to:
- Approve/reject teacher applications
- Manage users, classes, payouts, and complaints
- View platform analytics and system health
- Manage coupons, courses, and platform settings

### `packages/database`
Shared Prisma ORM package consumed by both apps. Contains the PostgreSQL schema, seed scripts, and the generated Prisma client.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router, React 19) |
| **Styling** | Tailwind CSS v4 + Framer Motion |
| **Database** | PostgreSQL via [Prisma ORM](https://prisma.io/) |
| **Authentication** | JWT + httpOnly cookies |
| **Payments** | Razorpay (coin wallet system) |
| **Video** | LiveKit (1-on-1 classroom) |
| **Language** | TypeScript (strict) |

---

## 💻 Local Development

### Prerequisites
- Node.js ≥ 20
- A running PostgreSQL database (local, [Supabase](https://supabase.com/), [Neon](https://neon.tech/), or [Railway](https://railway.app/))

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

See [`.env.example`](.env.example) for all available options.

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate --schema=packages/database/prisma/schema.prisma

# Push schema to your database
npx prisma db push --schema=packages/database/prisma/schema.prisma

# Seed initial admin user & platform settings
npm run db:seed
```

### 4. Start Both Dev Servers

```bash
npm run dev
```

- **Main Web App** → [http://localhost:3000](http://localhost:3000)
- **Admin Panel** → [http://localhost:3001](http://localhost:3001)

---

## 👥 User Roles

| Role | Access |
|------|--------|
| `student` | Browse & book teachers, manage coin wallet, join live sessions |
| `teacher` | Set availability, manage bookings, track earnings (requires admin approval) |
| `admin` | Full platform oversight via the Admin Panel at `:3001` |

---

## 🔒 Security & Code Quality

- **Pre-commit hooks** via Husky: ESLint auto-fix runs on every staged file before commit.
- **Secrets scanning**: Gitleaks integration checks for accidentally committed credentials.
- **JWT Auth**: Short-lived access tokens (15m) with httpOnly refresh cookies.
- **Rate limiting**: Applied to all auth and sensitive API endpoints.

---

## 🤝 Contributing

1. Branch from `main` using `contributor/<your-name>` or `feature/<feature-name>`.
2. Write atomic commits using [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`.
3. Run `npx tsc --noEmit` before opening a PR — zero TypeScript errors required.
4. Open a Pull Request against `main`.

---

## 📄 License

Proprietary — Language Metrics © 2025. All rights reserved.
