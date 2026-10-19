import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const TEACHER = "22222222-2222-4222-8222-222222222222";
const S = (n: number) => `11111111-1111-4111-8111-${n.toString().padStart(12, "0")}`;
const at = (minutes: number) => new Date(Date.parse("2026-10-01T00:00:00.000Z") + minutes * 60_000);

type Booking = { studentId: string; createdAt: Date };
type Student = { userId: string; name: string; avatarUrl: string | null };
type Message = { id: string; senderId: string; receiverId: string; content: string; createdAt: Date };

const data = vi.hoisted(() => ({
  bookings: [] as Booking[],
  students: [] as Student[],
  messages: [] as Message[],
  calls: [] as { model: string; method: string; args: unknown }[],
}));

const fullUser = (userId: string) => ({ id: userId, email: "s@example.test", passwordHash: "$2b$secret", totpSecret: "secret" });
const studentOf = (id: string) => data.students.find((s) => s.userId === id)!;

vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: TEACHER, role: "TEACHER" } }) }));
vi.mock("@/lib/db", () => {
  const record = (model: string, method: string, args: unknown) => data.calls.push({ model, method, args });
  const prisma = {
    booking: {
      // Today's query: every booking, with the student's full user row.
      findMany: async (args: unknown) => {
        record("booking", "findMany", args);
        return [...data.bookings]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((b) => ({ ...b, teacherId: TEACHER, student: { ...studentOf(b.studentId), user: fullUser(b.studentId) } }));
      },
      groupBy: async (args: unknown) => {
        record("booking", "groupBy", args);
        const latest = new Map<string, Date>();
        for (const b of data.bookings) {
          const seen = latest.get(b.studentId);
          if (!seen || b.createdAt > seen) latest.set(b.studentId, b.createdAt);
        }
        return Array.from(latest, ([studentId, createdAt]) => ({ studentId, _max: { createdAt } }));
      },
    },
    studentProfile: {
      findMany: async (args: { where: { userId: { in: string[] } } }) => {
        record("studentProfile", "findMany", args);
        return data.students.filter((s) => args.where.userId.in.includes(s.userId));
      },
    },
    chatMessage: {
      // Today's query: one per student (N+1).
      findFirst: async (args: { where: { OR: { senderId: string; receiverId: string }[] } }) => {
        record("chatMessage", "findFirst", args);
        const [a, b] = [args.where.OR[0].senderId, args.where.OR[0].receiverId];
        return [...data.messages]
          .filter((m) => (m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a))
          .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())[0] ?? null;
      },
    },
    // Newest message per counterpart, as the DISTINCT ON query would return it.
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      record("$queryRaw", "sql", { sql: strings.join("?"), values });
      const newest = new Map<string, Message>();
      for (const m of data.messages) {
        const other = m.senderId === TEACHER ? m.receiverId : m.senderId;
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
  data.students = Array.from({ length: threadCount }, (_, i) => ({
    userId: S(i),
    name: `Student ${i}`,
    avatarUrl: i % 2 ? `https://img.example/${i}.png` : null,
  }));
  data.bookings = data.students.flatMap((s, i) => [
    { studentId: s.userId, createdAt: at(i) },
    { studentId: s.userId, createdAt: at(i + 1000) },
  ]);
  data.messages = data.students.slice(1).flatMap((s, i) => [
    { id: `a${i}`, senderId: TEACHER, receiverId: s.userId, content: `hello ${i}`, createdAt: at(2000 + i) },
    { id: `b${i}`, senderId: s.userId, receiverId: TEACHER, content: `<b>reply</b> ${i}`, createdAt: at(3000 + i) },
  ]);
}

async function getThreads() {
  const { GET } = await import("./route");
  const res = await GET(new NextRequest("http://localhost/api/teachers/chat"));
  return { status: res.status, body: await res.json() };
}

function containsKey(value: unknown, key: string): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([k, v]) => k === key || containsKey(v, key));
}

describe("GET /api/teachers/chat (thread list)", () => {
  beforeEach(() => seed(3));

  it("returns the same thread shape, newest conversation first", async () => {
    const { status, body } = await getThreads();
    expect(status).toBe(200);
    expect(body.threads).toEqual([
      { studentId: S(2), studentName: "Student 2", studentAvatar: null, language: "General", lastMessage: "reply 1", lastMessageTime: at(3001).toISOString(), unreadCount: 0 },
      { studentId: S(1), studentName: "Student 1", studentAvatar: "https://img.example/1.png", language: "General", lastMessage: "reply 0", lastMessageTime: at(3000).toISOString(), unreadCount: 0 },
      { studentId: S(0), studentName: "Student 0", studentAvatar: null, language: "General", lastMessage: "No messages yet", lastMessageTime: at(1000).toISOString(), unreadCount: 0 },
    ]);
  });

  it("removes HTML from student names and message previews", async () => {
    data.students[2].name = "<img src=x onerror=alert(1)>Eve<script>x</script>";
    data.messages.push({ id: "x", senderId: S(2), receiverId: TEACHER, content: "<script>alert(1)</script>hi<b>!</b>", createdAt: at(9000) });
    data.messages.push({ id: "y", senderId: S(1), receiverId: TEACHER, content: "<i></i>", createdAt: at(8000) });
    const { body } = await getThreads();
    const [eve, one] = body.threads;
    expect(eve.studentName).toBe("Evex");
    expect(eve.lastMessage).toBe("alert(1)hi!");
    expect(one.lastMessage).toBe("No messages yet");
  });

  it("never loads a student's full user record", async () => {
    await getThreads();
    expect(data.calls.filter((c) => containsKey(c.args, "user"))).toEqual([]);
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
    expect(sql).not.toContain(TEACHER);
    expect(values).toContain(TEACHER);
  });
});
