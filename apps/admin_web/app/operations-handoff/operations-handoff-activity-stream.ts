import type { AdminAuditLog, AdminBooking, AdminBookingDetail, AdminNotification } from '../../lib/admin-api';
import { formatMoney, shortDisplayId } from '../../lib/admin-format';
import { partnerDisplayText as operatorDisplayText } from '../../lib/admin-copy';
import { isInDateRange } from '../../lib/date-range';
import { bookingPartnerName, bookingStatusClass } from './operations-handoff-booking-queue';

type FinanceActivityRow = {
  readonly id: string;
  readonly bookingId: string;
  readonly partnerName: string;
  readonly netAmount: number;
  readonly platformFee: number;
  readonly currency: string;
  readonly status: string;
  readonly statusClass: string;
  readonly createdAt?: string | null;
  readonly reviewReason?: string | null;
};

type UnifiedActivityStreamInput = {
  readonly bookings: readonly AdminBooking[];
  readonly chatArchive: readonly AdminBookingDetail[];
  readonly auditLogs: readonly AdminAuditLog[];
  readonly notifications: readonly AdminNotification[];
  readonly financeRows: readonly FinanceActivityRow[];
};

type ActivityStreamSourceRow = {
  readonly id: string;
  readonly area: string;
  readonly source: string;
  readonly record: string;
  readonly reviewReason: string;
  readonly summary: string;
  readonly href: string;
  readonly className: string;
  readonly createdAt?: string | null;
};

export function buildUnifiedActivityStream(input: UnifiedActivityStreamInput) {
  return [
    ...buildBookingActivityRows(input.bookings),
    ...buildChatActivityRows(input.chatArchive),
    ...buildAuditActivityRows(input.auditLogs),
    ...buildNotificationActivityRows(input.notifications),
    ...buildFinanceActivityRows(input.financeRows),
  ]
    .filter((item) => dateValue(item.createdAt) > 0)
    .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
    .slice(0, 40);
}

export type ActivityStreamRow = ReturnType<typeof buildUnifiedActivityStream>[number];

export function filterActivityStreamByRange(
  rows: ReturnType<typeof buildUnifiedActivityStream>,
  range: Parameters<typeof isInDateRange>[1],
) {
  return rows.filter((row) => isInDateRange(row.createdAt, range));
}

function buildBookingActivityRows(bookings: readonly AdminBooking[]): ActivityStreamSourceRow[] {
  return bookings.slice(0, 25).map((booking) => ({
    id: `booking-${booking.id}`,
    area: 'Booking',
    source: booking.status,
    record: shortDisplayId(booking.id),
    reviewReason: 'Booking movement needs payment, Partner, and customer follow-up context.',
    summary: bookingActivitySummary(booking),
    href: `/bookings/${booking.id}`,
    className: bookingStatusClass(booking.status),
    createdAt: booking.updatedAt ?? booking.createdAt ?? new Date(0).toISOString(),
  }));
}

type ChatArchiveMessage = {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly sender?: {
    readonly fullName?: string | null;
    readonly phone?: string | null;
    readonly roles?: readonly string[];
  };
};

function buildChatActivityRows(chatArchive: readonly AdminBookingDetail[]): ActivityStreamSourceRow[] {
  return chatArchive.flatMap((booking) =>
    chatArchiveMessages(booking)
      .slice(-5)
      .map((message) => ({
        id: `chat-${message.id}`,
        area: 'Chat',
        source: message.sender?.roles?.includes('PROVIDER')
          ? 'Partner message'
          : 'Customer/admin message',
        record: `Room ${shortDisplayId(booking.chatRoom?.id)}`,
        reviewReason: 'Retained chat evidence may explain customer, Partner, or dispute context.',
        summary: operatorDisplayText(
          `${message.sender?.fullName ?? message.sender?.phone ?? 'User'}: ${trimText(
            message.body,
            110,
          )}`,
        ),
        href: `/bookings/${booking.id}`,
        className: 'pill pill-info',
        createdAt: message.createdAt,
      })),
  );
}

function chatArchiveMessages(booking: AdminBookingDetail): readonly ChatArchiveMessage[] {
  return (
    (booking.chatRoom as { messages?: readonly ChatArchiveMessage[] } | null)?.messages ?? []
  );
}

function buildAuditActivityRows(auditLogs: readonly AdminAuditLog[]): ActivityStreamSourceRow[] {
  return auditLogs.slice(0, 30).map((log) => ({
    id: `audit-${log.id}`,
    area: auditActivityArea(log),
    source: operatorDisplayText(log.actor?.fullName ?? log.actor?.phone ?? 'System'),
    record: shortTarget(log.target),
    reviewReason: auditActivityReviewReason(log),
    summary: auditActivitySummary(log),
    href: relatedHref(log),
    className: auditActivityClassName(log),
    createdAt: log.createdAt,
  }));
}

function buildNotificationActivityRows(
  notifications: readonly AdminNotification[],
): ActivityStreamSourceRow[] {
  return notifications
    .filter((notification) =>
      (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
    )
    .slice(0, 20)
    .map((notification) => ({
      id: `notification-${notification.id}`,
      area: 'Notification',
      source: notification.type,
      record: shortDisplayId(notification.id),
      reviewReason: 'Failed delivery can hide booking, payment, or status updates from users.',
      summary: operatorDisplayText(`${notification.title}: ${trimText(notification.body, 100)}`),
      href: '/notifications?review=failed',
      className: 'pill pill-warn',
      createdAt: notification.createdAt,
    }));
}

function buildFinanceActivityRows(
  financeRows: readonly FinanceActivityRow[],
): ActivityStreamSourceRow[] {
  return financeRows.slice(0, 20).map((row) => ({
    id: `finance-${row.id}`,
    area: 'Finance',
    source: row.status,
    record: shortDisplayId(row.bookingId),
    reviewReason: financeActivityReviewReason(row),
    summary: `${row.partnerName} / wallet effect ${formatMoney(row.netAmount, row.currency)} / fee ${formatMoney(
      row.platformFee,
      row.currency,
    )}`,
    href: row.netAmount < 0 ? '/cash-settlements' : `/bookings/${row.bookingId}`,
    className: row.statusClass,
    createdAt: row.createdAt ?? new Date(0).toISOString(),
  }));
}

function bookingActivitySummary(booking: AdminBooking) {
  const customer =
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
  const payment = booking.payment
    ? `${booking.payment.method} ${booking.payment.status} ${formatMoney(booking.payment.amount, booking.payment.currency ?? 'VND')}`
    : 'No payment row';
  return operatorDisplayText(`${customer} / ${bookingPartnerName(booking)} / ${payment}`);
}

function auditActivitySummary(log: AdminAuditLog) {
  const metadata = asRecord(log.metadata);
  const note =
    stringValue(metadata.note) ??
    stringValue(metadata.preset) ??
    stringValue(metadata.reason) ??
    stringValue(metadata.status);
  return operatorDisplayText(note ? trimText(note, 140) : humanizeAction(log.action));
}

function shortTarget(target?: string | null) {
  if (!target) return '-';
  const [kind, id] = target.split(':');
  return id ? `${kind}:${shortDisplayId(id)}` : shortDisplayId(target);
}

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function auditActivityArea(log: AdminAuditLog) {
  if (isNotificationAuditLog(log)) {
    return 'Notification audit';
  }
  return 'Ops note';
}

function auditActivityClassName(log: AdminAuditLog) {
  if (isNotificationAuditLog(log)) {
    return 'pill pill-info';
  }
  return log.action.endsWith('.ops_note.add') ? 'pill pill-info' : 'pill';
}

function auditActivityReviewReason(log: AdminAuditLog) {
  if (isNotificationAuditLog(log)) {
    return 'Notification audit evidence needs delivery and recipient follow-up context.';
  }
  return 'Operator note or audit event for the next handoff review.';
}

function financeActivityReviewReason(row: FinanceActivityRow) {
  if (row.netAmount < 0) {
    return 'Negative wallet effect needs cash settlement or Partner receivable review.';
  }
  if (row.status === 'AVAILABLE') {
    return 'Available earning needs payout release or finance closeout review.';
  }
  return (
    stringValue(row.reviewReason) ??
    'Finance row needs payment, wallet, tax, and payout evidence review.'
  );
}

export function relatedHref(log: AdminAuditLog) {
  const metadata = asRecord(log.metadata);
  const bookingId = stringValue(metadata.bookingId);
  const customerId = stringValue(metadata.customerProfileId);
  const notificationId = stringValue(metadata.notificationId) ?? notificationTargetId(log.target);
  const providerId =
    stringValue(metadata.providerProfileId) ??
    stringValue(metadata.partnerProfileId) ??
    stringValue(metadata.providerId);
  if (bookingId) return `/bookings/${bookingId}`;
  if (customerId) return `/customers/${customerId}`;
  if (notificationId) {
    return `/audit-log?bucket=Notification&q=${encodeURIComponent(notificationId)}&range=all`;
  }
  if (providerId) return `/partners/${providerId}`;
  if (log.target.startsWith('booking:')) return `/bookings/${log.target.slice('booking:'.length)}`;
  if (log.target.startsWith('customer:')) return `/customers/${log.target.slice('customer:'.length)}`;
  if (log.target.startsWith('provider:')) return `/partners/${log.target.slice('provider:'.length)}`;
  if (isNotificationAuditLog(log)) return '/audit-log?bucket=Notification&range=all';
  if (log.target === 'operations:handoff') return '/operations-handoff';
  return '/audit-log';
}

function isNotificationAuditLog(log: AdminAuditLog) {
  return log.action.startsWith('notification.') || log.target.startsWith('notification:');
}

function notificationTargetId(target: string) {
  return target.startsWith('notification:') ? target.slice('notification:'.length) : null;
}

export function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function humanizeAction(action: string) {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
