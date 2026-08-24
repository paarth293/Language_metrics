# teacher-web — Language Metrics Main Web App

> The primary user-facing Next.js application for the Language Metrics platform. Serves the public landing page, student dashboard, teacher portal, and all authentication flows.

---

## What This App Does

| Area | Description |
|------|-------------|
| **Landing Page** | Public marketing site for prospective students and teachers |
| **Auth** | Student & teacher registration, login, JWT-based sessions |
| **Student Dashboard** | Browse verified teachers, book sessions, manage coin wallet |
| **Teacher Portal** | Manage schedule, view upcoming bookings, track class history |
| **API Routes** | Thin REST handlers for all auth and dashboard operations |

> **Note:** The admin dashboard is a **separate application** at `apps/admin-panel` running on port `:3001`.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Next.js 16](https://nextjs.org/) — App Router |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + Framer Motion |
| **ORM** | [Prisma](https://prisma.io/) (shared via `@repo/database`) |
| **Database** | PostgreSQL |
| **Auth** | JWT access token + httpOnly refresh cookie |
| **Payments** | Razorpay (coin wallet) |
| **Language** | TypeScript (strict) |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (public)/               # Public landing page + layout
│   ├── student/                # Student-guarded dashboard views
│   ├── teacher/                # Teacher portal views
│   ├── api/                    # REST API route handlers
│   ├── login/                  # Login page
│   ├── register/               # Student & teacher registration
│   └── globals.css             # Design tokens + base styles
│
├── features/                   # Feature-driven domain modules
│   ├── auth/                   # Login, register, JWT validation
│   ├── student/                # Student-specific services
│   ├── teacher/                # Teacher-specific services
│   └── home/                   # Landing page section components
│
├── components/                 # Shared, reusable UI
│   ├── layout/                 # Navbar, Footer, Sidebar, AuthLayout
│   ├── ui/                     # Button, Input, Badge, Avatar, Logo…
│   └── ThemeProvider.tsx
│
├── lib/                        # App-wide infrastructure
│   ├── db.ts                   # Prisma client singleton
│   ├── auth.ts                 # JWT sign/verify + role middleware
│   ├── auth-client.tsx         # Client-side auth context
│   └── api.ts                  # Typed fetch wrapper
│
├── hooks/                      # Custom React hooks
└── types/                      # Shared TypeScript interfaces
```

---

## Running Locally

From the **monorepo root**:

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm run dev
```

This app runs at **[http://localhost:3000](http://localhost:3000)**.

To run only this app:

```bash
npm run dev -w language_metrics
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npx prisma studio` | Open Prisma DB browser |

---

## License

Proprietary — Language Metrics © 2025. All rights reserved.
