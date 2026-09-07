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
import { uploadFile, deleteFile } from "./storage";
import { existsSync, readFileSync, rmSync } from "fs";
import path from "path";

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`PASS  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
    if (detail !== undefined) console.log("      " + JSON.stringify(detail));
  }
}

async function main() {
  const content = Buffer.from("fake-image-bytes-for-test");
  const result = await uploadFile(content, "photo.png", "image/png", {
    folder: "chat-attachments",
    allowedTypes: ["image/png", "image/jpeg"],
    maxSizeBytes: 1024 * 1024,
  });

  check(
    typeof result.url === "string" && result.url.startsWith("/uploads/chat-attachments/"),
    "returns a real resolvable URL (was: fake URL = original filename, file bytes discarded)",
    result
  );
  check(
    result.key.startsWith("chat-attachments/") && result.key.endsWith(".png"),
    "key is namespaced to the folder with the right extension",
    result
  );

  const diskPath = path.join(process.cwd(), "public", "uploads", result.key);
  const onDisk = existsSync(diskPath);
  check(onDisk, "file bytes were actually written to disk (the bug: old chat route never called this at all)", diskPath);
  if (onDisk) {
    const written = readFileSync(diskPath);
    check(written.equals(content), "written bytes match the uploaded content exactly");
  }

  let rejectedType = false;
  try {
    await uploadFile(content, "evil.exe", "application/x-msdownload", {
      folder: "chat-attachments",
      allowedTypes: ["image/png"],
    });
  } catch {
    rejectedType = true;
  }
  check(rejectedType, "disallowed content-type is rejected");

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
  check(rejectedSize, "oversized file is rejected");

  await deleteFile(result.key);
  check(!existsSync(diskPath), "deleteFile() removes the uploaded file");

  // Clean up the directory this test created so repeated runs (and a clean
  // checkout) don't accumulate an empty public/uploads tree.
  rmSync(path.join(process.cwd(), "public", "uploads", "chat-attachments"), { recursive: true, force: true });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
