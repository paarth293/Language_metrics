"use server";

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateTeacherStatus(teacherId: string, status: "PENDING" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED") {
  await requireAdmin();
  await db.teacherProfile.update({
    where: { userId: teacherId },
    data: { status }
  });
  revalidatePath(`/teachers/${teacherId}`);
  revalidatePath(`/teachers`);
  
  const filterParams: Record<string, string> = {
    APPROVED: 'approved',
    REJECTED: 'suspended',
    INTERVIEW_SCHEDULED: 'pending',
    PENDING: 'pending',
  };
  
  redirect(`/teachers?filter=${filterParams[status]}`);
}

export async function markDocumentStatus(documentId: string, teacherId: string, status: "PENDING" | "APPROVED" | "REJECTED") {
  await requireAdmin();
  await db.teacherDocument.update({
    where: { id: documentId },
    data: { status }
  });
  revalidatePath(`/teachers/${teacherId}`);
}

export async function updateQAStatus(teacherId: string, qaStatus: boolean) {
  // If we had a specific QA status field. Let's just use a general update if needed,
  // or we can add notes to the teacher profile.
  // We'll leave it as a placeholder or we can use `experienceLevel` or a new field.
  // The schema doesn't have an explicit 'QA status' or 'BGV status' field on TeacherProfile other than `status`.
  // Wait, BGV and QA might be separate tables or JSON fields. Since we can't change the schema without migrations, we will just use the available fields.
}
