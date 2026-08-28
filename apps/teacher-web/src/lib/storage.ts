/**
 * Cloud storage abstraction for file uploads.
 *
 * Supports:
 *   1. S3-compatible storage (AWS S3, MinIO, Cloudflare R2)
 *   2. Supabase Storage
 *   3. Local filesystem (development fallback)
 *
 * Configuration (env vars):
 *   STORAGE_PROVIDER     — "s3" | "supabase" | "local" (default: "local")
 *   STORAGE_BUCKET       — bucket name (default: "lm-uploads")
 *   STORAGE_REGION       — S3 region (default: "ap-south-1")
 *   STORAGE_ACCESS_KEY   — S3 access key
 *   STORAGE_SECRET_KEY   — S3 secret key
 *   STORAGE_ENDPOINT     — custom S3 endpoint (for MinIO / R2)
 *   STORAGE_PUBLIC_URL   — public URL prefix (for CDN / bucket URL)
 *   SUPABASE_URL         — Supabase project URL
 *   SUPABASE_SERVICE_KEY — Supabase service role key
 */

import { promises as fs } from "fs";
import path from "path";

const PROVIDER = (process.env.STORAGE_PROVIDER ?? "local") as "s3" | "supabase" | "local";
const BUCKET = process.env.STORAGE_BUCKET ?? "lm-uploads";
const PUBLIC_URL = process.env.STORAGE_PUBLIC_URL ?? "";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

export interface UploadOptions {
  folder: string;         // e.g. "teachers", "sessions", "documents"
  allowedTypes: string[]; // MIME types
  maxSizeBytes?: number;  // default 10MB
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Upload a file to the configured storage provider.
 */
export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string,
  options: UploadOptions
): Promise<UploadResult> {
  const { folder, allowedTypes, maxSizeBytes = DEFAULT_MAX_SIZE } = options;

  // Validate
  if (file.length > maxSizeBytes) {
    throw new Error(`File exceeds maximum size of ${maxSizeBytes / 1024 / 1024}MB`);
  }
  if (!allowedTypes.includes(contentType)) {
    throw new Error(`File type "${contentType}" is not allowed. Accepted: ${allowedTypes.join(", ")}`);
  }

  // Generate unique key using cryptographically secure random
  const ext = filename.split(".").pop() || "bin";
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";
  const key = `${folder}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${safeExt}`;

  switch (PROVIDER) {
    case "s3":
      return uploadToS3(file, key, contentType);
    case "supabase":
      return uploadToSupabase(file, key, contentType);
    default:
      return uploadToLocal(file, key, contentType);
  }
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<void> {
  switch (PROVIDER) {
    case "s3":
      return deleteFromS3(key);
    case "supabase":
      return deleteFromSupabase(key);
    default:
      return deleteFromLocal(key);
  }
}

/**
 * Get a signed/temporary URL for private files.
 */
export async function getFileUrl(key: string, expiresIn?: number): Promise<string> {
  if (PUBLIC_URL) {
    return `${PUBLIC_URL}/${key}`;
  }
  switch (PROVIDER) {
    case "s3":
      return getS3SignedUrl(key, expiresIn);
    default:
      return `/uploads/${key}`;
  }
}

// ─── S3 Implementation ───────────────────────────────────────────────────

async function uploadToS3(file: Buffer, key: string, contentType: string): Promise<UploadResult> {
  if (PROVIDER !== "s3") throw new Error("S3 provider not configured");
  // Lazy load S3 client only at runtime
  let S3Client, PutObjectCommand;
  try {
    ({ S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3"));
  } catch (e) {
    throw new Error("AWS S3 SDK not installed. Install @aws-sdk/client-s3 to use S3 storage.");
  }

  const client = new S3Client({
    region: process.env.STORAGE_REGION ?? "ap-south-1",
    endpoint: process.env.STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
    },
  });

  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
    ACL: "public-read",
  }));

  const url = PUBLIC_URL
    ? `${PUBLIC_URL}/${key}`
    : `https://${BUCKET}.s3.${process.env.STORAGE_REGION ?? "ap-south-1"}.amazonaws.com/${key}`;

  return { url, key, size: file.length, contentType };
}

async function deleteFromS3(key: string): Promise<void> {
  if (PROVIDER !== "s3") return;
  let S3Client, DeleteObjectCommand;
  try {
    ({ S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3"));
  } catch (e) {
    console.warn("AWS S3 SDK not installed, delete skipped.");
    return;
  }
  const client = new S3Client({
    region: process.env.STORAGE_REGION ?? "ap-south-1",
    endpoint: process.env.STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
    },
  });
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

async function getS3SignedUrl(key: string, expiresIn = 3600): Promise<string> {
  if (PROVIDER !== "s3") throw new Error("S3 provider not configured");
  let S3Client, GetObjectCommand, getSignedUrl;
  try {
    ({ S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3"));
    ({ getSignedUrl } = await import("@aws-sdk/s3-request-presigner"));
  } catch (e) {
    throw new Error("AWS S3 SDK not installed. Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner.");
  }
  const client = new S3Client({
    region: process.env.STORAGE_REGION ?? "ap-south-1",
    endpoint: process.env.STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
    },
  });
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

// ─── Supabase Implementation ─────────────────────────────────────────────

async function uploadToSupabase(file: Buffer, key: string, contentType: string): Promise<UploadResult> {
  if (PROVIDER !== "supabase") throw new Error("Supabase provider not configured");
  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch (e) {
    throw new Error("Supabase SDK not installed. Install @supabase/supabase-js.");
  }
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_KEY ?? ""
  );

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { contentType, upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, key, size: file.length, contentType };
}

async function deleteFromSupabase(key: string): Promise<void> {
  if (PROVIDER !== "supabase") return;
  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch (e) {
    console.warn("Supabase SDK not installed, delete skipped.");
    return;
  }
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_KEY ?? ""
  );
  await supabase.storage.from(BUCKET).remove([key]);
}

// ─── Local Filesystem Implementation ─────────────────────────────────────

async function uploadToLocal(file: Buffer, key: string, contentType: string): Promise<UploadResult> {
  const filePath = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, file);

  return {
    url: `/uploads/${key}`,
    key,
    size: file.length,
    contentType,
  };
}

async function deleteFromLocal(key: string): Promise<void> {
  const filePath = path.join(UPLOAD_DIR, key);
  await fs.unlink(filePath).catch(() => {}); // ignore if not found
}

/**
 * Get storage provider info (for diagnostics / admin).
 */
export function getStorageInfo(): { provider: string; bucket: string; configured: boolean } {
  return {
    provider: PROVIDER,
    bucket: BUCKET,
    configured: PROVIDER !== "local" || true, // local always works
  };
}
