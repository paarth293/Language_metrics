import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth-service";

export async function POST(request: NextRequest) {
  try {
    let email = "";
    let password = "";
    let csrfToken = "";
    let totpCode = "";

    // Support both JSON and URL-encoded forms
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = String(body.email ?? "");
      password = String(body.password ?? "");
      csrfToken = String(body.csrf_token ?? "");
      totpCode = String(body.totp_code ?? body.totp ?? "");
    } else {
      const formData = await request.formData();
      email = String(formData.get("email") ?? "");
      password = String(formData.get("password") ?? "");
      csrfToken = String(formData.get("csrf_token") ?? "");
      totpCode = String(formData.get("totp_code") ?? formData.get("totp") ?? "");
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const csrfCookie = request.cookies.get("csrf_token")?.value;

    const result = await authenticateAdmin(email, password, ip, csrfCookie, csrfToken, totpCode);

    if (!result.success) {
      if (result.error === "Invalid request origin." || result.error === "Invalid request. Please refresh and try again.") {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      if (result.error?.includes("Too many attempts") || result.error?.includes("Too many login attempts") || result.error?.includes("Account is temporarily locked")) {
        return NextResponse.json({ error: result.error }, { status: 429 });
      }
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return NextResponse.json({ success: true, message: "Logged in successfully" }, { status: 200 });
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
