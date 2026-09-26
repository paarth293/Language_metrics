import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MIN_AGE, dateOfBirthSchema, parseDateOfBirth } from "@/features/auth/validators/auth";

/**
 * POST /api/auth/date-of-birth
 * Body: { dateOfBirth: "YYYY-MM-DD" }
 *
 * For accounts created before DOB collection: records the date once. It only
 * fills an empty value — an existing DOB is never overwritten here.
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request, "STUDENT", "TEACHER");
  if (auth.error) return auth.error;
  const { sub: userId, role } = auth.user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const minAge = role === "TEACHER" ? MIN_AGE.TEACHER : MIN_AGE.STUDENT;
  const result = dateOfBirthSchema(minAge).safeParse((body as { dateOfBirth?: unknown })?.dateOfBirth);
  if (!result.success) {
    return NextResponse.json({ message: result.error.issues[0]?.message ?? "Invalid date of birth." }, { status: 400 });
  }
  const dateOfBirth = parseDateOfBirth(result.data);

  const where = { userId, dateOfBirth: null };
  const { count } =
    role === "TEACHER"
      ? await db.teacherProfile.updateMany({ where, data: { dateOfBirth } })
      : await db.studentProfile.updateMany({ where, data: { dateOfBirth } });

  if (count === 0) {
    return NextResponse.json({ message: "Date of birth is already set." }, { status: 409 });
  }
  return NextResponse.json({ success: true }, { status: 200 });
}
