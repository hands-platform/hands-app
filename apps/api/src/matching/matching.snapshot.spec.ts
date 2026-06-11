import {
  BACKUP_OPEN_IMMEDIATE,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
  type MatchingPolicy,
} from './matching.policy';
import { getRecordId, matchingPolicySnapshot } from './matching.snapshot';

describe('matching snapshot helpers', () => {
  it('reads string ids from records only', () => {
    expect(getRecordId({ id: 'booking-1' })).toBe('booking-1');
    expect(getRecordId({ id: 1 })).toBeUndefined();
    expect(getRecordId(null)).toBeUndefined();
  });

  it('builds the matching policy snapshot used by open booking events', () => {
    expect(matchingPolicySnapshot(policy())).toEqual({
      sort: ['distance', 'availability'],
      travelBufferMinutes: 30,
      earlyAcceptWindowMinutes: 10,
      preferredProviderResponseWindowMinutes: 10,
      marketplaceRadiusMeters: 12000,
      marketplaceLocationMaxAgeMinutes: 15,
      marketplaceInvitationLimit: 25,
      marketplaceOpenMode: BACKUP_OPEN_IMMEDIATE,
      backupProviderRadiusMeters: 12000,
      backupProviderLocationMaxAgeMinutes: 15,
      backupProviderInvitationLimit: 25,
      bookingMaxCustomerCurrentToAddressKm: 20,
      bookingMaxPreferredProviderDistanceKm: 50,
      bookingCurrentLocationFreshnessMinutes: 10,
      bookingDistanceGateEnabled: true,
      bookingServiceAreaRequired: true,
      preferredAcceptMode: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
      backupOpenMode: BACKUP_OPEN_IMMEDIATE,
      finalSelection: 'CUSTOMER_SELECTS_PARTNER',
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
