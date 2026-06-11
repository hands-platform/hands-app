import {
  BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
  BACKUP_OPEN_IMMEDIATE,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
  type MatchingPolicy,
} from '../matching/matching.policy';
import { bookingMatchingPolicySnapshot, restoreBookingMatchingPolicy } from './bookings.matching-policy';

describe('booking matching policy snapshot', () => {
  it('stores current marketplace fields with legacy backup aliases', () => {
    const snapshot = bookingMatchingPolicySnapshot(policy());

    expect(snapshot).toMatchObject({
      marketplaceRadiusMeters: 12000,
      marketplaceLocationMaxAgeMinutes: 15,
      marketplaceInvitationLimit: 25,
      marketplaceOpenMode: BACKUP_OPEN_IMMEDIATE,
      backupProviderRadiusMeters: 12000,
      backupProviderLocationMaxAgeMinutes: 15,
      backupProviderInvitationLimit: 25,
      backupOpenMode: BACKUP_OPEN_IMMEDIATE,
    });
  });

  it('restores current marketplace snapshot fields before legacy backup aliases', () => {
    const restored = restoreBookingMatchingPolicy(
      {
        matchingPolicy: {
          providerResponseWindowMinutes: 7,
          marketplaceRadiusMeters: 9000,
          marketplaceLocationMaxAgeMinutes: 12,
          marketplaceInvitationLimit: 10,
          marketplaceOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
          backupProviderRadiusMeters: 30000,
          backupProviderLocationMaxAgeMinutes: 90,
          backupProviderInvitationLimit: 99,
          backupOpenMode: BACKUP_OPEN_IMMEDIATE,
          bookingDistanceGateEnabled: false,
          bookingServiceAreaRequired: false,
        },
      },
      policy(),
    );

    expect(restored).toMatchObject({
      providerResponseWindowMinutes: 7,
      backupProviderRadiusMeters: 9000,
      backupProviderLocationMaxAgeMinutes: 12,
      backupProviderInvitationLimit: 10,
      backupOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
      bookingDistanceGateEnabled: false,
      bookingServiceAreaRequired: false,
    });
  });

  it('falls back when metadata has no usable matching policy snapshot', () => {
    const fallback = policy();

    expect(restoreBookingMatchingPolicy({ matchingPolicy: null }, fallback)).toBe(fallback);
    expect(restoreBookingMatchingPolicy(null, fallback)).toBe(fallback);
  });
});

function policy(overrides: Partial<MatchingPolicy> = {}): MatchingPolicy {
  return {
    backupOpenMode: BACKUP_OPEN_IMMEDIATE,
    backupProviderInvitationLimit: 25,
    backupProviderLocationMaxAgeMinutes: 15,
    backupProviderRadiusMeters: 12000,
    bookingCurrentLocationFreshnessMinutes: 10,
    bookingDistanceGateEnabled: true,
    bookingMaxCustomerCurrentToAddressKm: 20,
    bookingMaxPreferredProviderDistanceKm: 50,
    bookingServiceAreaRequired: true,
    preferredAcceptMode: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    providerResponseWindowMinutes: 10,
    travelBufferMinutes: 30,
    ...overrides,
  };
}
