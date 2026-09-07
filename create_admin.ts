/**
 * DISABLED — this script used to create a SUPER_ADMIN account with a
 * hardcoded email/password (admin@gmail.com / 12345678). That is a
 * critical credential-exposure risk: anyone with read access to this repo
 * (or its git history) could log in to the admin panel with full
 * superadmin privileges. It has been neutralized rather than silently
 * left in place.
 *
 * ACTION REQUIRED (do this manually, it isn't done for you):
 *   1. Delete this file from the repository entirely.
 *   2. If this script was EVER run against any real (staging or
 *      production) database, immediately find and remove/rotate the
 *      resulting AdminUser row (email: admin@gmail.com) — treat that
 *      account as compromised.
 *   3. Use apps/admin-panel/scripts/create-admin.mjs instead, which reads
 *      credentials from environment variables (ADMIN_EMAIL, ADMIN_PASSWORD,
 *      ADMIN_NAME, ADMIN_ROLE) instead of hardcoding them, and enforces a
 *      minimum password length/strength:
 *
 *        ADMIN_EMAIL=you@example.com \
 *        ADMIN_NAME="Your Name" \
 *        ADMIN_PASSWORD="a-strong-unique-password" \
 *        ADMIN_ROLE=SUPER_ADMIN \
 *        node --env-file=.env apps/admin-panel/scripts/create-admin.mjs
 */
throw new Error(
  "create_admin.ts is disabled (hardcoded credentials). Delete this file and use " +
    "apps/admin-panel/scripts/create-admin.mjs instead — see the comment at the top of this file."
);
