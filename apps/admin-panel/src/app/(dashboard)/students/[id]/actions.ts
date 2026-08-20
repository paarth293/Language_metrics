"use server";

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { revalidatePath } from "next/cache";

export async function updateStudentStatus(studentId: string, status: "ACTIVE" | "SUSPENDED" | "BLOCKED") {
  await requireAdmin();
  await db.studentProfile.update({
    where: { userId: studentId },
    data: { status }
  });
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/students`);
}
