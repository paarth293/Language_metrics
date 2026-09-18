# Language Metrics — Build Verification Report

**Date:** 17 September 2026
**Scope:** Whole monorepo — `apps/admin-panel`, `apps/student-web`, `apps/teacher-web`, `apps/student-mobile`, `packages/api-contracts`, `packages/auth`, `packages/database`
**Source verified:** The working copy in `C:\Users\paagu\OneDrive\Desktop\Language_metrics` as of 17 Sep 2026 (461 source/config files copied and checked)

---

## 1. Verdict

| Area | Result |
|---|---|
| Web app source code (3 Next.js apps) | **No errors found.** No syntax errors, no broken imports, every package used is declared and locked. |
| Last real production build of the web apps | **Passed** on 8 Sep 2026, 19:28–19:30 IST (TypeScript check + static generation finished for all 3 apps). No web source file has changed since then. |
| Clean install with `npm ci` (used by all GitHub Actions jobs) | ❌ **FAILS.** `package-lock.json` is out of sync with `apps/admin-panel/package.json`. See **Error 1**. |
| Mobile app (`student-mobile`) | ❌ **Will crash on start.** React versions don't match. See **Error 2**. |
| Mobile release builds (EAS) | ❌ **Blocked.** Placeholder config values. See **Error 3**. |
| Warnings (don't stop the build) | 5 items, see Section 5. |

**In short, the build is not perfect yet. There are 3 errors to fix.** Error 1 is a one-line fix and should be done first.

---

## 2. How this was verified (and what could not be run)

1. **Copied the whole repo** from your computer into a clean Linux workspace. That was 461 files: all `src/`, configs, the Prisma schema, lockfiles, workflows and tests.
2. **Tried a clean install** with `npm ci`. It failed before downloading any package, because npm had to re-resolve `bcryptjs`. That is how npm behaves when the lockfile is invalid. The network rules in the verification environment also block `registry.npmjs.org`, so a full install and `next build` **could not be run there**.
3. **Checked the lockfile offline** with `npm ls --package-lock-only`. It reported `ELSPROBLEMS — invalid: bcryptjs@3.0.3 apps/admin-panel/node_modules/bcryptjs`.
4. **Confirmed the cause.** In a copy of the repo, only the `bcryptjs` range in `apps/admin-panel/package.json` was changed. After that, `npm ls` passed and `npm ci` moved on to downloading tarballs. So this one line is the only lockfile blocker.
5. **Ran a static analysis with the TypeScript 5.9 compiler API** on every workspace, using each app's own `tsconfig.json`:
   - Syntax errors: **0** in every workspace.
   - Unresolved local imports (`./…`, `@/…`, `@repo/…`): **0**. The only unresolved paths were in the auto-generated `next-env.d.ts` (`.next/dev/types/*.d.ts`), which Next creates itself.
   - External packages used but missing from `package.json`/`package-lock.json`: **0**.
   - Full type checking needs installed `node_modules` (React, Next, Prisma types). Without them it only produces false positives, e.g. code after `redirect()` gets flagged because `never` can't be resolved. So it was not used as evidence.
6. **Read the build records on your disk** in each app's `.next` folder: `BUILD_ID`, `diagnostics/build-diagnostics.json` and `trace-build`:

| App | Last `next build` (IST) | Duration | TypeScript step | Final stage reached |
|---|---|---|---|---|
| admin-panel | 8 Sep 2026 19:28 | 57.3 s | `run-typescript` 8.7 s ✅ | `static-generation` ✅ |
| student-web | 8 Sep 2026 19:29 | 51.8 s | `run-typescript` 24.4 s ✅ | `static-generation` ✅ |
| teacher-web | 8 Sep 2026 19:30 | 48.7 s | `run-typescript` 14.3 s ✅ | `static-generation` ✅ |

   Every file under the three web apps' `src/`, their configs and `packages/database/prisma/schema.prisma` is **older** than these builds. The only files changed after 8 Sep are:
   - root `package.json` (15 Sep 05:40)
   - `package-lock.json` (15 Sep 06:38)
   - `apps/student-mobile/*` (15 Sep)
   - files Next generates itself (`next-env.d.ts`, `AGENTS.md`, `CLAUDE.md`, from `next dev` on 15 Sep)

**Still to do on your machine:** run the commands in Section 6 after the fixes. That confirms the result end to end.

---

## 3. Error 1 — `npm ci` fails: lockfile out of sync (bcryptjs) 🔴 BLOCKER

### What's wrong
- `apps/admin-panel/package.json` asks for `"bcryptjs": "^2.4.3"`.
- `package-lock.json` installs `apps/admin-panel/node_modules/bcryptjs` at **3.0.3**. That's also what's on your disk now.
- `3.0.3` does not satisfy `^2.4.3`, so the lockfile is invalid for that workspace.

### Where it breaks
Every `npm ci` stops with an error like:
```
npm error `npm ci` can only install packages when your package.json and package-lock.json are in sync.
npm error Invalid: lock file's bcryptjs@3.0.3 does not satisfy bcryptjs@^2.4.3
```
These CI jobs run `npm ci`, so they will all fail at install:
- `.github/workflows/mobile-ci.yml` → "Install Monorepo Dependencies" (`npm ci --legacy-peer-deps`)
- `.github/workflows/security.yml` → lines 138, 188 and 226 (`npm ci`)

### Fix (recommended): match `package.json` to what was actually built and tested
The 8 Sep successful build used bcryptjs **3.0.3**. The code only uses `import bcrypt from "bcryptjs"` in `src/lib/password.ts` and `src/lib/totp.ts`. That API works the same in v2 and v3.

1. Open `apps/admin-panel/package.json`.
2. In `"dependencies"`, change
   ```json
   "bcryptjs": "^2.4.3",
   ```
   to
   ```json
   "bcryptjs": "^3.0.3",
   ```
3. From the repo root in PowerShell, update the lockfile's workspace metadata:
   ```powershell
   cd C:\Users\paagu\OneDrive\Desktop\Language_metrics
   npm install --package-lock-only
   npm ls --package-lock-only
   ```
   `npm ls` must end **without** `ELSPROBLEMS`.
4. Commit both files together:
   ```powershell
   git add apps/admin-panel/package.json package-lock.json
   git commit -m "fix(admin-panel): align bcryptjs range with lockfile (3.0.3)"
   ```

> Note: bcryptjs 3 creates `$2b$` hashes by default and still verifies the existing `$2a$` hashes. Existing admin passwords keep working.

### Alternative fix (stay on v2)
```powershell
npm install bcryptjs@^2.4.3 -w admin-panel
```
Then run the admin tests again (`npm run test -w admin-panel`) and commit `package-lock.json`.

---

## 4. Error 2 — Mobile app: React 19 installed, but React Native 0.76 needs React 18 🔴 RUNTIME CRASH

### What's wrong
Lockfile check (`npm ls --package-lock-only --all`):
```
react@19.2.8 deduped invalid: "^18.2.0" from node_modules/react-native
react@19.2.8 deduped invalid: "^18.0.0" from node_modules/react-native-web
react-dom@19.2.8 deduped invalid: "^18.0.0" from node_modules/react-native-web
@types/react@19.2.18 deduped invalid: "^18.2.6" from node_modules/react-native
```
- `apps/student-mobile/package.json` has `"expo": "^52.0.0"` (locked **52.0.49**), `"react-native": "^0.76.0"` (locked **0.76.9**), `"react-native-web": "~0.19.13"`.
- It also declares `"react": "*"` and `"react-dom": "*"`. npm workspaces install one shared copy, so mobile gets the web apps' **React 19.2.8**.
- Expo SDK 52 / React Native 0.76 is built for React **18.3.1**. The React 18 renderer inside RN 0.76, and `react-native-web` 0.19, use React internals that React 19 removed. The app bundles, then crashes on launch.
- Installs don't fail only because `.npmrc` has `legacy-peer-deps=true`, which hides these peer conflicts.
- `apps/student-mobile/src/types/react-native.d.ts` is a hand-written stub of RN types. It hides type errors instead of fixing them.

### Fix (recommended): upgrade the mobile app to an Expo SDK built on React 19.2
Expo's version table ([docs.expo.dev/versions](https://docs.expo.dev/versions/latest/)):

| Expo SDK | React Native | React | react-native-web | Min Node |
|---|---|---|---|---|
| 55 | 0.83 | 19.2.0 | 0.21.0 | 20.19.x |
| 56 | 0.85 | 19.2.3 | 0.21.0 | 20.19.x |
| 57 | 0.86 | 19.2.3 | 0.21.0 | 22.13.x |

Steps (PowerShell, repo root):
```powershell
cd C:\Users\paagu\OneDrive\Desktop\Language_metrics\apps\student-mobile
npx expo install expo@^56.0.0
npx expo install --fix
cd ..\..
npm install
npm ls react react-dom react-native --all
```
Then:
1. Pin the React version the chosen SDK expects **in every workspace**. SDK 56 expects `19.2.3`, and `npx expo install --fix` prints the exact pin. Set it in:
   - root `package.json`
   - `apps/admin-panel`, `apps/student-web`, `apps/teacher-web`
   - `apps/student-mobile` (replace `"*"`)

   Use the same value for `react-dom`. There must be only one React in the tree. Next 16.3 supports any React 19.2.x.
2. In `apps/student-mobile/package.json`, set `"@types/react": "~19.2.x"` to match, and remove the root devDependency `"react-native-web": "^0.19.13"`. `expo install` adds the correct `0.21.0` to the mobile workspace.
3. Delete `apps/student-mobile/src/types/react-native.d.ts` and `apps/student-mobile/src/types/expo-secure-store.d.ts`. The real packages ship their own types.
4. Check:
   ```powershell
   npx expo-doctor apps/student-mobile
   npx tsc --noEmit -p packages/api-contracts/tsconfig.json
   npx tsc --noEmit -p apps/student-mobile/tsconfig.json
   cd apps/student-mobile; npx expo export --platform web; cd ../..
   ```
5. If you pick SDK 57, change `node-version: 20` to `node-version: 22` in `.github/workflows/mobile-ci.yml`.
6. Run `npm run build` again (Section 6), because the shared React pin changes for the web apps too.

### Also missing for native builds
`npm ls` reports `UNMET DEPENDENCY @babel/preset-env@^7.1.6` (required by `@react-native/codegen@0.76.9` and `jscodeshift@0.14.0`). After the SDK upgrade, run `npm ls @babel/preset-env --all`. If it's still unmet, add it to the mobile workspace:
```powershell
npm install -D @babel/preset-env -w student-mobile
```

---

## 5. Error 3 — Mobile EAS build/submit config has placeholders 🔴 BLOCKS STORE BUILDS

| File | Key | Current value | Problem | Fix |
|---|---|---|---|---|
| `apps/student-mobile/app.json` | `expo.extra.eas.projectId` | `"placeholder-eas-project-id"` | Not a valid EAS project UUID, so `eas build` fails. | From `apps/student-mobile` run `npx eas-cli@latest init`. It writes the real ID. |
| `apps/student-mobile/eas.json` | `build.development.developmentClient` | `true` | `expo-dev-client` is not installed (not in the lockfile), so the development profile can't build a dev client. | `npx expo install expo-dev-client` (in `apps/student-mobile`), or remove `"developmentClient": true`. |
| `apps/student-mobile/eas.json` | `submit.production.ios.ascAppId` | `"placeholder-asc-app-id"` | iOS submit fails. | Replace with the numeric Apple ID of the app from App Store Connect. |
| `apps/student-mobile/eas.json` | `submit.production.android.serviceAccountKeyPath` | `"./google-play-service-account.json"` | File doesn't exist in `apps/student-mobile`. | Add the Google Play service-account JSON (and add it to `.gitignore`), or upload it with `eas credentials`. |
| `apps/student-mobile/eas.json` | `build.preview.env.EXPO_PUBLIC_API_URL` | `https://staging.languagemetrics.com/api/v1` | No staging app is listed in the README's deployed environments. | Point to a real staging URL, or use `https://language-metrics-student-web.vercel.app/api/v1`. |

These only block **EAS** builds/submissions. The web apps are not affected.

---

## 6. Warnings (non-blocking, but worth fixing)

| # | Where | Finding | Recommended action |
|---|---|---|---|
| W1 | `apps/admin-panel/package.json` | `eslint-config-next` is `16.3.1` but `next` is `16.3.0`. Every other workspace uses `16.3.0`. | Set `"eslint-config-next": "16.3.0"`, or upgrade `next` to 16.3.1 everywhere. |
| W2 | `apps/teacher-web/package.json` | `@smithy/core ^1.2.0` and `@smithy/types ^1.2.0` install a second, old copy (`1.4.2`) next to the root's `3.33.3`. | Remove both lines. The root already provides v3, which `@aws-sdk/client-s3@3.1120` needs. |
| W3 | `apps/student-web` | Imports `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` and `@supabase/supabase-js` (`src/lib/storage.ts`), but they're only declared in the **root** `package.json`. Works in this monorepo because of hoisting, but breaks if the app is installed alone. | Add the three packages to `apps/student-web/package.json` dependencies. |
| W4 | `apps/teacher-web/package.json` | `puppeteer@25.9.0` in devDependencies downloads a full Chrome on every install, which slows CI and Vercel installs. | Remove it if unused, or set `PUPPETEER_SKIP_DOWNLOAD=true` in CI/Vercel env. |
| W5 | Root `.npmrc` | `legacy-peer-deps=true` hid Error 2. | After Error 2 is fixed, try removing it and running `npm install`, so future peer conflicts show up. |

---

## 7. Final re-verification checklist (run on your machine after the fixes)

Run from `C:\Users\paagu\OneDrive\Desktop\Language_metrics` in PowerShell. Each step must exit with code 0 (`$LASTEXITCODE` = `0`).

```powershell
# 1. Clean install exactly like CI
Remove-Item -Recurse -Force node_modules, apps\*\node_modules, packages\*\node_modules -ErrorAction SilentlyContinue
npm ci

# 2. Lockfile integrity
npm ls --package-lock-only

# 3. Type checks
npx tsc --noEmit -p apps/admin-panel/tsconfig.json
npx tsc --noEmit -p apps/student-web/tsconfig.json
npx tsc --noEmit -p apps/teacher-web/tsconfig.json
npx tsc --noEmit -p packages/api-contracts/tsconfig.json
npx tsc --noEmit -p apps/student-mobile/tsconfig.json

# 4. Lint
npm run lint

# 5. Unit tests (baseline.md: 189 tests in 14 suites)
npm run test -w admin-panel
npm run test -w student-web
npm run test -w teacher-web

# 6. Production build (Prisma generate + all 3 Next.js apps)
npm run build

# 7. Mobile
npx expo-doctor apps/student-mobile
cd apps\student-mobile; npx expo export --platform web; cd ..\..
```

The build is fully clean when all 7 steps pass and `npm run build` prints a route table for all three apps (`admin-panel`, `student-web`, `teacher-web`).
