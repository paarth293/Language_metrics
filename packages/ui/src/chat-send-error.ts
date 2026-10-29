/**
 * Why a chat message was not sent.
 *
 * The chat routes answer 400/403/413/429 with `{ error }`, but the pages threw
 * that away and only logged to the console, so a blocked message just
 * vanished from the composer. Prefer the server's own reason and fall back to
 * one derived from the status.
 */
const BY_STATUS: Record<number, string> = {
  400: "That message could not be sent as written.",
  403: "You can only message people you have a booking with.",
  413: "That attachment is too large.",
  429: "You are sending messages too quickly. Wait a moment and try again.",
};

const GENERIC = "Please check your connection and try again.";

/** A sentence to show the sender, e.g. "Message not sent. …". */
export async function chatSendError(response: Response): Promise<string> {
  let reason: string | null = null;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const value = (body as { error?: unknown }).error;
      if (typeof value === "string" && value.trim()) reason = value.trim();
    }
  } catch {
    // Not JSON (a proxy error page, say): fall back to the status.
  }
  return `Message not sent. ${reason ?? BY_STATUS[response.status] ?? GENERIC}`;
}
