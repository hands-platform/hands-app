import type { DetailActivityTypeOption } from '../../../lib/detail-activity-filter';

export const DETAIL_ACTIVITY_ORDER_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;

export type DetailActivityOrder = (typeof DETAIL_ACTIVITY_ORDER_OPTIONS)[number]['value'];

export const CUSTOMER_ACTIVITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All event types', types: [] },
  { value: 'booking_work', label: 'Bookings and completed work', types: ['BOOKING', 'WORK'] },
  { value: 'chat', label: 'Chat archive', types: ['CHAT'] },
  { value: 'payment', label: 'Payments and refunds', types: ['PAYMENT', 'REFUND'] },
  {
    value: 'address_app',
    label: 'Account, addresses, sessions, devices',
    types: ['ACCOUNT', 'ADDRESS', 'SESSION', 'DEVICE'],
  },
  {
    value: 'support',
    label: 'Notifications, reviews, staff records',
    types: ['NOTICE', 'REVIEW', 'OPS', 'AUDIT'],
  },
] satisfies DetailActivityTypeOption[];

export function readDetailActivityOrder(
  params: Record<string, string | string[] | undefined>,
): DetailActivityOrder {
  const raw = typeof params.activityOrder === 'string' ? params.activityOrder : '';
  const match = DETAIL_ACTIVITY_ORDER_OPTIONS.find((option) => option.value === raw);
  return match?.value ?? 'newest';
}

export function activityOrderLabel(order: DetailActivityOrder) {
  return DETAIL_ACTIVITY_ORDER_OPTIONS.find((option) => option.value === order)?.label ?? 'Newest first';
}

export function orderCustomerActivityRecords<T extends { at?: string | null }>(
  records: T[],
  order: DetailActivityOrder,
) {
  return [...records].sort((left, right) =>
    order === 'oldest' ? dateMs(left.at) - dateMs(right.at) : dateMs(right.at) - dateMs(left.at),
  );
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
