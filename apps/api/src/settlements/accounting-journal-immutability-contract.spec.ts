import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');
const migrationSource = readFileSync(
  resolve(
    root,
    'apps/api/prisma/migrations/20260816160000_harden_accounting_journal_immutability/migration.sql',
  ),
  'utf8',
);
const mutationSources = [
  'apps/api/src/admin/admin.service.ts',
  'apps/api/src/earnings/earnings.service.ts',
  'apps/api/src/referrals/referrals.service.ts',
  'apps/api/src/settlements/settlements.service.ts',
].map((path) => readFileSync(resolve(root, path), 'utf8'));

describe('accounting journal immutability contract', () => {
  it('rejects updates and deletes to posted journal and closed-period reversal evidence', () => {
    expect(migrationSource).toContain('CREATE OR REPLACE FUNCTION reject_accounting_evidence_mutation()');
    expect(migrationSource).toContain('BEFORE UPDATE OR DELETE ON "AccountingJournalBatch"');
    expect(migrationSource).toContain('BEFORE UPDATE OR DELETE ON "AccountingJournalEntry"');
    expect(migrationSource).toContain('BEFORE UPDATE OR DELETE ON "BookingSettlementReversalEntry"');
    expect(migrationSource).toContain('source-key replays must not change accounting evidence');
    expect(migrationSource).not.toContain('DROP TABLE');
  });

  it('keeps source-key journal replays as create-or-no-op operations', () => {
    for (const source of mutationSources) {
      const journalUpserts = source.match(/accountingJournalBatch\.upsert\([\s\S]*?\n\s*\}\);/gu) ?? [];
      for (const upsert of journalUpserts) {
        expect(upsert).toContain('update: {}');
        expect(upsert).not.toContain('deleteMany');
      }
    }
  });

  it('does not rewrite an existing closed-period settlement reversal', () => {
    const settlementsSource = mutationSources.at(-1) ?? '';
    const reversalUpsert = settlementsSource.match(
      /bookingSettlementReversalEntry\.upsert\([\s\S]*?\n\s*\}\);/u,
    )?.[0];

    expect(reversalUpsert).toContain('update: {}');
  });
});
