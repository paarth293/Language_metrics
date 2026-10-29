// Chat message body, shared by student-web's and teacher-web's chat POST
// routes so both apps enforce the same type check and length cap. Moved
// unchanged from student-web's lib/validation.ts (same result shape as both
// apps' `ValidationResult<T>`), so its error messages stay the same.

export interface ChatMessageBody {
  content: string;
}

export type ChatMessageValidation =
  | { ok: true; data: ChatMessageBody }
  | { ok: false; errors: string[] };

export const MAX_CHAT_MESSAGE_LENGTH = 5_000;

export function validateChatMessage(body: unknown): ChatMessageValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: ["Request body must be a JSON object."] };
  }

  const raw = (body as Record<string, unknown>).content;
  if (raw !== undefined && typeof raw !== "string") {
    return { ok: false, errors: ["content must be a string."] };
  }

  const content = typeof raw === "string" ? raw.trim() : "";
  if (content.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { ok: false, errors: [`content is too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters).`] };
  }

  return { ok: true, data: { content } };
}
