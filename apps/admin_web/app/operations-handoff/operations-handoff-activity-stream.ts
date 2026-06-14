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
};

type UnifiedActivityStreamInput = {
  readonly bookings: readonly AdminBooking[];
  readonly chatArchive: readonly AdminBookingDetail[];
  readonly auditLogs: readonly AdminAuditLog[];
  readonly notifications: readonly AdminNotification[];
  readonly financeRows: readonly FinanceActivityRow[];
};

export function buildUnifiedActivityStream(input: UnifiedActivityStreamInput) {
  const bookingRows = input.bookings.slice(0, 25).map((booking) => ({
    id: `booking-${booking.id}`,
    area: 'Booking',
    source: booking.status,
    record: shortDisplayId(booking.id),
    summary: bookingActivitySummary(booking),
    href: `/bookings/${booking.id}`,
    className: bookingStatusClass(booking.status),
    createdAt: booking.updatedAt ?? booking.createdAt ?? new Date(0).toISOString(),
  }));

  const chatRows = input.chatArchive.flatMap((booking) =>
    (
      (
        booking.chatRoom as {
          messages?: Array<{
            id: string;
            body: string;
            createdAt: string;
            sender?: { fullName?: string | null; phone?: string | null; roles?: string[] };
          }>;
        } | null
      )?.messages ?? []
    )
      .slice(-5)
      .map((message) => ({
        id: `chat-${message.id}`,
        area: 'Chat',
        source: message.sender?.roles?.includes('PROVIDER') ? 'Partner message' : 'Customer/admin message',
        record: `Room ${shortDisplayId(booking.chatRoom?.id)}`,
        summary: operatorDisplayText(
          `${message.sender?.fullName ?? message.sender?.phone ?? 'User'}: ${trimText(message.body, 110)}`,
        ),
        href: `/bookings/${booking.id}`,
        className: 'pill pill-info',
        createdAt: message.createdAt,
      })),
  );

  const auditRows = input.auditLogs.slice(0, 30).map((log) => ({
    id: `audit-${log.id}`,
    area: auditActivityArea(log),
    source: operatorDisplayText(log.actor?.fullName ?? log.actor?.phone ?? 'System'),
    record: shortTarget(log.target),
    summary: auditActivitySummary(log),
    href: relatedHref(log),
    className: auditActivityClassName(log),
    createdAt: log.createdAt,
  }));

  const notificationRows = input.notifications
    .filter((notification) =>
      (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
    )
    .slice(0, 20)
    .map((notification) => ({
      id: `notification-${notification.id}`,
      area: 'Notification',
      source: notification.type,
      record: shortDisplayId(notification.id),
      summary: operatorDisplayText(`${notification.title}: ${trimText(notification.body, 100)}`),
      href: '/notifications?review=failed',
      className: 'pill pill-warn',
      createdAt: notification.createdAt,
    }));

  const financeRows = input.financeRows.slice(0, 20).map((row) => ({
    id: `finance-${row.id}`,
    area: 'Finance',
    source: row.status,
    record: shortDisplayId(row.bookingId),
    summary: `${row.partnerName} / wallet effect ${formatMoney(row.netAmount, row.currency)} / fee ${formatMoney(
      row.platformFee,
      row.currency,
    )}`,
    href: row.netAmount < 0 ? '/cash-settlements' : `/bookings/${row.bookingId}`,
    className: row.statusClass,
    createdAt: row.createdAt ?? new Date(0).toISOString(),
  }));

  return [...bookingRows, ...chatRows, ...auditRows, ...notificationRows, ...financeRows]
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
