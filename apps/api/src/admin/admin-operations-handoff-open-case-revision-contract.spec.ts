import { readFileSync } from 'node:fs';

const migrationSource = readFileSync(
  new URL(
    '../../prisma/migrations/20260821120000_add_operations_handoff_open_case_revision/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const serviceSource = readFileSync(new URL('./admin.service.ts', import.meta.url), 'utf8');

describe('Operations handoff open-case revision contract', () => {
  it('keeps the singleton revision and statement-level bump function in the database', () => {
    expect(migrationSource).toContain('CREATE TABLE "OperationsHandoffOpenCaseRevision"');
    expect(migrationSource).toContain("VALUES ('open-cases', 0)");
    expect(migrationSource).toContain(
      'CREATE OR REPLACE FUNCTION hands_bump_operations_handoff_open_case_revision()',
    );
    expect(migrationSource).toContain('"revision" = "revision" + 1');
    expect(migrationSource).toContain('FOR EACH STATEMENT');
  });

  it.each([
    'Booking',
    'BookingParticipant',
    'Payment',
    'ProviderEarning',
    'Refund',
    'ProviderProfile',
    'ProviderVerification',
    'ProviderKyc',
    'PartnerBankDepositCashDebtAllocation',
    'Notification',
    'NotificationDelivery',
    'User',
    'CustomerProfile',
  ])('bumps the revision when %s can change open-case membership', (table) => {
    expect(migrationSource).toContain(`CREATE TRIGGER "${table}_bump_operations_handoff_open_case_revision"`);
  });

  it('limits high-volume identity tables to membership-affecting updates', () => {
    expect(migrationSource).toContain(
      'BEFORE UPDATE OF "id", "fullName", "fixtureKind", "fixtureRunId", "fixtureExpiresAt" ON "User"',
    );
    expect(migrationSource).toContain('BEFORE UPDATE OF "id", "userId" ON "CustomerProfile"');
  });

  it.each([
    'payment-holds',
    'matching-delays',
    'cancellation-review',
    'refund-review',
    'partner-approvals',
    'cash-reconciliation',
    'notification-failures',
  ])('joins the %s queue by its queue key rather than its policy storage key', (queueKey) => {
    expect(serviceSource).toContain(`('${queueKey}'::text, \${START_SHIFT_ACTION_SLA_POLICY_KEYS.`);
    expect(serviceSource).toContain(
      'LEFT JOIN "OperationalPolicySetting" setting ON setting.key = policy_default."policyKey"',
    );
  });
});
