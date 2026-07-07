import type { AdminBookingDetail } from '../../../lib/admin-api';
import { readPlainRecord } from '../../../lib/admin-format';
import { distanceLabel, formatDate } from './booking-formatters';
import { readOptionalNumber, readOptionalString } from './booking-readers';

export function readBookingMatchingPolicySnapshot(booking: AdminBookingDetail) {
  const metadata = readPlainRecord(booking.metadata);
  const policy = readPlainRecord(metadata?.matchingPolicy);
  const marketplaceRadiusMeters =
    readOptionalNumber(policy?.marketplaceRadiusMeters) ??
    readOptionalNumber(policy?.marketplacePartnerRadiusMeters) ??
    readOptionalNumber(policy?.backupProviderRadiusMeters);
  const marketplaceLocationMaxAgeMinutes =
    readOptionalNumber(policy?.marketplaceLocationMaxAgeMinutes) ??
    readOptionalNumber(policy?.marketplacePartnerLocationMaxAgeMinutes) ??
    readOptionalNumber(policy?.backupProviderLocationMaxAgeMinutes);
  const marketplaceInvitationLimit =
    readOptionalNumber(policy?.marketplaceInvitationLimit) ??
    readOptionalNumber(policy?.marketplacePartnerInvitationLimit) ??
    readOptionalNumber(policy?.backupProviderInvitationLimit);
  const marketplaceOpenMode =
    readOptionalString(policy?.marketplaceOpenMode) ??
    readOptionalString(policy?.backupOpenMode);
  return {
    providerResponseWindowMinutes: readOptionalNumber(policy?.providerResponseWindowMinutes),
    marketplaceRadiusMeters,
    marketplaceLocationMaxAgeMinutes,
    marketplaceInvitationLimit,
    marketplaceOpenMode,
    backupProviderRadiusMeters: marketplaceRadiusMeters,
    backupProviderLocationMaxAgeMinutes: marketplaceLocationMaxAgeMinutes,
    backupProviderInvitationLimit: marketplaceInvitationLimit,
    bookingMaxCustomerCurrentToAddressKm: readOptionalNumber(policy?.bookingMaxCustomerCurrentToAddressKm),
    bookingMaxPreferredProviderDistanceKm: readOptionalNumber(policy?.bookingMaxPreferredProviderDistanceKm),
    bookingCurrentLocationFreshnessMinutes: readOptionalNumber(
      policy?.bookingCurrentLocationFreshnessMinutes,
    ),
    preferredAcceptMode: readOptionalString(policy?.preferredAcceptMode),
    backupOpenMode: marketplaceOpenMode,
    travelBufferMinutes: readOptionalNumber(policy?.travelBufferMinutes),
  };
}

export function readBookingGateSnapshot(booking: AdminBookingDetail) {
  const metadata = readPlainRecord(booking.metadata);
  const gate = readPlainRecord(metadata?.bookingGate);
  const customerDistance = readOptionalNumber(gate?.customerToBookingAddressDistanceMeters);
  const customerLimit = readOptionalNumber(gate?.customerDistanceLimitMeters);
  const preferredDistance = readOptionalNumber(gate?.preferredProviderDistanceMeters);
  const preferredLimit = readOptionalNumber(gate?.preferredProviderDistanceLimitMeters);
  const customerCurrentLocation = readPlainRecord(gate?.customerCurrentLocation);
  const customerRecordedAt = readOptionalString(customerCurrentLocation?.recordedAt);
  const gatePassed = gate?.gatePassed === true;

  const customerDistanceLabel =
    customerDistance === null
      ? 'No optional customer GPS evidence'
      : `${distanceLabel(Math.round(customerDistance))} / historical support limit ${distanceLabel(Math.round(customerLimit ?? 0))}`;
  const preferredPartnerDistanceLabel =
    preferredDistance === null
      ? 'No preferred Partner distance'
      : `${distanceLabel(Math.round(preferredDistance))} / limit ${distanceLabel(Math.round(preferredLimit ?? 0))}`;

  return {
    gatePassed,
    customerDistanceLabel,
    customerDistanceHelper: customerRecordedAt
      ? `Optional customer GPS evidence was captured at ${formatDate(customerRecordedAt)} before booking opened.`
      : 'Address-based bookings may not have optional customer GPS metadata.',
    preferredPartnerDistanceLabel,
    preferredPartnerDistanceHelper:
      preferredDistance === null
        ? 'Marketplace-only bookings or older bookings may not have a first-pick Partner distance.'
        : 'Preferred Partner distance is measured from the immutable booking address.',
    summary: gatePassed
      ? `${customerDistanceLabel}; ${preferredPartnerDistanceLabel}`
      : 'Booking gate metadata is missing or older than this policy.',
  };
}
