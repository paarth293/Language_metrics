"use server";

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { revalidatePath } from "next/cache";

export async function updateSessionStatus(sessionId: string, bookingId: string, status: "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED") {
  await requireAdmin();
  await db.classSession.update({
    where: { id: sessionId },
    data: { status }
  });
  revalidatePath(`/classes/${bookingId}`);
  revalidatePath(`/classes`);
}
