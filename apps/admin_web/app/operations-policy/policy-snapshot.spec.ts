import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import {
  bookingPolicySnapshotDrift,
  formatSnapshotPolicyValue,
  readBookingMatchingPolicySnapshot,
  summarizeSnapshotValues,
} from './policy-snapshot';

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
    id: 'booking_snapshot',
    status: 'OPEN_MATCHING',
    metadata: {
      matchingPolicy: {
        providerResponseWindowMinutes: '10',
        backupProviderRadiusMeters: 10000,
        backupProviderLocationMaxAgeMinutes: '30',
        backupProviderInvitationLimit: 20,
        preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
        backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
        travelBufferMinutes: 30,
      },
    },
    ...overrides,
  } as AdminBooking;
}

describe('policy snapshot helpers', () => {
  it('reads saved booking matching policy values from metadata', () => {
    expect(readBookingMatchingPolicySnapshot(booking())).toEqual({
      providerResponseWindowMinutes: 10,
      backupProviderRadiusMeters: 10000,
      backupProviderLocationMaxAgeMinutes: 30,
      backupProviderInvitationLimit: 20,
      preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
      backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
      travelBufferMinutes: 30,
    });
    expect(readBookingMatchingPolicySnapshot(booking({ metadata: {} }))).toBeNull();
  });

  it('summarizes saved policy values and detects drift against live settings', () => {
    const settings = [
      setting({
        key: OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
        value: 15,
      }),
      setting({
        key: OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
        value: 10000,
      }),
      setting({
        key: OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
        value: 30,
      }),
      setting({
        key: OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
        value: 20,
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
      setting({
        key: OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
        value: 'IMMEDIATE_WITHIN_WINDOW',
      }),
      setting({
        key: OPERATIONAL_POLICY_KEYS.travelBufferMinutes,
        value: 30,
      }),
    ];
    const bookings = [
      booking(),
      booking({
        id: 'booking_snapshot_2',
        metadata: {
          matchingPolicy: {
            providerResponseWindowMinutes: 15,
          },
        },
      }),
    ];

    expect(
      summarizeSnapshotValues(
        bookings,
        (snapshot) => snapshot.providerResponseWindowMinutes,
        (value) => `${value} min`,
      ),
    ).toBe('10 min (1), 15 min (1)');
    expect(formatSnapshotPolicyValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode, 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT')).toBe(
      'Customer final choice',
    );
    expect(bookingPolicySnapshotDrift(booking(), settings)).toEqual([
      {
        label: 'response window',
        saved: 10,
        live: 15,
      },
    ]);
  });
});
