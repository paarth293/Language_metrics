import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { destroySession, readSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";

// Fix (errors.md #C4 residual / #N-logout-parity): the Server Action logout
// path (app/login/actions.ts -> logoutAction) audits the LOGOUT event before
// destroying the session; this REST route is the second, independent way to
// log out (used by any client-side fetch()-based "sign out" button, or
// external callers) and was calling destroySession() only — silently
// skipping the audit trail. Two logout paths with two different audit
// behaviors is exactly the kind of gap that lets an action go unlogged, so
// this now mirrors logoutAction exactly.
export async function POST(request: NextRequest) {
  const session = await readSession();
  if (session) {
    const h = request.headers;
    await auditLog(
      { adminId: session.sub },
      "LOGOUT",
      session.sub,
      {
        email: session.email,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
        userAgent: h.get("user-agent") ?? null,
      }
    );
  }
  await destroySession();
  return NextResponse.json({ success: true }, { status: 200 });
}
