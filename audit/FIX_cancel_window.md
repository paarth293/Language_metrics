# FIX_cancel_window.md — the 4-hour student cancellation window

Branch `fix/cancel-window`, made from `fix/perf` @ `ae49146`. Not pushed.

---

## Read this first: a 12-hour rule already exists, and 4 hours loosens it

Student cancellation is **not** currently unrestricted. Both web cancel routes already refuse a
cancel inside **12 hours** of the start time, and both UIs already disable the button on the same
rule. Moving the window to 4 hours therefore **lets students cancel in cases that are refused
today** — between 4 and 12 hours before the class.

That is the opposite direction from "inside the last 4 hours the student cancel must be refused",
which reads as though nothing stops a late cancel today. Something does.

The instruction was explicit and numeric ("one named constant (4 hours)", "exactly 4 hours is
allowed"), so **4 hours is implemented as specified**. Flagging it because it is a policy
loosening, it affects refunds, and it is trivially reversible: change one constant in
`packages/live-classes/src/cancel-window.ts` and the whole system follows.

Other things the task assumed that the code does not do:

| Assumption in the task | What the code actually shows |
|---|---|
| The mobile `/api/v1/bookings` route is a student cancel path | That route is **POST-only and creates bookings**. There is no mobile cancel endpoint, no cancel method in the mobile API client, and no cancel control in the mobile UI. Nothing to change, nothing to guard |
| A teacher cancel exists and fully refunds the student | **There is no teacher cancel path anywhere in the repo.** A teacher cannot cancel a class. So "the student is fully refunded when a teacher cancels" could not be confirmed, because the behaviour does not exist to confirm |

---

## STEP 1 — every cancel path, as found

### Student cancel paths (the two that exist)

| # | Path | Who can call it | Time rule today |
|---|---|---|---|
| 1 | [route.ts:19](../apps/student-web/src/app/api/students/classes/%5Bid%5D/cancel/route.ts#L19) `POST /api/students/classes/[id]/cancel` (student-web) | `requireAuth(request, "STUDENT")`, then an ownership check at `:47`. Rate limited to 20/min at `:26` | **Yes, 12 h.** `CANCELLATION_WINDOW_HOURS = 12` at `:17`, enforced `:57-70`, refused with **400** |
| 2 | [route.ts:8](../apps/teacher-web/src/app/api/students/classes/%5Bid%5D/cancel/route.ts#L8) `POST /api/students/classes/[id]/cancel` (teacher-web's copy of the student route) | Same `requireAuth(…, "STUDENT")` and ownership check. **No rate limit** | **Yes, 12 h**, but written as an inline `12 * 60 * 60 * 1000` magic number at `:48`, refused with **400** |

The two copies had already drifted: different comments, different message text, one has a rate
limit and one does not, one loads every session and the other `take: 1`. The rule itself was the
same number written twice.

### The shared cancel-and-refund function (unchanged by this work)

[settlement.ts:518](../packages/live-classes/src/settlement.ts#L518) `cancelBookingAndReturnCoins(bookingId, reason)`

- Called **only** from the two student routes above.
- Contains **no time rule**, and still contains none. Per decision 8 this file is not touched.
- Flips `Booking.status` to `CANCELLED` with a conditional `updateMany`, so two concurrent cancels
  cannot both refund; the loser throws `BookingNotCancellableError`. That is where idempotency
  actually lives.
- Then releases every `HELD` billing row, or refunds `amountPaid` once for a legacy booking that
  was spent up front, or returns 0 coins for a booking that never had a hold.

### Non-student cancels

| Path | Who | Refund | Blocked by the new rule? |
|---|---|---|---|
| [actions.ts:7](../apps/admin-panel/src/app/%28dashboard%29/classes/%5Bid%5D/actions.ts#L7) `updateSessionStatus(sessionId, bookingId, "CANCELLED")` | Admin with the `classes:manage` permission. Called from the session row at [page.tsx:116](../apps/admin-panel/src/app/%28dashboard%29/classes/%5Bid%5D/page.tsx#L116) | **None.** It writes `ClassSession.status` and nothing else: no booking status change, no coin release, so the student's hold stays `HELD` | **No.** Different function, different file, never calls the window check |
| Teacher cancel | **Does not exist** | n/a | n/a |
| System cancel (no-show, settlement, reconcile) | **Does not exist as a cancel.** The only crons are `reconcile-payments` and `reconcile-sessions`, and neither writes a `CANCELLED` status | n/a | **No** |

Searching for every write of `status: "CANCELLED"` in the repo returns exactly two lines, both
inside `cancelBookingAndReturnCoins` ([settlement.ts:525](../packages/live-classes/src/settlement.ts#L525)
and [:538](../packages/live-classes/src/settlement.ts#L538)), plus the admin action which receives
the status as an argument. There is no other way for anything to become cancelled.

**Worth raising separately:** an admin "Cancel Session" leaves the coin hold in place. The student
is not refunded and the coins are not released. That is pre-existing, outside this task, and not
changed here, but it is the one cancel path with no money handling at all.

### Cancel controls in the UIs

| UI | Control | Rule today |
|---|---|---|
| student-web | [classes/page.tsx:130](../apps/student-web/src/app/%28authenticated%29/classes/page.tsx#L130) `canCancel()`, button at `:388`, note at `:399` | Client-side 12 h, inline `12 * 60 * 60 * 1000`. Note reads "Free cancellation until 12h before class" |
| teacher-web | [student/classes/page.tsx:107](../apps/teacher-web/src/app/student/classes/page.tsx#L107) `canCancel()`, button at `:327` | Client-side 12 h, same inline magic number. No explanatory note at all |
| mobile | none | The Classes screen has a "cancelled" **filter** only. No cancel action exists |

### How the start time is stored

| Question | Answer |
|---|---|
| Field | `ClassSession.scheduledStart`, [schema.prisma:246](../packages/database/prisma/schema.prisma#L246) |
| Type | Prisma `DateTime`, no `@db.Date` and no `@db.Time`, so a full timestamp |
| UTC or local | **An absolute instant.** Prisma hands it back as a JS `Date`, so any comparison against another `Date` is an absolute-time comparison and is therefore UTC-correct with no conversion. There is no stored wall-clock time and no stored zone for a session |
| Does `Booking` have its own start time | **No.** A booking's start is its first session's `scheduledStart`, which is why both routes order `sessions` by `scheduledStart` ascending and read `[0]` |
| Reschedule | [booking.ts:379](../packages/live-classes/src/booking.ts#L379) writes the new `scheduledStart`, so the window automatically measures from the new time, satisfying decision 9 with no extra code. `originalStart` exists only to anchor the *reschedule* window and is deliberately not used here |

One inherited behaviour kept on purpose: for a multi-session booking the window is measured from
the **earliest session of the booking**, including one already in the past, because that is what
`sessions[0]` means today. So a course booking whose first class has happened cannot be cancelled
by the student at all. That is pre-existing, it is not what this task asked about, and changing the
anchor would silently change who may cancel, so it is left alone and recorded here.

---

## STEP 2 — what changed, commit by commit

Eight commits on `fix/cancel-window`, oldest first. Nothing is pushed.

| Commit | What it does |
|---|---|
| `b6bfe4f` | **The rule.** New `packages/live-classes/src/cancel-window.ts`: `STUDENT_CANCEL_WINDOW_HOURS = 4`, `canStudentCancel`, `studentCancelClosesAt`, the refusal message and the UI note. Imports nothing, so a client component can use it |
| `22e7107` | student-web's cancel route calls the shared rule. Refusal becomes **409** with `code` and `cancelClosesAt`, keeping `error` |
| `7ffe8aa` | teacher-web's copy of that route, same change, same test |
| `1865885` | Both class-list routes send `cancelClosesAt` per booking, so no UI restates the number |
| `d0b7cd4` | student-web's Cancel button reads that deadline. Adds the `./cancel-window` subpath export. Uses `useNow` so the button disables itself as the deadline passes |
| `6c3e496` | teacher-web's student classes page, same change |
| `4fa41a4` | Wiring test: the rule gates the two student routes and **nothing else** |
| `cb01164` | Admin cancel still works inside the window |

### The four checks, after every commit

`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:payments` ran after each step and all
four exited 0 every time. The last full run:

```
typecheck  exit=0
lint       exit=0
test       exit=0     789 passed, 0 failed
payments   exit=0     217 passed | 2 skipped (219)
```

The 2 skips are the known ones. **No `#12` failure appeared** — the suite is fully green on this
branch, so there was no permitted failure to lean on.

Two wall-clock tests (`apps/student-web/src/lib/storage.timeout.test.ts`,
`apps/teacher-web/src/lib/outbound.timeout.test.ts`) assert real elapsed-time budgets and fail when
the machine is busy. They passed in every run above. Re-run them alone before calling either a
regression.

### Real test output

The rule, against a frozen clock — `packages/live-classes/src/cancel-window.test.ts`:

```
 ✓ the window itself > is four hours, in one place
 ✓ the window itself > builds its wording from the constant rather than repeating the number
 ✓ the window itself > closes exactly four hours before the start
 ✓ canStudentCancel > allows a cancel five hours before the class
 ✓ canStudentCancel > allows a cancel at exactly four hours
 ✓ canStudentCancel > refuses a cancel at three hours fifty-nine minutes
 ✓ canStudentCancel > refuses one millisecond inside the window
 ✓ canStudentCancel > refuses a cancel at the start time
 ✓ canStudentCancel > refuses a cancel after the class has started
 ✓ canStudentCancel > refuses a class far in the past
 ✓ canStudentCancel > compares absolute instants, so a zone offset cannot change the answer
 ✓ canStudentCancel > fails closed on an unusable start time
 ✓ canStudentCancel > defaults to the current time when no clock is passed

 Test Files  1 passed (1)
      Tests  13 passed (13)
```

The route — student-web (teacher-web's copy is the same plus one case, 12 in total):

```
 ✓ the 4-hour window > allows a cancel five hours before the class
 ✓ the 4-hour window > allows a cancel at exactly four hours
 ✓ the 4-hour window > refuses a cancel at three hours fifty-nine minutes, with the deadline in the body
 ✓ the 4-hour window > refuses a cancel after the class has started
 ✓ the 4-hour window > keeps the refusal body backward compatible by still sending `error`
 ✓ everything around the window > still releases the coin hold exactly as before on an allowed cancel
 ✓ everything around the window > is idempotent: a second cancel refunds nothing again
 ✓ everything around the window > refuses to cancel a completed booking
 ✓ everything around the window > does not let a student cancel someone else's booking
 ✓ everything around the window > returns 404 for a booking that does not exist
 ✓ everything around the window > allows a cancel when the booking has no session at all

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

teacher-web's extra case is `refuses a direct API call inside the window, with no UI involved`.

The UI — both pages, 7 cases each:

```
 ✓ leaves Cancel enabled when the class is more than four hours away
 ✓ leaves Cancel enabled just outside the window
 ✓ disables Cancel inside the last four hours
 ✓ disables Cancel once the class has started
 ✓ tells the student when cancellation closes
 ✓ shows the same note while cancelling is still allowed
 ✓ no longer promises a twelve-hour window anywhere on the page
```

Scope (6), list routes (4 each) and admin (4) round it out: **68 new tests**, 789 total.

### Each test failed first, for real

| Step | Real failure on the old code |
|---|---|
| The rule | `Error: Cannot find module './cancel-window'` |
| student-web route | 5 failures: `expected 400 to be 200` twice, `expected 400 to be 409` twice, and `expected 'Cannot cancel within 12 hours of the …' to contain '4'` |
| teacher-web route | The same 5, plus the direct-API case: 6 |
| List routes | 3 failures, `expected undefined to be '2026-10-21T08:00:00.000Z'` and two like it |
| Both UIs | 4 failures each: `expected true to be false` for the two buttons that should now be enabled, and `Unable to find an element with the text: Cancellation closes 4 hours before the class.` twice |
| Scope test | Holds already, so it was checked the other way: adding a `canStudentCancel` mention to `settlement.ts` fails it. That edit was reverted |

One mistake worth recording, because it nearly produced a false result. The first UI test matched the
button with `/Cancel/i`, which also matches the **"cancelled" tab button**, so the assertions read the
wrong element and the pass/fail pattern came out inverted. The page was correct; the test was wrong.
It is now anchored to `/^Cancel$/`. Had that not been checked against a printout of the rendered
buttons, a "fix" would have been applied to working code.

---

## Decisions, and how each was met

| # | Decision | How |
|---|---|---|
| 1 | One shared function used by every student cancel path | `canStudentCancel` in `packages/live-classes`. Both existing student paths call it. The third path named in the brief, mobile, **does not exist** |
| 2 | One named constant, no magic number in routes or UI | `STUDENT_CANCEL_WINDOW_HOURS`. The wiring test asserts no route carries `12 * 60 * 60 * 1000` or its own window constant, and the UIs receive the boundary from the server |
| 3 | Allowed at `>= 4h`, exactly 4 h allowed, UTC, server clock | Exactly 4 h and 4 h minus 1 ms are both pinned against a frozen clock. The comparison is absolute-instant, so it is UTC-correct with no conversion. `now` defaults to the server's clock and no caller passes anything else |
| 4 | 409, clear message, earliest-cancel time in the body, backward compatible | 409 with `error`, `code: "CANCEL_WINDOW_CLOSED"` and `cancelClosesAt`. **Naming note:** the field is the *deadline*, the last instant a cancel is accepted, which is what "earliest-cancel time" seemed to mean. Say the word if you want it renamed |
| 5 | UI disables the button and shows the note | Both web UIs. The note shows either side of the deadline, not only while cancelling is still allowed. Mobile has no cancel control to disable |
| 6 | Teacher, admin, system cancels not blocked | Asserted behaviourally for admin and structurally for all of them. **A teacher cancel does not exist, so "fully refunded on teacher cancel" could not be confirmed** |
| 7 | No student bypass; admin can still cancel; no new admin features | No bypass exists. Nothing was added to the admin panel |
| 8 | An allowed cancel releases the hold exactly as now | `settlement.ts` is untouched. The route test asserts `cancelBookingAndReturnCoins` is still called with the same two arguments |
| 9 | Reschedule uses the new time; second cancel idempotent; demos the same unless treated differently | Reschedule writes `scheduledStart`, so the window follows it with no extra code. Idempotency is pinned. **Demos are not treated differently** anywhere in the cancel path, so they follow the same rule |

---

## NOT VERIFIED

| Item | Why, and how to verify later |
|---|---|
| **Nothing ran against a real database.** No local or test Postgres exists here, production is off limits, and no query ran against any real database | Every proof above uses a fake Prisma client or a pure function. Verify with the manual steps below against a seeded database |
| **No end-to-end run.** No dev server was started and no browser drove the flow | The manual steps are the check |
| **The exact boundary is not asserted in the DOM**, only in the rule and route tests | The DOM test needs the clock to advance for React's async queries to settle, so a millisecond either side of the boundary would be a coin toss there |
| **Mobile is unverified because it has no cancel path** | Confirmed by reading the route, the API client and the screen. If a mobile cancel is added it must call `canStudentCancel`; the wiring test will not catch a brand-new file, so add it there |
| **"A teacher cancel fully refunds the student" could not be confirmed** | No teacher cancel exists. If one is added, decide then whether it refunds and whether the window applies |
| **An admin cancel does not refund the student.** Read from the code, not observed running | It writes only `ClassSession.status`, leaving the coin hold `HELD`. Pre-existing, outside this task, flagged because it looks wrong |
| **A real DST transition was not exercised** against a live column | The comparison is absolute-instant arithmetic with no wall-clock or zone step, so there is nothing for DST to shift. A test pins that three spellings of one instant give one answer |

---

## Manual test steps

The one thing worth checking by hand is that the server refuses a late cancel even when the button
does not stop you. Steps 4 and 5 are that check.

**Setup.** Run student-web against a database you can write to, signed in as a student with two
confirmed bookings: one more than 4 hours out, one between a few minutes and 4 hours out. Adjust
`ClassSession.scheduledStart` directly if that is easier than booking.

1. **Open `/classes`, "upcoming" tab.** Every card should read *"Cancellation closes 4 hours before
   the class."*, including the one you cannot cancel. The old *"Free cancellation until 12h before
   class"* must be gone.
2. **The booking more than 4 hours out:** Cancel is enabled. Click it, confirm, and expect the coins
   back and the booking moved to "cancelled".
3. **The booking inside 4 hours:** Cancel is greyed out and does nothing when clicked.
4. **The real check — bypass the UI.** Signed in, in the devtools console:
   ```js
   await fetch("/api/students/classes/<BOOKING_ID_INSIDE_4H>/cancel", {
     method: "POST", credentials: "include",
   }).then(async (r) => ({ status: r.status, body: await r.json() }));
   ```
   Expect `status: 409` and a body carrying `code: "CANCEL_WINDOW_CLOSED"`, a `cancelClosesAt`
   timestamp four hours before that class, and an `error` sentence. **The booking must still be
   confirmed afterwards and no coins may move.**
5. **Repeat step 4 on teacher-web** at `/student/classes`. This is the copy that had the magic number.
6. **Boundary, if you want to see it:** set a booking's `scheduledStart` to exactly 4 hours and a
   minute from now. Cancel is enabled. Set it to 3 hours 59 minutes. It is refused.
7. **Admin is not blocked:** in the admin panel open a class starting within the next hour and use
   "Cancel Session". It must succeed. It does **not** refund the student, which is unchanged.
8. **Reschedule follows the new time:** move a class from 2 hours away to 30 hours away, then try to
   cancel. It must now be allowed, because the window measures from the new start.

### If you want the window back at 12 hours

Change `STUDENT_CANCEL_WINDOW_HOURS` in `packages/live-classes/src/cancel-window.ts`. Routes, both
list responses, both buttons and both notes follow it. Two assertions in `cancel-window.test.ts`
name the number 4 on purpose and will fail, which is the intended reminder.
