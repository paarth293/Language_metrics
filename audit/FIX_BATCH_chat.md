# Fix batch: chat load (#1, #2, #23 chat indexes)

Source of truth: `audit/PRODUCTION_READINESS.md`. Plan: `audit/PLAN_chat_load.md` (approved with the decisions below). Branch `fix/chat-load`, cut from `fix/redis-rate-limits` @ `23196e8`. **10 commits, not pushed.** Date 2026-10-19.

Approved decisions:
- **Cursor:** `(createdAt, id)`. Polls look back 10 s; the client drops duplicates by id. When the tab is visible again, poll once immediately.
- **Polling:** open conversation every 10 s, 30 s after 2 minutes with no new messages. Thread list every 30 s. Paused while the tab is hidden. Your own sent messages appear instantly.
- **Thread list:** one parameterised `$queryRaw` (`DISTINCT ON`) for the newest message per conversation; `select` only; never a full user record.
- teacher-web's two thread lists are included. No changes to teacher-web message-route security (follow-up batch). #22 not touched.

| Step | Commit | What |
|---|---|---|
| 2 | `5f90748` | student-web `GET /api/students/chat/:teacherId`: cursor pagination |
| 3 | `2c746b4` | teacher-web `GET /api/students/chat/:teacherId`: same (GET only) |
| 4 | `054e05e` | teacher-web `GET /api/teachers/chat/:studentId`: same (GET only) |
| 5 | `07c1aee` | student-web chat page: polling, cursors, merge, load older, scroll |
| 6 | `4bf7976` | teacher-web `/student/chat` page: byte-identical copy of step 5 |
| 7 | `49d5992` | teacher-web `/teacher/chat` page: same logic, teacher field names |
| 8 | `143d9ac` | student-web `GET /api/students/chat` thread list: bounded queries |
| 9a | `d63ee2a` | teacher-web `GET /api/students/chat` thread list: same |
| 9b | `7699adf` | teacher-web `GET /api/teachers/chat` thread list: same |
| 10 | `586be46` | ChatMessage indexes: 2 migrations + 2 rollbacks + schema + test (**written only**) |

---

## Issues fixed (real test output)

### #1: message routes returned the whole conversation (steps 2–4)

New helper `lib/chat-messages.ts` (one copy per app). It does `findMany` with `take: limit + 1`, `orderBy [createdAt, id]` and a fixed `select`. `?after=` / `?before=` compare on the tuple. The response keeps `messages` (oldest first) and adds `hasMore` and `cursor: { oldest, newest }`. Bad parameters → 400.

Test (identical in each app, against an in-memory evaluator of the real `where`/`orderBy`/`take`). Before the fix, in all three routes:
```
× first load returns only the newest 50, oldest first, with cursors
× ?after returns only newer messages, oldest first
× ?after without an id returns everything strictly newer than the time (look-back polls)
× ?after breaks createdAt ties by id
× ?before pages back through older messages until none are left
× rejects malformed cursors with 400
AssertionError: expected [ Array(120) ] to have a length of 50 but got 120
AssertionError: expected [ Array(120) ] to deeply equal [ Array(9) ]
AssertionError: expected 200 to be 400 // Object.is equality
Tests  6 failed | 1 passed (7)
```
After: `Tests 7 passed (7)` in each of the three route test files.

### #1: pages polled every 2–3 s for full history, even when hidden (steps 5–7)

New helper `lib/chat-polling.ts` (one copy per app) with the constants, `mergeMessages` (union by id, sorted by `(createdAt, id)`), and the poll and older-page URLs. The pages:
- use a `setTimeout` loop instead of `setInterval`;
- pause on `visibilitychange` to hidden, and run one immediate poll when visible again;
- back off after 2 idle minutes;
- show a "Load older messages" button;
- keep the scroll position when older messages are prepended, and only auto-scroll when a new last message arrives (it used to scroll every 2 s).

The existing in-flight and version guards are unchanged.

Test `page.polling.test.tsx` (jsdom, fake timers), on each of the three pages. Before the fix:
```
× polls an open conversation every 10 s, asking only for newer messages
× looks back 10 s from the newest message it has
× polls the thread list every 30 s
× stops polling while the tab is hidden and polls once immediately when it is visible again
× slows to 30 s after 2 minutes with no new messages
× merges polled messages by id, without duplicates, in time order
× loads older messages above the current ones
AssertionError: expected [ '/api/students/chat/a', …(29) ] to have a length of 6 but got 30
AssertionError: expected null to be '2026-10-19T09:59:51.000Z' // Object.is equality
AssertionError: expected 20 to be 2 // Object.is equality
AssertionError: expected 31 to be 1 // Object.is equality
AssertionError: expected 60 to be 4 // Object.is equality
AssertionError: expected [ 'm1' ] to deeply equal [ 'm1', 'm2', 'm3' ]
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name `/load older messages/i`
```
After: `Tests 7 passed (7)` on each page. In student-web the run also includes the **existing `page.test.tsx`, unchanged and passing** (`✓ discards a slow response from the previous conversation`; `Tests 8 passed (8)`).

The teacher page was built from the new student page with the same renames as before. The student/teacher difference (ignoring CR line endings) matches the old difference except for renamed new lines.

### #2: thread lists loaded full user records and every message (steps 8, 9a, 9b)

New helper `lib/chat-threads.ts` (one copy per app):
```sql
SELECT DISTINCT ON (m.counterpart) m.counterpart, m.content, m."createdAt"
FROM (
  SELECT CASE WHEN "senderId" = ${userId}::uuid THEN "receiverId" ELSE "senderId" END AS counterpart,
         "id", "content", "createdAt"
  FROM "ChatMessage"
  WHERE ("senderId" = ${userId}::uuid AND "receiverId" = ANY(${counterpartIds}::uuid[]))
     OR ("receiverId" = ${userId}::uuid AND "senderId" = ANY(${counterpartIds}::uuid[]))
) AS m
ORDER BY m.counterpart, m."createdAt" DESC, m."id" DESC
```
It's run through Prisma's tagged `$queryRaw`, so every `${}` is a bound parameter. Routes use `booking.groupBy` (one row per counterpart, `_max.createdAt` as the "no messages yet" fallback) plus a profile `findMany` with `select`. That's a fixed 3 queries.

Before the fix:
```
# student-web (its N+1 was already fixed; it loaded user rows and every message)
✓ returns the same thread shape, newest conversation first
× never loads a teacher's full user record
× never loads every message in the conversations
✓ uses a fixed number of queries however many threads there are
× passes the user id to raw SQL as a parameter, never inside the SQL text
AssertionError: expected [ { model: 'booking', …(2) } ] to deeply equal []
+       "include": { "teacher": { "include": { "user": true } } }

# teacher-web /api/students/chat
AssertionError: expected [ { model: 'booking', …(2) } ] to deeply equal []
AssertionError: expected 51 to be 4 // Object.is equality        ← N+1: 51 queries for 50 threads
Tests  4 failed | 1 passed (5)

# teacher-web /api/teachers/chat
AssertionError: expected [ { model: 'booking', …(2) } ] to deeply equal []
AssertionError: expected 51 to be 4 // Object.is equality
Tests  3 failed | 1 passed (4)
```
After: `Tests 5 passed (5)`, `Tests 5 passed (5)`, `Tests 4 passed (4)`. The **"same thread shape" test passed before and after** in all three, so each response is unchanged for the same data.

### #23: chat indexes (step 10, after your "go")

Before: `Tests 7 failed (7)` (ENOENT for the migration and rollback files; `schema.prisma` lacked the two `@@index` lines). After: `Tests 7 passed (7)`. The test checks that each `migration.sql` holds exactly one statement, `CREATE INDEX CONCURRENTLY IF NOT EXISTS …`, and each `rollback.sql` exactly `DROP INDEX CONCURRENTLY IF EXISTS …`.

`prisma validate` (run with dummy localhost URLs in the command's environment, so your real URLs were never read): `The schema at packages\database\prisma\schema.prisma is valid 🚀`.
`prisma migrate diff --from-schema-datamodel <schema before> --to-schema-datamodel <schema after> --script` (schema to schema, no database, no shadow DB):
```
-- CreateIndex
CREATE INDEX "ChatMessage_senderId_receiverId_createdAt_idx" ON "ChatMessage"("senderId", "receiverId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_receiverId_senderId_createdAt_idx" ON "ChatMessage"("receiverId", "senderId", "createdAt");
```
The only schema change is these two indexes, with the same names and columns as the migration files.

### Gate after the last step (real output)

```
typecheck EXIT 0
lint EXIT 0
test EXIT 0
      Tests  32 passed (32)      admin-panel
      Tests  135 passed (135)    student-web   (+19 this batch)
      Tests  189 passed (189)    teacher-web   (+37 this batch)
      Tests  6 passed (6)
      Tests  13 passed (13)
      Tests  11 passed (11)      packages/database (+7 this batch)
      Tests  46 passed (46)
      Tests  44 passed (44)
      Tests  4 passed (4)
test:payments EXIT 1
 FAIL  tests/payment-security/09-secret-scan.test.ts > 9. secret scan > git history > no private key material anywhere in git history
      Tests  1 failed | 180 passed | 2 skipped (183)
```
`npm test`: **480 passed, 0 failed** (417 before this batch + 63 new). `test:payments`: only the known #12 failure and the 2 skips. The same gate ran after every step.

---

## Things that happened during the batch

- **Corrupted dev-server output.** Typecheck failed after step 2 because `apps/teacher-web/.next/dev/types/routes.d.ts` (generated, git-ignored, written at 11:44 while dev servers were running) had its end written twice. Per-workspace typecheck showed 10/11 clean and teacher-web's 4 errors all in that file; step 2 hadn't touched teacher-web. With your "A", I removed that file. It had already disappeared by then, so I also removed the other three 11:44 files in the same folder (`validator.ts`, `cache-life.d.ts`, `root-params.d.ts`), which still pointed to it. `next dev` regenerates all of them. Nothing tracked by git was removed.
- **`.gitignore` exception (step 10).** The repo ignores `*.sql` except `migrations/**/migration.sql`, so the required `rollback.sql` files couldn't be committed. I added one line, `!packages/database/prisma/migrations/**/rollback.sql`, and amended it into the step-10 commit. Every other `*.sql` file is still ignored.
- **Deviation from the plan (§3.3):** the teacher-web `/api/students/chat` thread list keeps its **unsanitised** `lastMessage` and `teacherName`, exactly as today. The plan said it would match student-web's `stripHtml`, but HTML cleaning in teacher-web is now the follow-up batch.

---

## Migrations waiting to be applied (NOT applied anywhere)

| Folder | Statement | Rollback |
|---|---|---|
| `packages/database/prisma/migrations/20261020000000_chat_message_sender_receiver_created_idx/` | `CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_senderId_receiverId_createdAt_idx" ON "ChatMessage" ("senderId", "receiverId", "createdAt");` | `rollback.sql`: `DROP INDEX CONCURRENTLY IF EXISTS …` |
| `packages/database/prisma/migrations/20261020000100_chat_message_receiver_sender_created_idx/` | `CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_receiverId_senderId_createdAt_idx" ON "ChatMessage" ("receiverId", "senderId", "createdAt");` | `rollback.sql`: `DROP INDEX CONCURRENTLY IF EXISTS …` |

To apply: staging first, then production, with `npm run db:migrate:deploy`. If Prisma refuses `CONCURRENTLY` (see NOT VERIFIED), run each statement by hand outside a transaction, then `npx prisma migrate resolve --applied <folder>`. To undo: run `rollback.sql` by hand, then `npx prisma migrate resolve --rolled-back <folder>`. If a concurrent build fails, it leaves an INVALID index (the check query is in each `migration.sql`); run the rollback and apply again.
The new code works without these indexes (it's just slower on big tables), so deploying code and indexes in either order is safe.

No env vars to set for this batch.

---

## NOT VERIFIED

- **The `DISTINCT ON` query against a real PostgreSQL database.** No database was used in this batch. All route tests use a mocked `$queryRaw` that checks the call is parameterised and returns rows of the shape the SQL should return. Specifically untested:
  - the SQL syntax as Prisma sends it;
  - that `${counterpartIds}::uuid[]` binds a JS string array correctly;
  - that `${userId}::uuid` casts as intended;
  - that `counterpart` comes back as a string and `createdAt` as a `Date`;
  - that the planner uses the new indexes.

  **Run it on staging (with the indexes applied) before production**, e.g. `EXPLAIN ANALYZE` on the query with a real user id.
- `booking.groupBy` and the cursor `findMany` against real Prisma/Postgres (mocked in tests). Same staging check.
- How `prisma migrate deploy` runs a single-statement migration containing `CREATE INDEX CONCURRENTLY`. Each file has exactly one statement to avoid the implicit transaction, but this wasn't run. Also unchecked: whether Prisma ignores the extra `rollback.sql` inside a migration folder (Prisma documents only `migration.sql`; it should ignore other files).
- Index build time on production `ChatMessage` (row count unknown).
- Real browser behaviour: scroll preservation when loading older messages, and `visibilitychange` in real browsers. Covered by jsdom tests only; no dev server was started.
- Whether `createdAt` is set by the Prisma engine or by the database default. The 10 s look-back covers either, but it's unconfirmed.

---

## Follow-up batch (not done here, by your instruction)

Gaps found in the teacher-web chat **message** routes, `apps/teacher-web/src/app/api/teachers/chat/[studentId]/route.ts` and `apps/teacher-web/src/app/api/students/chat/[teacherId]/route.ts`. student-web's copy already handles all of these:

1. **No booking/relationship check** on GET or POST. Any logged-in teacher can read or post messages with any user id, and any logged-in student can do the same through teacher-web. student-web has `verifyTeacherRelationship`.
2. **No HTML cleaning**: message content and thread-list previews are returned unsanitised (student-web uses `stripHtml`). This includes the teacher-web `/api/students/chat` thread list, left unsanitised in step 9a.
3. **No length limit / validation** on POST content (student-web uses `validateChatMessage`).
4. **No rate limit** on POST (student-web: `rateLimitRedis(userId, "chat-send", { windowMs: 60_000, max: 30 })`). There's also no body-size guard.
5. **Attachments aren't uploaded**: POST stores `attachmentUrl = file.name` (`teachers/chat/[studentId]/route.ts:59-60`, `students/chat/[teacherId]/route.ts:57-58`) instead of uploading through `lib/storage`.

Also out of scope and still open: #22 (PaymentOrder indexes), dropping the now-redundant `ChatMessage_senderId_receiverId_idx`, and unread counts (still hard-coded to 0; there's no read flag).
