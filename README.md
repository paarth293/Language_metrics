# Language Metrics

A production-oriented language learning & teaching platform built with Next.js (App Router), Prisma, PostgreSQL, and Tailwind CSS.

## Architecture & Directory Structure

The project strictly follows a standard `src/` modular layout:

```text
src/
├── app/                  # Next.js App Router (Layouts, Pages, & Thin API Routes)
│   ├── (public)/         # Public marketing pages & layout
│   ├── (student)/        # Student dashboard & guarded views
│   ├── (teacher)/        # Teacher dashboard & registration forms
│   ├── (admin)/          # Admin panel & verification queue
│   └── api/              # Thin Next.js Route Handlers (Calls Services)
├── components/           # UI components
│   ├── home/             # Marketing home sections
│   ├── layout/           # Global Navbar & Footer
│   ├── shared/           # Auth & shared context components
│   └── ui/               # Reusable atomic UI components (StatusBadge, etc.)
├── hooks/                # Custom React hooks (e.g., useAuth)
├── lib/                  # Infrastructure (Prisma DB client, JWT Auth, API client)
├── services/             # Core business logic layer (Auth, Student, Teacher, Admin services)
├── types/                # Core TypeScript interfaces & types
└── validators/           # Zod validation schemas
```

## Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env` and fill in your database & secret configurations:

```bash
cp .env.example .env
```

### 2. Install Dependencies & Generate Prisma Client

```bash
npm install
npx prisma generate
```

### 3. Database Migration & Seeding

Run migrations to set up your PostgreSQL schema:

```bash
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Core Features & System Roles

- **Student Role**: Browse teachers, register, book demo sessions, and manage student profile.
- **Teacher Role**: Apply with experience credentials and certificates, view verification status, manage teaching dashboard.
- **Admin Role**: Review pending teacher verification applications, approve/reject candidates.
