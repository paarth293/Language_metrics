// Checks the ChatMessage index migrations as files. Never opens a database.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PRISMA_DIR = join(__dirname, "..", "prisma");

const INDEXES = [
  {
    folder: "20261020000000_chat_message_sender_receiver_created_idx",
    name: "ChatMessage_senderId_receiverId_createdAt_idx",
    columns: ["senderId", "receiverId", "createdAt"],
  },
  {
    folder: "20261020000100_chat_message_receiver_sender_created_idx",
    name: "ChatMessage_receiverId_senderId_createdAt_idx",
    columns: ["receiverId", "senderId", "createdAt"],
  },
];

/** SQL statements with `--` comments removed. */
function statements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const read = (...parts: string[]) => readFileSync(join(PRISMA_DIR, ...parts), "utf8");

describe("ChatMessage index migrations", () => {
  for (const index of INDEXES) {
    describe(index.folder, () => {
      const dir = join(PRISMA_DIR, "migrations", index.folder);
      const quotedColumns = index.columns.map((c) => `"${c}"`).join(", ");

      it("has a migration and a rollback file", () => {
        expect(existsSync(join(dir, "migration.sql"))).toBe(true);
        expect(existsSync(join(dir, "rollback.sql"))).toBe(true);
      });

      it("creates exactly one index, concurrently, outside any transaction", () => {
        const sql = statements(read("migrations", index.folder, "migration.sql"));
        expect(sql).toEqual([`CREATE INDEX CONCURRENTLY IF NOT EXISTS "${index.name}" ON "ChatMessage" (${quotedColumns})`]);
      });

      it("rolls back by dropping exactly that index, concurrently", () => {
        const sql = statements(read("migrations", index.folder, "rollback.sql"));
        expect(sql).toEqual([`DROP INDEX CONCURRENTLY IF EXISTS "${index.name}"`]);
      });
    });
  }

  it("declares both indexes on ChatMessage in schema.prisma", () => {
    const model = read("schema.prisma").match(/model ChatMessage \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(model).toContain("@@index([senderId, receiverId, createdAt])");
    expect(model).toContain("@@index([receiverId, senderId, createdAt])");
  });
});
