"use server";

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { revalidatePath } from "next/cache";

export async function updatePlatformSettings(formData: FormData) {
  await requireAdmin();
  
  const commissionPct = formData.get("commissionPct") as string || "30";
  const defaultClassDuration = formData.get("defaultClassDuration") as string || "60";
  const teacherMembershipFee = formData.get("teacherMembershipFee") as string || "99900";
  
  const settingsToUpdate = [
    { key: "COMMISSION_PCT", value: commissionPct },
    { key: "DEFAULT_CLASS_DURATION_MIN", value: defaultClassDuration },
    { key: "TEACHER_MEMBERSHIP_FEE", value: teacherMembershipFee },
  ];

  for (const setting of settingsToUpdate) {
    await db.platformSetting.upsert({
      where: { key: setting.key },
      create: { key: setting.key, value: setting.value },
      update: { value: setting.value }
    });
  }

  revalidatePath(`/settings`);
}
