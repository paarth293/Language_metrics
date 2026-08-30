import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/students/teacher/[id]
 * Returns a specific teacher's public profile for students.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;

    // Fetch teacher profile with all relations
    const teacher = await db.teacherProfile.findUnique({
      where: { userId: id },
      include: {
        rates: true,
        availability: true,
        reviews: true,
      },
    });

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    if (teacher.status !== "APPROVED") {
      return NextResponse.json({ error: "Teacher not available" }, { status: 404 });
    }

    // Fetch reviewer names separately
    const reviewerIds = [...new Set(teacher.reviews.map((r) => r.studentId))];
    const reviewers = await db.studentProfile.findMany({
      where: { userId: { in: reviewerIds } },
      select: { userId: true, name: true },
    });
    const reviewerMap = new Map(reviewers.map((r) => [r.userId, r.name]));

    // Calculate average rating
    const avgRating =
      teacher.reviews.length > 0
        ? teacher.reviews.reduce((sum, r) => sum + r.rating, 0) /
          teacher.reviews.length
        : 0;

    return NextResponse.json({
      teacher: {
        id: teacher.userId,
        name: teacher.name,
        avatarUrl: teacher.avatarUrl,
        bio: teacher.bio,
        experienceLevel: teacher.experienceLevel,
        language: teacher.language,
        languages: teacher.languages,
        demoVideoUrl: teacher.demoVideoUrl,
      },
      rates: teacher.rates.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount,
      })),
      reviews: teacher.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        studentName: reviewerMap.get(r.studentId) || "Student",
        createdAt: r.createdAt,
      })),
      availability: teacher.availability.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      stats: {
        totalReviews: teacher.reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Error fetching teacher profile:", error);
    return NextResponse.json(
      { error: "Failed to load teacher profile" },
      { status: 500 }
    );
  }
}
