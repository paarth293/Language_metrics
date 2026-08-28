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

import { uploadFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  // Note: We removed the strict access token requirement here because this endpoint 
  // is used during Teacher Registration before the user is fully authenticated.
  // Rate limiting and file validation provide security.

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

  // Generate safe filename
  const rawExt = file.name.split(".").pop() || "pdf";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "pdf";
  const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await uploadFile(buffer, safeName, file.type, {
      folder: "temp",
      allowedTypes: ["application/pdf"],
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
    });

    return NextResponse.json({ url: result.url, filename: result.key }, { status: 201 });
  } catch (err) {
    console.error("[Upload] Failed to upload file:", err);
    return NextResponse.json(
      { message: "Failed to save file. Please try again." },
      { status: 500 }
    );
  }
}

