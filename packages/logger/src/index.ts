/**
 * @repo/logger — one JSON line per log entry, with the request ID (#8).
 *
 * Vercel keeps stdout/stderr per request; JSON lines with a requestId make
 * them searchable and let one request be followed across log lines. Secrets
 * are masked before anything is written: by field name (password, otp, token,
 * card, upi, …) and by shape inside free text (JWTs, bearer tokens, card
 * numbers, UPI ids, URL passwords, private keys).
 */

export type Level = "debug" | "info" | "warn" | "error";
export type Fields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  /** A logger that adds `fields` to every line. */
  child(fields: Fields): Logger;
}

const REDACTED = "[REDACTED]";

/** Field names (lower-case, punctuation removed) whose value is never logged. */
const SECRET_KEY_PARTS = [
  "password", "passwd", "otp", "token", "secret", "authorization", "cookie", "signature",
  "apikey", "privatekey", "cvv", "card", "upi", "vpa", "paymentmethod",
];

function isSecretKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SECRET_KEY_PARTS.some((part) => normalised.includes(part));
}

/** Luhn check, so long numbers that are not card numbers (timestamps, ids) stay readable. */
function isCardNumber(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Mask secrets that appear inside free text. */
export function redactText(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[REDACTED JWT]")
    .replace(/\bBearer\s+[\w.~+/=-]+/gi, "Bearer [REDACTED]")
    // scheme://user:PASSWORD@host
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi, `$1${REDACTED}@`)
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, (match) => (isCardNumber(match.replace(/\D/g, "")) ? "[REDACTED CARD]" : match))
    // UPI ids look like name@bank, with no dot after the handle (unlike an email).
    .replace(/\b[\w.-]{2,}@[a-z]{2,}(?![\w.@-])/gi, "[REDACTED UPI]");
}

/** A copy of `value` that is safe to log. */
export function redact(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  if (depth > 8) return "[Too deep]";
  seen.add(value);
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return {
      name: value.name,
      message: redactText(value.message),
      ...(typeof code === "string" || typeof code === "number" ? { code } : {}),
      stack: value.stack ? redactText(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, seen, depth + 1));
  if (value instanceof Date) return value.toISOString();
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, isSecretKey(key) ? REDACTED : redact(item, seen, depth + 1)]),
  );
}

const STREAM: Record<Level, "log" | "warn" | "error"> = { debug: "log", info: "log", warn: "warn", error: "error" };

export function createLogger(base: Fields = {}): Logger {
  const write = (level: Level, msg: string, fields?: Fields) => {
    const entry = redact({ time: new Date().toISOString(), level, msg, ...base, ...fields });
    console[STREAM[level]](JSON.stringify(entry));
  };
  return {
    debug: (msg, fields) => write("debug", msg, fields),
    info: (msg, fields) => write("info", msg, fields),
    warn: (msg, fields) => write("warn", msg, fields),
    error: (msg, fields) => write("error", msg, fields),
    child: (fields) => createLogger({ ...base, ...fields }),
  };
}

/** Logger for code with no request at hand (crons, background work). */
export const log = createLogger();

/** Only IDs that cannot break or forge a JSON log line are trusted. */
const SAFE_ID = /^[\w.:-]{1,128}$/;

/**
 * The request's ID: X-Request-ID when a caller or proxy set a safe one, else
 * Vercel's own x-vercel-id, else a new UUID.
 */
export function requestIdFrom(request: { headers: Headers }): string {
  for (const name of ["x-request-id", "x-vercel-id"]) {
    const id = request.headers.get(name);
    if (id && SAFE_ID.test(id)) return id;
  }
  return crypto.randomUUID();
}

/** Logger whose every line carries this request's ID. */
export function requestLogger(request: { headers: Headers }, fields: Fields = {}): Logger {
  return createLogger({ requestId: requestIdFrom(request), ...fields });
}
