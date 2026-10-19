import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const TEACHER = "22222222-2222-4222-8222-222222222222";
const BASE = Date.parse("2026-10-01T00:00:00.000Z");

type Row = { id: string; senderId: string; receiverId: string; content: string; attachmentUrl: string | null; autoDeleteAt: Date; createdAt: Date };

const rows = vi.hoisted(() => ({ list: [] as Row[] }));

// Minimal Prisma `where` / `orderBy` / `take` evaluator for the shapes the route uses.
function matches(row: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return (cond as Record<string, unknown>[]).every((w) => matches(row, w));
    if (key === "OR") return (cond as Record<string, unknown>[]).some((w) => matches(row, w));
    const value = new Map(Object.entries(row)).get(key) as Date | string;
    const norm = (v: unknown) => (v instanceof Date ? v.getTime() : v) as number | string;
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { gt?: unknown; lt?: unknown };
      if (c.gt !== undefined && !(norm(value) > norm(c.gt))) return false;
      if (c.lt !== undefined && !(norm(value) < norm(c.lt))) return false;
      return true;
    }
    return norm(value) === norm(cond);
  });
}

function findMany(args: { where?: Record<string, unknown>; orderBy?: unknown; take?: number }) {
  const orders = (Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : []) as Record<string, "asc" | "desc">[];
  const out = rows.list.filter((r) => matches(r, args.where)).sort((a, b) => {
    for (const o of orders) {
      const [field, dir] = Object.entries(o)[0];
      const av = new Map(Object.entries(a)).get(field) as Date | string;
      const bv = new Map(Object.entries(b)).get(field) as Date | string;
      const an = av instanceof Date ? av.getTime() : av;
      const bn = bv instanceof Date ? bv.getTime() : bv;
      if (an < bn) return dir === "asc" ? -1 : 1;
      if (an > bn) return dir === "asc" ? 1 : -1;
    }
    return 0;
  });
  return Promise.resolve(args.take === undefined ? out : out.slice(0, args.take));
}

vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: STUDENT, role: "STUDENT" } }) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    teacherProfile: { findUnique: async () => ({ userId: TEACHER }) },
    booking: { findFirst: async () => ({ id: "booking" }) },
    chatMessage: { findMany: (args: Parameters<typeof findMany>[0]) => findMany(args) },
  },
}));

const id = (i: number) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;
function seed(count: number) {
  rows.list = Array.from({ length: count }, (_, i) => ({
    id: id(i),
    senderId: i % 2 ? STUDENT : TEACHER,
    receiverId: i % 2 ? TEACHER : STUDENT,
    content: `m${i}`,
    attachmentUrl: null,
    autoDeleteAt: new Date("2099-01-01"),
    createdAt: new Date(BASE + i * 1000),
  }));
}

async function get(query = "") {
  const { GET } = await import("./route");
  const res = await GET(new NextRequest(`http://localhost/api/students/chat/${TEACHER}${query}`), {
    params: Promise.resolve({ teacherId: TEACHER }),
  });
  return { status: res.status, body: await res.json() };
}

const contents = (body: { messages: { content: string }[] }) => body.messages.map((m) => m.content);

describe("GET /api/students/chat/[teacherId] pagination", () => {
  beforeEach(() => seed(120));

  it("first load returns only the newest 50, oldest first, with cursors", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.messages).toHaveLength(50);
    expect(contents(body)[0]).toBe("m70");
    expect(contents(body)[49]).toBe("m119");
    expect(body.hasMore).toBe(true);
    expect(body.cursor.oldest).toEqual({ createdAt: new Date(BASE + 70_000).toISOString(), id: id(70) });
    expect(body.cursor.newest).toEqual({ createdAt: new Date(BASE + 119_000).toISOString(), id: id(119) });
  });

  it("?after returns only newer messages, oldest first", async () => {
    const { body } = await get(`?after=${new Date(BASE + 110_000).toISOString()}&afterId=${id(110)}`);
    expect(contents(body)).toEqual(["m111", "m112", "m113", "m114", "m115", "m116", "m117", "m118", "m119"]);
    expect(body.hasMore).toBe(false);
  });

  it("?after without an id returns everything strictly newer than the time (look-back polls)", async () => {
    const { body } = await get(`?after=${new Date(BASE + 117_000).toISOString()}`);
    expect(contents(body)).toEqual(["m118", "m119"]);
  });

  it("?after breaks createdAt ties by id", async () => {
    rows.list[119].createdAt = rows.list[118].createdAt; // same millisecond
    const { body } = await get(`?after=${rows.list[118].createdAt.toISOString()}&afterId=${id(118)}`);
    expect(contents(body)).toEqual(["m119"]);
  });

  it("?before pages back through older messages until none are left", async () => {
    const first = (await get()).body;
    const older = (await get(`?before=${first.cursor.oldest.createdAt}&beforeId=${first.cursor.oldest.id}`)).body;
    expect(contents(older)[0]).toBe("m20");
    expect(contents(older)[49]).toBe("m69");
    expect(older.hasMore).toBe(true);
    const oldest = (await get(`?before=${older.cursor.oldest.createdAt}&beforeId=${older.cursor.oldest.id}`)).body;
    expect(contents(oldest)).toHaveLength(20);
    expect(contents(oldest)[0]).toBe("m0");
    expect(oldest.hasMore).toBe(false);
  });

  it("rejects malformed cursors with 400", async () => {
    expect((await get("?after=not-a-date")).status).toBe(400);
    expect((await get(`?after=${new Date(BASE).toISOString()}&afterId=nope`)).status).toBe(400);
    expect((await get(`?after=${new Date(BASE).toISOString()}&before=${new Date(BASE).toISOString()}`)).status).toBe(400);
    expect((await get("?limit=0")).status).toBe(400);
    expect((await get("?limit=101")).status).toBe(400);
  });

  it("keeps the fields the chat page reads", async () => {
    const { body } = await get();
    expect(Object.keys(body.messages[0]).sort()).toEqual(
      ["attachmentUrl", "autoDeleteAt", "content", "createdAt", "id", "receiverId", "senderId"].sort()
    );
  });
});
