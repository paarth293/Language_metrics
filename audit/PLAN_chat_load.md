# Plan: chat load (#1, #2, plus chat indexes from #23; #22 optional)

_Plan only. No code was changed while writing it. Branch to use: `fix/chat-load`, cut from `fix/redis-rate-limits`. Source of truth: `audit/PRODUCTION_READINESS.md`. Written 2026-10-19._

---

## 0. Three questions before I start

1. **Two teacher-web thread-list routes** have the same problem as #2, and a worse one (an N+1 query plus `include: { user: true }`). They weren't in your file list. Include them? **Recommendation: yes** (§3.3). Without them, the teacher-web `/student/chat` and `/teacher/chat` pages still overload the database.
2. **Not in the report, so I'm reporting it, not fixing it:** the teacher-web message routes have **no relationship check** on GET or POST. A logged-in teacher can message any user ID (`teachers/chat/[studentId]/route.ts:40-85`), and a logged-in student can message any user ID through teacher-web (`students/chat/[teacherId]/route.ts:38-83`). They also don't sanitise content, don't validate length, don't rate-limit, and store `attachmentUrl = file.name` (lines 59-60 / 57-58) instead of uploading the file. student-web's copy fixed all of this (`verifyTeacherRelationship`, `stripHtml`, `validateChatMessage`, `rateLimitRedis`, `uploadFile`). This plan **won't touch POST** in any route. Do you want a separate batch for it?
3. **#22 (PaymentOrder indexes)** isn't a chat issue and touches payments. This plan treats it as an **optional, separate migration step** (§5.3), done only on your explicit "go".

---

## 1. Current behaviour (from the files I opened)

### 1.1 Who calls what

| Page (client) | Thread-list route it polls | Message route it polls / posts to | App that serves both |
|---|---|---|---|
| `apps/student-web/src/app/(authenticated)/chat/page.tsx` | `GET /api/students/chat` (`:59`) | `GET/POST /api/students/chat/${teacherId}` (`:78`, `:112`, `:139`) | student-web |
| `apps/teacher-web/src/app/student/chat/page.tsx` (**byte-identical** to the page above; `diff` returned no output) | `GET /api/students/chat` | `GET/POST /api/students/chat/${teacherId}` | teacher-web |
| `apps/teacher-web/src/app/teacher/chat/page.tsx` | `GET /api/teachers/chat` (`:59`) | `GET/POST /api/teachers/chat/${studentId}` (`:78`, `:112`, `:139`) | teacher-web |

Each page calls only routes in its own app, so a Vercel deploy ships page and route together.

**Other callers:** grep for `api/(students|teachers)/chat` across `apps/*/src`, `packages/*/src` and `tests` found only the three pages and `apps/student-web/src/app/(authenticated)/chat/page.test.tsx:15`.
**Mobile:** `apps/student-mobile/src` has no chat screen (`screens/`: Booking, Classes, Discover, Login, Main, Profile, Session, Wallet), and `packages/api-contracts/src` has no chat contract. **The mobile app doesn't call any chat route.**

### 1.2 Polling today (same in all three pages, lines 89-106)

```ts
const interval = setInterval(() => void fetchThreads(false), 3000);                 // :92  thread list every 3 s
const interval = setInterval(() => void fetchMessages(selectedTeacher, false), 2000); // :100 open conversation every 2 s
useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]); // :104-106
```
- Polling **doesn't stop when the tab is hidden**.
- Each message poll **replaces** the whole array (`setMessages(data.messages || [])`, `:81`). That creates a new array every 2 s, so the scroll-to-bottom effect fires every 2 s, even when nothing changed.
- In-flight guards (`threadInFlight`, `messageInFlight`) and version counters drop stale responses (`:53-87`). The existing test depends on this (§6).

### 1.3 Message routes (GET), all three

`apps/student-web/src/app/api/students/chat/[teacherId]/route.ts:67-87`:
```ts
const messages = await prisma.chatMessage.findMany({
  where: { OR: [ { senderId: userId, receiverId: teacherId }, { senderId: teacherId, receiverId: userId } ] },
  orderBy: { createdAt: "asc" },
});
const sanitizedMessages = messages.map((m) => ({ ...m, content: stripHtml(m.content) }));
return NextResponse.json({ messages: sanitizedMessages });
```
It first runs `verifyTeacherRelationship` (`:33-45`): one `teacherProfile.findUnique` and one `booking.findFirst` per poll.

`apps/teacher-web/src/app/api/teachers/chat/[studentId]/route.ts:19-29` and `apps/teacher-web/src/app/api/students/chat/[teacherId]/route.ts:17-27` contain the same `findMany` with **no `take`**, and return `{ messages }` **without** `stripHtml` and **without** a relationship check.

**Response today:** `{ messages: ChatMessage[] }`, oldest first, full rows (`id, senderId, receiverId, content, attachmentUrl, autoDeleteAt, createdAt`).
**What the UI reads** (`page.tsx:20-27`, `:339-377`): `id`, `senderId` (`isOwn = msg.senderId !== selectedTeacher`, `:340`), `content`, `attachmentUrl`, `autoDeleteAt`, `createdAt`. It expects **ascending** order and appends sent messages to the end, de-duplicated by `id` (`:122`, `:148`).

### 1.4 Thread-list routes (GET)

`apps/student-web/src/app/api/students/chat/route.ts`:
- `:15-23` loads **every** booking with `include: { teacher: { include: { user: true } } }`. That pulls each teacher's whole `User` row (`passwordHash`, `totpSecret`, `backupCodes`, reset tokens) into memory. It isn't returned, but it's loaded.
- `:33-44` loads **every** message between the student and every teacher (no `take`), only to keep the newest one per teacher.
- `:58-93` builds `{ teacherId, teacherName, teacherAvatar, language, lastMessage, lastMessageTime, unreadCount: 0 }`, sorted by `lastMessageTime` desc.

`apps/teacher-web/src/app/api/students/chat/route.ts:14-63` and `apps/teacher-web/src/app/api/teachers/chat/route.ts:16-65` also `include: { user: true }` and run **one `findFirst` per counterpart inside the loop** (an N+1 query). Neither strips HTML from `lastMessage`. The teacher version returns `{ studentId, studentName, studentAvatar, language: "General", lastMessage, lastMessageTime, unreadCount: 0 }`.

**Unread counts:** hard-coded `unreadCount: 0` in all three routes. `ChatMessage` has **no read flag** (schema below), so the badge at `page.tsx:284-286` never shows. This plan keeps that behaviour and doesn't add read tracking.

### 1.5 ChatMessage model (`packages/database/prisma/schema.prisma:433-446`)

```prisma
model ChatMessage {
  id            String   @id @default(uuid()) @db.Uuid
  senderId      String   @db.Uuid
  receiverId    String   @db.Uuid
  content       String
  attachmentUrl String?
  autoDeleteAt  DateTime
  createdAt     DateTime @default(now())
  ...
  @@index([senderId, receiverId])
  @@index([autoDeleteAt])
}
```
- `id` is a **random UUID (v4)**, so it **can't be used as an ordering cursor on its own**.
- No index includes `createdAt`, and there is none on `(receiverId, …)`.

---

## 2. Message routes: paginated first load, poll for newer only, load older

### 2.1 Cursor type: **decision needed**

| Option | How it works | Pros | Cons |
|---|---|---|---|
| **A. `(createdAt, id)` composite cursor (recommended)** | Compare on the tuple: newer = `createdAt > t OR (createdAt = t AND id > i)`, and the reverse for older | Deterministic even when two messages share a millisecond; matches the new index order | Two query params per direction |
| B. `createdAt` only | `createdAt > t` | Simpler | Two messages in the same millisecond: one can be skipped or repeated at page edges |

Prisma's built-in `cursor: { id }` doesn't help with "newer than X" polling, and random UUIDs have no order. **Recommendation: A.**

### 2.2 Request and response, before and after

**Before (all three routes):**
```
GET /api/students/chat/:teacherId
→ 200 { "messages": [ {id, senderId, receiverId, content, attachmentUrl, autoDeleteAt, createdAt}, … ALL, oldest first ] }
```

**After.** The `messages` key and **ascending order** stay, so existing clients keep working:
```
# 1. First load: newest 50
GET /api/students/chat/:teacherId
→ 200 { "messages": [ …up to 50, oldest→newest ],
        "hasMore": true,                                        // older messages exist
        "cursor": { "oldest": {"createdAt": "…", "id": "…"},   // pass to ?before
                    "newest": {"createdAt": "…", "id": "…"} } } // pass to ?after (null when empty)

# 2. Poll: only newer than the last one seen (overlap window, see §2.3)
GET /api/students/chat/:teacherId?after=2026-10-19T10:00:00.000Z&afterId=<uuid>
→ 200 { "messages": [ …newer, oldest→newest, max 100 ], "hasMore": false, "cursor": {…} }

# 3. Scroll up: older page
GET /api/students/chat/:teacherId?before=<createdAt>&beforeId=<uuid>
→ 200 { "messages": [ …up to 50 older, oldest→newest ], "hasMore": <bool>, "cursor": {…} }
```
- `limit`: default 50, max 100. Bad or out-of-range params → **400** (`after`/`before` must be valid ISO dates, the IDs must be UUIDs, and `after` and `before` can't be sent together).
- `select` returns exactly the fields returned today (`id, senderId, receiverId, content, attachmentUrl, autoDeleteAt, createdAt`), so nothing disappears for any caller.
- student-web keeps `stripHtml` and the relationship check. The relationship check still runs on every poll; caching it is out of scope (§8).
- The newest page is fetched `orderBy createdAt desc, id desc` with `take: limit + 1` and reversed before returning, so the response stays ascending.

### 2.3 Polling for newer messages: missed-message guard

`createdAt` is set at insert time. A write that starts first but commits second can land with a `createdAt` **earlier** than a message the client has already seen. A plain "after the last one" cursor would then skip it forever. NOT VERIFIED whether Prisma or Postgres sets `createdAt` here (`@default(now())`); either way, clocks can differ between serverless instances.
**Plan:** the client polls with `after = newest.createdAt − 10 s` (overlap window) and **merges by `id`**. The server stays a plain cursor query; overlap and de-duplication are client-side. The cost is re-sending up to 10 s of messages per poll, which is usually 0–2 rows.

---

## 3. Thread-list routes: bounded queries, no `user: true`

### 3.1 student-web `GET /api/students/chat` (in scope, #2)

Replace `:15-44` with three bounded queries:
1. **Counterparts:** `prisma.booking.groupBy({ by: ["teacherId"], where: { studentId: userId }, _max: { createdAt: true } })`. That's one row per teacher, with the latest booking time for the "no messages yet" fallback (today's `booking.createdAt`, `:78`).
2. **Profiles:** `prisma.teacherProfile.findMany({ where: { userId: { in: teacherIds } }, select: { userId: true, name: true, avatarUrl: true, language: true } })`. **`select` only, never `user`.**
3. **Last message per counterpart, in one query:**
```sql
SELECT DISTINCT ON (counterpart) counterpart, content, "createdAt"
FROM (
  SELECT CASE WHEN "senderId" = $1 THEN "receiverId" ELSE "senderId" END AS counterpart, content, "createdAt"
  FROM "ChatMessage"
  WHERE ("senderId" = $1 AND "receiverId" = ANY($2::uuid[]))
     OR ("receiverId" = $1 AND "senderId" = ANY($2::uuid[]))
) m
ORDER BY counterpart, "createdAt" DESC
```
Run it with `prisma.$queryRaw` and a tagged template, so it's parameterised. Both halves of the `OR` can use the new indexes (§5).

The response shape is **unchanged**: same field names, `unreadCount: 0`, `stripHtml` on `lastMessage`, sorted by `lastMessageTime` desc. Threads for teachers you've only cancelled with are still listed, as today, because there's no status filter.

**Decision (small):** "one grouped query" for the last message.
- **A. `DISTINCT ON` raw SQL** (recommended): one round trip, and it uses the index.
- **B. Prisma `findFirst` per counterpart, run in parallel:** no raw SQL, but N queries per poll.

### 3.2 Why not `distinct` in Prisma

`booking.findMany({ distinct: ["teacherId"] })` de-duplicates **in memory** in Prisma 5 unless the `nativeDistinct` preview flag is on. It would still load every booking row. `groupBy` is a real `GROUP BY`. (NOT VERIFIED against Prisma 5.22 behaviour beyond the docs; checked by the query-count test in §7.)

### 3.3 teacher-web thread lists (needs your yes, see §0 Q1)

- `apps/teacher-web/src/app/api/students/chat/route.ts`: the same change as §3.1. It serves the identical page, so its output must match student-web's, including `stripHtml`, which this copy is missing today.
- `apps/teacher-web/src/app/api/teachers/chat/route.ts`: the mirror image. `groupBy({ by: ["studentId"], where: { teacherId } })`, `studentProfile.findMany({ select: { userId, name, avatarUrl } })`, the same `DISTINCT ON` query, and the same response shape (`studentId, studentName, studentAvatar, language: "General", …`).

---

## 4. Polling: **decision needed** (no WebSockets or SSE)

| | Open conversation | Thread list | Hidden tab | Idle |
|---|---|---|---|---|
| Today | 2 s | 3 s | keeps polling | keeps polling |
| **A (recommended)** | **10 s** | **30 s** | **paused** (`visibilitychange`), immediate fetch on return | after 2 min with no new messages: conversation 30 s; resets on send, new message or focus |
| B | 5 s | 15 s | paused | no idle backoff |

**Why A:**
- Chat here is between a student and a teacher around a booking, not live conversation; a 10 s delay is acceptable.
- A sent message appears **immediately** for the sender (it's already appended from the POST response, `:122`).
- Load at 1,000 users with chat open: today ≈ 500 + 333 = **833 req/s**, each a full-history scan. With A it's **at most ≈ 133 req/s**, each a small range scan returning ~0 rows, and far less in practice because hidden tabs stop.
- B halves the delay but doubles the load.

Implementation: a `setTimeout` loop instead of `setInterval`, so a slow request can't overlap the next. In-flight and version guards are kept as they are.

---

## 5. Index migrations (#23 chat; #22 optional). Files only, **not applied**

### 5.1 Chat indexes (#23)

`schema.prisma` gets `@@index([senderId, receiverId, createdAt])` and `@@index([receiverId, senderId, createdAt])` on `ChatMessage`, so the schema and migrations stay in sync. Prisma's default index names will be `ChatMessage_senderId_receiverId_createdAt_idx` and `ChatMessage_receiverId_senderId_createdAt_idx`.

**One migration folder per index.** Postgres refuses `CREATE INDEX CONCURRENTLY` inside a transaction block, and a migration file with several statements runs as one implicit transaction. NOT VERIFIED how `prisma migrate deploy` batches statements; one statement per file avoids the question.

```
packages/database/prisma/migrations/20261020000000_chat_message_sender_receiver_created_idx/migration.sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_senderId_receiverId_createdAt_idx"
    ON "ChatMessage" ("senderId", "receiverId", "createdAt");
packages/database/prisma/migrations/20261020000000_chat_message_sender_receiver_created_idx/rollback.sql
  DROP INDEX CONCURRENTLY IF EXISTS "ChatMessage_senderId_receiverId_createdAt_idx";

packages/database/prisma/migrations/20261020000100_chat_message_receiver_sender_created_idx/migration.sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_receiverId_senderId_createdAt_idx"
    ON "ChatMessage" ("receiverId", "senderId", "createdAt");
packages/database/prisma/migrations/20261020000100_chat_message_receiver_sender_created_idx/rollback.sql
  DROP INDEX CONCURRENTLY IF EXISTS "ChatMessage_receiverId_senderId_createdAt_idx";
```
- The existing `ChatMessage_senderId_receiverId_idx` becomes redundant (it's a prefix of the new index). **I'll leave it.** Dropping it is a separate, later change.
- If a `CONCURRENTLY` build fails it leaves an `INVALID` index behind. The note in each `migration.sql` will say: check `pg_index.indisvalid`, then drop and retry.
- **Verification without a database:** `prisma validate`, plus `prisma migrate diff --from-schema-datamodel <old schema> --to-schema-datamodel <new schema> --script`, which needs no DB connection. I'll confirm the only diff is these two indexes. I **won't** use `DATABASE_URL`/`DIRECT_URL` as a shadow DB, and I won't run `migrate dev` or `migrate deploy`.

### 5.2 How they get applied (by you, later)

On staging first, then production: `npm run db:migrate:deploy`, or the SQL run by hand outside a transaction. Use the `rollback.sql` files to undo.

### 5.3 Optional: #22 PaymentOrder indexes (separate step, only on your "go")

Same pattern: `"RazorpayOrder" ("status", "createdAt")` and `("status", "updatedAt")`, each in its own `CONCURRENTLY` migration with a rollback file, plus `@@index` lines on `PaymentOrder`.

---

## 6. Backward compatibility

| Caller | Impact | Why it's safe |
|---|---|---|
| student-web chat page | Updated in the same deploy | Same app, atomic Vercel deploy |
| teacher-web `/student/chat` page | Updated identically (the pages stay byte-identical) | Same app as its routes |
| teacher-web `/teacher/chat` page | Updated with the same logic (its own field names) | Same app as its routes |
| Tabs still running the **old JS** during a deploy | The old page polls with no params, gets the **newest 50** instead of all, and replaces its list with them | Still works; only very long threads show 50 until reload |
| New page against an **old route** (stale cache, rollback) | The old route ignores `after`/`before` and returns everything | The client **merges by `id`** and sorts by `(createdAt, id)`, so no duplicates and it still works |
| Mobile app | None | No chat client exists (§1.1) |
| `page.test.tsx` (`:9-26`) | Its fetch mock matches `url.endsWith("/a")` and `{ messages: [...] }` | The first load still uses the bare URL with no query string, and responses without `hasMore`/`cursor` are handled, so the test must keep passing **unchanged** |
| Thread-list consumers | None | Response shape byte-compatible (same keys, order, `unreadCount: 0`) |

---

## 7. Proof tests (each runs red first, then green)

| # | Test file (new unless noted) | Fails today because | Passes after |
|---|---|---|---|
| #1 route | `apps/student-web/src/app/api/students/chat/[teacherId]/route.test.ts`: mocks `@/lib/db` and `@/lib/auth`; 120 mock messages | `findMany` is called **without `take`** and returns 120; `?after=` is ignored | First load returns 50 + `hasMore: true`; `?after=` returns only newer; `?before=` returns the older page; bad params → 400; order stays ascending |
| #1 route (teacher-web ×2) | The same test for `apps/teacher-web/.../students/chat/[teacherId]/route.test.ts` and `.../teachers/chat/[studentId]/route.test.ts` | Same | Same |
| #1 page | `chat/page.polling.test.tsx` (jsdom, fake timers) in student-web, plus the two teacher-web pages | Over 60 s of virtual time, **30** message polls; polls continue while `document.visibilityState = "hidden"` | ≤ **6** message polls in 60 s; **0** while hidden; one immediate poll on `visibilitychange` back to visible; a new message merged by `id` without duplicates; out-of-order arrival sorted correctly |
| #1 page (existing) | `apps/student-web/.../chat/page.test.tsx` | passes | **still passes, unchanged** |
| #2 route | `apps/student-web/src/app/api/students/chat/route.test.ts`: records every Prisma call and its args | Booking query args contain `include.teacher.include.user === true`; message `findMany` has no `take` | No call anywhere includes `user`; exactly 3 DB calls for 1 thread **and** for 50 threads (constant); response deep-equals today's shape for the same fixtures |
| #2 route (teacher-web ×2) | Same idea | **N+1**: `findFirst` called once per counterpart (50 calls for 50 threads); `include: { user: true }` | Constant 3 calls; no `user`; same response shape |
| #23 indexes | `packages/database/src/chat-indexes.migration.test.ts`: reads the two migration folders | Folders don't exist | Each `migration.sql` has exactly one statement, which contains `CONCURRENTLY`; each has a `rollback.sql` with `DROP INDEX CONCURRENTLY IF EXISTS`; `schema.prisma` declares both `@@index` lines; `prisma migrate diff` output shown in the batch report |

After every step: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:payments`. The expected baseline is the one known #12 failure plus 2 skips. Anything else gets undone and reported.

---

## 8. Risks and what could go wrong in the chat UI

| Risk | How it shows up | Mitigation in this plan |
|---|---|---|
| **Missing messages** | A late-committing insert gets a `createdAt` earlier than the cursor (§2.3) | 10 s overlap window plus merge by `id`; an integration-style page test covers out-of-order arrival |
| **Duplicate messages** | Overlap window, POST response plus poll, or new page against an old route | Merge by `id` everywhere (the POST path already does `prev.some(m => m.id === …)`, `:122`) |
| **Wrong order** | Prepending older pages, or merging overlapped rows | Always sort by `(createdAt, id)` after merging; the server always returns ascending |
| **Scroll jumps** | `scrollIntoView` on every `messages` change (`:104-106`) would jump to the bottom when older messages load | Auto-scroll only when messages are **appended**, or when the user is already at the bottom; keep the scroll position when prepending. (Today it scrolls every 2 s for no reason; this also fixes that.) |
| **Stale conversation after switching** | A slow poll for teacher A lands after switching to B | Keep the existing version and in-flight guards; the existing test plus a new one for the cursor path |
| **Unread counts** | None today (hard-coded 0, no read flag) | Unchanged; adding read tracking is out of scope |
| **Delay** | New messages from the other person show up after ≤ 10 s (≤ 30 s when idle) instead of ≤ 2 s | Your decision (§4); your own sent messages are instant |
| **Relationship check still per poll** | 2 extra small queries per poll on student-web | Fewer polls (§4) cut this about 5×; caching is out of scope |
| **`DISTINCT ON` raw SQL** | A typo in column quoting only fails at runtime | Route test runs against a mocked `$queryRaw` (checks args); the real SQL is NOT VERIFIED against Postgres in this batch (no database used); it should be run on staging before production |
| **Index build** | `CONCURRENTLY` takes longer, and leaves an INVALID index if it fails | Note in each migration; rollback file; run on staging first |
| **Teacher-web copies drift again** | Fixing only student-web leaves teacher-web loading full history | Every route change is made in all copies in the same step, with a test per copy |

---

## 9. Work order (one small commit per step, test commit before fix commit, no push)

1. `git switch -c fix/chat-load` from `fix/redis-rate-limits`.
2. **#1 route, student-web:** proof test (red), then cursor pagination in `students/chat/[teacherId]/route.ts` (green). Gate.
3. **#1 route, teacher-web `students/chat/[teacherId]`:** same; GET only. Gate.
4. **#1 route, teacher-web `teachers/chat/[studentId]`:** same; GET only. Gate.
5. **#1 page, student-web:** polling test (red), then a 10 s/30 s `setTimeout` loop, hidden-tab pause, idle backoff, cursor polling, merge by `id`, "load older" control, scroll fix (green). The existing `page.test.tsx` stays unchanged and green. Gate.
6. **#1 page, teacher-web `/student/chat`:** copy step 5 byte-for-byte. Gate.
7. **#1 page, teacher-web `/teacher/chat`:** the same logic with its field names. Gate.
8. **#2 route, student-web thread list:** test (red), then `groupBy` + `select` + `DISTINCT ON` (green). Gate.
9. **#2 routes, teacher-web thread lists ×2:** only if you answer yes to §0 Q1. Gate.
10. **#23 chat indexes:** **wait for your "go" (schema and migration).** `schema.prisma` `@@index` lines, 2 migration folders each with `migration.sql` and `rollback.sql`, migration test, `prisma validate` and `prisma migrate diff --script` output. **Not applied.** Gate.
11. *(Optional)* **#22 PaymentOrder indexes:** only on a separate "go" (payments plus migration). Gate.
12. Write `audit/FIX_BATCH_chat.md` (fixed items with real output, open items, migrations waiting, env vars (none expected), NOT VERIFIED). Stop.

Steps 2–9 touch no auth, payments, schema or deployment, so per your rules they need no extra "go". The only exceptions are the open questions in §0. Steps 10 and 11 need your explicit "go".

---

## 10. Files opened for this plan, and what wasn't

**Opened and quoted:**
- `apps/student-web/src/app/api/students/chat/route.ts` (1-101)
- `apps/student-web/src/app/api/students/chat/[teacherId]/route.ts` (1-213)
- `apps/student-web/src/app/(authenticated)/chat/page.tsx` (1-240), plus a grep of the render section (`:274-377`)
- `apps/student-web/src/app/(authenticated)/chat/page.test.tsx` (1-26)
- `apps/teacher-web/src/app/api/teachers/chat/[studentId]/route.ts` (1-95)
- `apps/teacher-web/src/app/api/teachers/chat/route.ts` (1-85)
- `apps/teacher-web/src/app/api/students/chat/[teacherId]/route.ts` (1-93)
- `apps/teacher-web/src/app/api/students/chat/route.ts` (1-75)
- `apps/teacher-web/src/app/teacher/chat/page.tsx` (1-130), plus a grep of the render section
- `apps/teacher-web/src/app/student/chat/page.tsx` (via `diff`: identical to student-web's page)
- `packages/database/prisma/schema.prisma` `ChatMessage` (433-446, read during the audit)
- Directory listing of `apps/student-mobile/src/screens`; greps of `apps/student-mobile/src` and `packages/api-contracts/src`

**NOT VERIFIED:**
- The render half of `teacher/chat/page.tsx` beyond the grepped lines (assumed to mirror student-web, based on matching line numbers `:274-286`).
- Whether `createdAt` is set by the Prisma engine or by a Postgres default.
- How `prisma migrate deploy` wraps multi-statement files (avoided by using one statement per file).
- Prisma 5.22 `distinct` / `groupBy` SQL (to be checked by query-count tests).
- The `DISTINCT ON` SQL against a real Postgres (no database is used in this batch).
- The real row counts in production `ChatMessage`, so how long the index build takes is unknown.
