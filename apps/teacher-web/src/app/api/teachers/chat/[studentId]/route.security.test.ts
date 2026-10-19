import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const TEACHER = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({
  hasBooking: true,
  bookingWhere: [] as unknown[],
  created: [] as Record<string, unknown>[],
  findManyCalls: 0,
  stored: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: TEACHER, role: "TEACHER" } }) }));
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

const ctx = () => ({ params: Promise.resolve({ studentId: STUDENT }) });
const url = `http://localhost/api/teachers/chat/${STUDENT}`;

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
  state.hasBooking = true;
  state.bookingWhere = [];
  state.created = [];
  state.findManyCalls = 0;
  state.stored = [];
});

describe("teacher-web /api/teachers/chat/[studentId]: booking check", () => {
  it("GET returns 403 when the teacher has no booking with the student", async () => {
    state.hasBooking = false;
    const { status, body } = await get();
    expect(status).toBe(403);
    expect(body.error).toBe("You don't have a conversation with this student.");
    expect(state.findManyCalls).toBe(0);
  });

  it("POST returns 403 when the teacher has no booking with the student, and stores nothing", async () => {
    state.hasBooking = false;
    const { status } = await postJson({ content: "hello" });
    expect(status).toBe(403);
    expect(state.created).toHaveLength(0);
  });

  it("looks the booking up as (student = URL param, teacher = caller)", async () => {
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
      { id: "a", senderId: STUDENT, receiverId: TEACHER, content: "<script>alert(1)</script>hi<b>!</b>", attachmentUrl: null, autoDeleteAt: new Date("2099-01-01"), createdAt: new Date("2026-10-01T00:00:00Z") },
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
