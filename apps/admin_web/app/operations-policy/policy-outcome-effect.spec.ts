import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildPolicyOutcomeEffect } from './policy-outcome-effect';

function setting(overrides: Partial<AdminOperationalPolicySetting>): AdminOperationalPolicySetting {
  return {
    key: 'policy.key',
    category: 'Matching',
    label: 'Policy',
    value: 0,
    enforced: true,
    ...overrides,
  } as AdminOperationalPolicySetting;
}

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking_policy',
    status: 'OPEN_MATCHING',
    metadata: {
      matchingPolicy: {
        providerResponseWindowMinutes: 10,
        backupProviderRadiusMeters: 10000,
        backupProviderLocationMaxAgeMinutes: 30,
        backupProviderInvitationLimit: 20,
        preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
        backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
        travelBufferMinutes: 30,
      },
      backupNotificationTraces: [{ notifiedCount: 1 }],
    },
    participants: [],
    ...overrides,
  } as AdminBooking;
}

describe('policy outcome effect', () => {
  it('groups booking outcomes by saved policy snapshots using activity records only', () => {
    const settings = [
      setting({
        key: OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
        value: 10,
        unit: 'minutes',
      }),
      setting({
        key: OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
        value: 10000,
        unit: 'meters',
      }),
      setting({
        key: OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
        value: 20,
      }),
      setting({
        key: OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
        value: 'IMMEDIATE_WITHIN_WINDOW',
        options: [
          {
            value: 'IMMEDIATE_WITHIN_WINDOW',
            label: 'Immediate marketplace',
            tradeoff: 'Fast supply',
          },
        ],
      }),
      setting({
        key: OPERATIONAL_POLICY_KEYS.preferredAcceptMode,
        value: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
        options: [
          {
            value: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
            label: 'Customer final choice',
            tradeoff: 'No auto assignment',
          },
        ],
      }),
    ];
    const bookings = [
      booking({
        id: 'completed_booking',
        status: 'COMPLETED',
        selectedProvider: { id: 'partner_selected', displayName: 'Selected Partner' },
        participants: [
          { id: 'participant_1', status: 'SELECTED' } as never,
          { id: 'participant_2', status: 'ACCEPTED' } as never,
        ],
        metadata: {
          matchingPolicy: {
            providerResponseWindowMinutes: 10,
            backupProviderRadiusMeters: 10000,
            backupProviderLocationMaxAgeMinutes: 30,
            backupProviderInvitationLimit: 20,
            preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
            backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
            travelBufferMinutes: 30,
          },
          backupNotificationTraces: [{ notifiedCount: 3 }],
        },
      }),
      booking({
        id: 'cancelled_booking',
        status: 'CANCELLED',
      }),
      booking({
        id: 'matched_booking',
        status: 'MATCHED',
        selectedProvider: { id: 'partner_matched', displayName: 'Matched Partner' },
        participants: [{ id: 'participant_3', status: 'ACCEPTED' } as never],
        metadata: {
          matchingPolicy: {
            providerResponseWindowMinutes: 15,
            backupProviderRadiusMeters: 15000,
            backupProviderLocationMaxAgeMinutes: 45,
            backupProviderInvitationLimit: 30,
            preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
            backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
            travelBufferMinutes: 30,
          },
          backupNotificationTraces: [],
        },
      }),
      booking({
        id: 'legacy_without_snapshot',
        metadata: {},
      }),
    ];

    const analysis = buildPolicyOutcomeEffect(settings, bookings);

    expect(analysis.sampleCount).toBe(3);
    expect(analysis.metrics).toEqual([
      {
        label: 'Matched rate',
        value: '67%',
        helper: '2/3 sampled bookings reached a selected or active Partner.',
      },
      {
        label: 'Completed rate',
        value: '33%',
        helper: '1/3 sampled bookings completed service.',
      },
      {
        label: 'Avg marketplace alerts',
        value: '1.3 partners',
        helper: 'Uses stored marketplace alert traces from booking metadata, not just live partner supply.',
      },
      {
        label: 'Cancelled / expired / no-show',
        value: '1',
        helper: '1 cancelled, 0 expired, 0 no-show.',
      },
    ]);
    expect(
      analysis.rows.find((row) => row.policy === 'First-pick response window' && row.value === '10 min'),
    ).toMatchObject({
      sample: '2 bookings',
      matchedRate: '50%',
      completedRate: '50%',
      avgBackupInvites: '2 Partners',
      avgParticipants: '1 Partner',
      outcomeLabel: 'Low sample',
      outcomePill: 'pill-warn',
      outcomeDetail: '1 closed outcome to review / live value now 10 min.',
    });
    expect(analysis.cards.map((card) => card.title)).toEqual([
      'Policy snapshots are measurable',
      'Marketplace exposure: 10 km, cap 20',
      'Review closed booking cohorts before changing policy',
    ]);
  });
});
