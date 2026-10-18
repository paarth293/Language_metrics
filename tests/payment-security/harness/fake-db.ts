/**
 * In-memory stand-in for the slice of Prisma the payment code uses.
 *
 * Every method awaits a macrotask before touching state, so concurrent
 * callers interleave the way separate requests do. Each single call is atomic,
 * which mirrors what Postgres guarantees for one statement: a conditional
 * `updateMany` re-checks its WHERE clause at write time, and unique columns
 * reject a second insert. That is exactly the property the settlement code
 * relies on, so races here exercise the real guard, not a mocked one.
 *
 * It does not model transaction rollback; tests that need rollback assert on
 * the error instead.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function matchValue(actual: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== "object" || condition instanceof Date) {
    if (condition instanceof Date && actual instanceof Date) return actual.getTime() === condition.getTime();
    return actual === condition;
  }
  const c = condition as Record<string, unknown>;
  if ("in" in c && !(c.in as unknown[]).includes(actual)) return false;
  if ("notIn" in c && (c.notIn as unknown[]).includes(actual)) return false;
  if ("not" in c && matchValue(actual, c.not)) return false;
  if ("startsWith" in c && !(typeof actual === "string" && actual.startsWith(c.startsWith as string))) return false;
  const time = actual instanceof Date ? actual.getTime() : (actual as number);
  const bound = (v: unknown) => (v instanceof Date ? v.getTime() : (v as number));
  if ("lt" in c && !(time < bound(c.lt))) return false;
  if ("lte" in c && !(time <= bound(c.lte))) return false;
  if ("gt" in c && !(time > bound(c.gt))) return false;
  if ("gte" in c && !(time >= bound(c.gte))) return false;
  const operators = ["in", "notIn", "not", "startsWith", "lt", "lte", "gt", "gte"];
  const nested = Object.keys(c).filter((key) => !operators.includes(key));
  if (nested.length) {
    if (!actual || typeof actual !== "object") return false;
    return nested.every((key) => matchValue((actual as Row)[key], c[key]));
  }
  return true;
}

export function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return (condition as Where[]).some((w) => matches(row, w));
    if (key === "AND") return (condition as Where[]).every((w) => matches(row, w));
    return matchValue(row[key], condition);
  });
}

export class UniqueConstraintError extends Error {
  readonly code = "P2002";
  constructor(model: string, field: string) { super(`Unique constraint failed on ${model}.${field}`); }
}

class Table {
  rows: Row[] = [];
  constructor(readonly name: string, private readonly unique: string[], private readonly defaults: () => Row = () => ({})) {}

  private checkUnique(candidate: Row, ignore?: Row) {
    for (const field of this.unique) {
      const value = candidate[field];
      if (value === null || value === undefined) continue;
      if (this.rows.some((row) => row !== ignore && row[field] === value)) throw new UniqueConstraintError(this.name, field);
    }
  }

  private project(row: Row | undefined, select?: Record<string, boolean>) {
    if (!row) return null;
    if (!select) return { ...row };
    return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
  }

  async create({ data }: { data: Row }) {
    await tick();
    const row = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...this.defaults(), ...data };
    this.checkUnique(row);
    this.rows.push(row);
    return { ...row };
  }

  async findUnique({ where, select }: { where: Where; select?: Record<string, boolean> }) {
    await tick();
    return this.project(this.rows.find((row) => matches(row, where)), select);
  }

  async findFirst({ where, orderBy, select }: { where?: Where; orderBy?: Record<string, "asc" | "desc">; select?: Record<string, boolean> } = {}) {
    const rows = await this.findMany({ where, orderBy });
    return this.project(rows[0], select);
  }

  async findMany({ where, orderBy, take }: { where?: Where; orderBy?: Record<string, "asc" | "desc">; take?: number } = {}) {
    await tick();
    let rows = this.rows.filter((row) => matches(row, where));
    if (orderBy) {
      const [[key, direction]] = Object.entries(orderBy) as [[string, "asc" | "desc"]];
      rows = [...rows].sort((a, b) => {
        const left = a[key] instanceof Date ? (a[key] as Date).getTime() : (a[key] as number);
        const right = b[key] instanceof Date ? (b[key] as Date).getTime() : (b[key] as number);
        return direction === "asc" ? left - right : right - left;
      });
    }
    return rows.slice(0, take ?? rows.length).map((row) => ({ ...row }));
  }

  async count({ where }: { where?: Where } = {}) {
    await tick();
    return this.rows.filter((row) => matches(row, where)).length;
  }

  async update({ where, data }: { where: Where; data: Row }) {
    await tick();
    const row = this.rows.find((r) => matches(r, where));
    if (!row) throw new Error(`${this.name}.update: record not found`);
    const next = { ...row, ...data, updatedAt: new Date() };
    this.checkUnique(next, row);
    Object.assign(row, next);
    return { ...row };
  }

  /** Atomic like a single SQL UPDATE: the WHERE is evaluated at write time. */
  async updateMany({ where, data }: { where: Where; data: Row }) {
    await tick();
    const targets = this.rows.filter((row) => matches(row, where));
    for (const row of targets) this.checkUnique({ ...row, ...data }, row);
    for (const row of targets) Object.assign(row, data, { updatedAt: new Date() });
    return { count: targets.length };
  }
}

export class InsufficientCoinsError extends Error {
  readonly code = "INSUFFICIENT_COINS";
  constructor(readonly required: number, readonly available: number) { super(`Insufficient coins. Need ${required}, have ${available}.`); }
}

export function createFakeDb() {
  const paymentOrder = new Table("PaymentOrder", ["orderId", "paymentId"], () => ({ currency: "INR", status: "CREATED", receipt: null, paymentId: null, signature: null }));
  const payment = new Table("Payment", ["gatewayOrderId", "gatewayPaymentId"], () => ({ bookingId: null, status: "PENDING", gatewayOrderId: null, gatewayPaymentId: null }));
  const classSession = new Table("ClassSession", [], () => ({ isRecordingPaid: false, recordingUrl: "https://example.test/rec.mp4" }));
  const coinTransaction = new Table("CoinTransaction", ["idempotencyKey"]);
  const balances = new Map<string, number>();

  const db = {
    paymentOrder, payment, classSession, coinTransaction,
    async $transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> { return callback(db); },
  };

  /** Mirrors coin-ledger credit(): idempotent through the unique key. */
  async function credit(params: { userId: string; amount: number; type: string; description?: string; idempotencyKey?: string }) {
    if (params.amount <= 0) throw new Error("credit() requires a positive amount.");
    if (params.idempotencyKey && (await coinTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } }))) {
      return { balance: balances.get(params.userId) ?? 0 };
    }
    await coinTransaction.create({ data: { userId: params.userId, type: params.type, amount: params.amount, description: params.description ?? null, idempotencyKey: params.idempotencyKey ?? null } });
    balances.set(params.userId, (balances.get(params.userId) ?? 0) + params.amount);
    return { balance: balances.get(params.userId) ?? 0 };
  }

  /** Mirrors coin-ledger adjust() for removals: never below zero, idempotent. */
  async function adjust(params: { userId: string; delta: number; description: string; idempotencyKey: string }) {
    if (await coinTransaction.findUnique({ where: { idempotencyKey: params.idempotencyKey } })) return { balance: balances.get(params.userId) ?? 0 };
    const current = balances.get(params.userId) ?? 0;
    if (current + params.delta < 0) throw new InsufficientCoinsError(-params.delta, current);
    await coinTransaction.create({ data: { userId: params.userId, type: "ADJUSTMENT", amount: params.delta, description: params.description, idempotencyKey: params.idempotencyKey } });
    balances.set(params.userId, current + params.delta);
    return { balance: balances.get(params.userId) ?? 0 };
  }

  return {
    db, balances,
    /** The module shape `vi.mock("@repo/database", …)` should return. */
    module: { db, credit, adjust, InsufficientCoinsError, getSpendableBalance: async (userId: string) => balances.get(userId) ?? 0 },
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
