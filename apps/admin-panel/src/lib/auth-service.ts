import { db } from "@repo/database";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { rateLimit, clearRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";
import { recordLoginAttempt, auditLog } from "@/lib/audit";
import { verifyTotpCode, consumeBackupCode } from "@/lib/totp";
import { csrfTokensMatch } from "@/lib/csrf";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_ATTEMPTS = 10;

export interface AuthResult {
  success: boolean;
  error?: string;
}

// A valid bcrypt hash compared against unknown emails so the code path (and
// therefore the response time) is identical whether or not the account exists.
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomUUID());
  return dummyHash;
}

export async function authenticateAdmin(
  emailInput: string,
  passwordInput: string,
  ipInput: string | null,
  csrfCookie: string | undefined,
  csrfForm: string,
  totpCodeInput: string
): Promise<AuthResult> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput;
  const ip = ipInput;
  const totpCode = totpCodeInput.trim();

  if (!csrfTokensMatch(csrfCookie, csrfForm)) {
    return { success: false, error: "Invalid request. Please refresh and try again." };
  }

  // CSRF defense in depth (SameSite=strict is the primary control).
  const sameOrigin = await assertSameOrigin();
  if (!sameOrigin) {
    await recordLoginAttempt(email, ip, "FAILED", null);
    return { success: false, error: "Invalid request origin." };
  }

  // Per-IP rate limit.
  const ipKey = `login:ip:${ip ?? "unknown"}`;
  const rl = rateLimit(ipKey, { limit: IP_MAX_ATTEMPTS, windowMs: IP_WINDOW_MS });
  if (!rl.ok) {
    await recordLoginAttempt(email, ip, "RATE_LIMITED", null);
    return { success: false, error: "Too many attempts from this network. Try again later." };
  }

  // Per-email rate limit (prevents distributed brute-force against one account).
  const emailKey = `login:email:${email}`;
  const emailRl = rateLimit(emailKey, { limit: MAX_FAILED_LOGINS, windowMs: LOCKOUT_MS });
  if (!emailRl.ok) {
    await recordLoginAttempt(email, ip, "RATE_LIMITED", null);
    return { success: false, error: "Too many login attempts for this account. Try again later." };
  }

  const admin = await db.adminUser.findUnique({
    where: { email },
    include: {
      user: {
        select: {
          totpEnabled: true,
          totpSecret: true,
          backupCodes: true,
        },
      },
    },
  });

  // Account lockout check before spending the bcrypt comparison.
  if (admin && admin.lockedUntil && admin.lockedUntil > new Date()) {
    await recordLoginAttempt(email, ip, "LOCKED", admin.userId);
    return { success: false, error: "Account is temporarily locked due to failed attempts." };
  }

  const hash = admin ? admin.passwordHash : await getDummyHash();
  const ok = await verifyPassword(password, hash);

  if (!admin || !ok || admin.status !== "ACTIVE") {
    if (admin) {
      const nextCount = admin.failedLoginCount + 1;
      await db.adminUser.update({
        where: { userId: admin.userId },
        data: {
          failedLoginCount: nextCount,
          lockedUntil: nextCount >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS) : null,
        },
      });
      await auditLog({ adminId: admin.userId, ip }, "LOGIN_FAILURE", admin.userId);
    }
    await recordLoginAttempt(email, ip, "FAILED", admin?.userId ?? null);
    return { success: false, error: "Invalid credentials or account is not active." };
  }

  // ── TOTP gate ──────────────────────────────────────────────────────────
  if (admin.user?.totpEnabled && admin.user?.totpSecret) {
    if (!totpCode) {
      // No code submitted — tell the client to show the TOTP field.
      return { success: false, error: "2FA_REQUIRED" };
    }

    // Try TOTP first, then backup code
    const totpOk = await verifyTotpCode(admin.user.totpSecret, totpCode);
    if (!totpOk) {
      // Try as backup code
      const remaining = await consumeBackupCode(
        totpCode,
        admin.user.backupCodes ?? []
      );
      if (remaining === null) {
        await recordLoginAttempt(email, ip, "FAILED", admin.userId);
        return { success: false, error: "Invalid two-factor authentication code." };
      }
      // Backup code consumed — update the remaining codes in DB
      await db.user.update({
        where: { id: admin.userId },
        data: { backupCodes: remaining },
      });
    }
  }

  // ── Session creation (only reached after all gates pass) ──────────────
  clearRateLimit(ipKey);
  clearRateLimit(emailKey);
  await db.adminUser.update({
    where: { userId: admin.userId },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  
  const session = await createSession({
    sub: admin.userId,
    email: admin.email,
    roleKey: admin.roleKey,
    isSuperAdmin: admin.isSuperAdmin,
  });
  
  await recordLoginAttempt(email, ip, "SUCCESS", admin.userId);
  await auditLog({ adminId: admin.userId, ip }, "LOGIN_SUCCESS", admin.userId);

  return { success: true };
}
