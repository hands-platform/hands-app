import type { AdminAuditLog } from '../../lib/admin-api';
import { formatDistanceMeters, readPlainRecord } from '../../lib/admin-format';
import {
  BOOKING_CREATE_GATE_REASONS,
  bookingCreateGateReasonLabel,
} from '../../lib/booking-create-gate-reasons';
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
  const bookingAddress = readFirstRecord([
    metadata.bookingAddress,
    metadata.address,
    metadata.addressSnapshot,
  ]);
  const currentLocation = readFirstRecord([
    metadata.customerCurrentLocation,
    metadata.currentLocation,
    metadata.customerLocation,
  ]);
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
    reasonLabel: bookingCreateGateReasonLabel(reasonCode),
    tone: reasonCode === 'UNKNOWN' ? ('info' as const) : ('warn' as const),
    operatorAction: bookingGateOperatorAction(reasonCode),
    addressText:
      readAddressText(bookingAddress) ??
      readOptionalString(metadata.addressText) ??
      readOptionalString(metadata.bookingAddressText) ??
      'Address not recorded',
    customerDistanceLabel: formatGateDistance(
      'Optional customer GPS',
      customerDistance,
      customerDistanceLimit,
    ),
    preferredPartnerDistanceLabel: formatGateDistance(
      'First-pick Partner',
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

function bookingGateOperatorAction(reasonCode: string) {
  if (reasonCode === BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar) {
    return 'Ask the customer to book from a current location within the configured service-address distance gate. Payment and matching did not start.';
  }
  if (reasonCode === BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar) {
    return 'Ask the customer to choose a closer first-pick Partner or correct the service address. Payment and matching did not start.';
  }
  if (reasonCode === BOOKING_CREATE_GATE_REASONS.addressOutsideServiceArea) {
    return 'Confirm the requested address is inside an enabled Vietnam service area before booking can start.';
  }
  if (reasonCode === BOOKING_CREATE_GATE_REASONS.customerCurrentLocationStale) {
    return 'Treat this as historical optional GPS evidence. Current booking creation should continue from a confirmed Vietnam service address.';
  }
  if (reasonCode === BOOKING_CREATE_GATE_REASONS.customerCurrentLocationMissing) {
    return 'Treat this as historical optional GPS evidence. Current booking creation should not require customer GPS when the service address is confirmed.';
  }
  if (reasonCode === BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampMissing) {
    return 'Treat this as historical optional GPS evidence. Use the confirmed booking address before support follow-up.';
  }
  if (reasonCode === BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampInvalid) {
    return 'Treat this as historical optional GPS evidence. Use the confirmed booking address before support follow-up.';
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

function readFirstNumber(values: readonly unknown[]) {
  for (const value of values) {
    const parsed = readOptionalNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function readFirstRecord(values: readonly unknown[]) {
  for (const value of values) {
    const record = readPlainRecord(value);
    if (record) {
      return record;
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
