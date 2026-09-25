# Live classes with LiveKit

How live video works in Language Metrics, what it costs, and how students are
billed for it.

---

## 1. What was there before

Worth stating plainly, because it explains most of the design decisions below.

| Thing | State before |
|---|---|
| `livekit-server-sdk` | Not installed in any workspace |
| `livekit-client` | Not installed in any workspace |
| Token generation | `` `dev-token-${userId}-${sessionId}` `` and `` `mock_token_${identity}_${room}_${Date.now()}` `` — plain strings, unsigned, no room grant, no expiry |
| SDK loading | `Function('return import("livekit-server-sdk")')()` cast to `any`, to dodge the missing dependency |
| Token routes | Two, in different apps, already diverged: different join-window rules, different response shapes |
| Student classroom UI | A static placeholder. No LiveKit client; chat wrote to local React state and was never sent |
| Webhooks | None. `actualStart` / `actualEnd` were never populated |
| Recording | None. `recordingUrl` was never written by anything |
| Coin balance | Two contradictory implementations — one of which made booking a class *increase* the balance (see §7) |

So: live classes could not work in production regardless of configuration,
and the failure mode was silent — an unconfigured deployment returned HTTP 200
with a fake token.

---

## 2. Architecture

```
                         ┌───────────────────────────┐
  student-web ──┐        │        LiveKit Cloud      │
  teacher-web ──┼──POST──▶  /api/live/token          │
  mobile (v1) ──┘        │      ↓ mints a real JWT   │
                         │   scoped to ONE room,     │
                         │   TTL bounded by the      │
                         │   class's own end time    │
                         └───────────┬───────────────┘
                                     │ WebRTC
                   ┌─────────────────▼─────────────────┐
                   │        room `class-<sessionId>`    │
                   └─────────────────┬─────────────────┘
                                     │ webhooks (signed)
                         ┌───────────▼───────────────┐
                         │  /api/webhooks/livekit    │
                         │   room_started            │
                         │   participant_joined/left │──▶ LiveParticipantSession
                         │   room_finished ──────────┼──▶ settle → CoinAccount
                         │   egress_ended ───────────┼──▶ recordingUrl
                         └───────────────────────────┘
```

### Packages

| Package | Contains | Safe to import from |
|---|---|---|
| `@repo/livekit` | config, cost model, pure metering math | anywhere |
| `@repo/livekit/server` | tokens, RoomService, Egress, webhook verification | server only — holds the API secret |
| `@repo/livekit/client` | browser `RoomOptions` | client components |
| `@repo/live-classes` | join rules, settlement, webhook handler, usage, recording, admin queries | server only |

Route handlers are thin. Everything that decides who may join, what a class
costs, or when coins move lives in `@repo/live-classes` exactly once, so the
four surfaces cannot drift the way the two old token routes did.

---

## 3. Setup

### 3.1 Install

```bash
npm install                     # picks up the new workspace packages
npm run db:migrate:deploy       # applies prisma/migrations (see §3.2 for DIRECT_URL)
npm run db:backfill-coins       # REQUIRED — see §7
npm run db:migrate:status       # should say "Database schema is up to date!"
```

Use `db:migrate:deploy`, never `prisma migrate dev`, against a database that
holds real data. `migrate dev` is for authoring migrations locally and can
prompt to reset the database when it finds history it did not create.

### 3.2 Environment

Minimum to get a class working:

```bash
LIVEKIT_API_KEY="API..."
LIVEKIT_API_SECRET="..."
LIVEKIT_WS_URL="wss://your-project.livekit.cloud"
```

`.env.example` documents the rest. Every other `LIVEKIT_*` variable is a
spending control with a sensible default.

Migrations additionally need **`DIRECT_URL`**, separate from `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://…@…pooler.supabase.com:6543/postgres"  # pooled, for the app
DIRECT_URL="postgresql://…@…pooler.supabase.com:5432/postgres"    # direct, for migrations
```

Supabase's transaction pooler on 6543 cannot run DDL. `prisma migrate` reads
`directUrl` from the datasource block and connects on 5432 instead. If
`DIRECT_URL` is unset, migrations fail while the app itself keeps working —
which makes the cause easy to miss.

### 3.3 Webhook

LiveKit Cloud → your project → **Settings → Webhooks** → add:

```
https://<your-deployment>/api/webhooks/livekit
```

Point **exactly one** deployment at it. All three apps share a database, so a
second receiver only duplicates work.

**Without this webhook nothing is metered.** No join/leave times, no
settlement, no recording URLs. Coins stay held forever. This is the single
most important configuration step and the easiest to forget.

### 3.4 Cron

`vercel.json` runs `/api/cron/reconcile-sessions`. It settles any class whose
grace window has passed but whose webhook never arrived. Set `CRON_SECRET` or
the endpoint is public — the route only enforces auth when that variable is
set.

**The schedule is currently `0 0 * * *` (daily), not every 10 minutes.** Vercel's
Hobby plan rejects sub-daily cron expressions, so `*/10 * * * *` was replaced.
The consequence is real: when a `room_finished` webhook is lost, the student's
coins stay `HELD` for up to 24 hours instead of 10 minutes. On a paid plan,
restore `*/10 * * * *`; otherwise trigger the endpoint from an external
scheduler at the interval you actually want.

---

## 4. How students are billed

### The rule

> A student is charged for the time they and a teacher were **both connected**.

Not the slot they booked. Not the time they sat alone in an empty room waiting
for a teacher who was late.

### The lifecycle

1. **Book** — `hold()` moves coins from `balance` to `heldBalance`. Nothing is
   spent. The student's total is unchanged; they simply cannot spend those
   coins twice.
2. **Attend** — webhooks write a `LiveParticipantSession` row per connection.
   Three drops and rejoins produce three rows, which is exactly what the
   intersection needs.
3. **Settle** — on `room_finished`, `computeBillableWindow()` intersects the
   teacher's presence union with the student's, rounds up to the minute, and
   `captureHold()` charges that and returns the rest — in one statement, so a
   class can never be half-settled.

### Edge cases, all handled by the same intersection

| Situation | Outcome |
|---|---|
| Teacher joins 10 min late | Student billed 50 of 60 min, 10 min refunded |
| Student's wifi drops 3 times | Gaps excluded; only connected overlap billed |
| Both join 8 min early | Pre-start minutes clamped out, not billable |
| Teacher never joins | Full refund, flagged for admin review |
| Student never joins | Slot charged in full (the teacher held the time) |
| Class runs 30 min over | Charge capped at the hold — a student is never billed more than checkout showed |
| Student leaves after 40 seconds | 1-minute floor, 59 min refunded |

Tested in `packages/livekit/src/metering.test.ts` (25 cases), including a
property test that `charged + refunded === held` for every input.

### The live meter

`/api/live/[sessionId]/meter` runs the *same* `computeBillableWindow` +
`settleSession` pair that settlement runs. What the student watches tick up
during class is what they are charged. A meter that disagrees with the invoice
reads as a billing error even when the charge is right.

---

## 5. What it costs us, and how that is kept down

LiveKit Cloud bills two things
([pricing](https://livekit.com/pricing), verified 2026-09-20):

| | Build tier included | Then |
|---|---|---|
| Connection minutes | 5,000/mo | $0.0005/min |
| Downstream data | 50 GB/mo | $0.12/GB |
| Egress (video) | — | $0.02/min |
| Egress (audio) | — | $0.005/min |

A **1:1 class burns two connection minutes per wall-clock minute**, so the free
tier is about **2,500 class-minutes ≈ 41 hours of teaching per month**. Past
that, a 60-minute class costs about **6¢** in connection fees.

Bandwidth is usually the larger half. Everything below targets it.

### 5.1 The levers, in order of impact

**Dynacast** (`buildRoomOptions`) — the publisher stops encoding and sending
layers nobody is subscribed to. Minimise the teacher's video and the teacher's
browser stops uploading it. Biggest single saving in the file.

**Adaptive stream** — the SFU sends a resolution matched to the size the video
element is actually rendered at. A 180×120 thumbnail gets the 180p layer.

**Simulcast** — gives the two above layers to choose between. Without it
neither has anything to work with.

**360p default** — `low` is 640×360 @ 300 kbps, roughly a quarter of 720p.
Language tuition is audio-first; video is for rapport and mouth shape, and
360p carries both. Starting low and letting people opt up costs far less than
starting high and hoping they opt down, because almost nobody opts down.

**DTX** — stops sending audio during silence. In a 1:1 lesson one person is
listening most of the time.

**Prejoin without connecting** — `usePrejoinDevices` opens the camera and mic
*locally* via `createLocalTracks`. The obvious way to build a device-check
screen is to join the room and watch your own track, which starts the meter.
A student who arrives five minutes early every lesson would burn five billable
participant-minutes per class before it began.

**Short `emptyTimeout`** (120s vs LiveKit's 300s default) — abandoned rooms do
not linger.

**TTL bounded by the class** — a forgotten browser tab cannot silently
reconnect overnight. The token simply stops working.

**Audio-first recording** — $0.005/min vs $0.02/min. Students replay
pronunciation; they do not replay a talking head.

**Group class cap** — bandwidth grows with the *square* of participants
(n people each receive n−1 streams). Four participants is six times the
traffic of two, not twice. `LIVEKIT_MAX_PARTICIPANTS` defaults to 4.

### 5.2 The budget guard

`checkBudgetGate()` runs on every token request:

| Budget used | Behaviour |
|---|---|
| < 75% | Requested quality granted |
| ≥ 75% | `standard`/`high` downgraded to `low` |
| ≥ 90% | All new joins forced to `audio-only` |
| ≥ 100% | New rooms refused |

Two deliberate exemptions:

- **In-progress classes are never cut off.** Dropping a student mid-lesson to
  save a fraction of a cent trades a real refund and a real complaint for an
  imaginary saving.
- **Teachers are never blocked.** A teacher locked out of a class the student
  is already in triggers a no-show refund of the entire booking — the most
  expensive possible outcome.

### 5.3 If you outgrow the free tier

Self-hosting LiveKit on a ~$6–12/month VPS removes connection-minute billing
entirely; you pay only the VPS's bandwidth. Everything in this codebase goes
through `getLiveKitConfig()`, so the switch is one environment variable
(`LIVEKIT_WS_URL`) plus your own TURN/TLS setup. `config.deployment` already
reports `"self-hosted"` when the URL is not a `.livekit.cloud` host.

---

## 6. Endpoints

| Method | Path | Who |
|---|---|---|
| POST | `/api/live/token` | student, teacher, admin |
| GET | `/api/live/[sessionId]/status` | participants |
| GET | `/api/live/[sessionId]/meter` | participants |
| POST | `/api/live/[sessionId]/end` | teacher, admin |
| POST/DELETE | `/api/live/[sessionId]/recording` | teacher, admin |
| POST | `/api/webhooks/livekit` | LiveKit (signature-verified) |
| GET | `/api/cron/reconcile-sessions` | cron (`CRON_SECRET`) |
| POST | `/api/v1/classes/[id]/token` | mobile (Bearer) |
| GET | `/api/v1/classes/[id]/meter` | mobile (Bearer) |
| GET | `/api/admin/live/rooms` | admin `classes:manage` |
| POST | `/api/admin/live/rooms/[id]/end` | admin `classes:manage` |
| POST | `/api/admin/live/rooms/[id]/kick` | admin `classes:manage` |
| GET | `/api/admin/live/costs` | admin `analytics:view` |
| GET | `/api/admin/live/review` | admin `classes:manage` |

### Deprecated, kept as forwarding shims

- `POST /api/students/classes/[id]/livekit-token`
- `POST /api/teachers/session/token`

Both return `Deprecation: true` and a `Link: rel="successor-version"` header,
and include `wsUrl` alongside `serverUrl` so old and new clients both work
during a rolling deploy.

---

## 7. The coin ledger

Metered billing writes several ledger rows per class, which turned three
existing latent defects into blocking ones.

**Contradictory sign convention.** `lib/coin-service.getCoinBalance()` treated
`SPEND` as a positive magnitude and subtracted it. Both booking routes wrote
`SPEND` rows with an already-negative amount. `acc - (-300)` is `acc + 300`:
**booking a class increased the balance that function reported.** The wallet
page and the booking routes disagreed with each other.

**Read-then-write race.** `debitCoins()` read the balance, compared, then
wrote. The booking routes worked around this with Serializable isolation —
correct, but it costs a retry storm under load.

**O(n) balance reads.** Every check loaded the user's entire transaction
history, a table that only grows.

Now: `amount` is always the **signed delta to spendable balance**; balances
live in `CoinAccount`; a debit is one conditional `UPDATE` whose `WHERE`
clause *is* the balance check, so Postgres row-locking does the work and there
is nothing to retry.

```bash
npm run db:backfill-coins   # normalises legacy rows by TYPE, rebuilds CoinAccount
```

Idempotent. Rerunning it reports `drift: 0`. Run `auditCoinAccounts()` from a
cron to catch any write path that bypasses the ledger.

> **Deploy order matters.** Until the backfill runs, `CoinAccount` rows do not
> exist and every balance reads as zero — students will be told they cannot
> afford classes they can afford. Migrate, backfill, *then* serve traffic.

---

## 8. Deploy checklist

- [ ] Confirm a database backup exists before touching migrations
- [ ] `DIRECT_URL` is set (Supabase direct connection, port 5432 — see §3.2)
- [ ] `npm run db:migrate:deploy`
- [ ] `npm run db:migrate:status` — must say "Database schema is up to date!"
- [ ] `npm run db:backfill-coins` — must end with "Every account balance matches its ledger"
- [ ] Set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL`
- [ ] Register the webhook in LiveKit Cloud → Settings → Webhooks
- [ ] Set `CRON_SECRET` and confirm the Vercel cron is scheduled
- [ ] Set `LIVEKIT_MONTHLY_BUDGET_USD` to something you are willing to spend
- [ ] (Optional) Set `LIVEKIT_RECORDING_*` to enable recordings
- [ ] Run one real class end to end with two devices
- [ ] Check `/live` in the admin panel shows the room, then the settlement

---

## 9. Troubleshooting

**Every token request returns 503 `NOT_CONFIGURED`** — one of the three
required variables is missing. This is deliberate: the old code returned a
fake token with HTTP 200, so a typo'd variable looked healthy until every
student failed to connect.

**Webhook returns 401** — the body was parsed before verification. LiveKit
signs the exact bytes it sent; `request.text()`, never `request.json()`.

**Webhook returns 500 repeatedly** — check `WebhookEvent` rows with
`processedAt IS NULL` and a populated `error` column. LiveKit retries until it
gets a 2xx, and the row carries the reason.

**Classes never settle; coins stay held** — the webhook is not registered, or
is pointed at a deployment that cannot reach the database. The 10-minute cron
is the safety net; check its logs.

**Students join but hear nothing** — `<RoomAudioRenderer />` must be inside
`<LiveKitRoom>`. On mobile, `AudioSession.startAudioSession()` must have run,
or Android routes the call to the earpiece at near-zero volume.

**Mobile crashes on join** — Expo Go cannot load `@livekit/react-native-webrtc`.
You need a development build; see `apps/student-mobile/LIVEKIT_MOBILE.md`.

**Bill higher than expected** — open `/live` in the admin panel. The daily
chart splits spend into connection / bandwidth / recording. Bandwidth
dominating means quality profiles are too high or `dynacast` is off;
connection dominating means people are sitting in rooms they are not being
taught in (check the join window).
