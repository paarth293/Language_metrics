"use server";
import { db } from "@repo/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, readSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import { authenticateAdmin } from "@/lib/auth-service";
import { CSRF_COOKIE } from "@/lib/csrf";
import { cookies } from "next/headers";

export interface LoginState {
  error?: string;
  email?: string;
  password?: string;
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
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ip = await getClientIp();
  const csrfCookie = (await cookies()).get(CSRF_COOKIE)?.value;
  const csrfForm = String(formData.get("csrf_token") ?? "");
  const totpCode = String(formData.get("totp") ?? "");

  const result = await authenticateAdmin(email, password, ip, csrfCookie, csrfForm, totpCode);

  if (!result.success) {
    if (result.error === "2FA_REQUIRED") {
      return { error: result.error, email, password };
    }
    return { error: result.error };
  }

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

