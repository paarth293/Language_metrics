import { prisma } from "@/lib/db";

/**
 * True when this student and teacher have at least one booking together (any
 * status), the same rule as student-web's `verifyTeacherRelationship` and the
 * thread lists, which only ever show booked counterparts. Without it, the
 * chat routes let any logged-in user read or post messages with any user id.
 *
 * student-web also looks the teacher profile up first; that is redundant here
 * because `Booking.studentId` / `Booking.teacherId` are foreign keys to the
 * two profiles, so a booking can only exist when both profiles do.
 */
export async function hasBooking(studentId: string, teacherId: string): Promise<boolean> {
  const booking = await prisma.booking.findFirst({
    where: { studentId, teacherId },
    select: { id: true },
  });
  return Boolean(booking);
}
