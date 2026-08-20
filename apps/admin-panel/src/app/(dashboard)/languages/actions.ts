"use server";

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { revalidatePath } from "next/cache";

export async function addLanguage(formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const levels = parseInt(formData.get("levels") as string || "6");

  await db.language.create({
    data: {
      name,
      code,
      levels,
      status: "ACTIVE"
    }
  });
  revalidatePath(`/languages`);
}

export async function toggleLanguageStatus(id: string, currentStatus: "ACTIVE" | "INACTIVE") {
  await requireAdmin();
  await db.language.update({
    where: { id },
    data: { status: currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE" }
  });
  revalidatePath(`/languages`);
}
