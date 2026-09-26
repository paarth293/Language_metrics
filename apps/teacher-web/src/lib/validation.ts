/**
 * src/lib/validation.ts — hand-rolled request-body validators.
 *
 * Mirrors the equivalent module in student-web so the two apps' shared routes
 * can stay byte-identical. Only the validators teacher-web actually uses live
 * here; student-web's copy is larger.
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

/** `{ demo: true }` books the fixed-price demo class; otherwise `rateId` picks one of the teacher's rates. */
export type BookClassBody = { demo: true } | { demo: false; rateId: string };

export function validateBookClass(body: unknown): ValidationResult<BookClassBody> {
  if (!isPlainObject(body)) return invalid(["Request body must be a JSON object."]);
  if (body.demo === true) return ok({ demo: true });

  if (typeof body.rateId !== "string" || body.rateId.trim().length === 0) {
    return invalid(["rateId must be a non-empty string."]);
  }
  if (body.rateId.length > 200) {
    return invalid(["rateId is not valid."]);
  }

  return ok({ demo: false, rateId: body.rateId.trim() });
}
