# Routing Fixes Track Record

This document tracks the routing fixes applied to the student dashboard following the automated audit.

## Issues Identified
During the student dashboard audit, two routing bugs were identified:
1. **Teacher Profile Page:** The "Book a Class" button routed to `/teacher/[id]/book` (resulting in a 404 error) instead of `/student/teacher/[id]/book`.
2. **Teacher Booking Page:** The "Back to Profile" link routed to `/teacher/[id]` (resulting in a 404 error) instead of `/student/teacher/[id]`.

## Fixes Applied

### 1. Fixed "Book a Class" Button
- **File Edited:** `apps/teacher-web/src/app/student/teacher/[id]/page.tsx`
- **Change Made:** Updated the `href` attribute on the `<Link>` component.
- **Before:** ``href={`/teacher/${id}/book`}``
- **After:** ``href={`/student/teacher/${id}/book`}``

### 2. Fixed "Back to Profile" Link
- **File Edited:** `apps/teacher-web/src/app/student/teacher/[id]/book/page.tsx`
- **Change Made:** Updated the `href` attribute on the `<Link>` component.
- **Before:** ``href={`/teacher/${teacherId}`}``
- **After:** ``href={`/student/teacher/${teacherId}`}``

## Verification
- Both links now correctly include the `/student/` prefix.
- The routing will now keep the user correctly inside the student layout/portal, preventing the 404 Not Found error.

### 3. Demo Rate Change (49 to 29)
- **Files Edited:**
  - `apps/teacher-web/src/app/api/students/discover/route.ts`
  - `apps/student-web/src/app/api/students/discover/route.ts`
  - `apps/teacher-web/src/app/faq/page.tsx`
  - `packages/database/prisma/seed.mjs`
- **Change Made:** Reduced the demo class charge globally from 49 coins (4900 paise) to 29 coins (2900 paise).
- **Backend Sync:** Ran a live database script to immediately update the `PlatformSetting` row `DEMO_CLASS_FEE` to `2900`.

### 4. Discover Page Filters Linked to Database
- **Files Edited:**
  - `apps/teacher-web/src/app/api/students/discover/route.ts`
  - `apps/student-web/src/lib/validation.ts`
  - `apps/student-web/src/lib/discover-query.ts`
- **Change Made:** The UI filters for Budget (Hourly), Experience, Gender, and Available Now were originally unhandled or poorly handled by the API. They are now fully wired up end-to-end to correctly filter Prisma queries:
  - Added support for `minRate`, `maxRate`, `experienceLevel`, `gender`, and `availability: { some: {} }` logic into the database search query.

### 5. Filter UI Options Database Sync
- **Files Edited:**
  - `apps/teacher-web/src/app/student/discover/page.tsx`
- **Change Made:** Discovered a mismatch where the frontend Experience filter was sending unmapped enum values (`BEGINNER`, `INTERMEDIATE`, `EXPERT`) while the Prisma database schema (`TeacherExperienceLevel`) only supported `FRESHER` and `EXPERIENCED`. 
- **Resolution:** Updated the frontend UI dropdown choices in `EXPERIENCE_LEVELS` to perfectly match the backend enum values (`FRESHER`, `EXPERIENCED`) ensuring queries no longer crash or silently drop filters.

### 6. Filters Matched Against Real Stored Values
Sections 4 and 5 wired the filters up, but they still returned wrong or empty results because the query compared against values the database never holds. Checked against the live `TeacherProfile` rows:
- **Gender:** stored as free text (`"male"` from registration, `"Male"` from onboarding) while the UI sends `"MALE"`. Now matched case-insensitively.
- **Language:** onboarding stores ISO codes (`"en"`, `"fr"`, `"pl"`) while the UI sends names (`"English"`). New `getLanguageAliases()` in both apps' `lib/languages.ts` matches name and code (and `"Chinese"` → `zh`). Search uses the same aliasing.
- **Budget:** `TeacherRate.amount` is in paise but was compared to rupee budgets (₹350 = `35000` never fell in "₹200–₹500") and shown as "₹35000". Budget is now converted to paise and filtered in the database query (the old in-memory filter ran after `take: limit`, so pages could come back short or empty). `hourlyRate` in the response is now in rupees.
- **student-web specifically:** its page still offered `BEGINNER`/`INTERMEDIATE`/`EXPERT` (Prisma threw → "Failed to load teachers"), and its validator read `minPrice`/`maxPrice` while the page sends `minRate`/`maxRate`, so Budget was ignored. Both fixed; unknown experience values now return 400.
- Teacher cards show language names, de-duplicated (was `pl • pl • en`).
- **Files Edited:** both `api/students/discover/route.ts`, both `lib/languages.ts`, `apps/student-web/src/lib/{discover-query,validation}.ts` (+ tests), `apps/student-web/src/app/(authenticated)/discover/page.tsx`.
