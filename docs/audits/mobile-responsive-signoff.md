# Language Metrics — Student Mobile App & Responsive Web: Phase 0 Sign-Off Report

**Document Version:** 1.0.0  
**Date:** September 8, 2026  
**Author:** Paarth Gupta, Full Stack Developer Intern  
**Reviewed By:** Priyanshu Raj, Technical Lead  
**Scope:** Phase 0 Delivery (Internship Completion Window: Sep 8–15, 2026)  
**Repository Branch:** `feature/student-mobile-responsive-phase-0`  

---

## Executive Summary

Pursuant to the commitments set forth in the internship offer letter (LM/INT/2026/01) and the *Student Mobile App & Responsive Web Execution Plan* dated September 8, 2026, this report documents the completion and verification of **Phase 0**.

Phase 0 achieves two core objectives before the internship concludes on September 15, 2026:
1. **Web Responsiveness Standard & Enforcement**: Conducted an exhaustive audit of the existing web portals, hardened touch targets to the >= 44×44px accessibility baseline, added PWA web manifests, and instituted automated Playwright multi-viewport smoke tests (30/30 tests passed across Desktop, Laptop, Tablet, iPhone, and Android).
2. **Mobile Foundation Scaffolding**: Established the monorepo architecture for the student mobile app in React Native / Expo (`apps/student-mobile`), extracted the shared typed API contracts package (`packages/api-contracts`), implemented OS Secure Enclave token handling (`expo-secure-store`), and isolated mobile release engineering via path-filtered CI (`.github/workflows/mobile-ci.yml`).

---

## 1. Phase 0 Deliverables Summary

| Deliverable | Status | Location | Evidence / Verification |
|-------------|--------|----------|-------------------------|
| **Web Responsiveness Audit** | **Complete** | `apps/student-web`, `apps/teacher-web` | Touch targets elevated to >= 44px; overflow eliminated across 360px–1440px |
| **PWA Web Manifest** | **Complete** | `apps/student-web/public/manifest.json` | Standalone display mode, theme colors `#0f0c29`, verified via Playwright |
| **Playwright Viewport Suite** | **Complete** | `tests/e2e/responsive-audit.spec.ts` | 30 tests passed across 5 device viewports (Desktop, Laptop, iPad, iPhone, Android) |
| **Shared API Contracts** | **Complete** | `packages/api-contracts` | Shared Zod schemas & TypeScript types for Auth, Discovery, Booking, Wallet, Live Video |
| **Expo Mobile App Scaffold** | **Complete** | `apps/student-mobile` | Expo SDK 52, `app.json`, typed `MobileApiClient`, 4-tab UI shell |
| **Mobile Token Security** | **Complete** | `apps/student-mobile/src/lib/storage.ts` | OS Secure Enclave (Keychain/Keystore) for refresh tokens; in-memory access tokens |
| **Path-Filtered Mobile CI** | **Complete** | `.github/workflows/mobile-ci.yml` | Validates mobile TypeScript types and Expo configuration independently of web CI |
| **Admin Test Stability** | **Complete** | `apps/admin-panel/vitest.config.ts` | Configured worker thread pool; 18/18 admin tests passing in 12s |

---

## 2. Technical Verification Results

### A. TypeScript Type Check (Monorepo-wide)
- `apps/student-web/tsconfig.json`: **0 errors**
- `apps/teacher-web/tsconfig.json`: **0 errors**
- `apps/admin-panel/tsconfig.json`: **0 errors**
- `packages/api-contracts/tsconfig.json`: **0 errors**
- `apps/student-mobile/tsconfig.json`: **0 errors**

### B. Unit & Integration Test Suites
- `apps/admin-panel`: **4 test files, 18 tests passed (100%)**
- `apps/student-web`: **9 test files, 97 tests passed (100%)**
- `apps/teacher-web`: **8 test files, 114 tests passed (100%)**
- **Total Passing Unit Tests:** **229 / 229 passed**

### C. Playwright Multi-Viewport Responsive Tests
Running against live and local endpoints across 5 distinct viewport presets:
- **`desktop-chrome` (1440×900)**: 6 / 6 passed
- **`laptop` (1366×768)**: 6 / 6 passed
- **`tablet-ipad` (768×1024)**: 6 / 6 passed
- **`mobile-iphone` (390×844)**: 6 / 6 passed
- **`mobile-android` (393×851)**: 6 / 6 passed
- **Total Responsive Assertions:** **30 / 30 passed (100%)**

### D. Security & Secrets Verification
- Gitleaks secret scan: **0 secrets detected**
- Semgrep SAST scan (OWASP Top 10 + Next.js): **0 high/critical issues**
- Dynamic Security Runner (`security-tests/run_all.py`): **Exit code 0 [OK]**

---

## 3. Governance & Technical Lead Decisions (Section 18 Review)

Before implementation of Phase 1 (Core Features & Live Video) begins, the following 8 structural decisions require formal sign-off from Priyanshu Raj:

### Decision 1: Mobile Development Staffing (Post-Sep 15)
- **Context:** The internship window closes September 15, 2026. Phase 1–5 require an estimated 10–12 weeks of engineering.
- **Options:**
  1. *(Recommended)* Extend Paarth Gupta's engagement in a contracted or part-time capacity to drive Phase 1–5, preserving context on the monorepo, LiveKit, and Razorpay integrations.
  2. Hand over to internal team / new hire using the scaffolding and architecture established in Phase 0.
  3. Direct handover to Priyanshu Raj.

### Decision 2: iOS In-App Purchase Compliance Strategy
- **Context:** Apple App Store Review Guideline 3.1.1 mandates StoreKit in-app purchases for virtual currencies/coins consumed in-app (e.g. paying for lessons). Apple takes a 15–30% fee. External checkout links are currently permitted only on the US storefront (Epic v. Apple 2025 ruling).
- **Options:**
  1. *(Recommended for v1)* **Hybrid / StoreKit for iOS:** Integrate native StoreKit IAP on iOS (`react-native-iap` or Expo In-App Purchases). Adjust coin top-up pack pricing on iOS to absorb platform commissions, keeping unit economics neutral.
  2. **Web-Redirect v1:** Display wallet balance in mobile app, but direct coin purchases out to the mobile browser (`https://language-metrics-student-web.vercel.app/wallet`) via deep-link. (Note: incurs App Store review rejection risk if flagged under Guideline 3.1.1).

### Decision 3: Android Billing Strategy (Google Play)
- **Context:** Google Play Billing policy in India permits User Choice Billing (Alternative Billing) pursuant to CCI directives, allowing third-party processors like Razorpay alongside Google Play Billing with a reduced service fee (typically 11–26%).
- **Options:**
  1. *(Recommended)* **Razorpay via User Choice Billing on Android:** Retain Razorpay backend and existing settlement logic while complying with Google Play Alternative Billing APIs.
  2. **Standard Google Play Billing:** Implement Google Play Billing directly for coin packs.

### Decision 4: Student Age Demographics & Child Safety
- **Context:** If students under 18 enroll on the platform, both Apple and Google require parental consent flows, COPPA / GDPR-K compliance, and restrictions on targeted data collection.
- **Options:**
  1. *(Recommended)* Declare target audience as **18+** in Store Content Rating questionnaires, with explicit terms requiring minors to register through an adult/guardian account.
  2. Expand onboarding to include parental consent verification (adds 2 weeks of implementation).

### Decision 5: Mobile App Scope
- **Context:** Teacher and admin apps are currently excluded from mobile scope.
- **Decision:** Confirm that the mobile app remains strictly **student-facing** (`apps/student-mobile`). Teacher and admin operations remain web-only, protecting sensitive administrative workflows (2FA, audit logs, payout approvals).

### Decision 6: Developer Account Ownership
- **Context:** Apple Developer Organization enrollment requires a D-U-N-S number and legal entity verification (1–2 week lead time).
- **Decision:** Enroll under the **Language Metrics company entity**, not an individual's personal developer account, ensuring continuity across staffing changes.

### Decision 7: Observability & Crash Reporting Stack
- **Context:** Production mobile apps require symbolicated crash reporting and telemetry.
- **Options:**
  1. *(Recommended)* **Sentry for React Native / Expo:** Captures native and JavaScript crashes, breadcrumbs, and performance traces in one dashboard.
  2. **PostHog:** Lightweight client-side event tracking for student search, booking, and class join funnels.

### Decision 8: Minimum Supported OS Versions
- **Decision:** Target **iOS 15.0+** and **Android 8.0+ (API Level 26)**. This covers >96% of active devices in India and globally while avoiding legacy polyfill overhead.

---

## 4. Immediate Developer Account Provisioning Checklist

Because account verification has the longest lead time, the following actions should be initiated immediately by the organization:

### Apple Developer Program (Organization)
- [ ] Confirm company legal name: **Language Metrics Private Limited** (or exact legal entity name).
- [ ] Request / lookup D-U-N-S Number via Dun & Bradstreet ([dnb.com](https://www.dnb.com/duns-number.html)).
- [ ] Ensure the organization has an active website and a corporate email address (e.g. `@languagemetrics.com`).
- [ ] Submit enrollment at [developer.apple.com/programs](https://developer.apple.com/programs/) ($99 USD/year).
- [ ] Enable Apple Small Business Program (reduces store commission from 30% to 15% for developers earning < $1M/year).

### Google Play Console
- [ ] Register Google Play Console developer account at [play.google.com/console/signup](https://play.google.com/console/signup) ($25 USD one-time fee).
- [ ] Complete developer identity verification with corporate registration documents (GSTIN / Certificate of Incorporation).
- [ ] Link Google Payments merchant account to facilitate User Choice Billing / Play Billing payouts.

---

## 5. Phased Roadmap (Post-Phase 0)

```
Phase 0 (This Week: Sep 8-15) [COMPLETE]
  ├── Web responsiveness audit & Playwright viewport suite
  ├── packages/api-contracts extracted & typed
  └── apps/student-mobile Expo scaffolded with secure storage
       │
Phase 1 (Weeks 1-2): Authentication & Custom Dev Client
  ├── Deploy /api/v1/auth/mobile endpoints (Bearer RS256 token exchange)
  ├── Setup EAS custom development build (native module preparation)
  └── Establish shared mobile design system components
       │
Phase 2 (Weeks 3-6): Core Feature Parity
  ├── Teacher discovery, language filtering & search
  ├── Slot selection and booking creation flow
  └── Coin balance display & transaction history
       │
Phase 3 (Weeks 7-8): Live Video & Notifications
  ├── LiveKit React Native WebRTC SDK integration
  ├── Class room controls (mic/camera toggle, speaker switch)
  └── Expo push notifications for booking confirmations & class reminders
       │
Phase 4 (Weeks 9-10): Payments & Hardening
  ├── StoreKit / Play Billing / Razorpay integration per Decision 2 & 3
  ├── Security hardening & penetration testing pass
  └── Internal TestFlight (iOS) and Closed Testing (Play Console) beta release
       │
Phase 5 (Weeks 11-12): Store Submission & Launch
  ├── Store listing screenshots, privacy policy URL, data safety declarations
  ├── App Store and Google Play store reviews
  └── Staged production rollout (10% → 25% → 50% → 100%)
```

---

## 6. Sign-Off & Approvals

| Role | Name | Signature / Status | Date |
|------|------|--------------------|------|
| **Intern / Full Stack Developer** | Paarth Gupta | *Submitted* | Sep 8, 2026 |
| **Technical Lead** | Priyanshu Raj | *Pending Review* | ____________ |

*All Phase 0 artifacts and code changes are verified, documented, and ready on branch `feature/student-mobile-responsive-phase-0`.*
