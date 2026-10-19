import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const T = (n: number) => `22222222-2222-4222-8222-${n.toString().padStart(12, "0")}`;
const at = (minutes: number) => new Date(Date.parse("2026-10-01T00:00:00.000Z") + minutes * 60_000);

type Booking = { teacherId: string; createdAt: Date };
type Teacher = { userId: string; name: string; avatarUrl: string | null; language: string | null };
type Message = { id: string; senderId: string; receiverId: string; content: string; createdAt: Date };

const data = vi.hoisted(() => ({
  bookings: [] as Booking[],
  teachers: [] as Teacher[],
  messages: [] as Message[],
  calls: [] as { model: string; method: string; args: unknown }[],
}));

const fullUser = (userId: string) => ({ id: userId, email: "t@example.test", passwordHash: "$2b$secret", totpSecret: "secret" });
const teacherOf = (id: string) => data.teachers.find((t) => t.userId === id)!;

vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: STUDENT, role: "STUDENT" } }) }));
vi.mock("@/lib/db", () => {
  const record = (model: string, method: string, args: unknown) => data.calls.push({ model, method, args });
  const prisma = {
    booking: {
      // Today's query: every booking, with the teacher's full user row.
      findMany: async (args: unknown) => {
        record("booking", "findMany", args);
        return [...data.bookings]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((b) => ({ ...b, studentId: STUDENT, teacher: { ...teacherOf(b.teacherId), user: fullUser(b.teacherId) } }));
      },
      groupBy: async (args: unknown) => {
        record("booking", "groupBy", args);
        const latest = new Map<string, Date>();
        for (const b of data.bookings) {
          const seen = latest.get(b.teacherId);
          if (!seen || b.createdAt > seen) latest.set(b.teacherId, b.createdAt);
        }
        return Array.from(latest, ([teacherId, createdAt]) => ({ teacherId, _max: { createdAt } }));
      },
    },
    teacherProfile: {
      findMany: async (args: { where: { userId: { in: string[] } } }) => {
        record("teacherProfile", "findMany", args);
        return data.teachers.filter((t) => args.where.userId.in.includes(t.userId));
      },
    },
    chatMessage: {
      findFirst: async (args: { where: { OR: { senderId: string; receiverId: string }[] } }) => {
        record("chatMessage", "findFirst", args);
        const [a, b] = [args.where.OR[0].senderId, args.where.OR[0].receiverId];
        return [...data.messages]
          .filter((m) => (m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a))
          .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())[0] ?? null;
      },
      findMany: async (args: unknown) => {
        record("chatMessage", "findMany", args);
        return [...data.messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },
    },
    // Newest message per counterpart, as the DISTINCT ON query would return it.
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      record("$queryRaw", "sql", { sql: strings.join("?"), values });
      const newest = new Map<string, Message>();
      for (const m of data.messages) {
        const other = m.senderId === STUDENT ? m.receiverId : m.senderId;
        const seen = newest.get(other);
        if (!seen || m.createdAt > seen.createdAt) newest.set(other, m);
      }
      return Array.from(newest, ([counterpart, m]) => ({ counterpart, content: m.content, createdAt: m.createdAt }));
    },
  };
  return { prisma, db: prisma };
});

function seed(threadCount: number) {
  data.calls = [];
  data.teachers = Array.from({ length: threadCount }, (_, i) => ({
    userId: T(i),
    name: `Teacher ${i}`,
    avatarUrl: i % 2 ? `https://img.example/${i}.png` : null,
    language: i % 3 ? "Spanish" : null,
  }));
  data.bookings = data.teachers.flatMap((t, i) => [
    { teacherId: t.userId, createdAt: at(i) },
    { teacherId: t.userId, createdAt: at(i + 1000) }, // a later booking with the same teacher
  ]);
  // Every teacher except the first has messages; the newest is from the teacher.
  data.messages = data.teachers.slice(1).flatMap((t, i) => [
    { id: `a${i}`, senderId: STUDENT, receiverId: t.userId, content: `hello ${i}`, createdAt: at(2000 + i) },
    { id: `b${i}`, senderId: t.userId, receiverId: STUDENT, content: `<b>reply</b> ${i}`, createdAt: at(3000 + i) },
  ]);
}

async function getThreads() {
  const { GET } = await import("./route");
  const res = await GET(new NextRequest("http://localhost/api/students/chat"));
  return { status: res.status, body: await res.json() };
}

function containsKey(value: unknown, key: string): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([k, v]) => k === key || containsKey(v, key));
}

describe("GET /api/students/chat (thread list)", () => {
  beforeEach(() => seed(3));

  it("returns the same thread shape, newest conversation first", async () => {
    const { status, body } = await getThreads();
    expect(status).toBe(200);
    expect(body.threads).toEqual([
      { teacherId: T(2), teacherName: "Teacher 2", teacherAvatar: null, language: "Spanish", lastMessage: "reply 1", lastMessageTime: at(3001).toISOString(), unreadCount: 0 },
      { teacherId: T(1), teacherName: "Teacher 1", teacherAvatar: "https://img.example/1.png", language: "Spanish", lastMessage: "reply 0", lastMessageTime: at(3000).toISOString(), unreadCount: 0 },
      { teacherId: T(0), teacherName: "Teacher 0", teacherAvatar: null, language: "General", lastMessage: "No messages yet", lastMessageTime: at(1000).toISOString(), unreadCount: 0 },
    ]);
  });

  it("removes HTML from teacher names and message previews", async () => {
    data.teachers[2].name = "<img src=x onerror=alert(1)>Eve<script>x</script>";
    data.messages.push({ id: "x", senderId: T(2), receiverId: STUDENT, content: "<script>alert(1)</script>hi<b>!</b>", createdAt: at(9000) });
    data.messages.push({ id: "y", senderId: T(1), receiverId: STUDENT, content: "<i></i>", createdAt: at(8000) });
    const { body } = await getThreads();
    const [eve, one] = body.threads;
    expect(eve.teacherName).toBe("Evex");
    expect(eve.lastMessage).toBe("alert(1)hi!");
    expect(one.lastMessage).toBe("No messages yet");
  });

  it("never loads a teacher's full user record", async () => {
    await getThreads();
    const loadsUser = data.calls.filter((c) => containsKey(c.args, "user"));
    expect(loadsUser).toEqual([]);
  });

  it("never loads every message in the conversations", async () => {
    await getThreads();
    const unbounded = data.calls.filter((c) => c.model === "chatMessage" && !containsKey(c.args, "take"));
    expect(unbounded).toEqual([]);
  });

  it("uses a fixed number of queries however many threads there are", async () => {
    await getThreads();
    const few = data.calls.length;
    seed(50);
    await getThreads();
    expect(data.calls.length).toBe(few);
  });

  it("passes the user id to raw SQL as a parameter, never inside the SQL text", async () => {
    await getThreads();
    const raw = data.calls.filter((c) => c.model === "$queryRaw");
    expect(raw).toHaveLength(1);
    const { sql, values } = raw[0].args as { sql: string; values: unknown[] };
    expect(sql).not.toContain(STUDENT);
    expect(values).toContain(STUDENT);
  });
});
