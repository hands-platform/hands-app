import type { AdminAuditLog } from '../../lib/admin-api';
import { bookingGateReasonCode } from './booking-gate-rejections';

export type BookingGateFilter =
  | 'all'
  | 'service-area'
  | 'customer-gps'
  | 'customer-distance'
  | 'first-pick-distance'
  | 'unknown';

export type BookingGateFilterOption = {
  value: BookingGateFilter;
  label: string;
  operatorHint: string;
};

export type BookingGateTriageItem = {
  filter: BookingGateFilter;
  label: string;
  operatorHint: string;
  count: number;
  latestAge: string;
  status: string;
  tone: 'ok' | 'warn';
  auditHref: string;
};

export const bookingGateFilterOptions: BookingGateFilterOption[] = [
  {
    value: 'all',
    label: 'All create gates',
    operatorHint: 'Review every booking create attempt stopped before payment and matching.',
  },
  {
    value: 'service-area',
    label: 'Service area',
    operatorHint: 'Address is outside the enabled Vietnam service area. Confirm the pin before support follow-up.',
  },
  {
    value: 'customer-gps',
    label: 'Optional GPS evidence',
    operatorHint:
      'Optional customer GPS evidence rows are retained as support context. Booking authority is the address snapshot.',
  },
  {
    value: 'customer-distance',
    label: 'Optional GPS distance',
    operatorHint: 'Optional customer GPS distance rows are retained only as support evidence, not booking authority.',
  },
  {
    value: 'first-pick-distance',
    label: 'First-pick distance',
    operatorHint: 'Selected Partner is outside the first-pick distance gate for this service address.',
  },
  {
    value: 'unknown',
    label: 'Unknown gate',
    operatorHint: 'Audit metadata did not include a recognized reason code. Inspect the raw audit entry.',
  },
];

export function buildBookingGateTriage(
  logs: AdminAuditLog[],
  activeFilter: BookingGateFilter,
  logAgeLabel: (log: AdminAuditLog) => string,
): BookingGateTriageItem[] {
  return bookingGateFilterOptions
    .filter((option) => option.value !== 'all')
    .map((option) => {
      const matchingLogs = logs.filter((log) => bookingGateMatchesFilter(log, option.value));
      const latest = matchingLogs[0];
      const latestAge = latest ? logAgeLabel(latest) : 'none';
      const active = activeFilter === option.value;

      return {
        filter: option.value,
        label: option.label,
        operatorHint: option.operatorHint,
        count: matchingLogs.length,
        latestAge,
        status: active ? 'Selected' : matchingLogs.length > 0 ? `${matchingLogs.length} open` : 'Clear',
        tone: matchingLogs.length > 0 ? 'warn' : 'ok',
        auditHref: `/audit-log?query=${encodeURIComponent(bookingGateAuditQuery(option.value))}`,
      };
    });
}

export function bookingGateCount(logs: AdminAuditLog[], filter: BookingGateFilter) {
  return logs.filter((log) => bookingGateMatchesFilter(log, filter)).length;
}

export function bookingGateMatchesFilter(log: AdminAuditLog, filter: BookingGateFilter) {
  if (filter === 'all') {
    return true;
  }

  const reasonCode = bookingGateReasonCode(log);
  if (filter === 'service-area') {
    return reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA';
  }
  if (filter === 'customer-distance') {
    return reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR';
  }
  if (filter === 'first-pick-distance') {
    return reasonCode === 'PREFERRED_PARTNER_TOO_FAR';
  }
  if (filter === 'customer-gps') {
    return (
      reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING' ||
      reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING' ||
      reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID' ||
      reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE'
    );
  }
  return reasonCode === 'UNKNOWN';
}

export function bookingGateAuditQuery(filter: BookingGateFilter) {
  if (filter === 'service-area') {
    return 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA';
  }
  if (filter === 'customer-distance') {
    return 'CUSTOMER_CURRENT_LOCATION_TOO_FAR';
  }
  if (filter === 'first-pick-distance') {
    return 'PREFERRED_PARTNER_TOO_FAR';
  }
  if (filter === 'customer-gps') {
    return 'CUSTOMER_CURRENT_LOCATION';
  }
  if (filter === 'unknown') {
    return 'booking.create.rejected UNKNOWN';
  }
  return 'booking.create.rejected';
}
