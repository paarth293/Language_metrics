/**
 * Demo classes — a short, fixed-price first class with a teacher.
 *
 * A demo is booked and billed exactly like any other class: the price is held
 * at booking, the class is metered, and settlement charges only the minutes
 * taught (never more than the hold). What differs is the price and length,
 * which are platform-wide rather than per teacher, and that each student gets
 * one demo per teacher.
 */
import { db, type Prisma } from "@repo/database";

export const DEMO_CLASS_COINS = 29;
export const DEMO_CLASS_MINUTES = 45;

export class DemoAlreadyUsedError extends Error {
  constructor() {
    super("You have already booked a demo class with this teacher.");
    this.name = "DemoAlreadyUsedError";
  }
}

/** A cancelled demo does not count — the student never got it. */
export async function hasUsedDemo(
  studentId: string,
  teacherId: string,
  client: Prisma.TransactionClient | typeof db = db
): Promise<boolean> {
  const existing = await client.booking.findFirst({
    where: { studentId, teacherId, type: "DEMO", status: { not: "CANCELLED" } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Call inside the transaction that creates the demo booking. Takes a lock on
 * the student–teacher pair first so two simultaneous requests cannot both see
 * "no demo yet" and both book one.
 */
export async function assertDemoAvailable(
  tx: Prisma.TransactionClient,
  studentId: string,
  teacherId: string
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`demo:${studentId}:${teacherId}`}))`;
  if (await hasUsedDemo(studentId, teacherId, tx)) throw new DemoAlreadyUsedError();
}
