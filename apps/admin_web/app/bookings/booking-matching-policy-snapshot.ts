import type { AdminBooking } from '../../lib/admin-api';
import { readPlainRecord } from '../../lib/admin-format';
import type { BookingMatchingPolicySnapshot } from '../../lib/booking-matching-rule-snapshot';
import { readOptionalNumber, readOptionalString } from './booking-readers';

export function bookingMatchingPolicySnapshot(
  booking: Pick<AdminBooking, 'metadata'>,
): BookingMatchingPolicySnapshot | null {
  const metadata = readPlainRecord(booking.metadata);
  const policy = readPlainRecord(metadata?.matchingPolicy);
  if (!policy) {
    return null;
  }

  const marketplaceRadiusMeters =
    readOptionalNumber(policy.marketplaceRadiusMeters) ??
    readOptionalNumber(policy.marketplacePartnerRadiusMeters) ??
    readOptionalNumber(policy.backupProviderRadiusMeters);
  const marketplaceLocationMaxAgeMinutes =
    readOptionalNumber(policy.marketplaceLocationMaxAgeMinutes) ??
    readOptionalNumber(policy.marketplacePartnerLocationMaxAgeMinutes) ??
    readOptionalNumber(policy.backupProviderLocationMaxAgeMinutes);
  const marketplaceInvitationLimit =
    readOptionalNumber(policy.marketplaceInvitationLimit) ??
    readOptionalNumber(policy.marketplacePartnerInvitationLimit) ??
    readOptionalNumber(policy.backupProviderInvitationLimit);
  const marketplaceOpenMode =
    readOptionalString(policy.marketplaceOpenMode) ?? readOptionalString(policy.backupOpenMode);

  return {
    providerResponseWindowMinutes: readOptionalNumber(policy.providerResponseWindowMinutes),
    backupProviderRadiusMeters: marketplaceRadiusMeters,
    backupProviderLocationMaxAgeMinutes: marketplaceLocationMaxAgeMinutes,
    backupProviderInvitationLimit: marketplaceInvitationLimit,
    preferredAcceptMode: readOptionalString(policy.preferredAcceptMode),
    backupOpenMode: marketplaceOpenMode,
    travelBufferMinutes: readOptionalNumber(policy.travelBufferMinutes),
  };
}
