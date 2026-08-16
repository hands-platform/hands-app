import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');
const schemaSource = readFileSync(resolve(root, 'apps/api/prisma/schema.prisma'), 'utf8');
const migrationSource = readFileSync(
  resolve(
    root,
    'apps/api/prisma/migrations/20260816143000_harden_wallet_ledger_immutability_and_payout_lookup/migration.sql',
  ),
  'utf8',
);

describe('wallet ledger immutability and payout lookup contract', () => {
  it('keeps source keys unique and adds the Partner payout history index', () => {
    const providerLedger = schemaSource.match(/model ProviderWalletLedgerEntry\s+\{[\s\S]*?\n\}/)?.[0] ?? '';
    const customerLedger = schemaSource.match(/model CustomerWalletLedgerEntry\s+\{[\s\S]*?\n\}/)?.[0] ?? '';
    const payoutBatch = schemaSource.match(/model ProviderPayoutBatch\s+\{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(providerLedger).toContain('sourceKey         String                   @unique');
    expect(customerLedger).toContain('sourceKey         String                   @unique');
    expect(payoutBatch).toContain('@@index([providerProfileId, createdAt])');
  });

  it('rejects financial evidence updates and deletes while permitting exact no-op replays', () => {
    expect(migrationSource).toContain('CREATE OR REPLACE FUNCTION reject_wallet_ledger_mutation()');
    expect(migrationSource).toContain("IF TG_OP = 'DELETE'");
    expect(migrationSource).toContain("to_jsonb(NEW) - 'updatedAt'");
    expect(migrationSource).toContain("to_jsonb(OLD) - 'updatedAt'");
    expect(migrationSource).toContain('NEW."updatedAt" := OLD."updatedAt"');
    expect(migrationSource).toContain('BEFORE UPDATE OR DELETE ON "ProviderWalletLedgerEntry"');
    expect(migrationSource).toContain('BEFORE UPDATE OR DELETE ON "CustomerWalletLedgerEntry"');
    expect(migrationSource).toContain('write a reversal entry instead');
  });

  it('ships a non-destructive lookup index for Partner payout batches', () => {
    expect(migrationSource).toContain(
      'CREATE INDEX IF NOT EXISTS "ProviderPayoutBatch_providerProfileId_createdAt_idx"',
    );
    expect(migrationSource).toContain('ON "ProviderPayoutBatch"("providerProfileId", "createdAt")');
    expect(migrationSource).not.toContain('DROP TABLE');
  });
});
