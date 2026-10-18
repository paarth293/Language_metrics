# Repository restructuring validation

Date: 2026-10-15

## Changes

- Consolidated both web classrooms into `@repo/classroom`, split by responsibility.
- Consolidated Button, Input, PasswordInput, Card, Badge, and class-name helpers into `@repo/ui`.
- Consolidated language/proficiency reference data into `@repo/languages`.
- Retained app-local compatibility exports and all 226 existing route/page/layout files.
- Moved student services into consistent `features/student/services` directories.
- Added shared web compiler defaults, package lint configuration, workspace checks,
  and a quality workflow for pull requests and main/staging pushes.
- Retained the video framing and password visibility fixes from the preceding work.

## Verification

- All three Next.js production builds completed successfully.
- Workspace type checks passed; shared packages include their new test files in type checking.
- Existing workspace suites and new shared-component tests were run. The teacher
  authorization fixture was corrected to include the paid session's billing hold;
  production billing and access logic were not changed.
- Six browser smoke tests passed against the production builds: three login routes
  at desktop and mobile sizes. They check keyboard toggling, retained values, no
  unintended navigation/submission, and generated input/button geometry.
- Tailwind generated shared video and input styles for both portals.
- Structure checks passed for 13 workspaces; package manifests match the lockfile.
- Five existing lint errors were corrected without weakening lint rules: JSX
  apostrophe escaping, payout prop typing, and deriving notification count from props.

## Limits

The builds still report the existing Prisma CommonJS export warning. Existing
lint warnings remain in application code. Tests do not prove a real two-person
LiveKit call, real payment, email delivery, or every authenticated user journey.
Those require configured services and staging verification before deployment.

Legacy student routes in teacher-web remain deliberately supported. Large unrelated
pages and app-specific components were not rewritten as part of this consolidation.
See [repository ownership](../repository-structure.md) before extending them.
