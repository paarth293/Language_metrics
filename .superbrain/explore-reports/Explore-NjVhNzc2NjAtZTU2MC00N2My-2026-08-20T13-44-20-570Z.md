# Sub-Agent Report Trace

- **Agent**: Explore
- **Session**: /NjVhNzc2NjAtZTU2MC00N2MyLWIwNjgtNWNkOGUyZGM1M2Y2
- **Raw report chars**: 11757
- **Compressed (delivered to parent) chars**: 12319
- **Distinct files mentioned in raw report**: 47

## Spawn Prompt (what the parent asked)

Explore the Next.js monorepo at e:\language_metrics\Language_metrics, specifically the `apps/teacher-web` app, to document the platform's existing authentication and security conventions so I can build the separate `apps/admin-panel` consistently.

I need a compact report on:

1. **Auth mechanism in teacher-web**: Read `apps/teacher-web/src/lib/auth.ts`, `apps/teacher-web/src/lib/auth-client.tsx`, `apps/teacher-web/src/lib/db.ts`, and any files in `apps/teacher-web/src/features/auth/`. How does login/session work? Is it Supabase, JWT (jsonwebtoken), cookie-based, or next-auth? How are passwords hashed (bcryptjs)? What is the session token/cookie name and its flags (httpOnly, secure, sameSite)? How is a session verified on each request?

2. **Existing admin section**: Look at `apps/teacher-web/src/app/admin/` and `apps/teacher-web/src/features/admin/`. What admin pages exist there and what do they do? Is there an admin auth gate / role check?

3. **API routes pattern**: Read a couple of files in `apps/teacher-web/src/app/api/` to document the API route convention (route handlers, how they check auth, how they return JSON/errors, how they access the db).

4. **RLS / security notes**: Any comments about Supabase RLS, service role, edge functions, webhooks, or security-related patterns in the code.

5. **Environment variables**: List any env vars referenced (search for process.env in these files) and check `apps/teacher-web/.env` and any `.env.example` for what's defined.

6. **Shared UI components**: Briefly list what reusable components exist in `apps/teacher-web/src/components/ui/` and `apps/teacher-web/src/components/layout/`.

Report file paths and concrete code details (cookie names, function names, JWT payload structure, env var names). Keep it focused and factual — cite file:line where possible. Do NOT attempt to read the entire codebase; focus on auth, admin, api, lib, components/ui, and .env files.

## Raw Report (what the sub-agent produced, pre-compression)

I'll explore the teacher-web app systematically. Let me start by discovering the structure and reading the key auth files.Let me read the core lib/auth files and enumerate the feature/API/admin directories.Now let me read the auth services, validators, types, API routes, admin files, and env config.Now let me check the `.env.example`, search for env vars and security/RLS references, and read the remaining relevant files.Let me read the database package (schema, RLS comments), the README env docs, and the shared UI/layout components.Let me read the Prisma schema (for RLS/security comments) and the remaining UI components.Let me verify whether a Next.js middleware exists (server-side route guard) and check the register page flow.## Exploration Report

**Confidence**: HIGH — all target files read; auth, admin, API, lib, schema, env, and UI enumerated.

**Files Examined**: `src/lib/auth.ts`, `src/lib/auth-client.tsx`, `src/lib/db.ts`, `src/lib/api.ts`, `src/features/auth/services/auth-service.ts`, `src/features/auth/validators/auth.ts`, `src/types/index.ts`, `src/hooks/use-auth.ts`, `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/app/register/teacher/page.tsx`, `src/app/teacher/layout.tsx`, `src/app/student/layout.tsx`, all 8 API routes (`auth/login`, `auth/register/student`, `auth/register/teacher`, `health`, `students/me`, `teachers/me`, `admins/me`, `admin/teachers`, `admin/teachers/[id]`), `src/app/admin/dashboard/page.tsx`, `src/features/admin/services/admin-service.ts`, `packages/database/index.ts`, `packages/database/prisma/schema.prisma`, `.env`, `README.md`, UI components (Button, Card, Badge, StatusBadge, AppShell, AuthLayout).

**Key Tool Path**: listDirectory → readFile/readFiles → targeted search (env/RLS/middleware).

### Findings

**1. Auth mechanism (jsonwebtoken JWT — NOT Supabase, NOT next-auth, NOT cookie-based)**
- `src/lib/auth.ts:1,5` — imports `jsonwebtoken`; `JWT_SECRET = process.env.JWT_SECRET` (missing → console.error only, no hard fail). No bcryptjs anywhere.
- `signToken(userId, role)` at `auth.ts:11-13` — `jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" })`. JWT payload is exactly `{ userId: string, role: Role }` where `Role = "STUDENT" | "TEACHER" | "ADMIN"` (`src/types/index.ts:1,10-13`).
- `verifyToken(token)` at `auth.ts:15-22` — `jwt.verify`, returns `{userId, role}` or null on failure.
- `getAuthUser(req)` at `auth.ts:28-34` — reads the **`Authorization: Bearer <token>` header** (`authHeader.slice(7)`), verifies, returns payload or null.
- `requireRole(req, ...allowedRoles)` at `auth.ts:41-66` — server-side guard returning either `{ user }` (authorized) or `{ response }` = `NextResponse.json({message}, 401)` when no/invalid token, `403` when role not in allowed list. This is the canonical gate for every protected route.
- **Client session is localStorage, not a cookie** — `auth-client.tsx:36-37,47-48,58-59` reads/writes/removes keys **`lm_token`** and **`lm_user`** (JSON of `{id,name,email,role}`). No httpOnly/secure/sameSite cookie flags exist in code. `useEffect` on mount hydrates state from localStorage. `login()` redirects by role: STUDENT→`/student/dashboard`, TEACHER→`/teacher/dashboard`, ADMIN→`/admin/dashboard`. `logout()` clears both keys, pushes `/`.
- Axios attaches the token client-side: `lib/api.ts:11-19` request interceptor sets `Authorization: Bearer ${localStorage.getItem("lm_token")}`.
- **⚠️ Mismatch with docs**: README (`README.md:15,128`) and the technical spec claim "short-lived 15m access token + long-lived **httpOnly refresh cookie**" — but the actual code uses a single **7-day JWT in localStorage** (XSS-exposed, no refresh, no cookie). Build admin-panel to match the **implemented** convention (Bearer JWT + localStorage) unless you're also fixing this.
- **No Next.js `middleware.ts` exists** (searched `src/**/middleware.ts` and `middleware` — zero matches). All route protection is either per-route `requireRole` in handlers or client-side checks in pages. There is no global server-side route guard.

**2. Password hashing — NOT implemented (security gap)**
- `auth-service.ts:19-20` — explicit `FIXME`: "Schema dropped passwordHash (designed for Supabase Auth). For now, bypassing password check so build passes. Real auth must be handled by Supabase." Login finds user by email and returns a token **without any password verification** (anyone with a valid email gets a JWT). No bcryptjs import in the repo.

**3. Existing admin section**
- Pages: only `src/app/admin/dashboard/page.tsx` (198 lines, "use client") — a teacher-verification queue UI: stat cards (pending/approved/rejected/total), status filter tabs, approve/reject buttons. Uses `useAuth()` + `adminApi.listTeachers(filter)` / `adminApi.setTeacherStatus(id, status)`.
- **Admin gate is client-side only**: `dashboard/page.tsx:43` `if (!isLoading && (!user || user.role !== "ADMIN")) router.push("/login")`, and `:60` skips loading unless role==="ADMIN". Real enforcement lives in the API handlers via `requireRole(request, "ADMIN")`.
- Layout: this admin page does **not** use the shared `AppShell`/`Sidebar`/`TopBar` — it inlines its own fixed left nav (nav items "Verification Queue" / "All Users", with "All Users" marked `active:false` i.e. not built).
- Feature service: `features/admin/services/admin-service.ts` — `AdminService.getProfile(userId)` queries `db.user.findUnique({ where: { id, role: "ADMIN" } })`, returns `{ userId, user: { id, name:"Admin", email, createdAt } }` (name hardcoded "Admin").

**4. API routes pattern** (all under `src/app/api/`)
- Convention: thin `Route Handler`s → Zod `safeParse` on `request.json()` → delegate to a `features/<x>/services/*` static service → return `NextResponse.json`.
- Error/status convention (consistent everywhere): `400` validation (`result.error.issues[0]?.message`), `401` invalid credentials, `403` role-denied (from requireRole), `404` not found, `409` email in use, `500` catch-all with `console.error("... error:", err)` + `{ message: "Internal server error." }`.
- Protected routes pattern (e.g. `teachers/me`, `students/me`, `admins/me`, `admin/teachers`): `const auth = requireRole(request, "ROLE"); if (auth.response) return auth.response;` then use `auth.user.userId`. `teachers/me` & `admins/me` guard with `requireRole(request, "TEACHER")` / `"ADMIN"`; `admin/teachers` GET & `admin/teachers/[id]` PATCH guard with `"ADMIN"`.
- `admin/teachers/route.ts:17-22` — reads query via `new URL(request.url).searchParams`, uppercases and whitelists `status` against `VALID_STATUSES`. `admin/teachers/[id]/route.ts:16,22` — Next.js 15 async `params: Promise<{ id }>` (`const { id } = await params`), uppercases/whitelists `body.status`.
- Open routes (no guard): `auth/login`, `auth/register/*`, `health`.
- `lib/db.ts:1,3` — `import { db } from "@repo/database"`, re-exports `db`/`prisma`. `packages/database/index.ts:11-15` — PrismaClient singleton via `globalThis.prismaGlobal` (dev-only caching).

**5. RLS / security notes**
- **RLS is designed, not implemented** — extensive `/// RLS:` comments on every model in `packages/database/prisma/schema.prisma` (e.g. User L21 "Public read, self write. Admins full access"; CoinTransaction L171 "Service role only write (via edge functions)"; Booking L240 "created via payment webhook"; Payment L320, Payout L348, ChatMessage L370, AdminAuditLog L448 "Admin only read/write"). These are aspirational design notes; no SQL/RLS policies or edge functions exist in the codebase.
- Key schema facts for admin-panel: `User.id` is `@db.Uuid` **matching Supabase `auth.users.id`** (`schema.prisma:24`, `auth-service.ts:40`). `VerificationStatus` enum = `PENDING | INTERVIEW_SCHEDULED | APPROVED | REJECTED` (note: `INTERVIEW_SCHEDULED` exists in schema but the admin API whitelists only `PENDING/APPROVED/REJECTED`). `AdminAuditLog` and `PlatformSetting` models exist for admin audit/settings.
- `docs/internal/Language_Metrics_Technical_Specification.md` contains the security guidance (webhook HMAC-SHA256 signature verification, idempotency via stored `event_id`, RLS defense-in-depth, `service_role`/edge-function-only writes, never expose service keys to client) — spec only, none of it is wired in code yet.

**6. Environment variables**
- Read in source: `JWT_SECRET` (`auth.ts:5`) and `NEXT_PUBLIC_API_URL` (`api.ts:3`, defaults to `"/api"`). Prisma uses `DATABASE_URL` + `DIRECT_URL` (schema + `.env`).
- `apps/teacher-web/.env` (committed) defines only `DATABASE_URL` (Supabase transaction pooler :6543, `?pgbouncer=true`) and `DIRECT_URL` (session pooler :5432). **No `JWT_SECRET` or `NEXT_PUBLIC_API_URL` set** in the actual `.env`.
- **No `.env.example` file exists** in the repo (search `**/.env.example` = 0 matches), despite README (`:87`) instructing `cp .env.example .env` and `.gitignore` whitelisting it. The only env list is prose in the spec doc (lines ~483-489: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, etc.).
- Note: `auth-service.ts` uses `crypto.randomUUID()` (Node global) for new user IDs, not a DB-generated UUID.

**7. Shared UI components**
- `src/components/ui/`: `Avatar.tsx`, `Badge.tsx` (cva variants: default/success/warning/danger/info/outline), `Button.tsx` (cva variants: primary/gold/outline/outline-cream/ghost/danger; sizes sm/default/lg/icon; custom `asChild` slot via `React.cloneElement`, no radix-slot), `Card.tsx` (Card/CardHeader/CardTitle/CardContent/CardFooter), `Input.tsx`, `Logo.tsx`, `StatusBadge.tsx` (pending/approved/rejected, keyed on `VerificationStatus`).
- `src/components/layout/`: `AppShell.tsx` (sidebar+topbar shell; `NavItem {label, href, icon}`), `AuthLayout.tsx` (auth-page split layout), `Footer.tsx`, `Navbar.tsx`, `Sidebar.tsx`, `TopBar.tsx`.
- Styling deps: `cn()` = `clsx` + `tailwind-merge` (`lib/cn.ts`), `class-variance-authority` (cva), `framer-motion`, `lucide-react`. Tailwind v4, design tokens via `globals.css` (`bg-bg`, `text-text`, `bg-gold`, `text-navy`, `bg-cream`, etc.).

### Recommendation
For `apps/admin-panel`, mirror the implemented conventions exactly: (1) JWT via `jsonwebtoken` with `JWT_SECRET`, payload `{userId, role}`, `Bearer` header, guarded by `requireRole(req, "ADMIN")` in every handler (401/403 pattern); (2) localStorage `lm_token`/`lm_user` client session with axios Bearer interceptor; (3) thin route handlers → Zod `safeParse` → `features/*/services` static class → `NextResponse.json` with the established status/`{message}` mapping; (4) reuse the shared `@repo/database` Prisma singleton. Note the existing admin features (`AdminService`, `admin/teachers`, `AdminAuditLog`, `PlatformSetting`) as reusable starting points. Do NOT copy the missing-password-check login behavior into admin.

### Not covered / Uncertain
- Did not read `components/ui/Input.tsx`, `Avatar.tsx`, `Logo.tsx`, `layout/{Footer,Navbar,Sidebar,TopBar}.tsx` bodies (signatures/roles inferred from layout usage and file listing — only Button/Card/Badge/StatusBadge/AppShell/AuthLayout fully read).
- Did not read `src/features/student/services/*`, `features/teacher/services/teacher-service.ts` (referenced by API routes: `getProfileByUserId`, `listTeachersForAdmin`, `findById`, `updateVerificationStatus` — behavior not verified, only signatures inferred from call sites), `features/home/*`, or `prisma/seed.mjs`.
- `register/student/page.tsx` not read (mirrors the teacher stub pattern seen in `register/teacher/page.tsx`, which is a simulated `setTimeout` flow with **no real API call** — login/register pages are not yet wired to the working API routes).
- `.env` was read; note it may contain a live database credential — do not propagate it. No `.env.example` exists to enumerate remaining vars beyond the spec-doc prose list.

## Compressed Report (what the parent actually received)

<HYDRATION_REPORT>
I'll explore the teacher-web app systematically. Let me start by discovering the structure and reading the key auth files.Let me read the core lib/auth files and enumerate the feature/API/admin directories.Now let me read the auth services, validators, types, API routes, admin files, and env config.Now let me check the `.env.example`, search for env vars and security/RLS references, and read the remaining relevant files.Let me read the database package (schema, RLS comments), the README env docs, and the shared UI/layout components.Let me read the Prisma schema (for RLS/security comments) and the remaining UI components.Let me verify whether a Next.js middleware exists (server-side route guard) and check the register page flow.## Exploration Report

**Confidence**: HIGH — all target files read; auth, admin, API, lib, schema, env, and UI enumerated.

**Files Examined**: `src/lib/auth.ts`, `src/lib/auth-client.tsx`, `src/lib/db.ts`, `src/lib/api.ts`, `src/features/auth/services/auth-service.ts`, `src/features/auth/validators/auth.ts`, `src/types/index.ts`, `src/hooks/use-auth.ts`, `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/app/register/teacher/page.tsx`, `src/app/teacher/layout.tsx`, `src/app/student/layout.tsx`, all 8 API routes (`auth/login`, `auth/register/student`, `auth/register/teacher`, `health`, `students/me`, `teachers/me`, `admins/me`, `admin/teachers`, `admin/teachers/[id]`), `src/app/admin/dashboard/page.tsx`, `src/features/admin/services/admin-service.ts`, `packages/database/index.ts`, `packages/database/prisma/schema.prisma`, `.env`, `README.md`, UI components (Button, Card, Badge, StatusBadge, AppShell, AuthLayout).

**Key Tool Path**: listDirectory → readFile/readFiles → targeted search (env/RLS/middleware).

### Findings

**1. Auth mechanism (jsonwebtoken JWT — NOT Supabase, NOT next-auth, NOT cookie-based)**
- `src/lib/auth.ts:1,5` — imports `jsonwebtoken`; `JWT_SECRET = process.env.JWT_SECRET` (missing → console.error only, no hard fail). No bcryptjs anywhere.
- `signToken(userId, role)` at `auth.ts:11-13` — `jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" })`. JWT payload is exactly `{ userId: string, role: Role }` where `Role = "STUDENT" | "TEACHER" | "ADMIN"` (`src/types/index.ts:1,10-13`).
- `verifyToken(token)` at `auth.ts:15-22` — `jwt.verify`, returns `{userId, role}` or null on failure.
- `getAuthUser(req)` at `auth.ts:28-34` — reads the **`Authorization: Bearer <token>` header** (`authHeader.slice(7)`), verifies, returns payload or null.
- `requireRole(req, ...allowedRoles)` at `auth.ts:41-66` — server-side guard returning either `{ user }` (authorized) or `{ response }` = `NextResponse.json({message}, 401)` when no/invalid token, `403` when role not in allowed list. This is the canonical gate for every protected route.
- **Client session is localStorage, not a cookie** — `auth-client.tsx:36-37,47-48,58-59` reads/writes/removes keys **`lm_token`** and **`lm_user`** (JSON of `{id,name,email,role}`). No httpOnly/secure/sameSite cookie flags exist in code. `useEffect` on mount hydrates state from localStorage. `login()` redirects by role: STUDENT→`/student/dashboard`, TEACHER→`/teacher/dashboard`, ADMIN→`/admin/dashboard`. `logout()` clears both keys, pushes `/`.
- Axios attaches the token client-side: `lib/api.ts:11-19` request interceptor sets `Authorization: Bearer ${localStorage.getItem("lm_token")}`.
- **⚠️ Mismatch with docs**: README (`README.md:15,128`) and the technical spec claim "short-lived 15m access token + long-lived **httpOnly refresh cookie**" — but the actual code uses a single **7-day JWT in localStorage** (XSS-exposed, no refresh, no cookie). Build admin-panel to match the **implemented** convention (Bearer JWT + localStorage) unless you're also fixing this.
- **No Next.js `middleware.ts` exists** (searched `src/**/middleware.ts` and `middleware` — zero matches). All route protection is either per-route `requireRole` in handlers or client-side checks in pages. There is no global server-side route guard.

**2. Password hashing — NOT implemented (security gap)**
- `auth-service.ts:19-20` — explicit `FIXME`: "Schema dropped passwordHash (designed for Supabase Auth). For now, bypassing password check so build passes. Real auth must be handled by Supabase." Login finds user by email and returns a token **without any password verification** (anyone with a valid email gets a JWT). No bcryptjs import in the repo.

**3. Existing admin section**
- Pages: only `src/app/admin/dashboard/page.tsx` (198 lines, "use client") — a teacher-verification queue UI: stat cards (pending/approved/rejected/total), status filter tabs, approve/reject buttons. Uses `useAuth()` + `adminApi.listTeachers(filter)` / `adminApi.setTeacherStatus(id, status)`.
- **Admin gate is client-side only**: `dashboard/page.tsx:43` `if (!isLoading && (!user || user.role !== "ADMIN")) router.push("/login")`, and `:60` skips loading unless role==="ADMIN". Real enforcement lives in the API handlers via `requireRole(request, "ADMIN")`.
- Layout: this admin page does **not** use the shared `AppShell`/`Sidebar`/`TopBar` — it inlines its own fixed left nav (nav items "Verification Queue" / "All Users", with "All Users" marked `active:false` i.e. not built).
- Feature service: `features/admin/services/admin-service.ts` — `AdminService.getProfile(userId)` queries `db.user.findUnique({ where: { id, role: "ADMIN" } })`, returns `{ userId, user: { id, name:"Admin", email, createdAt } }` (name hardcoded "Admin").

**4. API routes pattern** (all under `src/app/api/`)
- Convention: thin `Route Handler`s → Zod `safeParse` on `request.json()` → delegate to a `features/<x>/services/*` static service → return `NextResponse.json`.
- Error/status convention (consistent everywhere): `400` validation (`result.error.issues[0]?.message`), `401` invalid credentials, `403` role-denied (from requireRole), `404` not found, `409` email in use, `500` catch-all with `console.error("... error:", err)` + `{ message: "Internal server error." }`.
- Protected routes pattern (e.g. `teachers/me`, `students/me`, `admins/me`, `admin/teachers`): `const auth = requireRole(request, "ROLE"); if (auth.response) return auth.response;` then use `auth.user.userId`. `teachers/me` & `admins/me` guard with `requireRole(request, "TEACHER")` / `"ADMIN"`; `admin/teachers` GET & `admin/teachers/[id]` PATCH guard with `"ADMIN"`.
- `admin/teachers/route.ts:17-22` — reads query via `new URL(request.url).searchParams`, uppercases and whitelists `status` against `VALID_STATUSES`. `admin/teachers/[id]/route.ts:16,22` — Next.js 15 async `params: Promise<{ id }>` (`const { id } = await params`), uppercases/whitelists `body.status`.
- Open routes (no guard): `auth/login`, `auth/register/*`, `health`.
- `lib/db.ts:1,3` — `import { db } from "@repo/database"`, re-exports `db`/`prisma`. `packages/database/index.ts:11-15` — PrismaClient singleton via `globalThis.prismaGlobal` (dev-only caching).

**5. RLS / security notes**
- **RLS is designed, not implemented** — extensive `/// RLS:` comments on every model in `packages/database/prisma/schema.prisma` (e.g. User L21 "Public read, self write. Admins full access"; CoinTransaction L171 "Service role only write (via edge functions)"; Booking L240 "created via payment webhook"; Payment L320, Payout L348, ChatMessage L370, AdminAuditLog L448 "Admin only read/write"). These are aspirational design notes; no SQL/RLS policies or edge functions exist in the codebase.
- Key schema facts for admin-panel: `User.id` is `@db.Uuid` **matching Supabase `auth.users.id`** (`schema.prisma:24`, `auth-service.ts:40`). `VerificationStatus` enum = `PENDING | INTERVIEW_SCHEDULED | APPROVED | REJECTED` (note: `INTERVIEW_SCHEDULED` exists in schema but the admin API whitelists only `PENDING/APPROVED/REJECTED`). `AdminAuditLog` and `PlatformSetting` models exist for admin audit/settings.
- `docs/internal/Language_Metrics_Technical_Specification.md` contains the security guidance (webhook HMAC-SHA256 signature verification, idempotency via stored `event_id`, RLS defense-in-depth, `service_role`/edge-function-only writes, never expose service keys to client) — spec only, none of it is wired in code yet.

**6. Environment variables**
- Read in source: `JWT_SECRET` (`auth.ts:5`) and `NEXT_PUBLIC_API_URL` (`api.ts:3`, defaults to `"/api"`). Prisma uses `DATABASE_URL` + `DIRECT_URL` (schema + `.env`).
- `apps/teacher-web/.env` (committed) defines only `DATABASE_URL` (Supabase transaction pooler :6543, `?pgbouncer=true`) and `DIRECT_URL` (session pooler :5432). **No `JWT_SECRET` or `NEXT_PUBLIC_API_URL` set** in the actual `.env`.
- **No `.env.example` file exists** in the repo (search `**/.env.example` = 0 matches), despite README (`:87`) instructing `cp .env.example .env` and `.gitignore` whitelisting it. The only env list is prose in the spec doc (lines ~483-489: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, etc.).
- Note: `auth-service.ts` uses `crypto.randomUUID()` (Node global) for new user IDs, not a DB-generated UUID.

**7. Shared UI components**
- `src/components/ui/`: `Avatar.tsx`, `Badge.tsx` (cva variants: default/success/warning/danger/info/outline), `Button.tsx` (cva variants: primary/gold/outline/outline-cream/ghost/danger; sizes sm/default/lg/icon; custom `asChild` slot via `React.cloneElement`, no radix-slot), `Card.tsx` (Card/CardHeader/CardTitle/CardContent/CardFooter), `Input.tsx`, `Logo.tsx`, `StatusBadge.tsx` (pending/approved/rejected, keyed on `VerificationStatus`).
- `src/components/layout/`: `AppShell.tsx` (sidebar+topbar shell; `NavItem {label, href, icon}`), `AuthLayout.tsx` (auth-page split layout), `Footer.tsx`, `Navbar.tsx`, `Sidebar.tsx`, `TopBar.tsx`.
- Styling deps: `cn()` = `clsx` + `tailwind-merge` (`lib/cn.ts`), `class-variance-authority` (cva), `framer-motion`, `lucide-react`. Tailwind v4, design tokens via `globals.css` (`bg-bg`, `text-text`, `bg-gold`, `text-navy`, `bg-cream`, etc.).

### Recommendation
For `apps/admin-panel`, mirror the implemented conventions exactly: (1) JWT via `jsonwebtoken` with `JWT_SECRET`, payload `{userId, role}`, `Bearer` header, guarded by `requireRole(req, "ADMIN")` in every handler (401/403 pattern); (2) localStorage `lm_token`/`lm_user` client session with axios Bearer interceptor; (3) thin route handlers → Zod `safeParse` → `features/*/services` static class → `NextResponse.json` with the established status/`{message}` mapping; (4) reuse the shared `@repo/database` Prisma singleton. Note the existing admin features (`AdminService`, `admin/teachers`, `AdminAuditLog`, `PlatformSetting`) as reusable starting points. Do NOT copy the missing-password-check login behavior into admin.

### Not covered / Uncertain
- Did not read `components/ui/Input.tsx`, `Avatar.tsx`, `Logo.tsx`, `layout/{Footer,Navbar,Sidebar,TopBar}.tsx` bodies (signatures/roles inferred from layout usage and file listing — only Button/Card/Badge/StatusBadge/AppShell/AuthLayout fully read).
- Did not read `src/features/student/services/*`, `features/teacher/services/teacher-service.ts` (referenced by API routes: `getProfileByUserId`, `listTeachersForAdmin`, `findById`, `updateVerificationStatus` — behavior not verified, only signatures inferred from call sites), `features/home/*`, or `prisma/seed.mjs`.
- `register/student/page.tsx` not read (mirrors the teacher stub pattern seen in `register/teacher/page.tsx`, which is a simulated `setTimeout` flow with **no real API call** — login/register pages are not yet wired to the working API routes).
- `.env` was read; note it may contain a live database credential — do not propagate it. No `.env.example` exists to enumerate remaining vars beyond the spec-doc prose list.

---
[Exploration: Explore (deepseek-v4-flash) | 70659ms | 8 turns | 48 tools | 44139in/7278out tokens | status: completed]
</HYDRATION_REPORT>

CRITICAL: Write your final answer DIRECTLY from the findings above. Do NOT re-page files the sub-agent already covered (no whole-file skeleton/symbols/read on those paths). To confirm one specific cited line, a narrow sb_read_code range (<=40 lines) is allowed. Files the report did NOT cover stay fully readable — locate them with superbrain_listDirectory / superbrain_search instead of guessing.
