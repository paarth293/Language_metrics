import { afterAll, describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { deleteFile } from "@/lib/storage";

// Runs the real route through the real uploadFile (local provider, in-process
// rate limiter), then deletes whatever it stored.
const stored: string[] = [];
let ip = 0;

const PDF = Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const HTML = "<html><script>alert(document.cookie)</script></html>";

async function upload(body: BlobPart, name: string, type: string) {
  const { POST } = await import("./route");
  const fd = new FormData();
  fd.append("file", new File([body], name, { type }));
  const res = await POST(
    new NextRequest("http://localhost/api/auth/upload", {
      method: "POST",
      headers: { "x-forwarded-for": `10.0.0.${++ip}` },
      body: fd,
    })
  );
  const json = await res.json();
  if (res.status === 201) stored.push(json.filename);
  return { status: res.status, body: json };
}

afterAll(async () => {
  for (const key of stored) await deleteFile(key);
});

describe("POST /api/auth/upload with the checked uploadFile", () => {
  it("still uploads a real PDF", async () => {
    const { status, body } = await upload(PDF, "certificate.pdf", "application/pdf");
    expect(status).toBe(201);
    expect(body.filename).toMatch(/^temp\/.+\.pdf$/);
    expect(body.url).toBe(`/uploads/${body.filename}`);
  });

  it("still uploads a real PNG", async () => {
    const { status, body } = await upload(PNG, "id-card.png", "image/png");
    expect(status).toBe(201);
    expect(body.filename).toMatch(/^temp\/.+\.png$/);
  });

  it("still uploads a PDF the browser sent without a type (filename fallback)", async () => {
    const { status, body } = await upload(PDF, "certificate.pdf", "");
    expect(status).toBe(201);
    expect(body.filename).toMatch(/\.pdf$/);
  });

  it("rejects evil.html sent as image/png with 400", async () => {
    const { status, body } = await upload(HTML, "evil.html", "image/png");
    expect(status).toBe(400);
    expect(body.message).toBe('File type "image/png" does not match the file\'s contents.');
  });

  it("rejects an untyped evil.html (route falls back to application/pdf) with 400", async () => {
    const { status } = await upload(HTML, "evil.html", "");
    expect(status).toBe(400);
  });
});
