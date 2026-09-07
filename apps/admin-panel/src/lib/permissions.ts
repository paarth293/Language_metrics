export const ALL_PERMISSIONS = [
  "dashboard:view",
  "teachers:view",
  "teachers:manage",
  "students:view",
  "students:manage",
  "languages:manage",
  "courses:manage",
  "classes:manage",
  "payments:view",
  "payments:refund",
  "invoices:manage",
  "payouts:manage",
  "recordings:manage",
  "complaints:manage",
  "reviews:view",
  "reviews:manage",
  "coupons:manage",
  "notifications:send",
  "cms:manage",
  "analytics:view",
  "settings:manage",
  "admin-users:manage",
  "audit:view",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PRESETS: Record<string, Permission[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  FINANCE_ADMIN: [
    "dashboard:view",
    "payments:view",
    "payments:refund",
    "invoices:manage",
    "payouts:manage",
    "analytics:view",
    "audit:view",
  ],
  TEACHER_ADMIN: [
    "dashboard:view",
    "teachers:view",
    "teachers:manage",
    "classes:manage",
    "recordings:manage",
  ],
  SUPPORT_ADMIN: [
    "dashboard:view",
    "students:view",
    "students:manage",
    "classes:manage",
    "complaints:manage",
    "reviews:view",
    "reviews:manage",
    "notifications:send",
  ],
  CONTENT_ADMIN: [
    "dashboard:view",
    "languages:manage",
    "courses:manage",
    "reviews:view",
    "cms:manage",
    "notifications:send",
  ],
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  FINANCE_ADMIN: "Finance Admin",
  TEACHER_ADMIN: "Teacher Admin",
  SUPPORT_ADMIN: "Support Admin",
  CONTENT_ADMIN: "Content Admin",
};

export function permissionsForRole(
  roleKey: string,
  explicit: string[]
): Permission[] {
  // Granular per-user overrides win when set; otherwise fall back to the role
  // preset. Super admins ignore this and are granted everything at auth time.
  //
  // KNOWN GAP (errors.md #N6 — flagged, not silently patched): `explicit`
  // maps to AdminUser.permissions, a non-nullable `String[] @default([])`
  // column. That means "no override was ever set" and "an admin explicitly
  // set this user's override to zero extra permissions" are stored
  // identically as `[]`, and this function can't tell them apart — an
  // override of `[]` silently falls through to the full role preset instead
  // of granting nothing. Distinguishing the two cases correctly needs a
  // schema change (e.g. a nullable `permissions String[]?` with `null`
  // meaning "no override", or a separate `permissionsOverridden Boolean`
  // flag) plus a migration, which this pass does not attempt. Until that
  // migration ships, do not rely on an empty-array override to fully lock
  // an admin out of their role's default permissions — deactivate the
  // account (`status`) or change their `roleKey` instead.
  if (explicit && explicit.length > 0) {
    const allowed = new Set<string>(ALL_PERMISSIONS);
    return explicit.filter((p) => allowed.has(p)) as Permission[];
  }
  return ROLE_PRESETS[roleKey] ?? [];
}
