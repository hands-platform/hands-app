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
        id: 'earning-consistent',
        snapshotLabel: 'Vietnam tax 2026',
        statusLabel: 'Aligned',
        toneClassName: 'pill-success',
      }),
      expect.objectContaining({
        deltaLabel: '10.000 VND',
        id: 'earning-mismatch',
        snapshotLabel: 'NO_APPROVED_TAX_PROFILE',
        statusLabel: 'Check amount',
        toneClassName: 'pill-danger',
      }),
      expect.objectContaining({
        id: 'earning-missing-log',
        snapshotLabel: 'No tax log',
        statusLabel: 'Missing tax log',
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
