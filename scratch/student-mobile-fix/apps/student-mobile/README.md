# Language Metrics — Student Mobile (Expo SDK 57)

Student-only app (Decision 5 in `docs/MOBILE_RESPONSIVE_SIGNOFF.md`). It talks to the
versioned mobile API in `apps/student-web` (`/api/v1/*`), validates every
request and response against `packages/api-contracts`, and uses the same light/dark
design tokens as the web portals.

## Run it

```powershell
# 1. From the repo root, install (adds react-native-safe-area-context + expo-system-ui)
cd C:\Users\paagu\OneDrive\Desktop\Language_metrics
npm install

# 2. Start the API the app talks to (student-web needs its env vars: DATABASE_URL, JWT keys, REDIS_URL — see root .env.example)
npm run dev:student            # student-web on http://localhost:3002

# 3. Point the app at that API
copy apps\student-mobile\.env.example apps\student-mobile\.env

# 4. Start Expo (press w for web, a for Android emulator, i for iOS simulator)
npm run dev:mobile -- -c
```

`.env` values are inlined at bundle time. Restart with `-c` after changing them.

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| Expo web / iOS simulator | `http://localhost:3002/api/v1` |
| Android emulator | `http://10.0.2.2:3002/api/v1` |
| Physical phone (same Wi-Fi) | `http://<your-PC-LAN-IP>:3002/api/v1` |
| Deployed API | `https://language-metrics-student-web.vercel.app/api/v1` |

## Flows

**Launch and session restore**
- The app rotates the refresh token kept in the Keychain/Keystore (`POST /auth/mobile/refresh`) and loads `GET /me`.
- If that succeeds, it opens the tabs. If there is no session, it shows Login. If the server can't be reached, it shows the Offline screen (Try again / Sign in with a different account).

**Login** (same copy and flow as `student-web/src/app/login/page.tsx`)
- The student enters email and password (with show/hide), then taps "Sign in as Student", which calls `POST /auth/mobile/login`.
- Only student accounts can sign in. Unverified or suspended accounts see the server's message.
- The access token stays in memory; the refresh token goes to the secure store.
- "Forgot password?" and "Sign up as Student" open the public site.
- There is no demo fallback: a failed login never creates a session.

**Signed in**
- **Header coin balance:** loaded from `/me`, refreshed from `/wallet/balance`.
- **Discover:** `GET /teachers` with search, language filters (same list as web) and "Load more" paging.
- **Book lesson:** pick a duration (30/60/90), a day and a time, then `POST /bookings`. The server checks the balance and deducts coins in a Serializable transaction. If coins are short, the sheet links to Wallet.
- **Classes:** Upcoming / Past / Cancelled from `GET /classes`. "Join classroom" appears 10 minutes before start and opens the web classroom (`/live/:bookingId`) until the LiveKit mobile SDK ships (Phase 3).
- **Wallet:** live balance and the web coin packages. Top-up opens the student portal wallet (Razorpay) until the IAP/Play Billing decision (Decisions 2 and 3) is signed off.
- **Profile:** account details, Appearance (System / Light / Dark), help and legal links, and Sign out (`POST /auth/mobile/logout`, which revokes the refresh session).

**Expired or revoked session**
- Every API call shares one refresh rotation.
- If the refresh is rejected, tokens are wiped and the app returns to Login with "Your session has expired. Please sign in again."

## Theme

`src/theme/tokens.ts` mirrors `apps/student-web/src/app/globals.css`:

| Theme | Background | Surface | Brand | Action |
|---|---|---|---|---|
| Light | cream `#f8f4ea` | white | indigo `#231d5e` | gold `#c7982f` |
| Dark | navy-black `#0d1424` | `#18233c` | indigo `#7b73e4` | gold `#e0b24a` |

- The mode follows the device by default. The Profile tab or the sun/moon button on Login overrides it, and the choice is saved.
- Text tokens (`actionText`, `trustText`, `brandText`) keep body text at ≥ 4.5:1 contrast in both themes.

## CORS (Expo web only)

Native iOS/Android builds don't send CORS preflights. Browsers do.
- `apps/student-web/src/proxy.ts` allows `http://localhost:8081` and `:19006` automatically in development.
- For a deployed student-web, set `MOBILE_WEB_ALLOWED_ORIGINS` in Vercel, e.g. `http://localhost:8081`.

## Checks

```powershell
npx tsc --noEmit -p packages/api-contracts/tsconfig.json
npx tsc --noEmit -p apps/student-mobile/tsconfig.json
npx expo-doctor apps/student-mobile
```
