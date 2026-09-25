/**
 * One-time migration: normalise the ledger and materialise CoinAccount.
 *
 * Run AFTER `prisma migrate deploy` and BEFORE serving traffic on the new
 * code. Until this runs, CoinAccount rows do not exist and every balance
 * reads as zero, so students will be told they cannot afford classes they can
 * afford.
 *
 *   npx tsx packages/database/scripts/backfill-coins.ts
 *
 * Idempotent — rerunning recomputes the same balances. Run it again after the
 * deploy as a check; it should report drift: 0.
 */
import { auditCoinAccounts, backfillCoinAccounts } from "../coin-ledger";

async function main() {
  console.log("Normalising CoinTransaction signs and rebuilding CoinAccount…");
  const result = await backfillCoinAccounts();
  console.log(`  ledger rows corrected : ${result.rowsNormalised}`);
  console.log(`  accounts written      : ${result.accounts}`);

  const drift = await auditCoinAccounts();
  if (drift.length === 0) {
    console.log("\n✓ Every account balance matches its ledger.");
    return;
  }

  console.error(`\n✗ ${drift.length} account(s) do not match their ledger:`);
  for (const row of drift.slice(0, 20)) {
    console.error(
      `  ${row.userId}  account=${row.accountBalance}  ledger=${row.ledgerBalance}  drift=${row.drift}`
    );
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
