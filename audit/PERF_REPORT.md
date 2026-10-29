# PERF_REPORT.md — performance work on `fix/perf`

Work in progress. This file is written as each item lands, and finished at the end of the batch.
Decisions and scope are in `PERF_PLAN.md`; per-item status is in `PROGRESS_PERF.md`.

No readiness score is given anywhere in this report, by instruction.

---

## Measurement ground rules

There is **no local or test database**, by instruction. Nothing was installed, the production
`DATABASE_URL` was never read or used, and **no query was run against any real database.**
Builds were run with `DATABASE_URL` and `DIRECT_URL` overridden to `127.0.0.1:1`, an unroutable
local address; Next.js gives an already-set `process.env` value precedence over `.env` files, so
the build could not have reached a real database even by accident.

| Measured for real | Stated as NOT VERIFIED |
|---|---|
| First-load and per-chunk sizes, from `next build` | Query latency in milliseconds |
| Requests per page load, derived from the client components | `EXPLAIN ANALYZE` plans |
| Query counts, and the exact column and row sets a query asks for, asserted in tests | Index effectiveness |
| Outbound third-party call counts, with the HTTP layer stubbed | End-to-end page latency |

No millisecond figure is estimated. Where timing matters and could not be measured, the item says
**NOT VERIFIED** and says how to measure it later.

One number from the baseline is worth repeating as context, because it sets what a removed round
trip is worth: Supabase Postgres is in **Tokyo** and answered a TCP handshake from India at
**141 ms p50**. That is a network measurement from the baseline session, not a claim about any fix
below.

---

## Finding: can `passwordHash` or `totpSecret` reach a response?

Asked for before the first fix. **Answer: no — not before this change and not after it.** No
response body, and no server-rendered page, can contain either value. The recordings fix was still
worth doing, for a different reason given below.

What was checked, exhaustively rather than by sampling:

| Check | Result |
|---|---|
| Every `include: { user: true }` in the repo | 5 sites: 2 recordings routes, 3 admin pages |
| Every `prisma.user.find*` call | 2 sites, both `change-password`, both with a narrow `select` |
| Every file mentioning `passwordHash` outside tests | 11 files, 38 references |
| Every file mentioning `totpSecret` outside tests | 2 files |
| Every raw SQL query (`$queryRaw` / `$executeRaw`) | No `SELECT *`; every column list is explicit |

Site by site:

- **The two recordings routes** loaded the whole `User` row through
  `booking.teacher.include: { user: true }`, which does include `passwordHash`, `totpSecret`,
  `backupCodes` and both reset tokens. The response is built by an explicit `.map()` that reads
  only `teacher.name` and `teacher.language`, so **nothing from `User` was ever serialized**. The
  row was fetched across the network into function memory and then dropped on the floor.
- **The three admin pages** (`analytics`, `payments/[id]`, `teachers/[id]`) load full `User` rows in
  a server component and read only `user.email` in JSX. React Server Components serialize a value
  into the page payload only when it is passed across the server-to-client boundary; these objects
  are not. `TeacherPayoutCard` is the one client component nearby and it receives `payouts` and
  `teacherId`, not the user. `CoinWalletCard` is a server component and receives `userId` plus the
  admin session, which `requireAdmin` builds from a narrow `select` that contains no secret.
- **Login, mobile login, password reset, admin login and coin adjustments** read `passwordHash` or
  `totpSecret` into a local variable, pass it to `bcrypt.compare` or the TOTP verifier, and return a
  boolean or a hand-built object. `teacher-web`'s login service selects `passwordHash` in raw SQL
  and returns a freshly built `{ id, name, email, role }`. None of them returns the hash.
- **`/api/auth/me`** builds its row with an explicit column list in raw SQL and then re-maps it
  field by field. Neither secret is in either list.

So this was **not** an exposure bug. It was a cost bug and a blast-radius bug: every credential
column for every teacher on the list crossed the Tokyo link on each request, which is bytes wasted
and a wider surface for any future change that starts spreading the fetched object into a response.
The fix removes the reason to worry rather than fixing a live leak. Reported as such, with no
inflation.

A regression test now pins this. `CREDENTIAL_COLUMNS` in both recordings route tests fails if any
of the five credential columns is ever loaded again, and the test's fake Prisma client projects a
fully populated row through whatever `select` or `include` the route asks for, so it measures the
columns the route actually causes to be read rather than trusting a hand-written stub.
