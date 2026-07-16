import type { BookingGateFilter } from './booking-gate-filters';
import type { BookingDateRangeFilter } from './booking-date-range-filter';

export type BookingPageView =
  | 'active'
  | 'attention'
  | 'matching'
  | 'first-pick'
  | 'marketplace'
  | 'customer-choice'
  | 'handoff-repair'
  | 'no-supply'
  | 'blocked-create'
  | 'address'
  | 'manual-decision'
  | 'payment'
  | 'cash-debt'
  | 'closeout'
  | 'pricing'
  | 'location'
  | 'chat'
  | 'chat-repair'
  | 'chat-evidence'
  | 'evidence-missing'
  | 'refund-review'
  | 'post-match-cancellations'
  | 'expired'
  | 'no-show'
  | 'all';

export type BookingEvidenceFilter =
  | 'all'
  | 'address'
  | 'partner'
  | 'chat'
  | 'money'
  | 'location'
  | 'alerts'
  | 'closeout';

const BOOKING_VIEWS = new Set<BookingPageView | 'backup'>([
  'attention',
  'matching',
  'first-pick',
  'backup',
  'marketplace',
  'customer-choice',
  'handoff-repair',
  'no-supply',
  'blocked-create',
  'address',
  'manual-decision',
  'payment',
  'cash-debt',
  'closeout',
  'pricing',
  'location',
  'chat',
  'chat-repair',
  'chat-evidence',
  'evidence-missing',
  'refund-review',
  'post-match-cancellations',
  'expired',
  'no-show',
  'all',
]);

const BOOKING_EVIDENCE_FILTERS = new Set<BookingEvidenceFilter>([
  'address',
  'partner',
  'chat',
  'money',
  'location',
  'alerts',
  'closeout',
]);

const BOOKING_GATE_FILTERS = new Set<BookingGateFilter>([
  'service-area',
  'customer-gps',
  'customer-distance',
  'first-pick-distance',
  'unknown',
]);

const BOOKING_DATE_RANGE_FILTERS = new Set<BookingDateRangeFilter>([
  'today',
  'yesterday',
  '7d',
  '30d',
  'custom',
]);

export function readBookingView(
  value: string | string[] | undefined,
  statusValue?: string | string[] | undefined,
): BookingPageView {
  const view = readSearchParam(value);
  const status = readSearchParam(statusValue);
  if (BOOKING_VIEWS.has(view as BookingPageView | 'backup')) {
    return view === 'backup' ? 'marketplace' : (view as BookingPageView);
  }
  if (status === 'EXPIRED') {
    return 'expired';
  }
  if (status === 'NO_SHOW') {
    return 'no-show';
  }
  return 'active';
}

export function readBookingEvidenceFilter(value: string | string[] | undefined): BookingEvidenceFilter {
  const evidence = readSearchParam(value);
  return BOOKING_EVIDENCE_FILTERS.has(evidence as BookingEvidenceFilter)
    ? (evidence as BookingEvidenceFilter)
    : 'all';
}

export function readBookingGateFilter(value: string | string[] | undefined): BookingGateFilter {
  const gate = readSearchParam(value);
  return BOOKING_GATE_FILTERS.has(gate as BookingGateFilter) ? (gate as BookingGateFilter) : 'all';
}

export function readBookingDateRangeFilter(value: string | string[] | undefined): BookingDateRangeFilter {
  const range = readSearchParam(value);
  return BOOKING_DATE_RANGE_FILTERS.has(range as BookingDateRangeFilter)
    ? (range as BookingDateRangeFilter)
    : 'today';
}

export function readBookingDateInput(value: string | string[] | undefined) {
  const date = readSearchParam(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? (date as string) : '';
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
