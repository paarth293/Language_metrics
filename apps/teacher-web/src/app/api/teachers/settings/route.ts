import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";
import { z } from "zod";

const settingsSchema = z.object({
  hourlyRate: z.number().min(0).optional(),
  courseRate: z.number().min(0).optional(),
  availability: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
  })).optional(),
});

export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const profile = await TeacherService.getProfileWithSettings(auth.user.sub);
    if (!profile) {
      return NextResponse.json({ message: "Teacher profile not found." }, { status: 404 });
    }
    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    console.error("GET /api/teachers/settings error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const result = settingsSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ message: "Invalid data", errors: result.error.format() }, { status: 400 });
    }
    
    const { hourlyRate, courseRate, availability } = result.data;
    
    // Update rates if provided
    if (hourlyRate !== undefined && courseRate !== undefined) {
      await TeacherService.updateRates(auth.user.sub, hourlyRate, courseRate);
    }
    
    // Update availability if provided
    if (availability !== undefined) {
      await TeacherService.updateAvailability(auth.user.sub, availability);
    }

    return NextResponse.json({ message: "Settings updated successfully" }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/teachers/settings error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
