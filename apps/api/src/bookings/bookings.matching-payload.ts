import type { MatchingPolicy } from '../matching/matching.policy';

type BookingOpenMatchingPayloadExtra = {
  firstPickDeclined?: boolean;
};

export function bookingOpenMatchingPayload(
  matchingPolicy: MatchingPolicy,
  eligibleBackupProviderCount: number,
  extra: BookingOpenMatchingPayloadExtra = {},
) {
  return {
    eligibleBackupProviderCount,
    marketplaceRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
    marketplaceInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
    backupProviderRadiusMeters: matchingPolicy.backupProviderRadiusMeters,
    backupProviderInvitationLimit: matchingPolicy.backupProviderInvitationLimit,
    ...extra,
  };
}
