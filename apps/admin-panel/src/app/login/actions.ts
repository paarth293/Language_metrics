"use server";

import { db } from "@repo/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createSession, destroySession, readSession } from "@/lib/session";
import { rateLimit, clearRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";
import { auditLog, recordLoginAttempt } from "@/lib/audit";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_ATTEMPTS = 10;

export interface LoginState {
  error?: string;
}

// A valid bcrypt hash compared against unknown emails so the code path (and
// therefore the response time) is identical whether or not the account exists.
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomUUID());
  return dummyHash;
}

async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

export async function loginAction(
  _prev: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ip = await getClientIp();

  // CSRF defense in depth (SameSite=strict is the primary control).
  const sameOrigin = await assertSameOrigin();
  if (!sameOrigin) {
    await recordLoginAttempt(email, ip, "FAILED", null);
    return { error: "Invalid request origin." };
  }

  // Per-IP rate limit.
  const ipKey = `login:ip:${ip ?? "unknown"}`;
  const rl = rateLimit(ipKey, { limit: IP_MAX_ATTEMPTS, windowMs: IP_WINDOW_MS });
  if (!rl.ok) {
    await recordLoginAttempt(email, ip, "RATE_LIMITED", null);
    return { error: "Too many attempts from this network. Try again later." };
  }

  const admin = await db.adminUser.findUnique({ where: { email } });

  // Account lockout check before spending the bcrypt comparison.
  if (admin && admin.lockedUntil && admin.lockedUntil > new Date()) {
    await recordLoginAttempt(email, ip, "LOCKED", admin.userId);
    return { error: "Account is temporarily locked due to failed attempts." };
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
    }
    await recordLoginAttempt(email, ip, "FAILED", admin?.userId ?? null);
    return { error: "Invalid credentials or account is not active." };
  }

  await createSession({
    sub: admin.userId,
    email: admin.email,
    roleKey: admin.roleKey,
    isSuperAdmin: admin.isSuperAdmin,
  });

  clearRateLimit(ipKey);
  await db.adminUser.update({
    where: { userId: admin.userId },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await recordLoginAttempt(email, ip, "SUCCESS", admin.userId);

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const session = await readSession();
  if (session) {
    await auditLog({ adminId: session.sub }, "LOGOUT", session.sub, { email: session.email });
  }
  await destroySession();
  redirect("/login");
}
