/**
 * lib/chat-messages.ts — cursor pagination for one chat conversation.
 *
 * A conversation used to be returned whole on every poll. Pages are now
 * bounded and addressed by a (createdAt, id) cursor: ids are random UUIDs,
 * so the id only breaks ties between messages sent in the same millisecond.
 *
 *   (no params)                 newest page
 *   ?after=<iso>[&afterId=<id>] messages newer than the cursor (polling)
 *   ?before=<iso>&beforeId=<id> the page older than the cursor (scroll up)
 *
 * Messages are always returned oldest first.
 */

export const CHAT_PAGE_SIZE = 50;
export const CHAT_MAX_PAGE_SIZE = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ChatPageQuery =
  | { direction: "latest"; limit: number }
  | { direction: "after" | "before"; at: Date; id?: string; limit: number };

export function parseChatPageQuery(
  params: URLSearchParams
): { ok: true; query: ChatPageQuery } | { ok: false; error: string } {
  const rawLimit = params.get("limit");
  const limit = rawLimit === null ? CHAT_PAGE_SIZE : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > CHAT_MAX_PAGE_SIZE) {
    return { ok: false, error: `limit must be an integer from 1 to ${CHAT_MAX_PAGE_SIZE}.` };
  }

  const after = params.get("after");
  const before = params.get("before");
  if (after !== null && before !== null) return { ok: false, error: "Use either after or before, not both." };
  if (after === null && before === null) return { ok: true, query: { direction: "latest", limit } };

  const direction = after !== null ? "after" : "before";
  const at = new Date((after ?? before) as string);
  if (Number.isNaN(at.getTime())) return { ok: false, error: `${direction} must be an ISO date.` };

  const id = params.get(direction === "after" ? "afterId" : "beforeId") ?? undefined;
  if (id !== undefined && !UUID.test(id)) return { ok: false, error: `${direction}Id must be a UUID.` };

  return { ok: true, query: { direction, at, id, limit } };
}

const MESSAGE_FIELDS = {
  id: true,
  senderId: true,
  receiverId: true,
  content: true,
  attachmentUrl: true,
  autoDeleteAt: true,
  createdAt: true,
} as const;

export interface ChatMessageRow {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  attachmentUrl: string | null;
  autoDeleteAt: Date;
  createdAt: Date;
}

interface ChatMessageFinder {
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Record<string, "asc" | "desc">[];
    take: number;
    select: typeof MESSAGE_FIELDS;
  }): Promise<ChatMessageRow[]>;
}

export interface ChatCursor {
  createdAt: string;
  id: string;
}

export interface ChatPage {
  messages: ChatMessageRow[];
  /** More messages exist past this page in the direction that was asked for. */
  hasMore: boolean;
  cursor: { oldest: ChatCursor | null; newest: ChatCursor | null };
}

/** Strictly after/before (at, id); without an id, compares the time only. */
function cursorClause(direction: "after" | "before", at: Date, id: string | undefined) {
  const op = direction === "after" ? "gt" : "lt";
  if (!id) return { createdAt: { [op]: at } };
  return { OR: [{ createdAt: { [op]: at } }, { createdAt: at, id: { [op]: id } }] };
}

export async function fetchConversationPage(
  chatMessage: ChatMessageFinder,
  userId: string,
  otherId: string,
  query: ChatPageQuery
): Promise<ChatPage> {
  const conversation = {
    OR: [
      { senderId: userId, receiverId: otherId },
      { senderId: otherId, receiverId: userId },
    ],
  };
  const newestFirst = query.direction !== "after";
  const order = newestFirst ? "desc" : "asc";

  const rows = await chatMessage.findMany({
    where: query.direction === "latest" ? conversation : { AND: [conversation, cursorClause(query.direction, query.at, query.id)] },
    orderBy: [{ createdAt: order }, { id: order }],
    take: query.limit + 1,
    select: MESSAGE_FIELDS,
  });

  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const messages = newestFirst ? page.reverse() : page;
  const toCursor = (m: ChatMessageRow | undefined): ChatCursor | null =>
    m ? { createdAt: m.createdAt.toISOString(), id: m.id } : null;

  return {
    messages,
    hasMore,
    cursor: { oldest: toCursor(messages[0]), newest: toCursor(messages[messages.length - 1]) },
  };
}
