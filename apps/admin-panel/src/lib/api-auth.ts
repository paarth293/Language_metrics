import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { readSession } from "./session";
import { permissionsForRole } from "./permissions";
import { hasPermission, type SessionUser } from "./rbac";
import type { Permission } from "./permissions";

export type ApiAuth =
  | { ok: true; admin: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Guards an API route. Verifies the session JWT (signature + expiry), then
 * reloads the admin from the DB so status/role changes are effective
 * immediately, and checks an optional permission.
 */
export async function requireApiAdmin(
  request: Request,
  permission?: Permission
): Promise<ApiAuth> {
  const session = await readSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

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
    },
  });

  if (!admin || admin.status !== "ACTIVE") {
    return { ok: false, response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  const user: SessionUser = {
    id: admin.userId,
    email: admin.email,
    name: admin.name,
    roleKey: admin.roleKey,
    isSuperAdmin: admin.isSuperAdmin,
    permissions: permissionsForRole(admin.roleKey, admin.permissions),
  };

  if (permission && !hasPermission(user, permission)) {
    return { ok: false, response: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, admin: user };
}
