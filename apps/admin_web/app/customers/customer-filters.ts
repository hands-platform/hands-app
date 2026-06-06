import { formatMoney } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';

export type CustomerFilters = {
  q: string;
  booking: string;
  bookingFlow: string;
  reachability: string;
  address: string;
  payment: string;
  chat: string;
  memo: string;
  sort: string;
  joinedFrom: string;
  joinedTo: string;
  seen: string;
  minBookings: number | null;
  minCompleted: number | null;
  minSpend: number | null;
};

export function buildCustomerFilters(
  params: Record<string, string | string[] | undefined>,
): CustomerFilters {
  return {
    q: readSearchParam(params.q),
    booking: readSearchParam(params.booking),
    bookingFlow: normalizeCustomerBookingFlowFilter(readSearchParam(params.bookingFlow)),
    reachability: readSearchParam(params.reachability),
    address: readSearchParam(params.address),
    payment: readSearchParam(params.payment),
    chat: readSearchParam(params.chat),
    memo: readSearchParam(params.memo),
    sort: readCustomerSort(params.sort),
    joinedFrom: readDateParam(params.joinedFrom),
    joinedTo: readDateParam(params.joinedTo),
    seen: readSearchParam(params.seen),
    minBookings: readPositiveNumber(params.minBookings),
    minCompleted: readPositiveNumber(params.minCompleted),
    minSpend: readPositiveNumber(params.minSpend),
  };
}

export function customerSortLabel(sort: string) {
  if (sort === 'last-work') return 'last completed work';
  if (sort === 'booking-count') return 'booking count';
  if (sort === 'completed-count') return 'completed work count';
  if (sort === 'captured-spend') return 'captured spend';
  if (sort === 'last-seen') return 'last app session';
  if (sort === 'joined') return 'first signup date';
  if (sort === 'name') return 'customer name';
  return 'latest booking progress date';
}

export function buildCustomerActiveFilters(filters: CustomerFilters) {
  const labels: string[] = [];
  if (filters.q) labels.push(`Search: ${filters.q}`);
  if (filters.booking) labels.push(`Booking: ${filters.booking}`);
  if (filters.bookingFlow) labels.push(`Booking flow: ${customerBookingFlowFilterLabel(filters.bookingFlow)}`);
  if (filters.reachability) labels.push(`Reachability: ${filters.reachability}`);
  if (filters.address) labels.push(`Address: ${filters.address}`);
  if (filters.payment) labels.push(`Payment: ${filters.payment}`);
  if (filters.chat) labels.push(`Chat: ${filters.chat}`);
  if (filters.memo) labels.push(`Memo: ${filters.memo}`);
  if (filters.joinedFrom) labels.push(`Joined from: ${filters.joinedFrom}`);
  if (filters.joinedTo) labels.push(`Joined to: ${filters.joinedTo}`);
  if (filters.seen) labels.push(`Recent access: ${filters.seen}`);
  if (filters.minBookings !== null) labels.push(`Min bookings: ${filters.minBookings}`);
  if (filters.minCompleted !== null) labels.push(`Min completed: ${filters.minCompleted}`);
  if (filters.minSpend !== null) labels.push(`Min paid amount: ${formatMoney(filters.minSpend)}`);
  if (filters.sort !== 'last-booking') labels.push(`Sort: ${customerSortLabel(filters.sort)}`);
  return labels;
}

function readCustomerSort(value: string | string[] | undefined) {
  const sort = readSearchParam(value);
  return [
    'last-booking',
    'last-work',
    'booking-count',
    'completed-count',
    'captured-spend',
    'last-seen',
    'joined',
    'name',
  ].includes(sort)
    ? sort
    : 'last-booking';
}

function readDateParam(value: string | string[] | undefined) {
  const date = readSearchParam(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function readPositiveNumber(value: string | string[] | undefined) {
  const raw = readSearchParam(value).replaceAll(',', '');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function normalizeCustomerBookingFlowFilter(value: string) {
  const allowed = [
    'open-matching',
    'first-pick',
    'customer-choice',
    'chat-live',
    'chat-missing',
    'service-live',
    'completed-work',
    'closed-record',
    'address-snapshot',
  ];
  return allowed.includes(value) ? value : '';
}

function customerBookingFlowFilterLabel(flow: string) {
  const labels: Record<string, string> = {
    'open-matching': 'Open matching wait',
    'first-pick': 'First-pick pending',
    'customer-choice': 'Customer final choice',
    'chat-live': 'Chat room opened',
    'chat-missing': 'Matched but chat missing',
    'service-live': 'Service in progress',
    'completed-work': 'Completed work',
    'closed-record': 'Closed or no-show record',
    'address-snapshot': 'Address snapshot saved',
  };
  return labels[flow] ?? flow;
}
