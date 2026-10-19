import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { NextRequest } from "next/server";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const TEACHER = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({
  hasBooking: true,
  bookingWhere: [] as unknown[],
  created: [] as Record<string, unknown>[],
  findManyCalls: 0,
  stored: [] as Record<string, unknown>[],
  userId: "",
}));

vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: state.userId, role: "STUDENT" } }) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    booking: {
      findFirst: async (args: { where: unknown }) => {
        state.bookingWhere.push(args.where);
        return state.hasBooking ? { id: "booking" } : null;
      },
    },
    chatMessage: {
      findMany: async () => {
        state.findManyCalls++;
        return state.stored;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.created.push(data);
        return { id: "m1", createdAt: new Date(), ...data };
      },
    },
  },
}));

const ctx = () => ({ params: Promise.resolve({ teacherId: TEACHER }) });
const url = `http://localhost/api/students/chat/${TEACHER}`;

async function get() {
  const { GET } = await import("./route");
  const res = await GET(new NextRequest(url), ctx());
  return { status: res.status, body: await res.json() };
}

async function postJson(body: unknown) {
  const { POST } = await import("./route");
  const res = await POST(
    new NextRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    ctx()
  );
  return { status: res.status, body: await res.json() };
}

async function postRaw(body: BodyInit, headers: Record<string, string> = {}) {
  const { POST } = await import("./route");
  const res = await POST(new NextRequest(url, { method: "POST", headers, body }), ctx());
  return { status: res.status, body: await res.json() };
}

function form(fields: Record<string, string | Blob>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  // Fresh route + rate-limit modules per test, so the in-process limiter
  // (used because REDIS_URL is empty) starts from zero every time.
  vi.resetModules();
  vi.stubEnv("REDIS_URL", "");
  state.userId = STUDENT;
  state.hasBooking = true;
  state.bookingWhere = [];
  state.created = [];
  state.findManyCalls = 0;
  state.stored = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("teacher-web /api/students/chat/[teacherId]: booking check", () => {
  it("GET returns 403 when the student has no booking with the teacher", async () => {
    state.hasBooking = false;
    const { status, body } = await get();
    expect(status).toBe(403);
    expect(body.error).toBe("You don't have a conversation with this teacher.");
    expect(state.findManyCalls).toBe(0);
  });

  it("POST returns 403 when the student has no booking with the teacher, and stores nothing", async () => {
    state.hasBooking = false;
    const { status } = await postJson({ content: "hello" });
    expect(status).toBe(403);
    expect(state.created).toHaveLength(0);
  });

  it("looks the booking up as (student = caller, teacher = URL param)", async () => {
    await get();
    expect(state.bookingWhere).toEqual([{ studentId: STUDENT, teacherId: TEACHER }]);
  });

  it("allows GET and POST when there is a booking", async () => {
    expect((await get()).status).toBe(200);
    const sent = await postJson({ content: "hello" });
    expect(sent.status).toBe(201);
    expect(state.created).toHaveLength(1);
  });
});

describe("HTML cleaning", () => {
  it("GET removes HTML from message content", async () => {
    state.stored = [
      { id: "a", senderId: TEACHER, receiverId: STUDENT, content: "<script>alert(1)</script>hi<b>!</b>", attachmentUrl: null, autoDeleteAt: new Date("2099-01-01"), createdAt: new Date("2026-10-01T00:00:00Z") },
    ];
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual(["alert(1)hi!"]);
  });
});

describe("message validation (shared validateChatMessage, max 5000 characters)", () => {
  it("accepts a 5000-character message", async () => {
    const { status } = await postJson({ content: "x".repeat(5000) });
    expect(status).toBe(201);
    expect(state.created[0].content).toHaveLength(5000);
  });

  it("rejects a 5001-character JSON message with 400 and stores nothing", async () => {
    const { status, body } = await postJson({ content: "x".repeat(5001) });
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("content is too long (max 5000 characters).");
    expect(state.created).toHaveLength(0);
  });

  it("rejects a 5001-character multipart message with 400 and stores nothing", async () => {
    const { status, body } = await postRaw(form({ content: "x".repeat(5001) }));
    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(state.created).toHaveLength(0);
  });

  it("rejects non-string content with 400", async () => {
    const { status } = await postJson({ content: 123 });
    expect(status).toBe(400);
    expect(state.created).toHaveLength(0);
  });

  it("rejects an invalid JSON body with 400, not 500", async () => {
    const { status, body } = await postRaw("{not json", { "content-type": "application/json" });
    expect(status).toBe(400);
    expect(body.error).toBe("Invalid JSON body.");
  });

  it("trims the stored content", async () => {
    await postJson({ content: "  hi  " });
    expect(state.created[0].content).toBe("hi");
  });
});

describe("rate limit (student-web's: 30 messages per 60 s per user) and body size", () => {
  it("lets the 30th message in a minute through and answers the 31st with 429", async () => {
    for (let i = 1; i <= 30; i++) {
      const { status } = await postJson({ content: `message ${i}` });
      expect(status, `message ${i}`).toBe(201);
    }
    const { status, body } = await postJson({ content: "message 31" });
    expect(status).toBe(429);
    expect(body.error).toBe("Too many messages. Please slow down.");
    expect(state.created).toHaveLength(30);
  });

  it("limits each user separately", async () => {
    for (let i = 1; i <= 31; i++) await postJson({ content: `message ${i}` });
    state.userId = "33333333-3333-4333-8333-333333333333";
    expect((await postJson({ content: "from someone else" })).status).toBe(201);
  });

  it("does not limit reading messages", async () => {
    for (let i = 1; i <= 31; i++) await postJson({ content: `message ${i}` });
    expect((await get()).status).toBe(200);
  });

  it("rejects a body over 10 MB with 413 before reading it", async () => {
    const { status, body } = await postRaw("{}", {
      "content-type": "application/json",
      "content-length": String(10 * 1024 * 1024 + 1),
    });
    expect(status).toBe(413);
    expect(body.error).toBe("Request body too large.");
    expect(state.created).toHaveLength(0);
  });
});

describe("attachments (real upload through lib/storage, as student-web)", () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const PDF = Buffer.from("%PDF-1.7\n", "latin1");
  const HTML = "<html><script>alert(document.cookie)</script></html>";
  const uploaded: string[] = [];

  async function sendFile(bytes: BlobPart, name: string, type: string) {
    const res = await postRaw(form({ content: name, file: new File([bytes], name, { type }) }));
    const url = state.created.at(-1)?.attachmentUrl;
    if (res.status === 201 && typeof url === "string" && url.startsWith("/uploads/")) uploaded.push(url);
    return res;
  }

  afterAll(async () => {
    const { deleteFile } = await import("@/lib/storage");
    for (const url of uploaded) await deleteFile(url.slice("/uploads/".length));
  });

  it("uploads an image and stores its real URL, not the filename", async () => {
    const { status } = await sendFile(PNG, "photo.png", "image/png");
    expect(status).toBe(201);
    expect(state.created[0].attachmentUrl).toMatch(/^\/uploads\/chat-attachments\/\d+_[0-9a-f-]{36}\.png$/);
    expect(state.created[0].content).toBe("photo.png");
  });

  it("uploads a PDF", async () => {
    const { status } = await sendFile(PDF, "notes.pdf", "application/pdf");
    expect(status).toBe(201);
    expect(state.created[0].attachmentUrl).toMatch(/^\/uploads\/chat-attachments\/.+\.pdf$/);
  });

  it("rejects a type outside images and PDF with 400 and stores nothing", async () => {
    const { status, body } = await sendFile(HTML, "page.html", "text/html");
    expect(status).toBe(400);
    expect(body.error).toMatch(/^File type "text\/html" is not allowed/);
    expect(state.created).toHaveLength(0);
  });

  it("rejects evil.html sent as image/png with 400 and stores nothing", async () => {
    const { status, body } = await sendFile(HTML, "evil.html", "image/png");
    expect(status).toBe(400);
    expect(body.error).toBe('File type "image/png" does not match the file\'s contents.');
    expect(state.created).toHaveLength(0);
  });

  it("rejects an image over 10 MB with 400 and stores nothing", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const { status, body } = await sendFile(big, "big.png", "image/png");
    expect(status).toBe(400);
    expect(body.error).toBe("File exceeds maximum size of 10MB");
    expect(state.created).toHaveLength(0);
  });

  it("treats an empty file field as no attachment", async () => {
    const { status } = await sendFile("", "empty.png", "image/png");
    expect(status).toBe(201);
    expect(state.created[0].attachmentUrl).toBeUndefined();
  });
});
