import { describe, it, expect } from "vitest";
import { uploadFile, deleteFile } from "./storage";
import { existsSync, readFileSync, rmSync } from "fs";
import path from "path";

describe("storage", () => {
  it("uploads, verifies, and deletes files", async () => {
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
    const onDisk = existsSync(diskPath);
    expect(onDisk).toBe(true);
    if (onDisk) {
      const written = readFileSync(diskPath);
      expect(written.equals(content)).toBe(true);
    }

    await expect(
      uploadFile(content, "evil.exe", "application/x-msdownload", {
        folder: "chat-attachments",
        allowedTypes: ["image/png"],
      })
    ).rejects.toThrow();

    await expect(
      uploadFile(Buffer.alloc(2000), "big.png", "image/png", {
        folder: "chat-attachments",
        allowedTypes: ["image/png"],
        maxSizeBytes: 1000,
      })
    ).rejects.toThrow();

    await deleteFile(result.key);
    expect(existsSync(diskPath)).toBe(false);

    rmSync(path.join(process.cwd(), "public", "uploads", "chat-attachments"), { recursive: true, force: true });
  });
});
