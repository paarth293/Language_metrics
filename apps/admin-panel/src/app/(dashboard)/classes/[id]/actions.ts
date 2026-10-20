"use server";

import { db } from "@repo/database";
import { refundSessionHold } from "@repo/live-classes";
import { requirePermission } from "@/lib/guards";
import { revalidatePath } from "next/cache";

/**
 * Set a class session's status, and give the coins back on a cancel.
 *
 * A cancel is not just a status: the student's coins are sitting in
 * `heldBalance`, and the hold is released by the booking's own lifecycle —
 * settlement when the class runs, `cancelBookingAndReturnCoins` when the
 * student cancels. An admin cancel ends the class outside both, so it has to
 * release the hold itself or the coins are stranded.
 *
 * It releases them through `refundSessionHold`, which is the same function
 * `cancelBookingAndReturnCoins` calls for each held session, so there is one
 * body of code that moves coins on a cancel rather than two. That also carries
 * its idempotency for free: it returns early unless the billing row is still
 * HELD, and `releaseHold` below it drops a repeat of `refund:<sessionId>`. A
 * second click therefore pays nothing out again.
 *
 * The release runs in the transaction that flips the status, so the class
 * cannot end up cancelled with the hold still standing, or released with the
 * class still scheduled.
 *
 * Unlike a student cancel, this is deliberately not subject to the 4-hour
 * window: the admin path is the escape hatch for exactly the cases that
 * window refuses.
 */
export async function updateSessionStatus(sessionId: string, bookingId: string, status: "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED") {
  await requirePermission("classes:manage");
  await db.$transaction(async (tx) => {
    await tx.classSession.update({
      where: { id: sessionId },
      data: { status }
    });
    if (status === "CANCELLED") {
      // No ids, names or amounts: the session this reason is attached to
      // already says which class and which student it belongs to.
      await refundSessionHold(sessionId, "Class cancelled by an administrator", tx);
    }
  });
  revalidatePath(`/classes/${bookingId}`);
  revalidatePath(`/classes`);
}
