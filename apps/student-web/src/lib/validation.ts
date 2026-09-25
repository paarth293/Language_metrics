/**
 * lib/validation.ts — dependency-free request validation for student-web's
 * API routes.
 *
 * The audit recommended Zod schemas for this. Zod (^4.4.3) is already listed
 * as a dependency at the repo root, but this session cannot prove that out:
 * there is no `node_modules` anywhere in this repo on disk (confirmed by
 * listing the project root — `npm install` has never been run), and this
 * sandbox's own `npm install`/`npm view` calls to the public registry are
 * blocked (403) from here too. Rather than hand you code that imports a
 * package neither environment can currently resolve — which would look
 * fixed but fail at build time until someone runs `npm install` — every
 * validator below is plain TypeScript with no imports, so it works the
 * moment it lands, and it's exactly what the tests in
 * `validation.test.ts` (run with `tsx`, no install needed) actually execute.
 * See errors.md for the full reasoning and the optional migration path to
 * Zod later.
 *
 * Every validator returns a `ValidationResult<T>`: either `{ ok: true, data }`
 * or `{ ok: false, errors }`, the same shape a Zod `safeParse()` caller would
 * branch on, so swapping to real Zod schemas later (once `npm install` has
 * been run) is a mechanical, low-risk change.
 */

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

function ok<T>(data: T): ValidationResult<T> {
  return { ok: true, data };
}

function invalid(errors: string[]): ValidationResult<never> {
  return { ok: false, errors };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A deliberately simple email check: this is a shape check to reject
// obviously-malformed input before it reaches bcrypt/Prisma, not a full
// RFC 5322 validator (real deliverability is proven by the verification
// email, not by a regex).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Login ────────────────────────────────────────────────────────────────

export interface LoginBody {
  email: string;
  password: string;
  role?: "STUDENT" | "TEACHER";
}

export function validateLoginBody(body: unknown): ValidationResult<LoginBody> {
  if (!isPlainObject(body)) return invalid(["Request body must be a JSON object."]);

  const errors: string[] = [];

  const rawEmail = body.email;
  if (typeof rawEmail !== "string" || rawEmail.trim().length === 0) {
    errors.push("Email is required.");
  } else if (rawEmail.length > 254) {
    errors.push("Email is too long.");
  } else if (!EMAIL_RE.test(rawEmail.trim())) {
    errors.push("Email format is invalid.");
  }

  const rawPassword = body.password;
  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    errors.push("Password is required.");
  } else if (rawPassword.length > 200) {
    // Not a complexity rule (that's a signup-time policy, and changing it
    // here would risk locking out real users with older passwords) — just a
    // sane upper bound so no one can make the server bcrypt-hash a
    // multi-megabyte string.
    errors.push("Password is too long.");
  }

  let role: "STUDENT" | "TEACHER" | undefined;
  if (body.role !== undefined) {
    if (body.role !== "STUDENT" && body.role !== "TEACHER") {
      errors.push('Role must be "STUDENT" or "TEACHER".');
    } else {
      role = body.role;
    }
  }

  if (errors.length > 0) return invalid(errors);

  return ok({
    email: (rawEmail as string).toLowerCase().trim(),
    password: rawPassword as string,
    role,
  });
}

// ── Discover (teacher search) query params ──────────────────────────────

export interface DiscoverQuery {
  search?: string;
  language?: string;
  minPrice: number;
  maxPrice: number;
  limit: number;
  cursor?: string;
}

const MAX_PRICE_CEILING = 10_000_000; // sanity bound, not a real product limit

function parseNonNegativeInt(
  raw: string | null,
  fieldLabel: string,
  fallback: number,
  errors: string[]
): number {
  if (raw === null || raw === "") return fallback;
  // Reject anything that isn't a plain base-10 integer (parseInt("12abc")
  // would otherwise silently succeed as 12, and parseInt("abc") would
  // silently become NaN and make every downstream comparison false —
  // which is exactly how the old code could return zero teachers with no
  // error for a typo'd query string).
  if (!/^\d+$/.test(raw)) {
    errors.push(`${fieldLabel} must be a non-negative whole number.`);
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed > MAX_PRICE_CEILING) {
    errors.push(`${fieldLabel} is out of range.`);
    return fallback;
  }
  return parsed;
}

export function validateDiscoverQuery(
  params: URLSearchParams
): ValidationResult<DiscoverQuery> {
  const errors: string[] = [];

  const rawSearch = params.get("search");
  let search: string | undefined;
  if (rawSearch !== null && rawSearch.trim().length > 0) {
    if (rawSearch.length > 200) {
      errors.push("search is too long (max 200 characters).");
    } else {
      search = rawSearch.trim();
    }
  }

  const rawLanguage = params.get("language");
  let language: string | undefined;
  if (rawLanguage !== null && rawLanguage.trim().length > 0) {
    if (rawLanguage.length > 100) {
      errors.push("language is too long (max 100 characters).");
    } else {
      language = rawLanguage.trim();
    }
  }

  const minPrice = parseNonNegativeInt(params.get("minPrice"), "minPrice", 0, errors);
  const maxPrice = parseNonNegativeInt(params.get("maxPrice"), "maxPrice", 99_999, errors);
  if (errors.length === 0 && maxPrice < minPrice) {
    errors.push("maxPrice must be greater than or equal to minPrice.");
  }

  const rawLimit = params.get("limit");
  let limit = 20;
  if (rawLimit !== null && rawLimit !== "") {
    if (!/^\d+$/.test(rawLimit)) {
      errors.push("limit must be a positive whole number.");
    } else {
      const parsedLimit = Number.parseInt(rawLimit, 10);
      if (parsedLimit < 1) {
        errors.push("limit must be at least 1.");
      } else {
        // A too-large limit isn't dangerous, just wasteful — cap it instead
        // of rejecting it, matching the original endpoint's behavior.
        limit = Math.min(parsedLimit, 50);
      }
    }
  }

  const rawCursor = params.get("cursor");
  let cursor: string | undefined;
  if (rawCursor !== null && rawCursor.trim().length > 0) {
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(rawCursor.trim())) {
      errors.push("cursor is not a valid pagination cursor.");
    } else {
      cursor = rawCursor.trim();
    }
  }

  if (errors.length > 0) return invalid(errors);

  return ok({ search, language, minPrice, maxPrice, limit, cursor });
}

// ── Classes filter ───────────────────────────────────────────────────────

export type ClassesFilter = "upcoming" | "past" | "cancelled";
const CLASSES_FILTERS: ClassesFilter[] = ["upcoming", "past", "cancelled"];

export function validateClassesFilter(
  raw: string | null
): ValidationResult<ClassesFilter> {
  if (raw === null || raw === "") return ok("upcoming");
  if (!CLASSES_FILTERS.includes(raw as ClassesFilter)) {
    return invalid([`filter must be one of: ${CLASSES_FILTERS.join(", ")}.`]);
  }
  return ok(raw as ClassesFilter);
}

// ── Profile update ───────────────────────────────────────────────────────

const PROFICIENCY_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export interface ProfileUpdate {
  name?: string;
  avatarUrl?: string | null;
  languageToLearn?: string;
  proficiencyLevel?: string;
}

export function validateProfileUpdate(body: unknown): ValidationResult<ProfileUpdate> {
  if (!isPlainObject(body)) return invalid(["Request body must be a JSON object."]);

  const errors: string[] = [];
  const result: ProfileUpdate = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      errors.push("name must be a non-empty string.");
    } else if (body.name.trim().length > 100) {
      errors.push("name is too long (max 100 characters).");
    } else {
      result.name = body.name.trim();
    }
  }

  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl !== null && typeof body.avatarUrl !== "string") {
      errors.push("avatarUrl must be a string or null.");
    } else if (typeof body.avatarUrl === "string" && body.avatarUrl.length > 2000) {
      errors.push("avatarUrl is too long.");
    } else {
      result.avatarUrl = body.avatarUrl;
    }
  }

  if (body.languageToLearn !== undefined) {
    if (typeof body.languageToLearn !== "string" || body.languageToLearn.trim().length === 0) {
      errors.push("languageToLearn must be a non-empty string.");
    } else if (body.languageToLearn.trim().length > 100) {
      errors.push("languageToLearn is too long (max 100 characters).");
    } else {
      result.languageToLearn = body.languageToLearn.trim();
    }
  }

  if (body.proficiencyLevel !== undefined) {
    if (typeof body.proficiencyLevel !== "string") {
      errors.push("proficiencyLevel must be a string.");
    } else if (!PROFICIENCY_LEVELS.includes(body.proficiencyLevel.toUpperCase())) {
      errors.push(`proficiencyLevel must be one of: ${PROFICIENCY_LEVELS.join(", ")}.`);
    } else {
      result.proficiencyLevel = body.proficiencyLevel.toUpperCase();
    }
  }

  if (errors.length > 0) return invalid(errors);
  if (Object.keys(result).length === 0) {
    return invalid(["No recognized fields to update."]);
  }

  return ok(result);
}

// ── Complaint / support ticket ──────────────────────────────────────────

const COMPLAINT_CATEGORIES = [
  "PAYMENT_ISSUE",
  "CLASS_QUALITY",
  "TEACHER_BEHAVIOR",
  "TECHNICAL_ISSUE",
  "BOOKING_ISSUE",
  "REFUND_REQUEST",
  "ACCOUNT_ISSUE",
  "OTHER",
];

export interface ComplaintBody {
  category: string;
  subject: string;
  description: string;
}

export function validateComplaint(body: unknown): ValidationResult<ComplaintBody> {
  if (!isPlainObject(body)) return invalid(["Request body must be a JSON object."]);

  const errors: string[] = [];

  if (typeof body.category !== "string" || !COMPLAINT_CATEGORIES.includes(body.category)) {
    errors.push(`category must be one of: ${COMPLAINT_CATEGORIES.join(", ")}.`);
  }

  if (typeof body.subject !== "string" || body.subject.trim().length < 3) {
    errors.push("subject must be at least 3 characters.");
  } else if (body.subject.length > 200) {
    errors.push("subject is too long (max 200 characters).");
  }

  if (typeof body.description !== "string" || body.description.trim().length < 3) {
    errors.push("description must be at least 3 characters.");
  } else if (body.description.length > 2000) {
    errors.push("description is too long (max 2000 characters).");
  }

  if (errors.length > 0) return invalid(errors);

  return ok({
    category: body.category as string,
    subject: (body.subject as string).trim(),
    description: (body.description as string).trim(),
  });
}

// ── Device token registration ───────────────────────────────────────────

const DEVICE_PLATFORMS = ["ios", "android", "web"];

export interface DeviceTokenBody {
  token: string;
  platform: string;
}

export function validateDeviceToken(body: unknown): ValidationResult<DeviceTokenBody> {
  if (!isPlainObject(body)) return invalid(["Request body must be a JSON object."]);

  const errors: string[] = [];

  if (typeof body.token !== "string" || body.token.trim().length < 10) {
    errors.push("token must be a string of at least 10 characters.");
  } else if (body.token.length > 4096) {
    errors.push("token is too long.");
  }

  if (typeof body.platform !== "string" || !DEVICE_PLATFORMS.includes(body.platform.toLowerCase())) {
    errors.push(`platform must be one of: ${DEVICE_PLATFORMS.join(", ")}.`);
  }

  if (errors.length > 0) return invalid(errors);

  return ok({
    token: (body.token as string).trim(),
    platform: (body.platform as string).toLowerCase(),
  });
}

// ── Notification update ──────────────────────────────────────────────────

export interface NotificationUpdateBody {
  notificationId?: string;
}

export function validateNotificationUpdate(
  body: unknown
): ValidationResult<NotificationUpdateBody> {
  if (!isPlainObject(body)) return ok({});

  if (body.notificationId === undefined) return ok({});

  if (typeof body.notificationId !== "string" || body.notificationId.trim().length === 0) {
    return invalid(["notificationId must be a non-empty string."]);
  }

  return ok({ notificationId: body.notificationId.trim() });
}

// ── Change password ───────────────────────────────────────────────────────
// Added while reviewing the 7 files the file bridge couldn't reach the first
// pass (see errors.md, Part 4 follow-up). `change-password/route.ts` was
// checking `newPassword.length < 8` inline with no type guard at all, so a
// non-string `newPassword` (e.g. `{}` or `123`) would throw a 500 at
// `.length` instead of a clean 400 — this brings it in line with every other
// mutating route in this app, which all validate through this module.

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export function validateChangePassword(body: unknown): ValidationResult<ChangePasswordBody> {
  if (!isPlainObject(body)) return invalid(["Request body must be a JSON object."]);

  const errors: string[] = [];

  if (typeof body.currentPassword !== "string" || body.currentPassword.length === 0) {
    errors.push("currentPassword is required.");
  } else if (body.currentPassword.length > 1024) {
    errors.push("currentPassword is too long.");
  }

  if (typeof body.newPassword !== "string") {
    errors.push("newPassword must be a string.");
  } else if (body.newPassword.length < 8) {
    errors.push("New password must be at least 8 characters.");
  } else if (body.newPassword.length > 1024) {
    errors.push("newPassword is too long.");
  }

  if (
    errors.length === 0 &&
    typeof body.currentPassword === "string" &&
    typeof body.newPassword === "string" &&
    body.currentPassword === body.newPassword
  ) {
    errors.push("New password must be different from the current password.");
  }

  if (errors.length > 0) return invalid(errors);

  return ok({
    currentPassword: body.currentPassword as string,
    newPassword: body.newPassword as string,
  });
}

// ── Book a class ────────────────────────────────────────────────────────
// `book/route.ts` only checked `if (!rateId)` — a non-string rateId (a
// number, an object) would sail through that check and reach Prisma's
// `where: { id: rateId }`, which either throws a Prisma validation error
// (500, not 400) or, worse, silently matches nothing and gets reported back
// as "Invalid rate selected" — technically correct but for the wrong
// diagnosable reason. This gives it the same explicit type/shape guard as
// every other body-validated route.

export interface BookClassBody {
  rateId: string;
}

export function validateBookClass(body: unknown): ValidationResult<BookClassBody> {
  if (!isPlainObject(body)) return invalid(["Request body must be a JSON object."]);

  if (typeof body.rateId !== "string" || body.rateId.trim().length === 0) {
    return invalid(["rateId must be a non-empty string."]);
  }
  if (body.rateId.length > 200) {
    return invalid(["rateId is not valid."]);
  }

  return ok({ rateId: body.rateId.trim() });
}

// ── Chat message (send to teacher) ────────────────────────────────────────
// `chat/[teacherId]/route.ts`'s JSON branch did `content = body.content ||
// ""` with no length cap and no type check — a non-string `content` (e.g. an
// array or object) would be stored as-is by Prisma (if the column type
// allowed it, a runtime error; if coerced, `[object Object]` saved forever)
// and there was nothing stopping a multi-megabyte string from being written
// straight into the chat history.

export interface ChatMessageBody {
  content: string;
}

const MAX_CHAT_MESSAGE_LENGTH = 5_000;

export function validateChatMessage(body: unknown): ValidationResult<ChatMessageBody> {
  if (!isPlainObject(body)) return invalid(["Request body must be a JSON object."]);

  const raw = body.content;
  if (raw !== undefined && typeof raw !== "string") {
    return invalid(["content must be a string."]);
  }

  const content = typeof raw === "string" ? raw.trim() : "";
  if (content.length > MAX_CHAT_MESSAGE_LENGTH) {
    return invalid([`content is too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters).`]);
  }

  return ok({ content });
}
