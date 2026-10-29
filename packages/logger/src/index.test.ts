import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, log, redact, requestIdFrom, requestLogger } from "./index";

let lines: { stream: string; line: string }[] = [];
beforeEach(() => {
  lines = [];
  for (const stream of ["log", "warn", "error"] as const) {
    vi.spyOn(console, stream).mockImplementation((line: unknown) => { lines.push({ stream, line: String(line) }); });
  }
});
afterEach(() => vi.restoreAllMocks());

const last = () => JSON.parse(lines.at(-1)!.line) as Record<string, unknown>;
const headers = (h: Record<string, string>) => ({ headers: new Headers(h) });

describe("JSON log lines (#8b)", () => {
  it("writes one JSON object per line with time, level and message", () => {
    log.info("order created", { orderId: "coins_1" });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.line).not.toContain("\n");
    expect(last()).toMatchObject({ level: "info", msg: "order created", orderId: "coins_1" });
    expect(new Date(last().time as string).toString()).not.toBe("Invalid Date");
  });

  it("sends each level to the matching console stream", () => {
    log.debug("d"); log.info("i"); log.warn("w"); log.error("e");
    expect(lines.map((l) => l.stream)).toEqual(["log", "log", "warn", "error"]);
  });

  it("child loggers carry their fields on every line", () => {
    const child = createLogger({ app: "student-web" }).child({ route: "/api/payments/verify" });
    child.warn("slow");
    expect(last()).toMatchObject({ app: "student-web", route: "/api/payments/verify", msg: "slow" });
  });

  it("serialises errors with name, message and stack", () => {
    log.error("failed", { error: new TypeError("bad thing") });
    expect(last().error).toMatchObject({ name: "TypeError", message: "bad thing" });
    expect(String((last().error as { stack: string }).stack)).toContain("TypeError");
  });

  it("survives circular objects", () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    log.info("loop", { loop });
    expect(last().loop).toEqual({ a: 1, self: "[Circular]" });
  });
});

describe("request ID", () => {
  it("uses X-Request-ID when the caller or proxy set one", () => {
    expect(requestIdFrom(headers({ "x-request-id": "abc-123", "x-vercel-id": "bom1::xyz" }))).toBe("abc-123");
  });

  it("falls back to Vercel's x-vercel-id, then to a new UUID", () => {
    expect(requestIdFrom(headers({ "x-vercel-id": "bom1::iad1::xyz-1" }))).toBe("bom1::iad1::xyz-1");
    expect(requestIdFrom(headers({}))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ignores a request ID that could inject into logs", () => {
    expect(requestIdFrom(headers({ "x-request-id": 'x" , "level": "info' }))).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestIdFrom(headers({ "x-request-id": "a".repeat(200) }))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("requestLogger stamps every line with the request ID", () => {
    const rlog = requestLogger(headers({ "x-request-id": "req-42" }));
    rlog.info("one");
    rlog.error("two");
    expect(lines.map((l) => JSON.parse(l.line).requestId)).toEqual(["req-42", "req-42"]);
  });
});

describe("redaction: never log secrets, tokens, OTPs, card or UPI data", () => {
  it("masks secret-named fields at any depth, in any case", () => {
    log.info("login", {
      email: "a@example.test",
      password: "hunter2",
      body: { otp: "123456", refreshToken: "r", nested: [{ CLIENT_SECRET: "s", Authorization: "Bearer x" }] },
      headers: { cookie: "lm=1", "x-webhook-signature": "sig-value-77" },
      payment: { card_number: "4111111111111111", cvv: "123", upi_id: "alice@okaxis", payment_method: { upi: {} } },
      apiKey: "k", privateKey: "pk",
    });
    const line = lines.at(-1)!.line;
    for (const secret of ["hunter2", "123456", "Bearer x", "lm=1", "sig-value-77", "4111111111111111", "alice@okaxis", '"k"', '"pk"']) {
      expect(line).not.toContain(secret);
    }
    expect(last()).toMatchObject({ email: "a@example.test", password: "[REDACTED]" });
  });

  it("masks secrets inside free text, including error messages", () => {
    const jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNpZ25hdHVyZQ";
    const text = [
      `token ${jwt}`,
      "Authorization: Bearer abc.def-123",
      "card 4111 1111 1111 1111 and 5500-0000-0000-0004",
      "paid by 9876543210@ybl",
      "db postgresql://app:p4ssw0rd@db.example.test:5432/x",
      "-----BEGIN PRIVATE KEY-----\nMIIabc\n-----END PRIVATE KEY-----",
    ].join(" | ");
    log.error(text, { error: new Error(`refresh failed for ${jwt}`) });
    const line = lines.at(-1)!.line;
    for (const secret of [jwt, "abc.def-123", "4111 1111 1111 1111", "5500-0000-0000-0004", "9876543210@ybl", "p4ssw0rd", "MIIabc"]) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain("db.example.test"); // the rest of the URL stays readable
  });

  it("keeps ordinary values, emails and order ids", () => {
    expect(redact({ orderId: "coins_500_ab12", email: "student@example.test", amount: 500, status: "PAID" }))
      .toEqual({ orderId: "coins_500_ab12", email: "student@example.test", amount: 500, status: "PAID" });
  });
});
