import { readFileSync } from 'node:fs';

const migrationSource = readFileSync(
  new URL(
    '../../prisma/migrations/20260824123000_materialize_partner_wallet_debt_snapshots/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const schemaSource = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('./admin.service.ts', import.meta.url), 'utf8');

describe('Partner wallet debt snapshot contract', () => {
  it('stores bounded snapshot metadata and frozen searchable profile members', () => {
    expect(schemaSource).toContain('model PartnerWalletDebtSnapshot {');
    expect(schemaSource).toContain('model PartnerWalletDebtSnapshotMember {');
    expect(migrationSource).toContain('CREATE TABLE "PartnerWalletDebtSnapshot"');
    expect(migrationSource).toContain('CREATE TABLE "PartnerWalletDebtSnapshotMember"');
    expect(migrationSource).toContain('CHECK ("expiresAt" > "snapshotAt")');
    expect(migrationSource).toContain('CHECK ("balance" < 0)');
    expect(migrationSource).toContain(
      '"PartnerWalletDebtSnapshotMember_snapshotId_balance_providerProfileId_idx"',
    );
    expect(schemaSource).toContain('map: "PartnerWalletDebtSnapshotMember_snapshotId_balance_providerProf"');
  });

  it('keeps snapshot membership independent from later live profile mutations', () => {
    expect(migrationSource).not.toContain('FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"');
    expect(serviceSource).toContain('INSERT INTO "PartnerWalletDebtSnapshotMember"');
    expect(serviceSource).toContain('FROM "PartnerWalletDebtSnapshotMember" member');
    expect(serviceSource).toContain('member."displayName"');
    expect(serviceSource).toContain('displayName: frozenProfile.displayName');
  });

  it('expires and prunes the operational profile snapshots after the cursor window', () => {
    expect(migrationSource).toContain('"PartnerWalletDebtSnapshot_expiresAt_idx"');
    expect(serviceSource).toContain("CURRENT_TIMESTAMP + INTERVAL '30 minutes'");
    expect(serviceSource).toContain('WHERE "expiresAt" <= CURRENT_TIMESTAMP');
    expect(serviceSource).toContain('snapshot."expiresAt" > CURRENT_TIMESTAMP');
  });
});
