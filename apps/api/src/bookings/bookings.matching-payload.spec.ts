import {
  BACKUP_OPEN_IMMEDIATE,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
  type MatchingPolicy,
} from '../matching/matching.policy';
import { bookingOpenMatchingPayload } from './bookings.matching-payload';

describe('booking matching payload helpers', () => {
  it('builds open-booking matching payload radius and invitation fields from policy', () => {
    expect(bookingOpenMatchingPayload(policy(), 7)).toEqual({
      eligibleBackupProviderCount: 7,
      marketplaceRadiusMeters: 12000,
      marketplaceInvitationLimit: 25,
      backupProviderRadiusMeters: 12000,
      backupProviderInvitationLimit: 25,
    });
  });

  it('preserves first-pick decline evidence when reopening marketplace matching', () => {
    expect(bookingOpenMatchingPayload(policy(), 3, { firstPickDeclined: true })).toEqual({
      eligibleBackupProviderCount: 3,
      marketplaceRadiusMeters: 12000,
      marketplaceInvitationLimit: 25,
      backupProviderRadiusMeters: 12000,
      backupProviderInvitationLimit: 25,
      firstPickDeclined: true,
    });
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
