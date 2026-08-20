"use server";

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { revalidatePath } from "next/cache";

export async function addCourse(formData: FormData) {
  await requireAdmin();
  const name = formData.get("name") as string;
  const languageId = formData.get("languageId") as string;
  const level = formData.get("level") as string;
  const durationWeeks = parseInt(formData.get("durationWeeks") as string || "4");
  const classCount = parseInt(formData.get("classCount") as string || "8");
  const classDurationMin = parseInt(formData.get("classDurationMin") as string || "60");
  const price = parseInt(formData.get("price") as string || "0"); // in paise

  await db.course.create({
    data: {
      name,
      languageId,
      level,
      durationWeeks,
      classCount,
      classDurationMin,
      price,
      status: "DRAFT",
      published: false,
    }
  });
  revalidatePath(`/courses`);
}

export async function toggleCourseStatus(id: string, published: boolean) {
  await requireAdmin();
  await db.course.update({
    where: { id },
    data: { 
      published: !published, 
      status: !published ? "ACTIVE" : "DRAFT" 
    }
  });
  revalidatePath(`/courses`);
}
