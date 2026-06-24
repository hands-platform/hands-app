import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');
const schemaSource = readFileSync(resolve(root, 'apps/api/prisma/schema.prisma'), 'utf8');

function schemaBlock(kind: 'enum' | 'model', name: string) {
  const match = schemaSource.match(new RegExp(`${kind}\\s+${name}\\s+\\{[\\s\\S]*?\\n\\}`));

  return match?.[0] ?? '';
}

function migrationSqlContaining(token: string) {
  const migrationsDir = resolve(root, 'apps/api/prisma/migrations');

  return readdirSync(migrationsDir)
    .map((name) => resolve(migrationsDir, name, 'migration.sql'))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, 'utf8'))
    .find((source) => source.includes(token));
}

function expectField(block: string, name: string, type: string) {
  expect(block).toMatch(new RegExp(`\\b${name}\\s+${type}(?=\\s|$)`));
}

describe('referral wallet credit schema contract', () => {
  it('defines an audited Customer wallet ledger for referral reward credits', () => {
    const providerLedgerType = schemaBlock('enum', 'ProviderWalletLedgerType');
    const customerProfile = schemaBlock('model', 'CustomerProfile');
    const booking = schemaBlock('model', 'Booking');
    const referralReward = schemaBlock('model', 'ReferralReward');
    const ledgerType = schemaBlock('enum', 'CustomerWalletLedgerType');
    const ledger = schemaBlock('model', 'CustomerWalletLedgerEntry');

    expect(providerLedgerType).toContain('REFERRAL_REWARD');
    expect(ledgerType).toContain('REFERRAL_REWARD');
    expect(ledgerType).toContain('REFUND');
    expect(ledgerType).toContain('ADMIN_ADJUSTMENT');
    expectField(customerProfile, 'walletLedgerEntries', 'CustomerWalletLedgerEntry\\[\\]');
    expectField(booking, 'customerWalletLedgerEntries', 'CustomerWalletLedgerEntry\\[\\]');
    expectField(referralReward, 'customerWalletLedgerEntries', 'CustomerWalletLedgerEntry\\[\\]');
    expectField(ledger, 'customerProfileId', 'String');
    expectField(ledger, 'bookingId', 'String\\?');
    expectField(ledger, 'referralRewardId', 'String\\?');
    expectField(ledger, 'type', 'CustomerWalletLedgerType');
    expect(ledger).toMatch(/\bsourceKey\s+String\s+@unique\b/);
    expectField(ledger, 'amount', 'Int');
    expect(ledger).toMatch(/\bcurrency\s+String\s+@default\("VND"\)/);
    expectField(ledger, 'metadata', 'Json\\?');
    expect(ledger).toMatch(/\bcustomerProfile\s+CustomerProfile\s+@relation/);
    expect(ledger).toMatch(/\bbooking\s+Booking\?\s+@relation/);
    expect(ledger).toMatch(/\breferralReward\s+ReferralReward\?\s+@relation/);
    expect(ledger).toContain('@@index([customerProfileId, createdAt])');
    expect(ledger).toContain('@@index([bookingId])');
    expect(ledger).toContain('@@index([referralRewardId])');
    expect(ledger).toContain('@@index([type, createdAt])');
  });

  it('ships a migration for the Customer wallet ledger table and indexes', () => {
    const migration = migrationSqlContaining('CREATE TABLE "CustomerWalletLedgerEntry"');
    const providerLedgerTypeMigration = migrationSqlContaining(
      'ALTER TYPE "ProviderWalletLedgerType" ADD VALUE',
    );

    expect(providerLedgerTypeMigration).toContain("'REFERRAL_REWARD'");
    expect(migration).toContain('CREATE TYPE "CustomerWalletLedgerType"');
    expect(migration).toContain('CREATE TABLE "CustomerWalletLedgerEntry"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "CustomerWalletLedgerEntry_sourceKey_key"',
    );
    expect(migration).toContain(
      'CREATE INDEX "CustomerWalletLedgerEntry_customerProfileId_createdAt_idx"',
    );
    expect(migration).toContain(
      'CREATE INDEX "CustomerWalletLedgerEntry_referralRewardId_idx"',
    );
    expect(migration).toContain('CustomerWalletLedgerEntry_customerProfileId_fkey');
    expect(migration).toContain('CustomerWalletLedgerEntry_bookingId_fkey');
    expect(migration).toContain('CustomerWalletLedgerEntry_referralRewardId_fkey');
  });
});
