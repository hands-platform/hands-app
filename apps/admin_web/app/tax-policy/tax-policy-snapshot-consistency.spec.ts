import type { AdminEarning } from '../../lib/admin-api';
import { buildTaxPolicySnapshotConsistency } from './tax-policy-snapshot-consistency';

describe('buildTaxPolicySnapshotConsistency', () => {
  it('summarizes recent earning tax snapshots without recalculating settlement policy', () => {
    const summary = buildTaxPolicySnapshotConsistency([
      earning({
        id: 'earning-consistent',
        withholdingAmount: 50_000,
        taxLogs: [
          {
            createdAt: '2026-06-27T10:00:00.000Z',
            currency: 'VND',
            grossAmount: 1_000_000,
            id: 'tax-log-1',
            ruleSnapshot: { policyName: 'Vietnam tax 2026' },
            taxableAmount: 1_000_000,
            withholdingAmount: 50_000,
          },
        ],
      }),
      earning({
        id: 'earning-mismatch',
        withholdingAmount: 70_000,
        taxLogs: [
          {
            createdAt: '2026-06-27T10:00:00.000Z',
            currency: 'VND',
            grossAmount: 1_000_000,
            id: 'tax-log-2',
            ruleSnapshot: { reason: 'NO_APPROVED_TAX_PROFILE' },
            taxableAmount: 1_000_000,
            withholdingAmount: 60_000,
          },
        ],
      }),
      earning({
        id: 'earning-missing-log',
        withholdingAmount: 0,
        taxLogs: [],
      }),
    ]);

    expect(summary).toMatchObject({
      consistentCount: 1,
      missingRuleSnapshotCount: 0,
      missingTaxLogCount: 1,
      sampleCount: 3,
      warningCount: 2,
    });
    expect(summary.rows).toEqual([
      expect.objectContaining({
        deltaLabel: '0 VND',
        earningHref: '/earnings?earningId=earning-consistent#earning-earning-consistent',
        financeTraceHref: '/bookings/booking-123456789#finance',
        id: 'earning-consistent',
        snapshotLabel: 'Vietnam tax 2026',
        statusLabel: 'Aligned',
        recordIntegrityLabel: 'Amounts match',
        taxApplicabilityLabel: 'Applicable evidence present',
        toneClassName: 'pill-success',
      }),
      expect.objectContaining({
        deltaLabel: '10.000 VND',
        id: 'earning-mismatch',
        snapshotLabel: 'NO_APPROVED_TAX_PROFILE',
        statusLabel: 'Check amount',
        taxApplicabilityLabel: 'No approved tax profile',
        taxApplicabilityTone: 'warning',
        toneClassName: 'pill-danger',
      }),
      expect.objectContaining({
        id: 'earning-missing-log',
        snapshotLabel: 'No tax log',
        statusLabel: 'Missing tax log',
        taxApplicabilityLabel: 'Needs review',
        toneClassName: 'pill-warn',
      }),
    ]);
  });
});

function earning(overrides: Partial<AdminEarning>): AdminEarning {
  return {
    bookingId: 'booking-123456789',
    currency: 'VND',
    grossAmount: 1_000_000,
    id: 'earning-1',
    netAmount: 800_000,
    platformFee: 150_000,
    providerProfileId: 'provider-123456789',
    providerProfile: { displayName: 'Smoke Partner', user: { phone: '+84000000000' } },
    status: 'PAID',
    withholdingAmount: 50_000,
    ...overrides,
  };
}
