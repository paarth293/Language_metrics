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

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/**
 * Upper bounds for one storage request, so a slow provider cannot hold the
 * function open. Exported so tests can shorten them.
 */
export const STORAGE_TIMEOUTS = { connectionMs: 5_000, requestMs: 10_000 };

/**
 * S3 client settings for those bounds. In this SDK version `requestTimeout`
 * only logs a warning unless `throwOnRequestTimeout` is set. Uploads and
 * deletes are not retried (`maxAttempts: 1`); the SDK's default of 3 attempts
 * would triple the wait.
 */
function s3TimeoutConfig() {
  return {
    maxAttempts: 1,
    requestHandler: {
      connectionTimeout: STORAGE_TIMEOUTS.connectionMs,
      requestTimeout: STORAGE_TIMEOUTS.requestMs,
      throwOnRequestTimeout: true,
    },
  };
}

/** Supabase's client takes a custom fetch; this one adds the request timeout. */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(STORAGE_TIMEOUTS.requestMs);
  return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
};

/** Storage keys are relative, bounded to the upload root, and safe to put in URLs. */
function validateStorageKey(key: string): void {
  if (!key || !/^[a-zA-Z0-9._/-]+$/.test(key) || key.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid storage key");
  }
}

function localFilePath(key: string): string {
  validateStorageKey(key);
  const root = path.resolve(UPLOAD_DIR);
  const filePath = path.resolve(root, key);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid storage key");
  return filePath;
}
 // 10MB

/**
 * Every type uploadFile can store, with the extension it is saved under and a
 * check of the file's first bytes. The claimed type comes from the client, so
 * it is only trusted when the bytes match; the extension comes from here, never
 * from the client's filename (an `evil.html` claimed as `image/png` used to be
 * saved — and, with the local provider, served — as `.html`).
 */
const startsWith = (file: Buffer, bytes: number[] | string, offset = 0) => {
  const expected = typeof bytes === "string" ? Buffer.from(bytes, "latin1") : Buffer.from(bytes);
  return file.length >= offset + expected.length && file.subarray(offset, offset + expected.length).equals(expected);
};
const HEIF_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"];
const isJpeg = (f: Buffer) => startsWith(f, [0xff, 0xd8, 0xff]);
const isPdf = (f: Buffer) => startsWith(f, "%PDF-");
const isHeif = (f: Buffer) => startsWith(f, "ftyp", 4) && HEIF_BRANDS.includes(f.subarray(8, 12).toString("latin1"));

const FILE_TYPES = new Map<string, { ext: string; matches: (file: Buffer) => boolean }>([
  ["image/jpeg", { ext: "jpg", matches: isJpeg }],
  ["image/jpg", { ext: "jpg", matches: isJpeg }],
  ["image/png", { ext: "png", matches: (f) => startsWith(f, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }],
  ["image/gif", { ext: "gif", matches: (f) => startsWith(f, "GIF87a") || startsWith(f, "GIF89a") }],
  ["image/webp", { ext: "webp", matches: (f) => startsWith(f, "RIFF") && startsWith(f, "WEBP", 8) }],
  ["application/pdf", { ext: "pdf", matches: isPdf }],
  ["application/x-pdf", { ext: "pdf", matches: isPdf }],
  ["image/heic", { ext: "heic", matches: isHeif }],
  ["image/heif", { ext: "heif", matches: isHeif }],
]);

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
  validateStorageKey(folder);

  // Validate
  if (file.length > maxSizeBytes) {
    throw new Error(`File exceeds maximum size of ${maxSizeBytes / 1024 / 1024}MB`);
  }
  if (!allowedTypes.includes(contentType)) {
    throw new Error(`File type "${contentType}" is not allowed. Accepted: ${allowedTypes.join(", ")}`);
  }

  // The claimed type must be one we can check, and the bytes must match it.
  const fileType = FILE_TYPES.get(contentType);
  if (!fileType) {
    throw new Error(`File type "${contentType}" is not supported.`);
  }
  if (!fileType.matches(file)) {
    throw new Error(`File type "${contentType}" does not match the file's contents.`);
  }

  // Random stored name; the extension comes from the checked type, never from
  // `filename` (kept in the signature for callers, but no longer used).
  const key = `${folder}/${Date.now()}_${crypto.randomUUID()}.${fileType.ext}`;

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
  validateStorageKey(key);
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
  validateStorageKey(key);
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
  // Dynamic import to avoid bundling aws-sdk when not using S3
  // @ts-ignore — optional dependency
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    ...s3TimeoutConfig(),
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
  // @ts-ignore — optional dependency
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    ...s3TimeoutConfig(),
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
  // @ts-ignore — optional dependency
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  // @ts-ignore — optional dependency
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = new S3Client({
    ...s3TimeoutConfig(),
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
  // @ts-ignore — optional dependency
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_KEY ?? "",
    { global: { fetch: fetchWithTimeout } }
  );

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, { contentType, upsert: false });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, key, size: file.length, contentType };
}

async function deleteFromSupabase(key: string): Promise<void> {
  // @ts-ignore — optional dependency
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_KEY ?? "",
    { global: { fetch: fetchWithTimeout } }
  );
  await supabase.storage.from(BUCKET).remove([key]);
}

// ─── Local Filesystem Implementation ─────────────────────────────────────

async function uploadToLocal(file: Buffer, key: string, contentType: string): Promise<UploadResult> {
  const filePath = localFilePath(key);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- localFilePath validates the key and confines it to UPLOAD_DIR.
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- localFilePath validates the key and confines it to UPLOAD_DIR.
  await fs.writeFile(filePath, file);

  return {
    url: `/uploads/${key}`,
    key,
    size: file.length,
    contentType,
  };
}

async function deleteFromLocal(key: string): Promise<void> {
  const filePath = localFilePath(key);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- localFilePath validates the key and confines it to UPLOAD_DIR.
  await fs.unlink(filePath).catch((error: unknown) => {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  });
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
