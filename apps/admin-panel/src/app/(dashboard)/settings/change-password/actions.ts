"use server";

import { db } from "@repo/database";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { verifyPassword, hashPassword } from "@/lib/password";
import { auditLog } from "@/lib/audit";
import { changePasswordSchema } from "@/lib/validators";

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

export async function changePasswordAction(
  _prev: ChangePasswordState | null,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await readSession();
  if (!session) redirect("/login");

  const raw = {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = await db.adminUser.findUnique({
    where: { userId: session.sub },
    select: { userId: true, passwordHash: true },
  });

  if (!admin) redirect("/login");

  const currentOk = await verifyPassword(parsed.data.currentPassword, admin.passwordHash);
  if (!currentOk) {
    return { error: "Current password is incorrect." };
  }

  // Prevent reuse of the same password
  const sameAsOld = await verifyPassword(parsed.data.newPassword, admin.passwordHash);
  if (sameAsOld) {
    return { error: "New password must be different from the current password." };
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.adminUser.update({
    where: { userId: admin.userId },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  await auditLog({ adminId: admin.userId }, "PASSWORD_CHANGED", admin.userId);

  return { success: true };
}
