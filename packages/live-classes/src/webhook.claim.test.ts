/**
 * Tests for the webhook claim decision.
 *
 * These never touch Postgres. `FakeWebhookEventStore` models the two SQL
 * statements the real store issues — the unique-index INSERT and the
 * conditional UPDATE — as in-memory transitions, the same approach
 * coin-ledger.invariants.test.ts takes.
 *
 * What is being pinned down: a retry of a *failed* event must be able to make
 * progress, while a genuine duplicate and an in-flight delivery must not. The
 * bug this replaces returned `duplicate` for any pre-existing row, so a failed
 * event could never succeed on LiveKit's retry.
 *
 * Run: npm test --workspace @repo/live-classes
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";

import {
  claimWebhookEvent,
  WEBHOOK_RETRY_GRACE_MS,
  type WebhookEventStore,
} from "./webhook";

interface Row {
  source: string;
  eventId: string;
  eventType: string;
  processedAt: Date | null;
  receivedAt: Date;
  error: string | null;
}

/**
 * Models the Postgres behaviour the real store depends on:
 *   - create() violates the (source, eventId) unique index.
 *   - reclaimStale() is a conditional UPDATE; it matches only an unfinished
 *     row older than the cutoff, and moving receivedAt forward is what makes
 *     a second concurrent caller fail to match.
 */
function makeStore(rows: Row[] = []) {
  const store: WebhookEventStore & { rows: Row[] } = {
    rows,
    async create(row) {
      const clash = rows.some(
        (r) => r.source === row.source && r.eventId === row.eventId
      );
      if (clash) {
        throw new Error(
          "Unique constraint failed on the fields: (`source`,`eventId`)"
        );
      }
      rows.push({ ...row, processedAt: null, receivedAt: new Date(), error: null });
    },
    async reclaimStale({ source, eventId, staleBefore, now }) {
      const row = rows.find((r) => r.source === source && r.eventId === eventId);
      if (!row) return 0;
      if (row.processedAt !== null) return 0;
      if (!(row.receivedAt.getTime() < staleBefore.getTime())) return 0;
      row.receivedAt = now;
      row.error = null;
      return 1;
    },
  };
  return store;
}

const NOW = new Date("2026-09-26T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function existingRow(overrides: Partial<Row> = {}): Row {
  return {
    source: "livekit",
    eventId: "EV_1",
    eventType: "room_finished",
    processedAt: null,
    receivedAt: NOW,
    error: null,
    ...overrides,
  };
}

const claim = (store: WebhookEventStore) =>
  claimWebhookEvent(store, {
    source: "livekit",
    eventId: "EV_1",
    eventType: "room_finished",
    now: NOW,
  });

describe("claimWebhookEvent", () => {
  it("claims a first delivery and records it unprocessed", async () => {
    const store = makeStore();
    assert.equal(await claim(store), "claimed");
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0]!.processedAt, null);
  });

  it("rejects a concurrent duplicate while the first is still in flight", async () => {
    // The first delivery has only just claimed the row, so it is presumed
    // still running. Processing now would double-handle the event.
    const store = makeStore([existingRow({ receivedAt: NOW })]);
    assert.equal(await claim(store), "duplicate");
    assert.equal(store.rows.length, 1);
  });

  it("reclaims after a failed attempt once the grace period has passed", async () => {
    const store = makeStore([
      existingRow({ receivedAt: ago(5 * 60_000), error: "boom" }),
    ]);
    assert.equal(await claim(store), "reclaimed");
    // The claim is refreshed and the stale error cleared, so the retry owns it.
    assert.equal(store.rows[0]!.receivedAt.getTime(), NOW.getTime());
    assert.equal(store.rows[0]!.error, null);
    assert.equal(store.rows.length, 1, "must reuse the row, never insert a second");
  });

  it("refuses to reclaim inside the grace period", async () => {
    const store = makeStore([
      existingRow({ receivedAt: ago(WEBHOOK_RETRY_GRACE_MS - 1_000), error: "boom" }),
    ]);
    assert.equal(await claim(store), "duplicate");
  });

  it("never reprocesses an event that already completed", async () => {
    // Old enough to be stale, but finished — this is the double-settlement
    // case and must stay closed no matter how old the row is.
    const store = makeStore([
      existingRow({ receivedAt: ago(24 * 3_600_000), processedAt: ago(24 * 3_600_000) }),
    ]);
    assert.equal(await claim(store), "duplicate");
  });

  it("lets exactly one of two concurrent retries win", async () => {
    const store = makeStore([
      existingRow({ receivedAt: ago(5 * 60_000), error: "boom" }),
    ]);
    const outcomes = await Promise.all([claim(store), claim(store)]);
    assert.deepEqual(
      outcomes.filter((o) => o === "reclaimed").length,
      1,
      "exactly one retry may take the row over"
    );
    assert.equal(outcomes.filter((o) => o === "duplicate").length, 1);
  });

  it("treats the grace boundary as still in flight", async () => {
    const store = makeStore([existingRow({ receivedAt: ago(WEBHOOK_RETRY_GRACE_MS) })]);
    // Strictly older than the cutoff is required, so exactly-at is not stale.
    assert.equal(await claim(store), "duplicate");
  });
});
