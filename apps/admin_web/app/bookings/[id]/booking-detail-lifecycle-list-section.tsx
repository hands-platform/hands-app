'use client';

import { useMemo } from 'react';
import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  isPostMatchCancellationReviewBooking,
  postMatchCancellationResolution,
} from '../booking-post-match-cancellations-model';
import { type BookingMonitorListRow, type BookingTableGroupKey } from '../booking-monitor-list-section';
import { buildBookingMonitorListRow } from '../booking-monitor-list-row-model';
import { bookingAddressSnapshotLabel, formatDate } from './booking-formatters';

export type BookingDetailLifecycleListRow = {
  readonly groupKey: BookingTableGroupKey;
  readonly row: BookingMonitorListRow;
};

export type BookingDetailLifecycleTimelineItem = {
  readonly detail: string;
  readonly groupKey: BookingTableGroupKey;
  readonly meta: readonly { readonly label: string; readonly value: string }[];
  readonly statusLabel: string;
  readonly timeLabel: string;
  readonly title: string;
  readonly tone: 'danger' | 'info' | 'primary' | 'success' | 'warning';
};

type BookingDetailLifecycleListSectionProps = {
  readonly booking: AdminBookingDetail;
};

export function BookingDetailLifecycleListSection({
  booking,
}: BookingDetailLifecycleListSectionProps) {
  const timelineItems = useMemo(
    () => bookingDetailLifecycleTimelineItems(booking, Date.now()),
    [booking],
  );

  if (timelineItems.length === 0) {
    return null;
  }

  return (
    <section className="card booking-detail-lifecycle-list admin-mb-16" id="booking-detail-lifecycle-list">
      <div className="ops-section-header admin-mt-16">
        <div>
          <h2>Booking lifecycle timeline</h2>
          <p className="muted">
            Compact stage history for this reservation without repeating full booking-list tables.
          </p>
        </div>
        <span className="pill pill-info">{timelineItems.length} stage(s)</span>
      </div>

      <div className="vuexy-basic-timeline admin-mt-16">
        {timelineItems.map((item, index) => (
          <article className="vuexy-basic-timeline-item" key={item.groupKey}>
            <div className="vuexy-basic-timeline-separator" aria-hidden="true">
              <span className={`vuexy-basic-timeline-dot is-${item.tone}`} />
              {index < timelineItems.length - 1 && <span className="vuexy-basic-timeline-connector" />}
            </div>
            <div className="vuexy-basic-timeline-content">
              <div className="vuexy-basic-timeline-title-row">
                <div>
                  <span className={`pill ${timelinePillTone(item.tone)}`}>{item.statusLabel}</span>
                  <h3>{item.title}</h3>
                </div>
                <time>{item.timeLabel}</time>
              </div>
              <p className="muted">{item.detail}</p>
              <div className="vuexy-basic-timeline-meta">
                {item.meta.map((meta) => (
                  <div className="vuexy-basic-timeline-meta-item" key={meta.label}>
                    <span>{meta.label}</span>
                    <strong>{meta.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function bookingDetailLifecycleTimelineItems(
  booking: AdminBookingDetail,
  currentTimeMs: number,
): readonly BookingDetailLifecycleTimelineItem[] {
  return bookingDetailLifecycleListRows(booking, currentTimeMs).map(({ groupKey, row }) =>
    bookingDetailLifecycleTimelineItem(groupKey, row),
  );
}

export function bookingDetailLifecycleListRows(
  booking: AdminBookingDetail,
  currentTimeMs: number,
): readonly BookingDetailLifecycleListRow[] {
  return bookingDetailLifecycleSnapshots(booking).map(({ groupKey, snapshot }) => ({
    groupKey,
    row: buildBookingMonitorListRow(snapshot, currentTimeMs, currentTimeMs),
  }));
}

function bookingDetailLifecycleSnapshots(
  booking: AdminBookingDetail,
): readonly { readonly groupKey: BookingTableGroupKey; readonly snapshot: AdminBookingDetail }[] {
  const snapshots: { groupKey: BookingTableGroupKey; snapshot: AdminBookingDetail }[] = [
    {
      groupKey: 'pre-match',
      snapshot: bookingRealtimeSnapshot(booking),
    },
  ];

  if (bookingHasPostMatchSignal(booking)) {
    snapshots.push({
      groupKey: 'post-match-in-progress',
      snapshot: bookingPostMatchSnapshot(booking),
    });
  }

  if (booking.status === 'COMPLETED') {
    snapshots.push({
      groupKey: 'completed',
      snapshot: booking,
    });
  }

  if (isPostMatchCancellationReviewBooking(booking)) {
    snapshots.push({
      groupKey:
        postMatchCancellationResolution(booking) === 'pending'
          ? 'post-match-cancellations-pending'
          : 'post-match-cancellations-resolved',
      snapshot: booking,
    });
  }

  return snapshots;
}

function bookingRealtimeSnapshot(booking: AdminBookingDetail): AdminBookingDetail {
  const requestTime = booking.openedAt ?? booking.createdAt ?? booking.statusChangedAt ?? booking.updatedAt;

  return {
    ...booking,
    closedAt: null,
    closedNote: null,
    closedReason: null,
    matchedAt: null,
    selectedProvider: undefined,
    selectedProviderId: null,
    status: 'OPEN_MATCHING',
    statusChangedAt: requestTime,
    updatedAt: requestTime ?? booking.updatedAt,
  };
}

function bookingPostMatchSnapshot(booking: AdminBookingDetail): AdminBookingDetail {
  const matchTime = booking.matchedAt ?? booking.statusChangedAt ?? booking.updatedAt ?? booking.createdAt;
  const status = bookingInProgressStatus(booking.status) ? booking.status : 'IN_SERVICE';

  return {
    ...booking,
    closedAt: null,
    closedNote: null,
    closedReason: null,
    status,
    statusChangedAt: matchTime,
    updatedAt: matchTime ?? booking.updatedAt,
  };
}

function bookingHasPostMatchSignal(booking: AdminBookingDetail) {
  return Boolean(
    booking.matchedAt ||
      booking.selectedProviderId ||
      booking.selectedProvider ||
      booking.status === 'MATCHED' ||
      booking.status === 'PROVIDER_ON_THE_WAY' ||
      booking.status === 'ARRIVED' ||
      booking.status === 'IN_SERVICE' ||
      booking.status === 'COMPLETED' ||
      isPostMatchCancellationReviewBooking(booking),
  );
}

function bookingInProgressStatus(status: string) {
  return (
    status === 'MATCHED' ||
    status === 'PROVIDER_ON_THE_WAY' ||
    status === 'ARRIVED' ||
    status === 'IN_SERVICE'
  );
}

function bookingDetailLifecycleTimelineItem(
  groupKey: BookingTableGroupKey,
  row: BookingMonitorListRow,
): BookingDetailLifecycleTimelineItem {
  const booking = row.booking as AdminBookingDetail;
  const customer = booking.customerProfile?.user;
  const customerLabel = customer?.fullName || customer?.phone || 'Customer pending';
  const partnerLabel = row.finalPartnerLabel ?? row.preferredPartnerLabel ?? 'Partner pending';
  const addressLabel = bookingAddressSnapshotLabel(booking);
  const participantCount = booking.participants?.length ?? 0;
  const participantLabel = `${participantCount} Partner${participantCount === 1 ? '' : 's'}`;
  const requestedPartnerLabel = row.preferredPartnerLabel === 'none' ? 'Not selected' : row.preferredPartnerLabel;
  const serviceLabel = compactLifecycleServiceLabel(row);
  const commonMeta = [
    { label: 'Customer', value: customerLabel },
    { label: 'Service', value: serviceLabel },
    { label: 'Address', value: addressLabel },
  ];

  if (groupKey === 'pre-match') {
    return {
      detail: row.stage.action,
      groupKey,
      meta: [
        ...commonMeta,
        { label: 'Requested', value: requestedPartnerLabel },
      ],
      statusLabel: row.stage.label,
      timeLabel: row.openedDateLabel,
      title: 'Realtime booking request',
      tone: 'primary',
    };
  }

  if (groupKey === 'post-match-in-progress') {
    return {
      detail: row.stage.detail,
      groupKey,
      meta: [
        { label: 'Matched Partner', value: partnerLabel },
        { label: 'Participating', value: participantLabel },
        { label: 'Service', value: serviceLabel },
        { label: 'Next action', value: row.nextActionLabel },
      ],
      statusLabel: 'Post-match',
      timeLabel: formatDate(booking.matchedAt ?? booking.statusChangedAt ?? booking.updatedAt),
      title: 'Partner matched and service is moving',
      tone: 'info',
    };
  }

  if (groupKey === 'completed') {
    return {
      detail: row.closureState?.detail ?? 'Completed booking is ready for finance and review closeout.',
      groupKey,
      meta: [
        { label: 'Matched Partner', value: partnerLabel },
        { label: 'Payment', value: booking.payment ? `${row.servicePriceLabel} / ${booking.payment.status}` : 'No payment' },
        { label: 'Payout', value: booking.earning ? `${booking.earning.status}` : 'Earning pending' },
      ],
      statusLabel: 'Completed',
      timeLabel: formatDate(booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt),
      title: 'Service completed',
      tone: 'success',
    };
  }

  if (groupKey === 'post-match-cancellations-resolved') {
    return {
      detail: row.closureState?.detail ?? 'Post-match cancellation has been reviewed by operations.',
      groupKey,
      meta: [
        { label: 'Matched Partner', value: partnerLabel },
        { label: 'Closed reason', value: booking.closedReason ?? 'No reason recorded' },
        { label: 'Fee state', value: row.cashDebtAmountLabel ?? row.closureState?.label ?? 'Resolved' },
      ],
      statusLabel: 'Resolved',
      timeLabel: formatDate(booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt),
      title: 'Post-match cancellation resolved',
      tone: 'success',
    };
  }

  return {
    detail: row.closureState?.detail ?? 'Admin must review chat evidence and close the cancellation decision.',
    groupKey,
    meta: [
      { label: 'Matched Partner', value: partnerLabel },
      { label: 'Closed reason', value: booking.closedReason ?? 'No reason recorded' },
      { label: 'Review', value: row.nextActionLabel },
    ],
    statusLabel: 'Needs review',
    timeLabel: formatDate(booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt),
    title: 'Post-match cancellation needs admin review',
    tone: 'warning',
  };
}

function compactLifecycleServiceLabel(row: BookingMonitorListRow) {
  const amount = row.servicePriceLabel
    .replace(/^Customer\s+/i, '')
    .replace(/\s*\/\s*min\s+.*$/i, '')
    .trim();

  return amount ? `${row.serviceOptionLabel} / ${amount}` : row.serviceOptionLabel;
}

function timelinePillTone(tone: BookingDetailLifecycleTimelineItem['tone']) {
  if (tone === 'success') {
    return 'pill-success';
  }
  if (tone === 'warning') {
    return 'pill-warn';
  }
  if (tone === 'danger') {
    return 'pill-danger';
  }
  return 'pill-info';
}
