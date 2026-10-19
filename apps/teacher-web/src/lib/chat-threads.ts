/**
 * lib/chat-threads.ts — newest message per conversation, in one query.
 *
 * The thread list used to load every message between the user and every
 * counterpart just to keep the newest one each. DISTINCT ON keeps one row per
 * counterpart in the database instead, using the
 * (senderId, receiverId, createdAt) and (receiverId, senderId, createdAt)
 * indexes. Every value is a bound parameter of the tagged template.
 */
import { prisma } from "@/lib/db";

export interface LastMessage {
  counterpart: string;
  content: string;
  createdAt: Date;
}

export async function fetchLastMessages(userId: string, counterpartIds: string[]): Promise<Map<string, LastMessage>> {
  if (counterpartIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<LastMessage[]>`
    SELECT DISTINCT ON (m.counterpart) m.counterpart, m.content, m."createdAt"
    FROM (
      SELECT CASE WHEN "senderId" = ${userId}::uuid THEN "receiverId" ELSE "senderId" END AS counterpart,
             "id", "content", "createdAt"
      FROM "ChatMessage"
      WHERE ("senderId" = ${userId}::uuid AND "receiverId" = ANY(${counterpartIds}::uuid[]))
         OR ("receiverId" = ${userId}::uuid AND "senderId" = ANY(${counterpartIds}::uuid[]))
    ) AS m
    ORDER BY m.counterpart, m."createdAt" DESC, m."id" DESC
  `;

  return new Map(rows.map((row) => [String(row.counterpart), row]));
}
