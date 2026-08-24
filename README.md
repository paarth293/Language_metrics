# Language Metrics Platform

A comprehensive language learning platform that connects students with language teachers. The system includes a powerful administration dashboard for managing platform operations and a dedicated web portal for teachers.

## 🚀 Live Demos

- **Admin Dashboard**: [https://language-metrics.vercel.app/](https://language-metrics.vercel.app/)
- **Teacher Web Portal**: [https://language-metrics-teacher-web.vercel.app/login](https://language-metrics-teacher-web.vercel.app/login)

## 📦 Architecture

This project is structured as a monorepo containing multiple applications and shared packages.

### Applications
- **Admin Panel** (`apps/admin-panel`): A secure Next.js dashboard for platform administrators to oversee operations, track analytics, approve teachers, manage payouts, and resolve complaints.
- **Teacher Web** (`apps/teacher-web`): A dedicated portal for teachers to manage their profiles, schedules, students, and classes.

### Packages
- **Database** (`packages/database`): Shared Prisma ORM schema, migrations, and generated client for PostgreSQL access across the platform.

## 🛠 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (React 19)
- **Styling**: Tailwind CSS v4, custom UI components, Lucide React (Icons)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Authentication**: JWT & Custom Guards (with OTP support)
- **Monorepo Tooling**: npm workspaces, concurrently

## 💻 Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL Database

### Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file at the root of the project with your database connection strings:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/language_metrics"
   DIRECT_URL="postgresql://user:password@localhost:5432/language_metrics"
   ```

3. **Database Initialization**:
   Sync the database schema and seed the initial admin user and platform settings:
   ```bash
   npx prisma db push --accept-data-loss
   npm run db:seed
   ```

4. **Start Development Servers**:
   Run both applications simultaneously:
   ```bash
   npm run dev
   ```
   - Admin Panel runs at `http://localhost:3000`
   - Teacher Web runs at `http://localhost:3001`

## 🔒 Security & Code Quality
- **Linting & Formatting**: Strict ESLint rules enforced via Husky `pre-commit` hooks.
- **Security Scanning**: Integrated SAST (Static Application Security Testing) using Semgrep and secrets detection using Gitleaks.
