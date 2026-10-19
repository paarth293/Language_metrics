# Load tests (k6) — NOT YET RUN

These scripts were written during the production-readiness audit and have **not been executed**.
Do **not** run them against production. `lib/common.js` refuses the known production hosts and
requires `I_CONFIRM_NOT_PRODUCTION=yes`.

| Script | Endpoint | Notes |
|---|---|---|
| `01-login.js` | `POST /api/auth/login` | Per-IP limit 10/min: expect 429s from a single generator |
| `02-discover-list.js` | `GET /api/students/discover` + `GET /api/students/chat` (3 s poll) | Read path + chat polling cost |
| `03-book-class.js` | `POST /api/students/teacher/:id/book` | Creates bookings + coin holds. Staging only |
| `04-payment-create-order.js` | `POST /api/payments/create-order` | Creates real Cashfree **sandbox** orders. Low VUs |
| `05-live-class-join.js` | `POST /api/live/token` + `GET /api/live/:id/status` | Calls the LiveKit API, never connects media |

Stages: ramp-up, then steady, then a 5x spike, then recovery (`standardStages` in `lib/common.js`). Scale with `TARGET_VUS`.

## Run (staging example)

```bash
export BASE_URL=https://<staging-student-web-host>
export I_CONFIRM_NOT_PRODUCTION=yes
export STUDENT_EMAILS=lt1@example.test,lt2@example.test   # seeded test accounts
export STUDENT_PASSWORD='***'
export TARGET_VUS=100
k6 run audit/load-tests/02-discover-list.js
TEACHER_IDS=<uuid>,<uuid> k6 run audit/load-tests/03-book-class.js
CASHFREE_SANDBOX_CONFIRMED=yes PACK_BODY='{"coins":500}' TARGET_VUS=10 k6 run audit/load-tests/04-payment-create-order.js
SESSION_IDS=<uuid>,<uuid> k6 run audit/load-tests/05-live-class-join.js
```

While a test runs, watch: Supabase connection count and pooler errors, Upstash connection count and
command rate, Vercel function duration and errors, and LiveKit API errors.

`PACK_BODY` must match `resolveCoinPackage` in `packages/api-contracts` (NOT VERIFIED; check before running).
