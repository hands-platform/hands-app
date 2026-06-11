import type { MatchingPolicy } from './matching.policy';

export function getRecordId(value: unknown) {
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return undefined;
}

export function matchingPolicySnapshot(policy: MatchingPolicy) {
  return {
    sort: ['distance', 'availability'],
    travelBufferMinutes: policy.travelBufferMinutes,
    earlyAcceptWindowMinutes: policy.providerResponseWindowMinutes,
    preferredProviderResponseWindowMinutes: policy.providerResponseWindowMinutes,
    marketplaceRadiusMeters: policy.backupProviderRadiusMeters,
    marketplaceLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
    marketplaceInvitationLimit: policy.backupProviderInvitationLimit,
    marketplaceOpenMode: policy.backupOpenMode,
    backupProviderRadiusMeters: policy.backupProviderRadiusMeters,
    backupProviderLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
    backupProviderInvitationLimit: policy.backupProviderInvitationLimit,
    bookingMaxCustomerCurrentToAddressKm: policy.bookingMaxCustomerCurrentToAddressKm,
    bookingMaxPreferredProviderDistanceKm: policy.bookingMaxPreferredProviderDistanceKm,
    bookingCurrentLocationFreshnessMinutes: policy.bookingCurrentLocationFreshnessMinutes,
    bookingDistanceGateEnabled: policy.bookingDistanceGateEnabled,
    bookingServiceAreaRequired: policy.bookingServiceAreaRequired,
    preferredAcceptMode: policy.preferredAcceptMode,
    backupOpenMode: policy.backupOpenMode,
    finalSelection: 'CUSTOMER_SELECTS_PARTNER',
  };
}
