# Teacher\-Web Portal — Error & Issue Analysis (read\-only pass)

**Scope:** `apps/teacher-web/` (the newly added consumer app hosting the teacher, student, and mini\-admin experiences), cross\-checked against `packages/database/prisma/schema.prisma`.
**Nature of this pass:** No files were changed. Every finding below comes from reading the source line by line and tracing data/type flow by hand — this sandbox's outbound network does not reach the npm registry (`registry.npmjs.org` → "Host not in allowlist"), so `npm install`, `next build`, `tsc --noEmit`, `eslint`, and `vitest` could not be executed here. Anything a compiler/linter would catch mechanically should still be re\-verified by actually running those commands (I've flagged one finding, \#3, that I'm confident is a hard TypeScript compile error).

* * *

## Critical / High

### 1\. CSRF protection and general API rate\-limiting in `proxy.ts` are dead code

`proxy.ts` contains logic that runs `pathname.startsWith("/api/")` checks for CSRF origin validation and a general 100 req/min API rate limit (lines \~71–117). But `config.matcher` is:

```
"/((?!_next/static|_next/image|api/|favicon.ico|brand).*)"
```

This negative\-lookahead pattern excludes every path starting with `api/` from ever invoking the `proxy()` function at all (confirmed by the comment right above it: *"api/* (all API routes handle their own auth)"\*). So the CSRF check and the generic API rate limiter can never run — not a partial gap, entirely unreachable code. The only requests that get any rate limiting are the handful of routes that separately call `rateLimit`/`rateLimitRedis` themselves (login, register, otp routes); everything else (profile updates, onboarding, wallet/teacher\-service mutations, admin approve/reject) has **no CSRF defense and no rate limit** beyond what an individual route happens to add.

### 2\. The origin check, even if it ran, is bypassable

```js
if (origin && host && !origin.includes(host)) { ... }
```

Using substring `.includes()` instead of exact match means an attacker\-controlled origin like `https://teacher-web.example.com.attacker.com` would pass, because `host` ("teacher\-web.example.com") is a literal substring of that origin string. This is a classic origin\-check bypass pattern.

### 3\. Type error in the Google OAuth callback (will fail `tsc`/`next build`)

`app/api/auth/oauth/callback/google/route.ts`\:

```ts
let userRole: "STUDENT" | "TEACHER" = role === "teacher" ? "TEACHER" : "STUDENT";
...
} else if (userRole === "ADMIN") {   // ← TS2367: no overlap between "STUDENT"|"TEACHER" and "ADMIN"
```

`userRole`'s declared type never includes `"ADMIN"` (later assignments use `as typeof userRole` casts that keep the narrow type), so under `strict: true` this comparison is a compile error, not just a logically dead branch.

### 4\. Password reset doesn't revoke existing sessions

`app/api/auth/forgot-password/reset/route.ts` updates the password hash but never calls `revokeAllRefreshSessions(user.id)`. Any refresh token issued before the reset (e.g. to an attacker who had the old password) stays valid for its full 7\-day life after the "victim" resets their password — defeating much of the point of a reset.

* * *

## Medium

### 5\. Verification\-status UI is broken by an enum case mismatch

- `packages/database/prisma/schema.prisma`\: `enum VerificationStatus { PENDING, INTERVIEW_SCHEDULED, APPROVED, REJECTED }` — **uppercase**, and this is what the API (`TeacherService`, `app/api/admin/teachers/*`) actually returns.
- `src/types/index.ts`\: `export type VerificationStatus = "pending" | "approved" | "rejected";` — a **separate, lowercase**, and incomplete (no `INTERVIEW_SCHEDULED`) type.
- `components/ui/StatusBadge.tsx` and `app/admin/dashboard/page.tsx` both import the lowercase type from `@/types` and key off it.

Result: `CONFIG[status] ?? CONFIG.pending` in `StatusBadge` never finds a match for real (uppercase) data, so **every teacher's badge shows "Pending review" regardless of actual status**, and `AdminDashboard`'s button\-visibility checks (`t.status !== "approved"`, `!== "rejected"`) never match either, so **Approve and Reject buttons both stay visible even for teachers already approved or rejected**.

### 6\. No role/auth guard on the teacher and student page shells

`components/layout/AppShell.tsx` (shared by both `app/teacher/layout.tsx` and `app/student/layout.tsx`) only checks `isLoading`; it never redirects when `user` is `null` or when `user.role` doesn't match the section. Compare this to `app/admin/dashboard/page.tsx`, which explicitly does `if (!isLoading && (!user || user.role !== "ADMIN")) router.push("/login")`. A logged\-in STUDENT can open `/teacher/dashboard`'s shell (and vice versa) — actual data still fails via each API route's own `requireAuth(request, "ROLE")`, but the page itself renders instead of redirecting, and an unauthenticated user isn't bounced to `/login` by the shell either.

### 7\. Wrong dev port for the admin redirect

Both `lib/auth-client.tsx` (line \~125) and the OAuth callback route (line \~223) fall back to:

```js
process.env.NEXT_PUBLIC_ADMIN_URL || (NODE_ENV === "production" ? "https://language-metrics-admin-panel.vercel.app" : "http://localhost:3001")
```

Per the project's own dev setup, port **3001 is student\-web**; admin\-panel runs on **3003**. Any admin logging into teacher\-web locally without `NEXT_PUBLIC_ADMIN_URL` set gets redirected into the student\-web dev server instead.

### 8\. External redirect via the wrong API

`auth-client.tsx`\: `router.replace(`${adminUrl}/dashboard`)` passes a full cross\-origin URL into Next's client router, which is meant for in\-app navigation. `window.location.href = ...` is the correct way to leave the app.

### 9\. `/api/auth/verify-otp` can never succeed

It checks a submitted 6\-digit code with `compareOtp(otp, user.emailVerificationToken)`, but `emailVerificationToken` is only ever set (in `register/student` and `register/teacher`) to a bcrypt hash of the long link\-style token `"{8-hex-prefix}:{uuid}"` — never a hashed OTP. The real 6\-digit\-OTP flows use a completely different store (the `EmailVerificationCode` table via `verify-email` POST, and Redis `reg-otp:*` keys via `send-registration-otp`/`verify-registration-otp`). This route currently isn't linked from any page (registration correctly uses the other two), so it's not user\-facing right now — but it's live, exported, and its docstring claims it's "the" OTP verification path, which would mislead whoever wires it up next.

### 10\. `/admin` isn't in the proxy's protected\-route list

`proxy.ts`'s `PROTECTED_PREFIXES = ["/student", "/teacher", "/dashboard", "/onboarding", "/profile"]` omits `/admin`. Every other authenticated section gets redirected to `/login` at the edge if the JWT is missing/expired; `/admin/dashboard` does not — it relies solely on its own client\-side check plus the API's RBAC. (`"/dashboard"` in that same list is also dead weight — there's no route at the bare `/dashboard` path; every dashboard lives under `/student`, `/teacher`, or `/admin`.)

### 11\. Dead conditional makes `getStorageInfo()` always report "configured"

`lib/storage.ts`\:

```js
configured: PROVIDER !== "local" || true,  // always true
```

The `|| true` defeats the intended check — this always returns `true` no matter the provider or whether credentials are actually set, which would give a false "configured" status to any admin/diagnostic UI that reads it.

### 12\. Dead nav link: "Live Class" 404s

`app/student/layout.tsx` links to `/student/live`, but the only page under that path is `app/student/live/[sessionId]/page.tsx` — there's no page at the bare `/student/live`. Clicking that sidebar item from the student portal will 404.

* * *

## Low / Code hygiene

### 13\. `lib/api.ts` is leftover pre\-cookie\-auth code

It builds an axios client that reads `localStorage.getItem("lm_token")` and attaches it as `Authorization: Bearer ...`. Nothing in the current (cookie\-only) auth system ever writes `lm_token` to localStorage — `lib/auth.ts`'s own docstring says it "Replaces the old ... Bearer\-header system entirely. Never reads Authorization header." This interceptor is inert dead code from the old architecture.

### 14\. Three parallel, easy\-to\-confuse verification mechanisms

Email/OTP verification is implemented three different ways in this one app: the `EmailVerificationCode` table, the `User.emailVerificationToken`/`Prefix`/`Expiry` link\-token fields, and Redis `reg-otp:*` keys. They're each internally consistent, but this is exactly how \#9 happened, and it's a real maintenance hazard for the next person touching this code.

### 15\. Leftover "thinking out loud" comments shipped to production code

`app/api/auth/forgot-password/verify-otp/route.ts`, lines \~77–82:

```js
// Note: OTPs are hashed using hashOtp (which uses bcrypt internally)
// Wait, the prompt says `passwordResetToken (will store a bcrypt hash of the OTP)`.
// In our `hashOtp` we did bcrypt.hash.
// So we can use bcrypt.compare here. Wait, actually hashOtp returns a bcrypt hash?
// Let me check my `hashOtp` implementation in `otp.ts` or just use bcrypt.compare if the DB stores bcrypt.
```

Harmless functionally, but it's unreviewed scratch commentary that shouldn't have shipped.

### 16\. Unauthenticated PDF upload endpoint has a soft rate limit only

`app/api/auth/upload` intentionally allows anonymous uploads (needed before an account exists, during registration), guarded by a 10\-requests/minute\-per\-IP limit only. Reasonable for its purpose, but worth knowing it has no daily cap and can be hit from rotating IPs — a minor storage\-filling exposure.

### 17\. Duplicated "verification queue" feature across two apps

This app re\-implements the same teacher\-approval queue (`admin/dashboard`, `api/admin/teachers/*`) that also exists in the separate `admin-panel` app, each with its own independently\-typed `VerificationStatus`. That duplication is the direct cause of \#5 and will keep causing similar drift unless the two are reconciled (e.g. both importing the Prisma\-generated enum instead of hand\-rolled types).

* * *

## What I did not find

- No missing `requireAuth` calls on any of the "real" resource routes — every route under `/api/students/*`, `/api/teachers/*`, and `/api/admin/*` correctly gates on the right role. The routes that skip `requireAuth` (`/api/auth/profile`, `/api/auth/onboarding`) do their own equivalent manual cookie/JWT check inline instead — functionally fine, just inconsistent with the shared helper.
- `lib/auth.test.ts` and `lib/otp.ts`/`lib/sanitize.ts` implementations match their tests and docstrings — no staleness found there (unlike a similar earlier pass on `admin-panel`, which did find a stale test).
- Prisma schema references from `teacher-service.ts` (e.g. `TeacherRate`'s `teacherId_type` compound key) check out against `schema.prisma`.
