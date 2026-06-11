import type { AdminAuditLog } from '../../lib/admin-api';
import { formatDistanceMeters, readPlainRecord } from '../../lib/admin-format';
import { coordinatePairLabel, readAddressText } from './booking-address-readers';
import { readOptionalNumber, readOptionalString } from './booking-readers';

export type BookingGateRejectionInfo = ReturnType<typeof bookingGateRejectionInfo>;

export function bookingGateReasonCode(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata);
  return readOptionalString(metadata?.reasonCode) ?? readOptionalString(metadata?.code) ?? 'UNKNOWN';
}

export function bookingGateRejectionInfo(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata) ?? {};
  const reasonCode = bookingGateReasonCode(log);
  const bookingAddress =
    readPlainRecord(metadata.bookingAddress) ??
    readPlainRecord(metadata.address) ??
    readPlainRecord(metadata.addressSnapshot);
  const currentLocation =
    readPlainRecord(metadata.customerCurrentLocation) ??
    readPlainRecord(metadata.currentLocation) ??
    readPlainRecord(metadata.customerLocation);
  const customerProfileId =
    readOptionalString(metadata.customerProfileId) ??
    readOptionalString(metadata.customerId) ??
    readCustomerIdFromAuditTarget(log.target);

  const customerDistance = readFirstNumber([
    metadata.customerDistanceMeters,
    metadata.customerCurrentToBookingAddressMeters,
    metadata.currentLocationDistanceMeters,
  ]);
  const customerDistanceLimit = readFirstNumber([
    metadata.customerDistanceLimitMeters,
    metadata.customerCurrentDistanceLimitMeters,
    metadata.customerCurrentToBookingAddressLimitMeters,
  ]);
  const preferredPartnerDistance = readFirstNumber([
    metadata.preferredProviderDistanceMeters,
    metadata.preferredPartnerDistanceMeters,
    metadata.partnerDistanceMeters,
  ]);
  const preferredPartnerDistanceLimit = readFirstNumber([
    metadata.preferredProviderDistanceLimitMeters,
    metadata.preferredPartnerDistanceLimitMeters,
    metadata.partnerDistanceLimitMeters,
  ]);

  const bookingAddressLabel =
    coordinatePairLabel(
      bookingAddress?.latitude ?? bookingAddress?.lat ?? metadata.bookingLatitude,
      bookingAddress?.longitude ?? bookingAddress?.lng ?? metadata.bookingLongitude,
    ) ?? 'booking pin not recorded';
  const currentLocationLabel =
    coordinatePairLabel(
      currentLocation?.latitude ?? currentLocation?.lat ?? metadata.currentLatitude,
      currentLocation?.longitude ?? currentLocation?.lng ?? metadata.currentLongitude,
    ) ?? 'optional GPS not recorded';
  const recordedAt =
    readOptionalString(metadata.currentLocationRecordedAt) ??
    readOptionalString(currentLocation?.updatedAt) ??
    readOptionalString(currentLocation?.recordedAt);

  return {
    reasonLabel: bookingGateReasonLabel(reasonCode),
    tone: reasonCode === 'UNKNOWN' ? ('info' as const) : ('warn' as const),
    operatorAction: bookingGateOperatorAction(reasonCode),
    addressText:
      readAddressText(bookingAddress) ??
      readOptionalString(metadata.addressText) ??
      readOptionalString(metadata.bookingAddressText) ??
      'Address not recorded',
    customerDistanceLabel: formatGateDistance('Optional customer GPS', customerDistance, customerDistanceLimit),
    preferredPartnerDistanceLabel: formatGateDistance(
      'First-pick partner',
      preferredPartnerDistance,
      preferredPartnerDistanceLimit,
    ),
    currentLocationLabel: recordedAt
      ? `${currentLocationLabel} / ${relativeTimeLabel(recordedAt, 0)}`
      : currentLocationLabel,
    bookingAddressLabel,
    customerHref: customerProfileId ? `/customers/${customerProfileId}` : null,
  };
}

function bookingGateReasonLabel(reasonCode: string) {
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') {
    return 'Optional customer GPS distance evidence';
  }
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') {
    return 'First-pick partner too far';
  }
  if (reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') {
    return 'Address outside service area';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE') {
    return 'Optional customer GPS stale';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING') {
    return 'Optional customer GPS missing';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING') {
    return 'Optional customer GPS timestamp missing';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID') {
    return 'Optional customer GPS timestamp invalid';
  }
  return reasonCode.replaceAll('_', ' ').toLowerCase();
}

function bookingGateOperatorAction(reasonCode: string) {
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') {
    return 'Treat this as historical support evidence. Current booking creation should rely on the confirmed service address snapshot, not customer GPS distance.';
  }
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') {
    return 'Ask the customer to choose a closer first-pick partner or correct the service address. Payment and matching did not start.';
  }
  if (reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') {
    return 'Confirm the requested address is inside an enabled Vietnam service area before booking can start.';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE') {
    return 'Treat this as historical optional GPS evidence. Current booking creation should continue from a confirmed Vietnam service address.';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING') {
    return 'Treat this as historical optional GPS evidence. Current booking creation should not require customer GPS when the service address is confirmed.';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING') {
    return 'Treat this as historical optional GPS evidence. Confirm the booking address snapshot before support follow-up.';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID') {
    return 'Treat this as historical optional GPS evidence. Confirm the booking address snapshot before support follow-up.';
  }
  return 'Review the audit metadata and customer address before support follow-up.';
}

function formatGateDistance(label: string, distance: number | null, limit: number | null) {
  if (distance === null && limit === null) {
    return `${label}: not recorded`;
  }
  if (limit === null) {
    return `${label}: ${formatDistanceMeters(distance)}`;
  }
  return `${label}: ${formatDistanceMeters(distance)} / limit ${formatDistanceMeters(limit)}`;
}

function readFirstNumber(values: unknown[]) {
  for (const value of values) {
    const parsed = readOptionalNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function readCustomerIdFromAuditTarget(target: string) {
  return target.startsWith('customer:') ? target.slice('customer:'.length) : null;
}

function relativeTimeLabel(value: string, nowMs: number) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'unknown time';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const minutesAgo = Math.max(0, Math.round((reference - timestamp) / 60_000));
  if (minutesAgo < 1) {
    return 'just now';
  }
  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  const hoursAgo = Math.round(minutesAgo / 60);
  if (hoursAgo < 24) {
    return `${hoursAgo}h ago`;
  }
  return `${Math.round(hoursAgo / 24)}d ago`;
}
