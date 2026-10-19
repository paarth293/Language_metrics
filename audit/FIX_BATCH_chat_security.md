# Fix batch: teacher-web chat security (follow-up from FIX_BATCH_chat.md)

Plan: `audit/PLAN_chat_security.md`. Branch `fix/chat-security`, cut from `fix/chat-load` @ `586be46`. 6 commits. **Not pushed.** Date 2026-10-19.

Decisions applied (from your "GO"):
1. Rate limit 30/min, same as student-web.
2. Attachments: option B (real upload) with hardening.
3. Only the length check is shared, through `@repo/api-contracts`.
4. Both thread lists are cleaned in one commit.
5. The shared upload helper is fixed in its own commit.
6. The chat pages' error handling is unchanged.

| # | Commit | What |
|---|---|---|
| 1 | `cbbdfb3` | Booking check (403) on GET + POST of both teacher-web message routes |
| 2 | `2444868` | `stripHtml` on both message GETs and both thread lists |
| 3 | `a0610b6` | `validateChatMessage` moved to `@repo/api-contracts`; 5000-char limit in teacher-web |
| 4 | `4ddd9cc` | Rate limit 30 / 60 s (429) + 10 MB body guard (413) on both POSTs |
| 5 | `f2dedd3` | `uploadFile` (both apps): checks the bytes against the claimed type; extension from the checked type; random name |
| 6 | `ab7e97b` | teacher-web chat attachments are really uploaded (images + PDF, 10 MB) |

Routes changed (teacher-web):
- `api/teachers/chat/[studentId]/route.ts`
- `api/students/chat/[teacherId]/route.ts`
- `api/teachers/chat/route.ts`
- `api/students/chat/route.ts`

Shared or other files:
- `packages/api-contracts/src/chat.ts` (new)
- `apps/student-web/src/lib/validation.ts` (re-export)
- `apps/{student,teacher}-web/src/lib/storage.ts`

The two message routes are now the same apart from role, booking direction and the existing `dynamic` export (checked with a normalised diff).

---

## Checks

Baseline is the one recorded in FIX_BATCH_chat.md at `586be46`:
- typecheck EXIT 0
- lint EXIT 0
- `npm test` 480 passed
- `test:payments` 1 failed / 180 passed / 2 skipped

My own baseline run overlapped with my first edits, so I didn't use it (see "Things that happened").

| After step | typecheck | lint | `npm test` | `test:payments` |
|---|---|---|---|---|
| 1 booking | EXIT 0 | EXIT 0 | EXIT 0, 488 passed | 1 failed (#12) / 180 passed / 2 skipped |
| 2 HTML | EXIT 0 | EXIT 0 | EXIT 0, 492 passed | same |
| 3 length | EXIT 0 | EXIT 0 | EXIT 0, 504 passed | same |
| 4 rate limit | EXIT 0 | EXIT 0 | EXIT 0, 512 passed | same |
| 5 upload helper | EXIT 0 | EXIT 0* | EXIT 0, 549 passed | same |
| 6 attachments | EXIT 0 | EXIT 0 | EXIT 0, 561 passed | same |

\* The first run of step 5 failed lint: `security/detect-object-injection` on `FILE_TYPES[contentType]` in student-web. Changing it to a `Map` fixed this; the full gate was then re-run and is shown above.

The only `test:payments` failure each time is the known one:
```
FAIL  tests/payment-security/09-secret-scan.test.ts > 9. secret scan > git history > no private key material anywhere in git history
AssertionError: private key: -----BEG**** at commit 159f42f43c3f: expected [ Array(1) ] to deeply equal []
Tests  1 failed | 180 passed | 2 skipped (183)
```

---

## Issues fixed (real test output)

Tests are in `route.security.test.ts` next to each teacher-web message route. The two files are identical apart from role and names, so each "before" below shows up once per route.

### 1. No booking check (`cbbdfb3`)

New `apps/teacher-web/src/lib/chat-access.ts` with `hasBooking(studentId, teacherId)`, which runs `booking.findFirst`, any status. It's called in GET and POST:
- teacher route: `hasBooking(studentId param, caller)`
- student route: `hasBooking(caller, teacherId param)`

On failure, 403 `"You don't have a conversation with this student."` / `"…teacher."`.

This is copied, not shared, because it needs the app's Prisma client. It leaves out student-web's `teacherProfile` lookup: `Booking`'s foreign keys mean a booking can only exist when both profiles do.

Before:
```
× GET returns 403 when the teacher has no booking with the student
× POST returns 403 when the teacher has no booking with the student, and stores nothing
× looks the booking up as (student = URL param, teacher = caller)
AssertionError: expected 200 to be 403 // Object.is equality
AssertionError: expected 201 to be 403 // Object.is equality
AssertionError: expected [] to deeply equal [ { …(2) } ]
Tests  6 failed | 2 passed (8)
```
After: `Test Files 6 passed (6)  Tests 31 passed (31)`, across all teacher-web chat route tests, including the existing pagination ones.

### 2. No HTML cleaning (`2444868`)

These now use teacher-web's existing copies of `stripHtml` / `sanitizeOrFallback` (`lib/sanitize.ts`, the same code as student-web's):
- Message GETs: `content: stripHtml(m.content)`.
- `/api/students/chat` and `/api/teachers/chat` thread lists: names go through `sanitizeOrFallback(name, "")`; previews through `stripHtml(...) || "No messages yet"`. This is word-for-word what student-web's thread list does.

The step-9a tests pinned the unescaped preview `"<b>reply</b> 1"`. They now expect `"reply 1"`.

Before:
```
× returns the same thread shape, newest conversation first      (both thread lists)
× removes HTML from student names and message previews
  Expected: "Evex"   Received: "<img src=x onerror=alert(1)>Eve<script>x</script>"
× removes HTML from teacher names and message previews           (same)
× GET removes HTML from message content                          (both message routes)
  AssertionError: expected [ Array(1) ] to deeply equal [ 'alert(1)hi!' ]
Tests  6 failed | 29 passed (35)
```
After: `Tests 35 passed (35)`.

### 3. No length limit / validation (`a0610b6`)

`validateChatMessage` + `MAX_CHAT_MESSAGE_LENGTH` (5 000) moved **unchanged** from student-web's `lib/validation.ts` to `packages/api-contracts/src/chat.ts`, exported from the package index.
- student-web's `validation.ts` re-exports them, so its route and `validation.test.ts` didn't change; they pass, 24/24 in student-web's validation + chat tests.
- Both teacher-web POSTs use the multipart and JSON branches from student-web:
  - 400 `{ code: "VALIDATION_ERROR", error, errors }`;
  - content is trimmed;
  - invalid JSON → 400 `"Invalid JSON body."` (it was 500).

Before:
```
× rejects a 5001-character JSON message with 400 and stores nothing
× rejects a 5001-character multipart message with 400 and stores nothing
× rejects non-string content with 400
× rejects an invalid JSON body with 400, not 500
× trims the stored content
AssertionError: expected 201 to be 400 // Object.is equality
AssertionError: expected 500 to be 400 // Object.is equality
AssertionError: expected '  hi  ' to be 'hi' // Object.is equality
Tests  10 failed | 12 passed (22)
```
After: `Tests 22 passed (22)`. A 5 000-character message → 201.

### 4. No rate limit (`4ddd9cc`)

Copied student-web's two guards into both POSTs, using teacher-web's copy of the fixed limiter (from FIX_BATCH_redis; no new limiter code):
- `exceedsMaxBodySize(request, 10 MB)` → 413 `"Request body too large."`;
- `rateLimitRedis(userId, "chat-send", { windowMs: 60_000, max: 30 })` → 429 `"Too many messages. Please slow down."`.

The order matches student-web: auth → body size → rate limit → booking → parse.

The tests use the **real** limiter with `REDIS_URL` empty, so it runs in-process, with fresh modules for each test.

Before:
```
× lets the 30th message in a minute through and answers the 31st with 429
× rejects a body over 10 MB with 413 before reading it
AssertionError: expected 201 to be 429 // Object.is equality
AssertionError: expected 400 to be 413 // Object.is equality
Tests  4 failed | 26 passed (30)
```
After: `Tests 30 passed (30)`. Messages 1–30 → 201, the 31st → 429, and 30 stored. A second user still gets 201, and GET isn't limited.

### 5 (your item 5). The shared upload helper trusted the client's type and filename (`f2dedd3`)

`uploadFile` in **both** `apps/student-web/src/lib/storage.ts` and `apps/teacher-web/src/lib/storage.ts` (still two copies):
- After the caller's allow-list and size checks, the claimed type must be in a fixed table, and the file's first bytes must match it:
  - JPEG `FF D8 FF`
  - PNG signature
  - `GIF87a`/`GIF89a`
  - `RIFF…WEBP`
  - `%PDF-`
  - HEIC/HEIF `ftyp` + brand
- Otherwise it throws `File type "<t>" is not supported.` / `File type "<t>" does not match the file's contents.` Both messages start with "File type", so `auth/upload`'s existing error mapping returns 400 for them.
- Stored name: `<folder>/<Date.now()>_<full randomUUID>.<ext from the table>`. The client's filename is no longer used; the parameter stays so callers don't change.

Proof test (`src/lib/storage.content-type.test.ts`, identical in both apps), before:
```
× rejects evil.html sent as image/png
AssertionError: promise resolved "{ …(4) }" instead of rejecting
× stores real PNG bytes named evil.html with a .png extension
AssertionError: expected false to be true // Object.is equality
× uses a random stored filename, not the client's
× rejects a file whose bytes are a different allowed type than claimed
× rejects a type the caller allows but the helper cannot check
× accepts real image/jpeg bytes and stores them as .jpg whatever the filename says   (…and 8 more types)
Tests  14 failed | 1 passed (15)          (each app)
```
After: `Tests 15 passed (15)` in each app.

**Both callers still work.** The caller tests use the real helper and local storage, and delete what they store. Run against the old helper (two `storage.ts` files stashed), then the new one:
```
--- OLD helper
teacher-web api/auth/upload/route.test.ts
  × rejects evil.html sent as image/png with 400                                   expected 201 to be 400
  × rejects an untyped evil.html (route falls back to application/pdf) with 400    expected 201 to be 400
  Tests  2 failed | 3 passed (5)
student-web api/students/chat/[teacherId]/route.attachments.test.ts
  × rejects evil.html sent as image/png with 400 and stores no message             expected 201 to be 400
  Tests  1 failed | 1 passed (2)
--- NEW helper
  Tests  5 passed (5)        (auth/upload: real PDF, real PNG, untyped PDF all 201; both evil.html → 400)
  Tests  24 passed (24)      (student-web: chat PNG → 201 with /uploads/chat-attachments/….png; evil.html → 400; storage tests)
```

student-web's existing `storage.test.ts` used `"fake-image-bytes-for-test"` as `image/png`. That's now rejected, as intended, so the fixture starts with a real PNG signature.

### 6. Attachments only saved the filename (`ab7e97b`)

Copied student-web's block into both teacher-web POSTs:
- `ALLOWED_ATTACHMENT_TYPES` (JPEG, PNG, GIF, WebP, PDF) and a 10 MB limit;
- `uploadFile(..., { folder: "chat-attachments" })` → `attachmentUrl = uploaded.url`;
- any upload error → 400 with the message, and no message stored;
- an empty file field means no attachment.

The hardening you asked for (allow-list, extension from the checked type, random name, size limit) comes from this allow-list plus the helper from commit 5.

Before:
```
× uploads an image and stores its real URL, not the filename
  AssertionError: expected 'photo.png' to match /^\/uploads\/chat-attachments\…/
× uploads a PDF                      expected 'notes.pdf' to match /^\/uploads\/chat-attachments\…/
× rejects a type outside images and PDF with 400 and stores nothing     expected 201 to be 400
× rejects evil.html sent as image/png with 400 and stores nothing       expected 201 to be 400
× rejects an image over 10 MB with 400 and stores nothing               expected 201 to be 400
× treats an empty file field as no attachment                           expected 'empty.png' to be undefined
```
(The PDF test first passed by accident, since `notes.pdf` ends in `.pdf`. I tightened it to require an `/uploads/` URL and showed it failing, as above, before the fix.)

After: `Test Files 6 passed (6)  Tests 67 passed (67)` across all teacher-web chat route tests.

---

## Behaviour changes to know about

- **Clients get new statuses:**
  - 403 (no booking);
  - 400 (validation, invalid JSON, bad attachment);
  - 413 (body > 10 MB);
  - 429 (31st message in 60 s).

  The teacher-web chat pages only `console.error` a non-OK response (unchanged, per decision 6), so the user sees the message not being sent. See the follow-ups.
- **The rate limit is checked before the booking check** (same as student-web), so attempts that get 403 still count towards the 30.
- **One bucket across both apps:** the key is `rl:chat-send:<userId>`, so when both apps share Redis, a user's sends through student-web and teacher-web count together.
- **`/api/auth/upload` (teacher registration):**
  - Files must now really be what they claim to be.
  - The route's existing fallback labels untyped files with an unknown extension as `application/pdf`, so those are now rejected unless they really are PDFs.
  - HEIC/HEIF must carry a known brand (`heic`, `heix`, `hevc`, `hevx`, `heim`, `heis`, `hevm`, `hevs`, `mif1`, `msf1`).
  - Stored keys now use a full UUID (`temp/<ts>_<uuid>.<ext>`) instead of 8 characters.
- **`uploadFile` now rejects any type outside its table**, even if a caller allows it. No current caller allows other types.
- **Existing data:** messages sent through teacher-web before this batch still have `attachmentUrl` = a bare filename. Nothing was migrated.

## Things that happened during the batch

- **Baseline overlap.** I started the baseline run in the background and began writing tests while it ran. Its results (2 test failures, 2 lint warnings) came from my half-finished edits, so I used FIX_BATCH_chat's recorded numbers for `586be46` as the baseline instead. Every per-step gate in the Checks table ran with no edits in progress.
- **Splitting gaps 1 and 2.** I had written the gap-2 changes before committing gap 1. To keep one commit per gap, I saved the files to the scratchpad, reversed the gap-2 hunks, ran the full gate on gap 1 alone and committed, then restored gap 2. Gap 2's failing run was taken on top of the gap-1 code.
- **Upload folders made by tests.** The storage/caller/attachment tests write through the local provider into `apps/*/public/uploads/` (git-ignored) and delete their files. They leave empty folders behind, which I removed by exact path after each run. A glob `rmdir` was blocked by a safety check and not run. The tests deliberately don't `rm -r` the shared `temp`/`chat-attachments` folders, because a developer's real uploads could be in them.
- **Commit granularity:** one commit per gap, as you asked here. The memory note about one commit per file was not followed for this batch.

## NOT VERIFIED

- **Production storage provider.** Whether prod sets `STORAGE_PROVIDER=s3`/`supabase`. With `local`, uploads go to the instance's disk, which doesn't last on serverless/multi-instance. I can't see the prod env.
- **Real S3/Supabase uploads** with the new keys. Only the local provider was exercised.
- **Real browsers.** Whether real browsers send the types the byte check expects (e.g. iPhone HEIC photos in teacher registration, which may be sent with no type or as `image/heic`). Only constructed `File` objects were tested.
- **Real Redis.** The 429 tests use the in-process limiter (`REDIS_URL` empty). The Redis path is the same code tested in FIX_BATCH_redis.
- **Real Postgres.** `booking.findFirst` is mocked; no database was used.
- No dev server was started; the pages weren't exercised in a browser.

## Follow-ups (not done)

1. **Chat pages: show a "message not sent" notice with the reason on 403/400/429** (and 413). Today `handleSend` / `handleFileUpload` only `console.error` (`teacher/chat/page.tsx`, `student/chat/page.tsx` in teacher-web, and student-web's `chat/page.tsx`, around lines 232 and 260).
2. **Attachments render as plain text**: `{msg.attachmentUrl}` is shown, not linked, in all three chat pages (around lines 485–491). Now that teacher-web stores real URLs, users will see a raw `/uploads/…` path.
3. **Uploaded files are public by URL.** No access check when fetching an attachment (both apps).
4. **`storage.ts` is still two copies** (student-web / teacher-web). They now share the same `uploadFile`, but S3/Supabase loading and `getStorageInfo` still differ. They could become one package.
5. **Still open from before:** #22 (PaymentOrder indexes), dropping `ChatMessage_senderId_receiverId_idx`, unread counts (hard-coded 0), #12 (key in git history).
