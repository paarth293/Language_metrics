import type { Permission } from "./permissions";

export interface SessionUser {
  id: string; // AdminUser.userId
  email: string;
  name: string;
  roleKey: string;
  isSuperAdmin: boolean;
  permissions: Permission[];
}

export function hasPermission(user: SessionUser, perm: Permission): boolean {
  return user.isSuperAdmin || user.permissions.includes(perm);
}
