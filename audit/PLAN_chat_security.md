# Plan: teacher-web chat message security (follow-up batch from FIX_BATCH_chat.md)

Branch `fix/chat-security`, cut from `fix/chat-load` @ `586be46`. Date 2026-10-19. **Status: waiting for "go".**

Target routes (teacher-web):
- `apps/teacher-web/src/app/api/teachers/chat/[studentId]/route.ts`: teacher ↔ student, GET + POST
- `apps/teacher-web/src/app/api/students/chat/[teacherId]/route.ts`: student ↔ teacher, GET + POST (the student UI served from teacher-web)
- Thread lists, for gap 2 only: `apps/teacher-web/src/app/api/students/chat/route.ts` and `apps/teacher-web/src/app/api/teachers/chat/route.ts`

Reference: `apps/student-web/src/app/api/students/chat/[teacherId]/route.ts`, called `SW` below.

---

## Decisions I need from you

1. **Rate limit number.** You asked for "the 11th message in a minute gets 429 (use the real limits student-web uses)". Those two don't match. student-web's real limit is `max: 30` per `60_000` ms (`SW:108`), so the **31st** message gets 429. **I recommend 30/min (same as student-web), with tests showing the 30th → 201 and the 31st → 429.** If you really want 10/min, say so. I'd then use 10 in teacher-web only, and the two apps would differ.
2. **Attachments:** option A or B (§5). I recommend **B**.
3. **Sharing `validateChatMessage`** through `@repo/api-contracts` (§3). I recommend sharing it. The other gaps get copies, with the reasons below.
4. **Also clean the teacher thread list** (`/api/teachers/chat`: `studentName`, `lastMessage`)? It has the same gap as the student thread list you named. I recommend yes, in the gap-2 commit.

---

## 1. Booking / relationship check

**student-web:** `verifyTeacherRelationship` at `SW:34-46`. It checks that `teacherProfile.findUnique({ userId: teacherId })` exists, then that `booking.findFirst({ studentId: userId, teacherId })` exists. Called in GET at `SW:60-66` and POST at `SW:116-122`. If either check fails: 403 `{ error: "You don't have a conversation with this teacher." }`. Any booking status counts, including PENDING and CANCELLED.

**teacher-web today:** no check in GET (`teachers/chat/[studentId]/route.ts:16-27`, `students/chat/[teacherId]/route.ts:14-25`) or POST (`:45-83`, `:43-81`).

**Plan (copy, not share):** add a new `apps/teacher-web/src/lib/chat-access.ts` with `hasBooking(studentId, teacherId): Promise<boolean>`, which runs `booking.findFirst({ where: { studentId, teacherId }, select: { id: true } })`.
- Teacher route: `hasBooking(studentId /*param*/, userId)`. Student route: `hasBooking(userId, teacherId /*param*/)`.
- On failure, both routes return 403 with student-web's wording, with "teacher" or "student" to match the route.
- I'm leaving out the `teacherProfile` lookup. `Booking.teacherId` is a FK to `TeacherProfile.userId` and `Booking.studentId` is a FK to `StudentProfile.userId` (`schema.prisma:230-231`), so a booking can only exist when the profile does. The result is the same with one query fewer.
- Why not shared: it needs the app's `prisma` client. No shared package currently takes a Prisma client for route-level checks, and adding one isn't a small change.
- POST order matches student-web: auth → body size → rate limit → relationship → parse body.

Tests (new `route.security.test.ts` next to each route): a user with no booking gets 403 on GET and on POST, and `chatMessage.create` is never called. A user with a booking gets 200/201.

## 2. HTML cleaning

**student-web:**
- Message GET: `stripHtml` on every `content` (`SW:80-85`).
- Thread list `apps/student-web/src/app/api/students/chat/route.ts`: `teacherName: sanitizeOrFallback(teacher.name, "")` at `:48`, and `lastMessage: lastMessage ? stripHtml(lastMessage.content) || "No messages yet" : "No messages yet"` at `:58`.
- `stripHtml` / `sanitizeOrFallback` live in `apps/student-web/src/lib/sanitize.ts:34-65`.

Content is stored raw and cleaned when it's sent out. The POST response echoes the sender's own raw input (`SW:203`).

**teacher-web today:**
- Message GETs return `page` as-is (`teachers/chat/[studentId]/route.ts:27`, `students/chat/[teacherId]/route.ts:25`).
- Thread lists return raw `lastMessage`/names (`students/chat/route.ts:57,60`; `teachers/chat/route.ts:59,62`).

**Plan (reuse what's already there):** teacher-web already has byte-identical `stripHtml` and `sanitizeOrFallback` in `apps/teacher-web/src/lib/sanitize.ts:41-72`. Nothing new to share; I'll import them and copy student-web's lines into:
- both message GETs: `content: stripHtml(m.content)`;
- `students/chat/route.ts`: the same two lines as student-web `:48`/`:58`;
- `teachers/chat/route.ts`: the same for `studentName`/`lastMessage` (if you agree to decision 4).

Tests: a stored message `<script>alert(1)</script>hi<b>!</b>` comes back as `alert(1)hi!` from both GETs, and the same goes for thread-list previews and names.

Note: React already escapes `{msg.content}`, so the browser pages weren't directly exploitable. This is defence in depth for other API consumers, and it brings teacher-web to parity.

## 3. Message length limit / validation

**student-web:** `validateChatMessage` in `apps/student-web/src/lib/validation.ts:518-538`:
- `content` must be a string if present;
- it's trimmed;
- max length is `MAX_CHAT_MESSAGE_LENGTH = 5_000` characters (`:522`).

It's used for multipart at `SW:130-140` and JSON at `SW:167-180`. Failures return 400 `{ code: "VALIDATION_ERROR", error, errors }`. Invalid JSON returns 400 `"Invalid JSON body."`; teacher-web currently returns 500 for that.

**teacher-web today:** `content = body.content || ""` with no type or length check (`teachers/...:55,62`, `students/...:53,60`).

**Plan (share, a small change):** move `validateChatMessage` + `MAX_CHAT_MESSAGE_LENGTH` into `packages/api-contracts/src/chat.ts`, exported from `packages/api-contracts/src/index.ts`.
- Both apps already depend on `@repo/api-contracts` (`apps/*/package.json`). It's already symlinked in `node_modules/@repo/`, and both already import from it in routes (e.g. `payments/create-order/route.ts:2`), so there's nothing to install and no build config to change.
- `apps/student-web/src/lib/validation.ts` re-exports it (`export { validateChatMessage, MAX_CHAT_MESSAGE_LENGTH } from "@repo/api-contracts"`), so student-web's route import and behaviour stay the same.
- teacher-web routes import it from `@repo/api-contracts`.
- The result type is structurally the same as both apps' `ValidationResult<T>` (`{ ok: true; data } | { ok: false; errors }`), so it can be used in either app without casts.
- I'll run student-web's existing validation tests (if any cover it) plus a new unit test in the package's consumer to show student-web didn't change.

Alternative if you'd rather not touch student-web: copy the 15 lines into `apps/teacher-web/src/lib/validation.ts`. That file's header says it mirrors student-web's (`:1-7`).

Tests: 5 000 chars → 201; 5 001 chars → 400 `VALIDATION_ERROR` on JSON and on multipart; `content: 123` → 400; invalid JSON → 400; `create` is never called on a rejection.

## 4. Rate limit (+ body-size guard)

**student-web:** `SW:103-111`:
- `exceedsMaxBodySize(request, MAX_ATTACHMENT_SIZE /*10 MB, SW:17*/)` → 413;
- then `rateLimitRedis(userId, "chat-send", { windowMs: 60_000, max: 30 })` → 429 `"Too many messages. Please slow down."`.

POST only; GET isn't limited.

**teacher-web today:** neither.

**Plan (reuse the fixed limiter):** teacher-web's `apps/teacher-web/src/lib/rate-limit.ts` is already the fixed version from the Redis batch (`fc5cb09`, `a9aaec9`, `23196e8`: shared client, in-process fallback on Redis error). It's byte-identical to student-web's. No new code; I'll copy the same two guards into both POST handlers.
- Same namespace `"chat-send"`, keyed by user id, so a user's sends through student-web and teacher-web share one 30/min bucket when both apps use the same Redis. That's intended: one user, one limit.

Tests: run against the **real** `rateLimitRedis` with `REDIS_URL` unset, so the in-process limiter is used. This is the path the `rate-limit.test.ts` files already use.
- 30 POSTs → 201; the 31st → 429 (per decision 1).
- A different user still gets 201.
- `Content-Length` above 10 MB → 413.

## 5. Attachments

**student-web:** `SW:142-165`. It reads the bytes and calls `uploadFile(buffer, file.name, file.type, { folder: "chat-attachments", allowedTypes: ALLOWED_ATTACHMENT_TYPES /*jpeg,png,gif,webp,pdf — SW:10-16*/, maxSizeBytes: 10 MB })`, then stores `uploaded.url`. Upload errors → 400 with the message.

**teacher-web today:** `attachmentUrl = file.name` (`teachers/chat/[studentId]/route.ts:56-59`, `students/chat/[teacherId]/route.ts:54-57`). The file is thrown away, and the "URL" is just the filename.

Things I found that apply to **both** options:
- `uploadFile` (`apps/teacher-web/src/lib/storage.ts:63-93`; same in student-web) takes the stored **extension from the client's filename** (`:81-83`), and checks only the **client-claimed** MIME type. With `STORAGE_PROVIDER=local`, the file is written under `public/uploads/`. So `evil.html` sent as `image/png` is stored and served as `…/chat-attachments/123_ab.html` from the app's own origin, which is stored XSS. **This already affects student-web's chat today**, and teacher-web's `api/auth/upload`.
- Both apps' chat pages render `msg.attachmentUrl` as plain text, not a link (`teacher/chat/page.tsx:485-491`, `student/chat/page.tsx:485-491`, student-web `chat/page.tsx:485-491`). Even student-web's working uploads show up as a URL string.
- Stored URLs are public to anyone who has them; GET doesn't check access to the file.

**Option A: reject attachments for now.**
- A multipart POST with a non-empty `file` → 400 `"Attachments are not supported yet."`.
- To avoid silent failures I'd also remove the paperclip / `type="file"` input from the two teacher-web chat pages (`teacher/chat/page.tsx:~532`, `student/chat/page.tsx:~532`).
- Pros: smallest change, no storage dependency, no new attack surface.
- Cons: `/student/chat` on teacher-web is a byte-identical copy of student-web's page (FIX_BATCH_chat step 6), and that copy would stop being identical. Teachers can't send files.

**Option B (recommended): real upload, copying student-web, with one hardening change.**
- Copy `SW:10-17` and `SW:142-165` into both teacher-web POSTs, using teacher-web's own `@/lib/storage`. teacher-web's copy differs from student-web's only in SDK loading and `getStorageInfo`; `uploadFile` is the same.
- Hardening (teacher-web chat only): pass a filename built from the **validated MIME type** (`attachment.png`, `.pdf`, …) instead of `file.name`, so the stored extension always matches an allowed type. Then the `.html` trick above can't happen for these routes. The original name is still sent as `content` by the pages (`page.tsx:253`).
- Pros: parity, and the feature works. The storage layer already exists and is already used in teacher-web (`api/auth/upload/route.ts`).
- Cons: prod must have `STORAGE_PROVIDER` set to `s3`/`supabase`, because `local` writes to the instance disk, which doesn't persist on serverless. That's NOT VERIFIED; I can't see the prod env. Files stay publicly reachable by URL.
- Out of scope, flagged for later: the same extension fix in `storage.ts` itself (fixes student-web chat and `auth/upload` too), and rendering attachments as links.

Tests (B):
- a 1-byte PNG `File` → `uploadFile` is called with folder `chat-attachments`, the allowed types, 10 MB, and a safe filename, and the message is stored with the returned URL (not the filename);
- `text/html` → 400 and nothing stored;
- `evil.html` claimed as `image/png` → stored filename ends `.png`;
- an upload error → 400.

`@/lib/storage` is mocked in these tests (no disk writes).

---

## Every caller of these routes

| Route | Caller (file:line) |
|---|---|
| teacher-web `GET /api/teachers/chat/[studentId]` | `apps/teacher-web/src/app/teacher/chat/page.tsx:98` (poll/first load), `:130` (older page) |
| teacher-web `POST /api/teachers/chat/[studentId]` | `apps/teacher-web/src/app/teacher/chat/page.tsx:227` (JSON send), `:256` (multipart file) |
| teacher-web `GET /api/students/chat/[teacherId]` | `apps/teacher-web/src/app/student/chat/page.tsx:98`, `:130` |
| teacher-web `POST /api/students/chat/[teacherId]` | `apps/teacher-web/src/app/student/chat/page.tsx:227`, `:256` |
| teacher-web `GET /api/students/chat` (thread list) | `apps/teacher-web/src/app/student/chat/page.tsx:77` |
| teacher-web `GET /api/teachers/chat` (thread list) | `apps/teacher-web/src/app/teacher/chat/page.tsx:77` |
| Tests | `api/teachers/chat/[studentId]/route.test.ts`, `api/students/chat/[teacherId]/route.test.ts`, `api/students/chat/route.test.ts`, `api/teachers/chat/route.test.ts`, `teacher/chat/page.polling.test.tsx`, `student/chat/page.polling.test.tsx` (all under `apps/teacher-web/src/app/`) |

No other callers: `apps/student-mobile` and `apps/admin-panel` have no references (searched `(students|teachers)/chat` across `apps/`, `packages/`, `tests/`).

**Client impact:** the pages treat any non-OK as a failure and only `console.error` (`page.tsx:232`, `:260`). A new 403/400/413/429 therefore shows up as "message not sent, text stays in the box", with no user-facing error message. The existing pagination tests already mock `booking.findFirst → { id }`, so they keep passing. I'm not changing UI error handling unless you ask (it's not in this batch).

## Steps after "go"

One commit per gap, in order 1 → 5 (+ the api-contracts move inside commit 3). For each commit:
1. Write the failing test, run it, and paste the real failure.
2. Fix, run it, and paste the real pass.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:payments`. Expected: everything green except `test:payments` with 1 failed (#12, `09-secret-scan`) + 2 skipped.

Not pushed. At the end: `audit/FIX_BATCH_chat_security.md`.

Note: this is one commit per gap, as you asked here. That differs from the one-commit-per-file habit used in earlier batches.
