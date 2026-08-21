import { headers } from "next/headers";

// Defense-in-depth against cross-site request forgery. Even with a
// SameSite=strict session cookie, we require that state-changing requests come
// from the exact same origin that serves the panel.
export async function assertSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (!origin || !host) return false;
  const proto = h.get("x-forwarded-proto") ?? "http";
  return origin === `${proto}://${host}`;
}
