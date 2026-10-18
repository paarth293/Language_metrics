import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Financial records must outlive the user row: deleting a user may not
 * silently erase what they paid or the coin ledger that proves it. This test
 * checks the schema and the migration statically; it does not run against a
 * database.
 */
const prismaDir = join(__dirname, "../../packages/database/prisma");
const schema = readFileSync(join(prismaDir, "schema.prisma"), "utf8");

function userRelation(model: string) {
  const body = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`).exec(schema)?.[1] ?? "";
  return /\n\s*user\s+User\s+@relation\(([^)]*)\)/.exec(body)?.[1] ?? null;
}

describe("issue #10: deleting a user cannot erase payment records", () => {
  it.each(["PaymentOrder", "CoinTransaction", "Payment"])("%s.user does not cascade on delete", (model) => {
    const relation = userRelation(model);
    expect(relation, `${model} has a user relation`).not.toBeNull();
    expect(relation).not.toMatch(/onDelete:\s*Cascade/);
  });

  it.each(["PaymentOrder", "CoinTransaction"])("%s.user is explicitly Restrict", (model) => {
    expect(userRelation(model)).toMatch(/onDelete:\s*Restrict/);
  });

  it("a migration switches both foreign keys to ON DELETE RESTRICT", () => {
    const dir = readdirSync(join(prismaDir, "migrations")).find((name) => name.endsWith("_restrict_payment_record_deletes"));
    expect(dir, "migration directory").toBeDefined();
    const sql = readFileSync(join(prismaDir, "migrations", dir!, "migration.sql"), "utf8");
    for (const [table, constraint] of [["RazorpayOrder", "RazorpayOrder_userId_fkey"], ["CoinTransaction", "CoinTransaction_userId_fkey"]]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" FOREIGN KEY \\("userId"\\) REFERENCES "User"\\("id"\\) ON DELETE RESTRICT`));
    }
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  });
});
