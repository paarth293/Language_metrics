/**
 * Verifies uploadFile() (this module) actually persists a file and returns
 * a resolvable URL — the function chat/[teacherId]/route.ts's POST handler
 * now calls instead of discarding the uploaded file entirely and storing
 * only its original filename as a fake "attachmentUrl". STORAGE_PROVIDER is
 * unset by default, so this exercises the "local" fallback path, which is
 * also what a fresh dev checkout uses before any storage env vars are set.
 *
 * Writes and cleans up a temporary file under ./public/uploads — safe to
 * run repeatedly, and safe in CI (no network, no real cloud credentials).
 *
 * Run with: tsx src/lib/storage.test.ts
 * (No install needed — no external imports beyond Node's own fs/path.)
 */
import { test, expect } from "vitest";
import { uploadFile, deleteFile } from "./storage";
import { existsSync, readFileSync, rmSync } from "fs";
import path from "path";

test("storage upload, validation, and delete", async () => {
  const content = Buffer.from("fake-image-bytes-for-test");
  const result = await uploadFile(content, "photo.png", "image/png", {
    folder: "chat-attachments",
    allowedTypes: ["image/png", "image/jpeg"],
    maxSizeBytes: 1024 * 1024,
  });

  expect(typeof result.url).toBe("string");
  expect(result.url.startsWith("/uploads/chat-attachments/")).toBe(true);
  expect(result.key.startsWith("chat-attachments/")).toBe(true);
  expect(result.key.endsWith(".png")).toBe(true);

  const diskPath = path.join(process.cwd(), "public", "uploads", result.key);
  expect(existsSync(diskPath)).toBe(true);
  const written = readFileSync(diskPath);
  expect(written.equals(content)).toBe(true);

  let rejectedType = false;
  try {
    await uploadFile(content, "evil.exe", "application/x-msdownload", {
      folder: "chat-attachments",
      allowedTypes: ["image/png"],
    });
  } catch {
    rejectedType = true;
  }
  expect(rejectedType).toBe(true);

  let rejectedSize = false;
  try {
    await uploadFile(Buffer.alloc(2000), "big.png", "image/png", {
      folder: "chat-attachments",
      allowedTypes: ["image/png"],
      maxSizeBytes: 1000,
    });
  } catch {
    rejectedSize = true;
  }
  expect(rejectedSize).toBe(true);

  await deleteFile(result.key);
  expect(existsSync(diskPath)).toBe(false);

  rmSync(path.join(process.cwd(), "public", "uploads", "chat-attachments"), { recursive: true, force: true });
});
