export const BOOKING_CREATE_GATE_REASONS = {
  addressOutsideServiceArea: 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
  customerCurrentLocationMissing: 'CUSTOMER_CURRENT_LOCATION_MISSING',
  customerCurrentLocationStale: 'CUSTOMER_CURRENT_LOCATION_STALE',
  customerCurrentLocationTimestampMissing: 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING',
  customerCurrentLocationTimestampInvalid: 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID',
  customerCurrentLocationTooFar: 'CUSTOMER_CURRENT_LOCATION_TOO_FAR',
  preferredPartnerTooFar: 'PREFERRED_PARTNER_TOO_FAR',
} as const;

export type BookingCreateGateFilter =
  | 'all'
  | 'service-area'
  | 'customer-gps'
  | 'customer-distance'
  | 'first-pick-distance'
  | 'unknown';

type BookingCreateGateReasonLabelVariant = 'monitor' | 'operations' | 'audit';

const customerGpsReasonCodes = new Set<string>([
  BOOKING_CREATE_GATE_REASONS.customerCurrentLocationMissing,
  BOOKING_CREATE_GATE_REASONS.customerCurrentLocationStale,
  BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampMissing,
  BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampInvalid,
]);

const reasonLabels: Record<BookingCreateGateReasonLabelVariant, Record<string, string>> = {
  monitor: {
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar]: 'Optional customer GPS distance evidence',
    [BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar]: 'First-pick Partner too far',
    [BOOKING_CREATE_GATE_REASONS.addressOutsideServiceArea]: 'Address outside service area',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationStale]: 'Optional customer GPS stale',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationMissing]: 'Optional customer GPS missing',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampMissing]:
      'Optional customer GPS timestamp missing',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampInvalid]:
      'Optional customer GPS timestamp invalid',
  },
  operations: {
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar]: 'Optional customer GPS distance evidence',
    [BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar]: 'First-pick partner too far',
    [BOOKING_CREATE_GATE_REASONS.addressOutsideServiceArea]: 'Outside service area',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationStale]: 'Optional stale customer GPS',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationMissing]: 'Optional missing customer GPS',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampMissing]: 'Optional missing GPS timestamp',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampInvalid]: 'Optional invalid GPS timestamp',
  },
  audit: {
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar]: 'optional customer GPS distance evidence',
    [BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar]: 'first-pick Partner too far',
    [BOOKING_CREATE_GATE_REASONS.addressOutsideServiceArea]: 'address outside service area',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationStale]: 'optional customer GPS stale',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationMissing]: 'optional customer GPS missing',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampMissing]: 'optional GPS timestamp missing',
    [BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTimestampInvalid]: 'optional GPS timestamp invalid',
  },
};

export function bookingCreateGateReasonLabel(
  reasonCode: string,
  variant: BookingCreateGateReasonLabelVariant = 'monitor',
  fallbackLabel?: (normalizedReason: string) => string,
) {
  const normalizedReason = normalizeBookingCreateGateReason(reasonCode);
  return reasonLabels[variant][normalizedReason] ?? (fallbackLabel?.(normalizedReason) ?? fallbackReasonLabel(normalizedReason));
}

export function bookingCreateGateReasonFilter(reasonCode: string): BookingCreateGateFilter {
  const normalizedReason = normalizeBookingCreateGateReason(reasonCode);
  if (normalizedReason === BOOKING_CREATE_GATE_REASONS.addressOutsideServiceArea) {
    return 'service-area';
  }
  if (normalizedReason === BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar) {
    return 'customer-distance';
  }
  if (normalizedReason === BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar) {
    return 'first-pick-distance';
  }
  if (isBookingCreateGateCustomerGpsReason(normalizedReason)) {
    return 'customer-gps';
  }
  return 'unknown';
}

export function bookingCreateGateAuditQuery(filter: BookingCreateGateFilter) {
  if (filter === 'service-area') {
    return BOOKING_CREATE_GATE_REASONS.addressOutsideServiceArea;
  }
  if (filter === 'customer-distance') {
    return BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar;
  }
  if (filter === 'first-pick-distance') {
    return BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar;
  }
  if (filter === 'customer-gps') {
    return 'CUSTOMER_CURRENT_LOCATION';
  }
  if (filter === 'unknown') {
    return 'booking.create.rejected UNKNOWN';
  }
  return 'booking.create.rejected';
}

export function bookingCreateGateReasonPill(reasonCode: string) {
  const normalizedReason = normalizeBookingCreateGateReason(reasonCode);
  if (normalizedReason === BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar) {
    return 'pill-warn';
  }
  if (normalizedReason === BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar) {
    return 'pill-danger';
  }
  return 'pill-info';
}

export function bookingCreateGateCustomerGpsRejectCount(counts: ReadonlyMap<string, number>) {
  return [...customerGpsReasonCodes].reduce((total, reasonCode) => total + (counts.get(reasonCode) ?? 0), 0);
}

export function isBookingCreateGateCustomerGpsReason(reasonCode: string) {
  return customerGpsReasonCodes.has(normalizeBookingCreateGateReason(reasonCode));
}

function normalizeBookingCreateGateReason(reasonCode: string) {
  return reasonCode.trim() || 'UNKNOWN';
}

function fallbackReasonLabel(reasonCode: string) {
  return reasonCode.replaceAll('_', ' ').toLowerCase();
}
