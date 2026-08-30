import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { rateLimit } from "@/lib/rate-limit";
import { verifyAccessToken } from "@/lib/tokens";

/**
 * POST /api/auth/upload
 * Accepts a multipart/form-data file upload for teacher registration documents.
 * Files are stored in public/uploads/temp/ with a unique name.
 *
 * Allowed types: PDF only
 * Max size: 10MB
 *
 * Returns: { url: string, filename: string }
 */

const ALLOWED_TYPES = new Set([
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set(["pdf"]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "temp");

export async function POST(request: NextRequest) {
  // If an access token is provided, verify it; otherwise allow temp registration upload
  const accessToken = request.cookies.get("lm_access_token")?.value;
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (!payload?.sub) {
      return NextResponse.json({ message: "Invalid or expired token." }, { status: 401 });
    }
  }

  // Rate limit: 10 uploads per minute per IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip, { windowMs: 60_000, max: 10 })) {
    return NextResponse.json(
      { message: "Too many upload attempts. Please wait and try again." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "Invalid form data." },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { message: "No file provided." },
      { status: 400 }
    );
  }

  // Validate file type
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        message:
          "Invalid file type. Only PDF files are accepted.",
      },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
      },
      { status: 400 }
    );
  }

  // Generate safe filename — sanitize extension to prevent path traversal
  const rawExt = file.name.split(".").pop() || "pdf";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "pdf";
  // Double-check extension is allowed
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ message: "Invalid file extension." }, { status: 400 });
  }
  const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  // Ensure upload directory exists
  await mkdir(UPLOAD_DIR, { recursive: true });

  // Write file
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(UPLOAD_DIR, safeName);

  try {
    await writeFile(filePath, buffer);
  } catch (err) {
    console.error("[Upload] Failed to write file:", err);
    return NextResponse.json(
      { message: "Failed to save file. Please try again." },
      { status: 500 }
    );
  }

  // Return the public URL
  const url = `/uploads/temp/${safeName}`;

  return NextResponse.json({ url, filename: safeName }, { status: 201 });
}
