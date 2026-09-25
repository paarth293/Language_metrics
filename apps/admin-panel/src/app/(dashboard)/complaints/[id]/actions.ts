"use server";

import { db } from "@repo/database";
import { requirePermission } from "@/lib/guards";
import { revalidatePath } from "next/cache";

export async function updateComplaintStatus(complaintId: string, status: "NEW" | "INVESTIGATING" | "ACTION_REQUIRED" | "RESOLVED" | "CLOSED") {
  await requirePermission("complaints:manage");
  await db.complaint.update({
    where: { id: complaintId },
    data: { status }
  });
  revalidatePath(`/complaints/${complaintId}`);
  revalidatePath(`/complaints`);
}
