import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./auth";
import type { AdminSessionToken, VerifiedSession } from "./auth";

const isProd = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true, // JS can never read the token -> XSS cannot exfiltrate the session
  secure: isProd, // only sent over TLS in production
  sameSite: "strict" as const, // blocks cross-site request forgery
  path: "/",
};

export async function createSession(payload: AdminSessionToken): Promise<void> {
  const token = signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    ...baseCookieOptions,
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
}

export async function readSession(): Promise<VerifiedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
