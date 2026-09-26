import { z } from "zod";
import { db, adjust, getCoinBalance, InsufficientCoinsError, type CoinBalance } from "@repo/database";
import { verifyPassword } from "./password";
import { verifyTotpCode } from "./totp";
import { rateLimit } from "./rate-limit";
import { recordSecurityEvent } from "./audit";
import type { SessionUser } from "./rbac";

// Manual coin adjustments move real money outside the payment flow, so every
// one of them is gated by, in order:
//
//   1. the `coins:adjust` permission (checked by the route),
//   2. a per-admin rate limit,
//   3. step-up re-authentication: the admin's password, plus a TOTP code when
//      their account has 2FA — a stolen session cookie alone is not enough,
//   4. target rules: students and teachers only, never an admin, never yourself,
//   5. a hard per-adjustment ceiling and a rolling 24h per-admin ceiling,
//      checked under a per-admin advisory lock so parallel requests cannot
//      both slip under the cap,
//
// and lands as one transaction: ledger entry, balance update and audit row
// commit together or not at all.

export const MAX_SINGLE_ADJUSTMENT = 10_000;
export const DAILY_ADJUSTMENT_LIMIT = Number(process.env.ADMIN_COIN_DAILY_LIMIT ?? 50_000);
/** Adjustments at or above this size also raise a security event. */
export const LARGE_ADJUSTMENT = 5_000;

export const coinAdjustmentSchema = z.object({
  direction: z.enum(["CREDIT", "DEBIT"]),
  amount: z
    .number()
    .int("Amount must be a whole number of coins.")
    .min(1, "Amount must be at least 1 coin.")
    .max(MAX_SINGLE_ADJUSTMENT, `A single adjustment cannot exceed ${MAX_SINGLE_ADJUSTMENT.toLocaleString("en-IN")} coins.`),
  reason: z
    .string()
    .trim()
    .min(10, "Give a reason of at least 10 characters.")
    .max(500, "Keep the reason under 500 characters."),
  /** Generated once per form submission so a retry or double click is a no-op. */
  requestId: z.string().uuid("Invalid request id."),
  password: z.string().min(1, "Enter your password to confirm.").max(200),
  totpCode: z.string().trim().max(20).optional(),
});

export type CoinAdjustmentInput = z.infer<typeof coinAdjustmentSchema>;

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export type CoinAdjustmentResult =
  | { ok: true; balance: CoinBalance; duplicate: boolean }
  | { ok: false; status: number; message: string; code?: "TOTP_REQUIRED" };

/** Ledger key for one adjustment. Scoped by admin so the daily cap can find them. */
export function adjustmentKey(adminId: string, requestId: string): string {
  return `admin-adjust:${adminId}:${requestId}`;
}

function fail(status: number, message: string, code?: "TOTP_REQUIRED"): CoinAdjustmentResult {
  return { ok: false, status, message, code };
}

export async function applyCoinAdjustment(
  admin: SessionUser,
  targetUserId: string,
  input: CoinAdjustmentInput,
  meta: RequestMeta
): Promise<CoinAdjustmentResult> {
  const rl = await rateLimit(`coins:adjust:${admin.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return fail(429, "Too many coin adjustments. Try again later.");

  // ── Step-up re-authentication ──────────────────────────────────────────
  const stepUpRl = await rateLimit(`coins:stepup:${admin.id}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!stepUpRl.ok) return fail(429, "Too many confirmation attempts. Try again in 15 minutes.");

  const self = await db.adminUser.findUnique({
    where: { userId: admin.id },
    select: { passwordHash: true, user: { select: { totpEnabled: true, totpSecret: true } } },
  });
  if (!self) return fail(401, "Unauthorized");

  const passwordOk = await verifyPassword(input.password, self.passwordHash);
  if (!passwordOk) {
    await recordSecurityEvent("COIN_ADJUST_STEPUP_FAILED", "WARN", { targetUserId, reason: "password" }, admin.id, meta.ip);
    return fail(403, "Incorrect password.");
  }
  if (self.user.totpEnabled && self.user.totpSecret) {
    if (!input.totpCode) return fail(403, "Enter the 6-digit code from your authenticator app.", "TOTP_REQUIRED");
    if (!(await verifyTotpCode(self.user.totpSecret, input.totpCode))) {
      await recordSecurityEvent("COIN_ADJUST_STEPUP_FAILED", "WARN", { targetUserId, reason: "totp" }, admin.id, meta.ip);
      return fail(403, "Invalid authenticator code.", "TOTP_REQUIRED");
    }
  }

  // ── Target rules ───────────────────────────────────────────────────────
  if (targetUserId === admin.id) return fail(403, "You cannot adjust your own coin balance.");

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true, adminUser: { select: { userId: true } } },
  });
  if (!target) return fail(404, "User not found.");
  if (target.adminUser || (target.role !== "STUDENT" && target.role !== "TEACHER")) {
    return fail(403, "Coins can only be adjusted for student and teacher accounts.");
  }

  // ── Money movement ─────────────────────────────────────────────────────
  const key = adjustmentKey(admin.id, input.requestId);
  const delta = input.direction === "CREDIT" ? input.amount : -input.amount;
  const description = `Admin ${input.direction === "CREDIT" ? "credit" : "debit"} by ${admin.email}: ${input.reason}`;

  try {
    const outcome = await db.$transaction(async (tx) => {
      // Serialise this admin's adjustments so the cap check below cannot race.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`coin-adjust:${admin.id}`}))`;

      const existing = await tx.coinTransaction.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
      if (existing) return { kind: "done" as const, duplicate: true, balance: await getCoinBalance(target.id, tx) };

      const [{ used }] = await tx.$queryRaw<Array<{ used: number }>>`
        SELECT COALESCE(SUM(ABS("amount")), 0)::int AS "used"
          FROM "CoinTransaction"
         WHERE "type" = 'ADJUSTMENT'
           AND "idempotencyKey" LIKE ${`admin-adjust:${admin.id}:%`}
           AND "createdAt" > NOW() - INTERVAL '24 hours'
      `;
      if (used + input.amount > DAILY_ADJUSTMENT_LIMIT) {
        return { kind: "capExceeded" as const, remaining: Math.max(0, DAILY_ADJUSTMENT_LIMIT - used) };
      }

      const balance = await adjust({ userId: target.id, delta, description, idempotencyKey: key }, tx);

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          eventType: input.direction === "CREDIT" ? "COINS_CREDITED" : "COINS_DEBITED",
          actorId: target.id,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
          outcome: JSON.stringify({
            targetType: "User",
            targetEmail: target.email,
            targetRole: target.role,
            amount: input.amount,
            delta,
            reason: input.reason,
            balanceAfter: balance.balance,
            idempotencyKey: key,
          }),
        },
      });

      await tx.notification.create({
        data: {
          userId: target.id,
          type: "PAYMENT_UPDATE",
          title: input.direction === "CREDIT" ? "Coins added to your wallet" : "Coins removed from your wallet",
          message:
            input.direction === "CREDIT"
              ? `${input.amount} coins were added to your wallet by our team.`
              : `${input.amount} coins were removed from your wallet by our team.`,
        },
      });

      return { kind: "done" as const, duplicate: false, balance };
    });

    if (outcome.kind === "capExceeded") {
      return fail(
        422,
        `This would exceed your 24-hour adjustment limit of ${DAILY_ADJUSTMENT_LIMIT.toLocaleString("en-IN")} coins. ` +
          `You can adjust up to ${outcome.remaining.toLocaleString("en-IN")} more.`
      );
    }

    if (!outcome.duplicate && input.amount >= LARGE_ADJUSTMENT) {
      await recordSecurityEvent(
        "LARGE_COIN_ADJUSTMENT",
        "WARN",
        { targetUserId: target.id, targetEmail: target.email, delta, reason: input.reason },
        admin.id,
        meta.ip
      );
    }

    return { ok: true, balance: outcome.balance, duplicate: outcome.duplicate };
  } catch (err) {
    if (err instanceof InsufficientCoinsError) {
      return fail(409, "The user does not have enough spendable coins to remove that many.");
    }
    throw err;
  }
}
