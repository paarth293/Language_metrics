"use server";

import { db } from "@repo/database";
import { requirePermission } from "@/lib/guards";
import { revalidatePath } from "next/cache";

export async function updateSessionStatus(sessionId: string, bookingId: string, status: "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED") {
  await requirePermission("classes:manage");
  await db.classSession.update({
    where: { id: sessionId },
    data: { status }
  });
  revalidatePath(`/classes/${bookingId}`);
  revalidatePath(`/classes`);
}

