"use server";

/**
 * "Invite Admin" server action (errors.md #F1).
 *
 * Design notes / why it works this way:
 *
 * - No email sending is wired up anywhere in this codebase yet (see
 *   SECURITY.md's own "known gaps" list), so this does NOT pretend to email
 *   an invite link. Instead it generates a strong random temporary password
 *   server-side, creates the account with `mustChangePassword: true`, and
 *   shows that password to the inviting admin exactly once (never persisted
 *   in plaintext, never logged). The inviting admin relays it to the new
 *   admin through whatever secure channel they already use (Slack DM,
 *   password manager share, etc.). This is the same "temporary password,
 *   forced change on first login" pattern AWS IAM and most admin panels use
 *   when there's no transactional email provider configured.
 * - `mustChangePassword: true` plugs directly into the existing, already-
 *   working gate in lib/guards.ts (`requireAdmin()`), which redirects any
 *   admin with that flag set to /settings/change-password before they can
 *   reach anything else — and that page already clears the flag on success
 *   (see settings/change-password/actions.ts). Nothing new had to be built
 *   for the "first login forces a real password" half of this flow.
 * - Privilege-escalation guard: creating a SUPER_ADMIN account is only
 *   allowed for an already-existing SUPER_ADMIN. `admin-users:manage` can in
 *   principle be granted to a non-super-admin via a per-user permission
 *   override (see lib/permissions.ts), and without this check such an admin
 *   could mint themselves (or an accomplice) a brand new SUPER_ADMIN account
 *   through this very form — a full privilege escalation. isSuperAdmin is
 *   the one thing this form must never let a non-super-admin control.
 * - Email uniqueness is checked against the shared `User` table, not just
 *   `AdminUser` — a match there is blocked outright rather than silently
 *   attaching admin credentials to whatever that row already is (a
 *   teacher/student account, for instance). apps/admin-panel/scripts/
 *   create-admin.mjs takes the more permissive upsert-by-email approach,
 *   which is acceptable for a CLI tool run by whoever already has server/DB
 *   access; a web form reachable by any permissioned admin gets the more
 *   conservative behavior here on purpose.
 */

import { headers } from "next/headers";
import { randomInt } from "crypto";
import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { hashPassword } from "@/lib/password";
import { auditLog } from "@/lib/audit";
import { inviteAdminSchema, parseBody } from "@/lib/validators";

export interface InviteAdminState {
  error?: string;
  success?: boolean;
  temporaryPassword?: string;
  createdEmail?: string;
}

async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

/**
 * A random temporary password that also happens to satisfy
 * changePasswordSchema's complexity rule (12+ chars, upper, lower, digit,
 * special) — not because this value is ever validated against that schema
 * (it isn't; only the admin's own chosen replacement password is), but so
 * the very first password this account ever has isn't visibly weaker than
 * what the app requires everyone to set for themselves.
 */
function generateTemporaryPassword(): string {
  // eslint-disable-next-line no-secrets/no-secrets
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — avoid visual ambiguity
  // eslint-disable-next-line no-secrets/no-secrets
  const lower = "abcdefghijkmnopqrstuvwxyz"; // no l
  const digits = "23456789"; // no 0/1
  const special = "!@#$%^&*-_+=";
  const all = upper + lower + digits + special;

  const pick = (pool: string) => pool[randomInt(pool.length)]!;

  // Guarantee at least one of each required class, then fill the rest
  // randomly, then shuffle so the guaranteed characters aren't always in
  // the same four positions.
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = chars.length; i < 16; i++) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

export async function inviteAdminAction(
  _prev: InviteAdminState | null,
  formData: FormData
): Promise<InviteAdminState> {
  const admin = await requireAdmin();

  if (!hasPermission(admin, "admin-users:manage")) {
    return { error: "You don't have permission to create admin accounts." };
  }

  const parsed = parseBody(inviteAdminSchema, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    roleKey: String(formData.get("roleKey") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error };
  }
  const { name, email, roleKey } = parsed.data;

  // Privilege-escalation guard — see module doc comment above.
  if (roleKey === "SUPER_ADMIN" && !admin.isSuperAdmin) {
    return { error: "Only a Super Admin can create another Super Admin account." };
  }

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      error: "An account with this email already exists. Use a different email address.",
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const newUser = await db.user.create({
    data: { id: crypto.randomUUID(), email, role: "ADMIN" },
  });

  await db.adminUser.create({
    data: {
      userId: newUser.id,
      name,
      email,
      passwordHash,
      roleKey,
      status: "ACTIVE",
      isSuperAdmin: roleKey === "SUPER_ADMIN",
      mustChangePassword: true,
    },
  });

  const ip = await getClientIp();
  await auditLog(
    { adminId: admin.id, ip },
    "CREATE_ADMIN_USER",
    newUser.id,
    { email, roleKey, invitedBy: admin.email }
  );

  return { success: true, temporaryPassword, createdEmail: email };
}
