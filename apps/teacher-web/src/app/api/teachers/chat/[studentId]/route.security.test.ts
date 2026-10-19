import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const TEACHER = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({
  hasBooking: true,
  bookingWhere: [] as unknown[],
  created: [] as Record<string, unknown>[],
  findManyCalls: 0,
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
        return [];
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

beforeEach(() => {
  state.hasBooking = true;
  state.bookingWhere = [];
  state.created = [];
  state.findManyCalls = 0;
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
