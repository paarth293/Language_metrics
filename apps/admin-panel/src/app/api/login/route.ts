import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@repo/database";
import {
  ADMIN_SESSION_COOKIE,
  CSRF_COOKIE,
  signAdminToken,
} from "@/lib/auth";
import { assertValidOrigin, csrfTokensMatch } from "@/lib/csrf";
import { checkAndRecordLoginAttempt } from "@/lib/rate-limit";
import { clientIp, writeAuditLog } from "@/lib/audit";
import { consumeBackupCode, verifyTotpCode } from "@/lib/totp";

export const runtime = "nodejs";

function redirectLogin(req: NextRequest, error: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const userAgent = req.headers.get("user-agent");

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const totpCode = String(formData.get("totp_code") ?? "").trim();
  const csrfForm = String(formData.get("csrf_token") ?? "");

  // 1) Rate limit by IP + username (before CSRF so probes still get 429)
  if (checkAndRecordLoginAttempt(ip, username)) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  // 2) CSRF — Origin allowlist (missing / forged → 403)
  const originResult = assertValidOrigin(req.headers.get("origin"));
  if (!originResult.ok) {
    return new NextResponse(originResult.message, {
      status: originResult.status,
    });
  }

  // Double-submit: if csrf cookie was issued (browser GET /login), require match
  const csrfCookie = req.cookies.get(CSRF_COOKIE)?.value;
  if (csrfCookie && !csrfTokensMatch(csrfCookie, csrfForm)) {
    return new NextResponse("Invalid CSRF token", { status: 403 });
  }

  // 3) Lookup admin user (never compare plaintext hardcoded credentials)
  const user = await db.user.findFirst({
    where: {
      role: "ADMIN",
      OR: [{ username }, { email: username }],
    },
  });

  const passwordOk =
    !!user?.passwordHash &&
    (await bcrypt.compare(password, user.passwordHash));

  if (!user || !passwordOk) {
    await writeAuditLog({
      eventType: "LOGIN_FAILURE",
      actorId: username || "unknown",
      ipAddress: ip,
      userAgent,
      outcome: "failure",
    });
    return redirectLogin(req, "Invalid username or password");
  }

  // 4) TOTP / backup code (required when 2FA is enabled)
  if (user.totpEnabled) {
    if (!totpCode) {
      await writeAuditLog({
        eventType: "LOGIN_FAILURE",
        actorId: user.id,
        adminId: user.id,
        ipAddress: ip,
        userAgent,
        outcome: "failure",
      });
      return redirectLogin(req, "Authenticator code required");
    }

    let totpOk = false;
    if (user.totpSecret) {
      totpOk = await verifyTotpCode(user.totpSecret, totpCode);
    }

    if (!totpOk && user.backupCodes?.length) {
      const remaining = await consumeBackupCode(totpCode, user.backupCodes);
      if (remaining) {
        totpOk = true;
        await db.user.update({
          where: { id: user.id },
          data: { backupCodes: remaining },
        });
      }
    }

    if (!totpOk) {
      await writeAuditLog({
        eventType: "LOGIN_FAILURE",
        actorId: user.id,
        adminId: user.id,
        ipAddress: ip,
        userAgent,
        outcome: "failure",
      });
      // 401 so security tests see a clear auth failure (also redirect for browsers)
      const accept = req.headers.get("accept") ?? "";
      if (accept.includes("text/html")) {
        return redirectLogin(req, "Invalid authenticator code");
      }
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const token = await signAdminToken({
    sub: user.id,
    role: "ADMIN",
    username: user.username ?? user.email,
  });

  await writeAuditLog({
    eventType: "LOGIN_SUCCESS",
    actorId: user.id,
    adminId: user.id,
    ipAddress: ip,
    userAgent,
    outcome: "success",
  });

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });
  return res;
}
