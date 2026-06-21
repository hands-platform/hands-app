import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildPolicyImpactDashboard } from './policy-impact-dashboard';

describe('policy impact dashboard builder', () => {
  it('summarizes live policy exposure, saved snapshots, and wallet review state', () => {
    const dashboard = buildPolicyImpactDashboard(
      [
        setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 10, { unit: 'minutes' }),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, 10000, { unit: 'meters' }),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, 30, {
          unit: 'minutes',
        }),
        setting(OPERATIONAL_POLICY_KEYS.preferredAcceptMode, 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, 'IMMEDIATE_WITHIN_WINDOW'),
        setting(OPERATIONAL_POLICY_KEYS.travelBufferMinutes, 30, { unit: 'minutes' }),
      ],
      [
        booking({
          earning: {
            walletLedgerEntries: [
              {
                amount: -150000,
              },
            ],
          },
          metadata: {
            matchingPolicy: {
              backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
              backupProviderLocationMaxAgeMinutes: 30,
              backupProviderRadiusMeters: 5000,
              preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
              providerResponseWindowMinutes: 5,
              travelBufferMinutes: 30,
            },
          },
          status: 'OPEN_MATCHING',
        }),
        booking({ id: 'active-booking', status: 'MATCHED' }),
      ],
    );

    expect(dashboard.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Open matching now', value: '1' }),
        expect.objectContaining({ label: 'Active dispatch', value: '1' }),
        expect.objectContaining({ label: 'Policy drift', value: '1' }),
        expect.objectContaining({ label: 'Older bookings', value: '1' }),
      ]),
    );
    expect(dashboard.snapshotSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Open bookings with saved policy', value: '1/1' }),
        expect.objectContaining({ label: 'Snapshot coverage', value: '50%' }),
      ]),
    );
    expect(dashboard.snapshotRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          liveValue: '10 km',
          policy: 'Marketplace Partner radius',
          savedValue: '5 km (1)',
        }),
        expect.objectContaining({
          liveValue: '10 min',
          policy: 'First-pick response timer',
          savedValue: '5 min (1)',
        }),
        expect.objectContaining({
          operatorMeaning:
            'Controls whether stale partner locations are excluded from distance-sensitive marketplace matching and dispatch checks.',
          policy: 'Marketplace location freshness',
        }),
      ]),
    );
    expect(dashboard.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          className: 'ops-task-done',
          title: 'Marketplace Partners can participate during the first window',
        }),
        expect.objectContaining({
          className: 'ops-task-blocked',
          pillClass: 'pill-danger',
          title: 'Negative wallet gate protects cash-fee debt',
        }),
      ]),
    );
  });

  it('keeps empty samples explainable', () => {
    const dashboard = buildPolicyImpactDashboard([], []);

    expect(dashboard.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Open matching now', value: '0' }),
        expect.objectContaining({ label: 'Older bookings', value: '0' }),
      ]),
    );
    expect(dashboard.snapshotSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Snapshot coverage', value: 'No sample' }),
      ]),
    );
    expect(dashboard.snapshotRows[0]).toMatchObject({
      liveValue: 'Not configured',
      savedValue: 'No saved value',
    });
  });
});

function setting(
  key: string,
  value: string | number,
  overrides: Partial<AdminOperationalPolicySetting> = {},
): AdminOperationalPolicySetting {
  return {
    category: 'Matching',
    enforced: true,
    key,
    label: key,
    value,
    ...overrides,
  } as AdminOperationalPolicySetting;
}

function booking(overrides: Record<string, unknown>): AdminBooking {
  return {
    id: 'booking',
    status: 'OPEN_MATCHING',
    ...overrides,
  } as unknown as AdminBooking;
}
