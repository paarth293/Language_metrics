"use server";

import { db } from "@repo/database";
import { requirePermission } from "@/lib/guards";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateTeacherStatus(teacherId: string, status: "PENDING" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED") {
  await requirePermission("teachers:manage");
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

  redirect(`/teachers?filter=${new Map(Object.entries(filterParams)).get(status)}`);
}

export async function markDocumentStatus(documentId: string, teacherId: string, status: "PENDING" | "APPROVED" | "REJECTED") {
  await requirePermission("teachers:manage");
  await db.teacherDocument.update({
    where: { id: documentId },
    data: { status }
  });
  revalidatePath(`/teachers/${teacherId}`);
}

export async function createPayout(teacherId: string, amount: number, note: string) {
  await requirePermission("coins:adjust");

  await db.payout.create({
    data: {
      teacherId,
      amount,
      status: "PAID",
      periodStart: new Date(),
      periodEnd: new Date(),
      transactionRef: note
    }
  });

  revalidatePath(`/teachers/${teacherId}`);
}

