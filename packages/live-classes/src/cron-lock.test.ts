import { beforeEach, describe, expect, it, vi } from "vitest";

// Postgres advisory locks are held per server connection. This fake keeps the
// held keys server-wide, ties each to the connection that took it, and frees
// them when that connection closes, as Postgres does.
const server = vi.hoisted(() => ({ held: new Map<unknown, object>(), opened: 0, closed: 0, unlocks: 0 }));

vi.mock("@repo/database", () => ({
  openDirectConnection: () => {
    server.opened++;
    const connection = {
      async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        const sql = strings.join("?");
        const key = values[0];
        if (sql.includes("pg_try_advisory_lock")) {
          if (server.held.has(key)) return [{ locked: false }];
          server.held.set(key, connection);
          return [{ locked: true }];
        }
        if (sql.includes("pg_advisory_unlock")) {
          server.unlocks++;
          return [{ unlocked: server.held.get(key) === connection && server.held.delete(key) }];
        }
        throw new Error(`unexpected SQL: ${sql}`);
      },
      async $disconnect() {
        server.closed++;
        for (const [key, owner] of server.held) if (owner === connection) server.held.delete(key);
      },
    };
    return connection;
  },
}));

const { withCronLock, sweepInBatches } = await import("./cron-lock");

beforeEach(() => {
  server.held.clear();
  server.opened = server.closed = server.unlocks = 0;
});

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => { open = resolve; });
  return { opened, open };
}

describe("withCronLock", () => {
  it("lets only one of two simultaneous runs do the work", async () => {
    const { opened, open } = gate();
    let work = 0;
    const job = async () => { work++; await opened; return "done"; };

    const first = withCronLock("reconcile-payments", job);
    const second = withCronLock("reconcile-payments", job);
    expect(await second).toEqual({ ran: false });
    open();
    expect(await first).toEqual({ ran: true, result: "done" });
    expect(work).toBe(1);
  });

  it("releases the lock and closes its connection afterwards, so the next run works", async () => {
    await withCronLock("reconcile-payments", async () => 1);
    expect(server.unlocks).toBe(1);
    expect(server.opened).toBe(server.closed);
    expect(await withCronLock("reconcile-payments", async () => 2)).toEqual({ ran: true, result: 2 });
  });

  it("releases the lock when the job throws", async () => {
    await expect(withCronLock("reconcile-payments", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(server.held.size).toBe(0);
    expect(server.opened).toBe(server.closed);
  });

  it("does not block a different job", async () => {
    const { opened, open } = gate();
    const payments = withCronLock("reconcile-payments", () => opened);
    expect(await withCronLock("reconcile-sessions", async () => "ok")).toEqual({ ran: true, result: "ok" });
    open();
    await payments;
  });
});

describe("sweepInBatches", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(3, "0")}` }));

  it("works through a backlog bigger than one batch, never re-reading a row", async () => {
    const all = rows(120);
    const seen: string[] = [];
    // Rows stay matchable after handling (like an order Cashfree still lists
    // as ACTIVE), so only the exclusion list stops a re-read.
    const result = await sweepInBatches({
      batchSize: 50,
      budgetMs: 60_000,
      fetchBatch: async (exclude, take) => all.filter((r) => !exclude.includes(r.id)).slice(0, take),
      handle: async (row) => { seen.push(row.id); },
    });
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
    expect(result).toEqual({ batches: 3, budgetExhausted: false });
  });

  it("stops starting new batches once the time budget is spent", async () => {
    let clock = 0;
    const seen: string[] = [];
    const result = await sweepInBatches({
      batchSize: 50,
      budgetMs: 1_000,
      now: () => clock,
      fetchBatch: async (exclude, take) => rows(500).filter((r) => !exclude.includes(r.id)).slice(0, take),
      handle: async (row) => { seen.push(row.id); clock += 30; }, // 50 rows = 1.5 s
    });
    expect(seen).toHaveLength(50);
    expect(result).toEqual({ batches: 1, budgetExhausted: true });
  });
});
