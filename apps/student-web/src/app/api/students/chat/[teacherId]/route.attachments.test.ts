import { afterAll, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { deleteFile } from "@/lib/storage";

// The chat POST through the real uploadFile (local provider); the database is mocked.
const STUDENT = "11111111-1111-4111-8111-111111111111";
const TEACHER = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({ created: [] as Record<string, unknown>[] }));

vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: STUDENT, role: "STUDENT" } }) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    teacherProfile: { findUnique: async () => ({ userId: TEACHER }) },
    booking: { findFirst: async () => ({ id: "booking" }) },
    chatMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.created.push(data);
        return { id: `m${state.created.length}`, createdAt: new Date(), ...data };
      },
    },
  },
}));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const HTML = "<html><script>alert(document.cookie)</script></html>";

async function send(body: BlobPart, name: string, type: string) {
  const { POST } = await import("./route");
  const fd = new FormData();
  fd.append("content", name);
  fd.append("file", new File([body], name, { type }));
  const res = await POST(new NextRequest(`http://localhost/api/students/chat/${TEACHER}`, { method: "POST", body: fd }), {
    params: Promise.resolve({ teacherId: TEACHER }),
  });
  return { status: res.status, body: await res.json() };
}

afterAll(async () => {
  for (const m of state.created) {
    const url = m.attachmentUrl as string | undefined;
    if (url?.startsWith("/uploads/")) await deleteFile(url.slice("/uploads/".length));
  }
});

describe("student-web chat attachments with the checked uploadFile", () => {
  it("still uploads a real PNG and stores its URL", async () => {
    const { status } = await send(PNG, "photo.png", "image/png");
    expect(status).toBe(201);
    expect(state.created.at(-1)?.attachmentUrl).toMatch(/^\/uploads\/chat-attachments\/.+\.png$/);
  });

  it("rejects evil.html sent as image/png with 400 and stores no message", async () => {
    const before = state.created.length;
    const { status, body } = await send(HTML, "evil.html", "image/png");
    expect(status).toBe(400);
    expect(body.error).toBe('File type "image/png" does not match the file\'s contents.');
    expect(state.created).toHaveLength(before);
  });
});
