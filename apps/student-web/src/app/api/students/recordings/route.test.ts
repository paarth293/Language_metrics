import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const TEACHER = "22222222-2222-4222-8222-222222222222";

/**
 * Columns that must never be read out of the database by this route. The
 * route's response uses two fields off TeacherProfile and nothing at all off
 * User, so a query that loads any of these is moving credential material from
 * the database into function memory for no reason.
 */
const CREDENTIAL_COLUMNS = [
  "passwordHash",
  "totpSecret",
  "backupCodes",
  "passwordResetToken",
  "emailVerificationToken",
] as const;

const data = vi.hoisted(() => ({
  calls: [] as { args: unknown; returned: unknown }[],
}));

/**
 * The stored graph, with every column a real row would carry. The fake client
 * below projects this through whatever `select`/`include` the route asks for,
 * the way Prisma does, so the test sees exactly the columns the route causes to
 * be loaded — not a hand-written stub that quietly omits the secrets.
 */
const STORED_SESSION = {
  id: "5e551011-0000-4000-8000-000000000001",
  scheduledStart: new Date("2026-10-01T10:00:00.000Z"),
  scheduledEnd: new Date("2026-10-01T11:30:00.000Z"),
  recordingUrl: "https://cdn.example.test/recordings/one.mp4",
  isRecordingPaid: true,
  status: "COMPLETED",
  roomName: "room-one",
  booking: {
    id: "b0000011-0000-4000-8000-000000000001",
    studentId: STUDENT,
    teacherId: TEACHER,
    amountPaid: 150000,
    teacher: {
      userId: TEACHER,
      name: "Aiko Tanaka",
      language: "Japanese",
      bio: "Fifteen years of teaching.",
      hourlyRate: 90000,
      user: {
        id: TEACHER,
        email: "aiko@example.test",
        role: "TEACHER",
        passwordHash: "$2b$10$DO_NOT_LOAD_THIS",
        totpSecret: "encrypted-totp-payload",
        backupCodes: ["$2b$10$code-one", "$2b$10$code-two"],
        passwordResetToken: "reset-token",
        emailVerificationToken: "verify-token",
        emailVerified: true,
      },
    },
  },
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);

/**
 * Project a stored row through a Prisma `select`/`include` argument.
 * Written with Map reads and `Object.fromEntries` rather than computed member
 * access, so it does not trip `security/detect-object-injection`.
 */
function project(node: Record<string, unknown>, args: Record<string, unknown> | undefined): unknown {
  if (!args) return node;
  const select = args.select as Record<string, unknown> | undefined;
  const include = args.include as Record<string, unknown> | undefined;
  const fields = new Map(Object.entries(node));
  const picked: [string, unknown][] = [];

  if (select) {
    for (const [key, spec] of Object.entries(select)) {
      if (!fields.has(key)) continue;
      const value = fields.get(key);
      if (isPlainObject(spec) && isPlainObject(value)) picked.push([key, project(value, spec)]);
      else if (spec) picked.push([key, value]);
    }
    return Object.fromEntries(picked);
  }

  // `include` means: every scalar column, plus the named relations.
  for (const [key, value] of fields) {
    if (!isPlainObject(value)) picked.push([key, value]);
  }
  if (include) {
    for (const [key, spec] of Object.entries(include)) {
      const value = fields.get(key);
      if (!isPlainObject(value)) continue;
      picked.push([key, project(value, isPlainObject(spec) ? spec : undefined)]);
    }
  }
  return Object.fromEntries(picked);
}

vi.mock("@/lib/auth", () => ({
  requireAuth: async () => ({ user: { sub: STUDENT, role: "STUDENT" } }),
}));

vi.mock("@repo/logger", () => ({
  requestLogger: () => ({ error: () => {}, info: () => {}, warn: () => {} }),
}));

vi.mock("@/lib/db", () => {
  const prisma = {
    classSession: {
      findMany: async (args: Record<string, unknown>) => {
        const returned = [project(STORED_SESSION, args)];
        data.calls.push({ args, returned });
        return returned;
      },
    },
  };
  return { prisma, db: prisma };
});

/** Every key name appearing anywhere in a value, at any depth. */
function deepKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) deepKeys(item, found);
  } else if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      deepKeys(child, found);
    }
  }
  return found;
}

const get = async () => {
  const { GET } = await import("./route");
  const res = await GET(new NextRequest("http://localhost/api/students/recordings"));
  return { res, body: await res.json() };
};

describe("GET /api/students/recordings", () => {
  beforeEach(() => {
    data.calls.length = 0;
    vi.resetModules();
  });

  it("never loads credential columns out of the database", async () => {
    await get();

    expect(data.calls).toHaveLength(1);
    const loaded = deepKeys(data.calls[0]!.returned);
    for (const column of CREDENTIAL_COLUMNS) {
      expect(loaded.has(column), `query loaded User.${column} into memory`).toBe(false);
    }
    // The whole User relation is unused by the response, so it should not be
    // traversed at all.
    expect(loaded.has("user"), "query loaded the User relation").toBe(false);
  });

  it("asks only for the columns the response actually uses", async () => {
    await get();

    const args = data.calls[0]!.args as Record<string, unknown>;
    expect(args.include, "the route should use select, not include").toBeUndefined();
    expect(args.select).toEqual({
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      isRecordingPaid: true,
      recordingUrl: true,
      booking: { select: { teacher: { select: { name: true, language: true } } } },
    });
  });

  it("returns the recording payload unchanged", async () => {
    const { res, body } = await get();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      recordings: [
        {
          id: STORED_SESSION.id,
          classSessionId: STORED_SESSION.id,
          title: "Aiko Tanaka Class",
          teacherName: "Aiko Tanaka",
          language: "Japanese",
          scheduledStart: "2026-10-01T10:00:00.000Z",
          duration: 5400,
          isRecordingPaid: true,
          unlockPrice: 299,
          videoUrl: "https://cdn.example.test/recordings/one.mp4",
          thumbnailUrl: null,
        },
      ],
    });
  });

  it("still withholds the video url for an unpaid recording", async () => {
    const paid = STORED_SESSION.isRecordingPaid;
    STORED_SESSION.isRecordingPaid = false;
    try {
      const { body } = await get();
      expect(body.recordings[0].isRecordingPaid).toBe(false);
      expect(body.recordings[0].videoUrl).toBeNull();
    } finally {
      STORED_SESSION.isRecordingPaid = paid;
    }
  });

  it("keeps the student scope and the newest-first order on the query", async () => {
    await get();

    const args = data.calls[0]!.args as {
      where: { recordingUrl: unknown; booking: { studentId: string } };
      orderBy: unknown;
    };
    expect(args.where.booking.studentId).toBe(STUDENT);
    expect(args.where.recordingUrl).toEqual({ not: null });
    expect(args.orderBy).toEqual({ scheduledStart: "desc" });
  });
});
