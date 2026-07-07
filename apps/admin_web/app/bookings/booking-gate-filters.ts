import type { AdminAuditLog } from '../../lib/admin-api';
import {
  type BookingCreateGateFilter,
  bookingCreateGateAuditQuery,
  bookingCreateGateReasonFilter,
} from '../../lib/booking-create-gate-reasons';
import { bookingGateReasonCode } from './booking-gate-rejections';

export type BookingGateFilter = BookingCreateGateFilter;

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
    operatorHint:
      'Address is outside the enabled Vietnam service area. Confirm the pin before support follow-up.',
  },
  {
    value: 'customer-gps',
    label: 'Optional GPS evidence',
    operatorHint:
      'Optional customer GPS evidence rows are retained as support context. Booking authority is the confirmed service address.',
  },
  {
    value: 'customer-distance',
    label: 'Customer distance gate',
    operatorHint:
      'Fresh customer current location was 50km or more from the selected service address, so booking creation stopped before payment and matching.',
  },
  {
    value: 'first-pick-distance',
    label: 'First-pick distance',
    operatorHint: 'Selected Partner is outside the first-pick distance gate for this service address.',
  },
  {
    value: 'unknown',
    label: 'Unknown gate',
    operatorHint: 'Audit metadata did not include a recognized reason code. Open the audit row before support follow-up.',
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
  return bookingCreateGateReasonFilter(reasonCode) === filter;
}

export function bookingGateAuditQuery(filter: BookingGateFilter) {
  return bookingCreateGateAuditQuery(filter);
}
