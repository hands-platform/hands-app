import { Fragment, createElement, type ReactNode } from 'react';
import type { AdminBookingDetail, AdminLocationSnapshot, AdminNotification } from '../../../lib/admin-api';
import { MoneyText } from '../../../components/money-text';
import { bookingRecordCreatedAt, bookingRequestOpenedAt } from '../../../lib/admin-booking-time';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { buildCsvDataHref } from '../../../lib/csv-export';
import { bookingMatchAuditDetail, bookingMatchAuditSummary } from '../../../lib/booking-match-audit';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import {
  addressLabel,
  bookingServiceOptionLabel,
  compactActivityText,
  distanceLabel,
  formatDate,
  money,
  providerName,
  safeTime,
  shortId,
} from './booking-formatters';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';

export type BookingActivityRecord = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail: string;
  detailNode?: ReactNode;
  href?: string;
};

export type BookingActivitySummaryItem = {
  label: string;
  value: string;
  helper: string;
  valueDateTimeValue?: string | null;
  detailDateTimePrefix?: string;
  detailDateTimeValue?: string | null;
};

type BookingClosureSummary = {
  status: string;
  detail: string;
};

type BuildBookingActivityRecordsInput = {
  booking: AdminBookingDetail;
  notifications: AdminNotification[];
  locationSnapshots: AdminLocationSnapshot[];
  closureSummary: BookingClosureSummary;
  humanizeAuditAction: (action: string) => string;
  auditMetadataSummary: (metadata: unknown) => string;
  notificationDataBookingId: (notification: AdminNotification) => string | null;
  humanizeNotificationType: (type: string) => string;
};

export function buildBookingActivityRecords({
  booking,
  notifications,
  locationSnapshots,
  closureSummary,
  humanizeAuditAction,
  auditMetadataSummary,
  notificationDataBookingId,
  humanizeNotificationType,
}: BuildBookingActivityRecordsInput) {
  const records: BookingActivityRecord[] = [];

  records.push({
    id: `${booking.id}-created`,
    type: 'BOOKING',
    at: bookingRecordCreatedAt(booking) ?? '',
    title: `Booking created as ${booking.status}`,
    detail: `${bookingServiceOptionLabel(booking)} / customer ${
      booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer'
    } / ${addressLabel(booking.address)}`,
    href: '#customer',
  });

  if (booking.openedAt) {
    records.push({
      id: `${booking.id}-opened`,
      type: 'MATCHING',
      at: booking.openedAt,
      title: 'Matching opened',
      detail: `Preferred Partner ${providerName(booking.preferredProvider)} / expires ${formatDate(booking.expiresAt)}`,
      href: '#alerts',
    });
  }

  const requestOpenedAt = bookingRequestOpenedAt(booking);
  if (requestOpenedAt) {
    records.push({
      id: `${booking.id}-request-timestamp`,
      type: 'BOOKING',
      at: requestOpenedAt,
      title: 'Request timestamp',
      detail: `Request opened ${formatDate(requestOpenedAt)}`,
      href: '#service',
    });
  }

  if (booking.closedAt) {
    records.push({
      id: `${booking.id}-closed`,
      type: 'CLOSURE',
      at: booking.closedAt,
      title: `Booking closure: ${closureSummary.status}`,
      detail: closureSummary.detail,
      href: '#booking-activity',
    });
  }

  for (const participant of booking.participants ?? []) {
    records.push({
      id: `${participant.id}-joined`,
      type: 'PARTNER',
      at: participant.joinedAt ?? booking.createdAt ?? '',
      title: `${providerName(participant.providerProfile)} entered marketplace shortlist`,
      detail: `${participant.status} / ${distanceLabel(participant.distanceMeters)} / ${
        participant.providerStatusAtJoin ?? 'status unknown'
      }`,
      href: participant.providerProfile?.id ? `/partners/${participant.providerProfile.id}` : '#participants',
    });
    if (participant.respondedAt) {
      records.push({
        id: `${participant.id}-responded`,
        type: 'PARTNER',
        at: participant.respondedAt,
        title: `${providerName(participant.providerProfile)} responded`,
        detail: `${participant.status} / customer can select from participating or accepted Partners.`,
        href: participant.providerProfile?.id
          ? `/partners/${participant.providerProfile.id}`
          : '#participants',
      });
    }
  }

  const finalPartner = bookingFinalPartnerSummary(booking);
  if (finalPartner.selected) {
    records.push({
      id: `${booking.id}-selected-partner-${finalPartner.id ?? 'relation'}`,
      type: 'MATCHED',
      at: booking.updatedAt ?? booking.openedAt ?? booking.createdAt ?? '',
      title: 'Final Partner selected',
      detail: `${finalPartner.label} / chat ${booking.chatRoom ? 'created' : 'not created yet'}`,
      href: finalPartner.href,
    });
  }

  if (booking.chatRoom) {
    records.push({
      id: `${booking.chatRoom.id}-room`,
      type: 'CHAT',
      at: booking.chatRoom.messages?.[0]?.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: `Chat room ${shortId(booking.chatRoom.id)} available`,
      detail: `${booking.chatRoom.messages?.length ?? 0} message(s) archived for admin.`,
      href: '#chat',
    });
  }

  for (const message of booking.chatRoom?.messages ?? []) {
    records.push({
      id: message.id,
      type: 'CHAT',
      at: message.createdAt,
      title: `Message from ${message.sender?.fullName ?? message.sender?.phone ?? message.sender?.roles?.join(', ') ?? 'Unknown sender'}`,
      detail: compactActivityText(message.body, 110),
      href: '#chat',
    });
  }

  if (booking.payment) {
    records.push({
      id: booking.payment.id ?? `${booking.id}-payment`,
      type: 'PAYMENT',
      at: booking.updatedAt ?? booking.createdAt ?? '',
      title: `${booking.payment.status} ${booking.payment.method} payment`,
      detail: `${money(booking.payment.amount, booking.payment.currency)} / ref ${
        booking.payment.providerRef ?? 'no gateway ref'
      }`,
      detailNode: createElement(
        Fragment,
        null,
        createElement(MoneyText, {
          amount: booking.payment.amount,
          currency: booking.payment.currency,
        }),
        ' / ref ',
        booking.payment.providerRef ?? 'no gateway ref',
      ),
      href: booking.payment.id ? `/payments#payment-${booking.payment.id}` : '#payment',
    });
  }

  const refunds = [...(booking.payment?.refunds ?? []), ...(booking.refunds ?? [])];
  for (const refund of refunds) {
    const reason = 'reason' in refund ? refund.reason : undefined;
    records.push({
      id: refund.id,
      type: 'REFUND',
      at: refund.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: `${refund.status} refund`,
      detail: `${money(Number(refund.amount ?? 0), booking.payment?.currency ?? 'VND')}${reason ? ` / ${reason}` : ''}`,
      href: `/refunds#refund-${refund.id}`,
    });
  }

  if (booking.earning) {
    records.push({
      id: booking.earning.id,
      type: 'EARNING',
      at: booking.earning.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: `${booking.earning.status} Partner earning`,
      detail: `Gross ${money(booking.earning.grossAmount, booking.earning.currency)} / fee ${money(
        booking.earning.platformFee,
        booking.earning.currency,
      )} / net ${money(booking.earning.netAmount, booking.earning.currency)}`,
      href: '/earnings',
    });
  }

  for (const log of [...(booking.platformFeeLogs ?? []), ...(booking.earning?.platformFeeLogs ?? [])]) {
    records.push({
      id: log.id,
      type: 'FEE',
      at: log.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: 'Platform fee calculated',
      detail: `${money(log.platformFeeAmount, log.currency)} from ${money(log.grossAmount, log.currency)}`,
      href: '/earnings',
    });
  }

  for (const log of [...(booking.taxLogs ?? []), ...(booking.earning?.taxLogs ?? [])]) {
    records.push({
      id: log.id,
      type: 'TAX',
      at: log.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: 'Withholding tax calculated',
      detail: `${money(log.withholdingAmount, log.currency)} from taxable ${money(log.taxableAmount, log.currency)}`,
      href: '/tax-policy',
    });
  }

  for (const entry of [
    ...(booking.walletLedgerEntries ?? []),
    ...(booking.earning?.walletLedgerEntries ?? []),
  ]) {
    records.push({
      id: entry.id,
      type: 'WALLET',
      at: entry.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: `${entry.type} wallet impact`,
      detail: `${money(entry.amount, entry.currency)} / ${entry.notes ?? entry.reference ?? entry.sourceKey}`,
      href: '/earnings',
    });
  }

  for (const snapshot of locationSnapshots) {
    const isBookingActionSnapshot = snapshot.bookingId === booking.id;
    const snapshotAddress = readAddressText(snapshot);
    const locationDetail = snapshotAddress
      ? serviceAddressAreaLabel(snapshotAddress)
      : 'Location recorded without readable address';

    records.push({
      id: snapshot.id,
      type: 'LOCATION',
      at: snapshot.recordedAt,
      title: isBookingActionSnapshot ? 'Partner booking action location' : 'Partner location snapshot',
      detail: isBookingActionSnapshot ? `Booking action snapshot / ${locationDetail}` : locationDetail,
      href: '#location',
    });
  }

  for (const notification of notifications.filter((item) => notificationDataBookingId(item) === booking.id)) {
    records.push({
      id: notification.id,
      type: 'ALERT',
      at: notification.createdAt,
      title: humanizeNotificationType(notification.type),
      detail: `${marketplaceDisplayText(notification.title)} / ${
        notification.deliveries?.[0]?.status ?? 'No delivery'
      } / ${notification.readAt ? `read ${formatDate(notification.readAt)}` : 'unread'}`,
      href: `/notifications?booking=${booking.id}`,
    });
  }

  for (const task of booking.opsTasks ?? []) {
    records.push({
      id: task.id,
      type: 'OPS',
      at: task.updatedAt,
      title: `${task.status} ${task.type}`,
      detail: `${task.note ?? 'No note'} / actor ${task.actor?.fullName ?? task.actor?.phone ?? 'System'}`,
      href: '#structured-ops-status',
    });
  }

  if (booking.review) {
    records.push({
      id: booking.review.id,
      type: 'REVIEW',
      at: booking.review.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
      title: 'Customer service feedback submitted',
      detail: booking.review.comment
        ? `${compactActivityText(booking.review.comment, 90)} / numeric input ${booking.review.rating}/5`
        : `No comment / numeric input ${booking.review.rating}/5`,
      href: '/reviews',
    });
  }

  for (const log of booking.auditLogs ?? []) {
    const matchSummary = bookingMatchAuditSummary(log);
    const matchDetail = bookingMatchAuditDetail(log);
    const auditDetail = matchDetail
      ? `${log.actor?.fullName ?? log.actor?.phone ?? 'System'} / ${matchSummary} / ${matchDetail}`
      : `${log.actor?.fullName ?? log.actor?.phone ?? 'System'} / ${auditMetadataSummary(log.metadata) || log.target}`;

    records.push({
      id: log.id,
      type: 'AUDIT',
      at: log.createdAt,
      title: matchSummary || humanizeAuditAction(log.action),
      detail: auditDetail,
      href: `/audit-log?q=${encodeURIComponent(booking.id)}`,
    });
  }

  const unique = new Map<string, BookingActivityRecord>();
  for (const record of records.filter((item) => Boolean(item.at))) {
    unique.set(`${record.type}:${record.id}:${record.at}`, record);
  }

  return [...unique.values()].sort((left, right) => safeTime(right.at) - safeTime(left.at));
}

export function buildBookingActivityCsvHref(booking: AdminBookingDetail, records: BookingActivityRecord[]) {
  const finalPartner = bookingFinalPartnerSummary(booking);

  return buildCsvDataHref(
    records.map((record) => ({
      booking_id: booking.id,
      booking_status: booking.status,
      customer_phone: booking.customerProfile?.user?.phone ?? '',
      preferred_partner: providerName(booking.preferredProvider),
      final_partner: finalPartner.selected ? finalPartner.label : 'Not selected',
      type: record.type,
      date: record.at,
      title: record.title,
      detail: record.detail,
      href: record.href ?? '',
      record_id: record.id,
    })),
    [
      'booking_id',
      'booking_status',
      'customer_phone',
      'preferred_partner',
      'final_partner',
      'type',
      'date',
      'title',
      'detail',
      'href',
      'record_id',
    ],
  );
}

export function buildBookingActivitySummary(records: BookingActivityRecord[]): BookingActivitySummaryItem[] {
  const financeTypes = new Set(['PAYMENT', 'REFUND', 'EARNING', 'FEE', 'TAX', 'WALLET']);
  const count = (predicate: (record: BookingActivityRecord) => boolean) =>
    records.filter(predicate).length;
  const latestAt = records[0]?.at;
  const oldestAt = records[records.length - 1]?.at;

  return [
    {
      label: 'Range',
      value: latestAt ? formatDate(latestAt) : 'None',
      helper: oldestAt ? `Oldest loaded: ${formatDate(oldestAt)}` : 'No activity loaded.',
      valueDateTimeValue: latestAt,
      detailDateTimePrefix: oldestAt ? 'Oldest loaded: ' : undefined,
      detailDateTimeValue: oldestAt,
    },
    {
      label: 'Matching',
      value: count((record) =>
        ['BOOKING', 'MATCHING', 'MATCHED', 'SCHEDULE', 'PARTNER'].includes(record.type),
      ).toString(),
      helper: 'Booking creation, wait window, Partner participation, and final selection.',
    },
    {
      label: 'Chat',
      value: count((record) => record.type === 'CHAT').toString(),
      helper: 'Loaded Customer and Partner messages kept for admin archive.',
    },
    {
      label: 'Finance',
      value: count((record) => financeTypes.has(record.type)).toString(),
      helper: 'Payment, refund, earning, tax, fee, and wallet impact rows.',
    },
    {
      label: 'Ops and alerts',
      value: count((record) => ['OPS', 'AUDIT', 'ALERT'].includes(record.type)).toString(),
      helper: 'Operator notes, audit events, and notification delivery events.',
    },
    {
      label: 'Location',
      value: count((record) => record.type === 'LOCATION').toString(),
      helper: 'Booking action and Partner location snapshots linked to this booking.',
    },
  ];
}
