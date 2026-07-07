import type { DetailActivityTypeOption } from '../../../lib/detail-activity-filter';
import { bookingRecordCreatedAt } from '../../../lib/admin-booking-time';
import { dateValue } from './partner-detail-format';

export const DETAIL_ACTIVITY_ORDER_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;

export type DetailActivityOrder = (typeof DETAIL_ACTIVITY_ORDER_OPTIONS)[number]['value'];

export const PARTNER_ACTIVITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All event types', types: [] },
  { value: 'booking_chat', label: 'Bookings and chat archive', types: ['BOOKING', 'CHAT'] },
  {
    value: 'app_device',
    label: 'Account, app sessions, and devices',
    types: ['ACCOUNT', 'SESSION', 'DEVICE'],
  },
  { value: 'location', label: 'Location records', types: ['LOCATION'] },
  { value: 'finance', label: 'Earnings and payouts', types: ['EARNING', 'PAYOUT'] },
  {
    value: 'verification',
    label: 'Verification, documents, and operation logs',
    types: ['VERIFY', 'DOCUMENT', 'BANK', 'TAX', 'AGREEMENT', 'REPORT', 'SANCTION', 'PROFILE', 'OPS'],
  },
] satisfies DetailActivityTypeOption[];

export function readDetailActivityOrder(
  params: Record<string, string | string[] | undefined>,
): DetailActivityOrder {
  const value = Array.isArray(params.order) ? params.order[0] : params.order;
  return value === 'oldest' ? 'oldest' : 'newest';
}

export function activityOrderLabel(order: DetailActivityOrder) {
  return DETAIL_ACTIVITY_ORDER_OPTIONS.find((option) => option.value === order)?.label ?? 'Newest first';
}

export function orderPartnerActivityRecords<T extends { at?: string | null }>(
  records: T[],
  order: DetailActivityOrder,
) {
  return [...records].sort((left, right) =>
    order === 'oldest' ? dateValue(left.at) - dateValue(right.at) : dateValue(right.at) - dateValue(left.at),
  );
}

export function orderPartnerBookingArchive<
  T extends { booking: { createdAt?: string | null; scheduledStartAt?: string | null } },
>(records: T[], order: DetailActivityOrder) {
  return [...records].sort((left, right) => {
    const leftAt = bookingRecordCreatedAt(left.booking);
    const rightAt = bookingRecordCreatedAt(right.booking);
    return order === 'oldest'
      ? dateValue(leftAt) - dateValue(rightAt)
      : dateValue(rightAt) - dateValue(leftAt);
  });
}
