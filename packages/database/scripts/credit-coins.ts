/**
 * Manually credit coins to one account, outside the payment flow.
 *
 *   npx tsx --env-file=packages/database/.env packages/database/scripts/credit-coins.ts \
 *     --email someone@example.com --amount 1000 --reason "Goodwill credit" [--apply]
 *
 * Without --apply it only looks the account up and prints what would happen.
 * The credit is an ADJUSTMENT ledger entry written through `credit()`, so the
 * balance and the transaction history stay in step. Pass --key to make a
 * retry of the same grant a no-op; by default a fresh key is generated.
 */
import { randomUUID } from "node:crypto";
import { db } from "../index";
import { credit, getCoinBalance } from "../coin-ledger";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const amount = Number(arg("amount"));
  const reason = arg("reason")?.trim();
  const apply = process.argv.includes("--apply");
  const key = arg("key") ?? `script-credit-${randomUUID()}`;

  if (!email || !Number.isInteger(amount) || amount <= 0 || !reason) {
    throw new Error("Usage: --email <email> --amount <positive int> --reason <text> [--apply] [--key <key>]");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new Error(`No user with email ${email}`);

  const before = await getCoinBalance(user.id);
  console.log(`User    : <${user.email}> [${user.role}] ${user.id}`);
  console.log(`Balance : ${before.balance} spendable, ${before.heldBalance} held`);
  console.log(`Credit  : +${amount} (${reason})`);

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply to credit.");
    return;
  }

  const after = await db.$transaction((tx) =>
    credit(
      { userId: user.id, amount, type: "ADJUSTMENT", description: `Manual credit: ${reason}`, idempotencyKey: key },
      tx
    )
  );
  console.log(`\n✓ Credited. New balance: ${after.balance} spendable, ${after.heldBalance} held`);
  console.log(`  idempotency key: ${key}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
