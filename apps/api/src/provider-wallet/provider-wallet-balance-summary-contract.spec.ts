import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');
const schemaSource = readFileSync(resolve(root, 'apps/api/prisma/schema.prisma'), 'utf8');
const migrationSource = readFileSync(
  resolve(
    root,
    'apps/api/prisma/migrations/20260719133000_add_provider_wallet_balance_summary/migration.sql',
  ),
  'utf8',
);
const serializedRefreshMigrationSource = readFileSync(
  resolve(
    root,
    'apps/api/prisma/migrations/20260728113000_serialize_provider_wallet_balance_summary_refresh/migration.sql',
  ),
  'utf8',
);

describe('provider wallet balance summary contract', () => {
  it('stores one exact bigint balance per Partner and currency', () => {
    const model = schemaSource.match(/model ProviderWalletBalanceSummary\s+\{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(model).toMatch(/balance\s+BigInt\s+@default\(0\)/);
    expect(model).toContain('@@id([providerProfileId, currency])');
    expect(model).toContain('@@index([currency, balance])');
  });

  it('backfills existing ledger rows and synchronizes every mutation type', () => {
    expect(migrationSource).toContain('FROM "ProviderWalletLedgerEntry"');
    expect(migrationSource).toContain('GROUP BY "providerProfileId", "currency"');
    expect(migrationSource).toContain('AFTER INSERT OR UPDATE OR DELETE');
    expect(migrationSource).toContain("IF TG_OP = 'DELETE'");
    expect(migrationSource).toContain("IF TG_OP = 'UPDATE'");
    expect(migrationSource).toContain('OLD."providerProfileId" IS DISTINCT FROM NEW."providerProfileId"');
  });

  it('serializes concurrent refreshes for one Partner and currency bucket', () => {
    expect(serializedRefreshMigrationSource).toContain(
      'CREATE OR REPLACE FUNCTION refresh_provider_wallet_balance_summary',
    );
    expect(serializedRefreshMigrationSource).toContain('pg_advisory_xact_lock');
    expect(serializedRefreshMigrationSource).toContain(
      "hashtextextended(target_provider_profile_id || ':' || target_currency, 0)",
    );
  });
});
