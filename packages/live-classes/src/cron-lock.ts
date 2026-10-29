/**
 * Keeping the reconcile crons from overlapping, and from falling behind.
 *
 * The same sweep can be started by GitHub Actions, Vercel cron and a second
 * deployment at once. Settlement is idempotent, so overlap does not double
 * credit, but it doubles the Cashfree calls and DB load. A Postgres advisory
 * lock lets exactly one run work; the others return straight away.
 */
import { openDirectConnection } from "@repo/database";
import { log } from "@repo/logger";

export type CronRun<T> = { ran: true; result: T } | { ran: false };

/**
 * Run `job` only if no other run of the job `name` holds the lock.
 *
 * The lock lives on its own one-connection client (see openDirectConnection),
 * so lock and unlock always reach the same server connection, and the job's
 * own queries never wait behind it for a pool slot. If the function dies,
 * Postgres drops the lock with the connection.
 */
export async function withCronLock<T>(name: string, job: () => Promise<T>): Promise<CronRun<T>> {
  const connection = openDirectConnection();
  try {
    const [row] = await connection.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(hashtext(${name})) AS locked`;
    if (!row?.locked) return { ran: false };
    try {
      return { ran: true, result: await job() };
    } finally {
      await connection.$queryRaw`SELECT pg_advisory_unlock(hashtext(${name})) AS unlocked`.catch((error: unknown) => {
        // Disconnecting below releases it anyway.
        log.error("cron lock release failed", { job: name, error });
      });
    }
  } finally {
    await connection.$disconnect().catch(() => {});
  }
}

/** Default time budget for one sweep; the cron routes allow 60 s (maxDuration). */
export const SWEEP_BUDGET_MS = 45_000;

/**
 * Process rows in batches until none are left or the time budget is spent.
 * A batch is never cut short; the budget only stops the next one starting.
 * Rows handled in this run are excluded from later batches, because a row can
 * still match afterwards (an order Cashfree still lists as ACTIVE).
 */
export async function sweepInBatches<Row extends { id: string }>(options: {
  batchSize: number;
  budgetMs: number;
  fetchBatch: (excludeIds: string[], take: number) => Promise<Row[]>;
  handle: (row: Row) => Promise<void>;
  now?: () => number;
}): Promise<{ batches: number; budgetExhausted: boolean }> {
  const now = options.now ?? Date.now;
  const started = now();
  const done: string[] = [];
  let batches = 0;
  for (;;) {
    const rows = await options.fetchBatch(done, options.batchSize);
    if (rows.length === 0) return { batches, budgetExhausted: false };
    batches++;
    for (const row of rows) {
      done.push(row.id);
      await options.handle(row);
    }
    if (rows.length < options.batchSize) return { batches, budgetExhausted: false };
    if (now() - started >= options.budgetMs) return { batches, budgetExhausted: true };
  }
}
