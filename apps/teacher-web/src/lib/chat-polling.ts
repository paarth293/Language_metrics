/**
 * lib/chat-polling.ts — client-side polling rules for the chat page.
 *
 * Pairs with lib/chat-messages.ts on the server. An open conversation polls
 * every 10 s (30 s after 2 idle minutes), the thread list every 30 s, and
 * both pause while the tab is hidden. Polls ask only for messages newer than
 * the newest one shown, looking back 10 s so a message that committed late
 * (with an earlier createdAt) is not skipped; the overlap is removed by
 * merging on id.
 */

export const MESSAGE_POLL_MS = 10_000;
export const IDLE_MESSAGE_POLL_MS = 30_000;
export const IDLE_AFTER_MS = 2 * 60_000;
export const THREAD_POLL_MS = 30_000;
export const POLL_LOOKBACK_MS = 10_000;

export interface ChatMessageLike {
  id: string;
  createdAt: string;
}

/** Union by id (incoming wins), ordered by (createdAt, id) like the server. */
export function mergeMessages<T extends ChatMessageLike>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** URL for a poll: newer than the newest message, minus the look-back window. */
export function newerMessagesUrl(base: string, newest: ChatMessageLike | undefined): string {
  if (!newest) return base;
  const after = new Date(Date.parse(newest.createdAt) - POLL_LOOKBACK_MS).toISOString();
  return `${base}?after=${encodeURIComponent(after)}`;
}

/** URL for the page of messages just older than the oldest one shown. */
export function olderMessagesUrl(base: string, oldest: ChatMessageLike): string {
  return `${base}?before=${encodeURIComponent(oldest.createdAt)}&beforeId=${encodeURIComponent(oldest.id)}`;
}

export function messagePollDelay(lastActivityAt: number, now: number = Date.now()): number {
  return now - lastActivityAt > IDLE_AFTER_MS ? IDLE_MESSAGE_POLL_MS : MESSAGE_POLL_MS;
}
