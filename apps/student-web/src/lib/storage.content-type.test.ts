import { afterAll, describe, it, expect } from "vitest";
import { rmSync } from "fs";
import path from "path";
import { uploadFile } from "./storage";

// Writes through the real local provider (STORAGE_PROVIDER unset), into a
// folder only this test uses.
const FOLDER = "test-content-type";
const IMAGES_AND_PDF = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const GIF = Buffer.from("GIF89a\x01\x00\x01\x00", "latin1");
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const PDF = Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1");
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(8)]);
const HTML = Buffer.from("<html><script>alert(document.cookie)</script></html>");

const upload = (file: Buffer, name: string, type: string, allowedTypes = IMAGES_AND_PDF) =>
  uploadFile(file, name, type, { folder: FOLDER, allowedTypes, maxSizeBytes: 1024 * 1024 });

afterAll(() => {
  rmSync(path.join(process.cwd(), "public", "uploads", FOLDER), { recursive: true, force: true });
});

describe("uploadFile checks the claimed type and picks the extension", () => {
  it("rejects evil.html sent as image/png", async () => {
    await expect(upload(HTML, "evil.html", "image/png")).rejects.toThrow(
      'File type "image/png" does not match the file\'s contents.'
    );
  });

  it("stores real PNG bytes named evil.html with a .png extension", async () => {
    const result = await upload(PNG, "evil.html", "image/png");
    expect(result.key.endsWith(".png")).toBe(true);
    expect(result.url.endsWith(".png")).toBe(true);
  });

  it("uses a random stored filename, not the client's", async () => {
    const result = await upload(PNG, "my holiday photo.png", "image/png");
    expect(result.key).toMatch(/^test-content-type\/\d+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/);
    expect(result.key).not.toContain("holiday");
  });

  it("rejects a file whose bytes are a different allowed type than claimed", async () => {
    await expect(upload(PNG, "doc.pdf", "application/pdf")).rejects.toThrow("does not match");
  });

  it("rejects a type the caller allows but the helper cannot check", async () => {
    await expect(upload(HTML, "page.html", "text/html", ["text/html"])).rejects.toThrow(
      'File type "text/html" is not supported.'
    );
  });

  it("still enforces the caller's allow-list and size limit", async () => {
    await expect(upload(HEIC, "a.heic", "image/heic")).rejects.toThrow('File type "image/heic" is not allowed');
    await expect(
      uploadFile(Buffer.concat([PNG, Buffer.alloc(2000)]), "big.png", "image/png", { folder: FOLDER, allowedTypes: ["image/png"], maxSizeBytes: 1000 })
    ).rejects.toThrow("File exceeds maximum size");
  });

  it.each([
    ["image/jpeg", "jpg", JPEG],
    ["image/jpg", "jpg", JPEG],
    ["image/png", "png", PNG],
    ["image/gif", "gif", GIF],
    ["image/webp", "webp", WEBP],
    ["application/pdf", "pdf", PDF],
    ["application/x-pdf", "pdf", PDF],
    ["image/heic", "heic", HEIC],
    ["image/heif", "heif", HEIC],
  ])("accepts real %s bytes and stores them as .%s whatever the filename says", async (type, ext, bytes) => {
    const result = await upload(bytes, "upload.exe", type, [type]);
    expect(result.key.endsWith(`.${ext}`)).toBe(true);
    expect(result.contentType).toBe(type);
  });
});
