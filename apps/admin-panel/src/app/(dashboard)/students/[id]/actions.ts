"use server";

import { db } from "@repo/database";
import { requirePermission } from "@/lib/guards";
import { revalidatePath } from "next/cache";

export async function updateStudentStatus(studentId: string, status: "ACTIVE" | "SUSPENDED" | "BLOCKED") {
  await requirePermission("students:manage");
  await db.studentProfile.update({
    where: { userId: studentId },
    data: { status }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/students`);
}
