import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { readSession } from "./session";
import { permissionsForRole } from "./permissions";
import type { SessionUser } from "./rbac";

/**
 * Server-side gate used by the dashboard layout and every protected page.
 * Reads the session cookie, verifies its signature, reloads the admin from the
 * DB (so suspensions/role changes take effect immediately), and redirects to
 * /login on any failure. Never trusts the cookie alone.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await readSession();
  if (!session) redirect("/login");

  const admin = await db.adminUser.findUnique({
    where: { userId: session.sub },
    select: {
      userId: true,
      name: true,
      email: true,
      roleKey: true,
      isSuperAdmin: true,
      permissions: true,
      status: true,
      mustChangePassword: true,
    },
  });

  if (!admin || admin.status !== "ACTIVE") redirect("/login");

  // Force password change if the flag is set (except on the change-password page itself)
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  if (admin.mustChangePassword && !pathname.includes("/settings/change-password")) {
    redirect("/settings/change-password");
  }

  return {
    id: admin.userId,
    email: admin.email,
    name: admin.name,
    roleKey: admin.roleKey,
    isSuperAdmin: admin.isSuperAdmin,
    permissions: permissionsForRole(admin.roleKey, admin.permissions),
  };
}
