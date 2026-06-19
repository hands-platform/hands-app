'use client';

import { useMemo } from 'react';
import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import {
  isPostMatchCancellationReviewBooking,
  postMatchCancellationResolution,
} from '../booking-post-match-cancellations-model';
import { type BookingMonitorListRow, type BookingTableGroupKey } from '../booking-monitor-list-section';
import { buildBookingMonitorListRow } from '../booking-monitor-list-row-model';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import { bookingAddressSnapshotLabel, coordinateLabel, formatDate } from './booking-formatters';

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

export function BookingDetailLifecycleListSection({ booking }: BookingDetailLifecycleListSectionProps) {
  const timelineItems = useMemo(() => bookingDetailLifecycleTimelineItems(booking, Date.now()), [booking]);

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
  const requestedPartnerLabel =
    row.preferredPartnerLabel === 'none' ? 'Not selected' : row.preferredPartnerLabel;
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
      meta: [...commonMeta, { label: 'Requested', value: requestedPartnerLabel }],
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
        { label: 'Partner gate', value: 'Blocked until completion' },
        { label: 'Next action', value: row.nextActionLabel },
      ],
      statusLabel: 'Post-match',
      timeLabel: formatDate(booking.matchedAt ?? booking.statusChangedAt ?? booking.updatedAt),
      title: 'Partner matched and service is moving',
      tone: 'info',
    };
  }

  if (groupKey === 'completed') {
    const completionLocation = partnerLifecycleLocationCheckpoint(
      booking,
      booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt,
      'completion',
    );

    return {
      detail: lifecycleDetailWithLocation(
        row.closureState?.detail ?? 'Completed booking is ready for finance and review closeout.',
        completionLocation,
      ),
      groupKey,
      meta: [
        { label: 'Matched Partner', value: partnerLabel },
        { label: 'Completion location', value: completionLocation.value },
        { label: 'Location capture', value: completionLocation.capture },
        {
          label: 'Payment',
          value: booking.payment ? `${row.servicePriceLabel} / ${booking.payment.status}` : 'No payment',
        },
        { label: 'Payout', value: booking.earning ? `${booking.earning.status}` : 'Earning pending' },
        { label: 'Partner gate', value: 'Eligible after completion' },
      ],
      statusLabel: 'Completed',
      timeLabel: formatDate(booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt),
      title: 'Service completed',
      tone: 'success',
    };
  }

  if (groupKey === 'post-match-cancellations-resolved') {
    const cancellationLocation = partnerLifecycleLocationCheckpoint(
      booking,
      booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt,
      'cancellation',
    );

    return {
      detail: lifecycleDetailWithLocation(
        row.closureState?.detail ?? 'Post-match cancellation has been reviewed by operations.',
        cancellationLocation,
      ),
      groupKey,
      meta: [
        { label: 'Matched Partner', value: partnerLabel },
        { label: 'Cancellation location', value: cancellationLocation.value },
        { label: 'Location capture', value: cancellationLocation.capture },
        { label: 'Closed reason', value: booking.closedReason ?? 'No reason recorded' },
        { label: 'Fee state', value: row.cashDebtAmountLabel ?? row.closureState?.label ?? 'Resolved' },
        { label: 'Partner gate', value: 'Eligible after cancellation' },
      ],
      statusLabel: 'Resolved',
      timeLabel: formatDate(booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt),
      title: 'Post-match cancellation resolved',
      tone: 'success',
    };
  }

  const cancellationLocation = partnerLifecycleLocationCheckpoint(
    booking,
    booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt,
    'cancellation',
  );

  return {
    detail: lifecycleDetailWithLocation(
      row.closureState?.detail ?? 'Admin must review chat evidence and close the cancellation decision.',
      cancellationLocation,
    ),
    groupKey,
    meta: [
      { label: 'Matched Partner', value: partnerLabel },
      { label: 'Cancellation location', value: cancellationLocation.value },
      { label: 'Location capture', value: cancellationLocation.capture },
      { label: 'Closed reason', value: booking.closedReason ?? 'No reason recorded' },
      { label: 'Partner gate', value: 'Eligible during review' },
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

function lifecycleDetailWithLocation(
  detail: string,
  location: ReturnType<typeof partnerLifecycleLocationCheckpoint>,
) {
  return `${detail} ${location.detail}`;
}

function partnerLifecycleLocationCheckpoint(
  booking: AdminBookingDetail,
  eventAt: string | null | undefined,
  checkpoint: 'completion' | 'cancellation',
) {
  const snapshot = selectedProviderLocationSnapshotForEvent(booking, eventAt);
  if (!snapshot) {
    return {
      capture: 'Request only at action time',
      detail:
        checkpoint === 'completion'
          ? 'Completion location should be captured once when the Partner taps complete.'
          : 'Cancellation location should be captured once when the Partner cancels after match.',
      value: 'No checkpoint location',
    };
  }

  const address = readAddressText(snapshot);
  const locationLabel = address
    ? serviceAddressAreaLabel(address)
    : `Pin ${coordinateLabel(snapshot.lat, snapshot.lng)}`;

  return {
    capture: `Recorded ${formatDate(snapshot.recordedAt)}`,
    detail:
      checkpoint === 'completion'
        ? 'Completion location is captured only when the Partner taps complete.'
        : 'Cancellation location is captured only when the Partner cancels after match.',
    value: locationLabel,
  };
}

function selectedProviderLocationSnapshotForEvent(
  booking: AdminBookingDetail,
  eventAt: string | null | undefined,
) {
  const selectedProviderId = booking.selectedProviderId ?? booking.selectedProvider?.id ?? null;
  const snapshots: AdminLocationSnapshot[] = [];

  snapshots.push(...(booking.snapshots ?? []));
  snapshots.push(...(booking.selectedProvider?.locationSnapshots ?? []));
  for (const participant of booking.participants ?? []) {
    const participantProviderId = participant.providerProfileId ?? participant.providerProfile?.id ?? null;
    if (!selectedProviderId || participantProviderId === selectedProviderId) {
      snapshots.push(...(participant.providerProfile?.locationSnapshots ?? []));
    }
  }

  const filtered = snapshots
    .filter(
      (snapshot) =>
        !selectedProviderId ||
        !snapshot.providerProfileId ||
        snapshot.providerProfileId === selectedProviderId,
    )
    .sort((left, right) => locationTimeValue(left.recordedAt) - locationTimeValue(right.recordedAt));
  if (filtered.length === 0) {
    return null;
  }

  const eventTime = locationTimeValue(eventAt);
  if (!Number.isFinite(eventTime)) {
    return filtered.at(-1) ?? null;
  }

  const beforeOrAt = filtered.filter((snapshot) => locationTimeValue(snapshot.recordedAt) <= eventTime);
  const bookingLinkedBeforeOrAt = beforeOrAt.filter((snapshot) => snapshot.bookingId === booking.id);
  const bookingLinkedAfter = filtered.find(
    (snapshot) => snapshot.bookingId === booking.id && locationTimeValue(snapshot.recordedAt) > eventTime,
  );
  return (
    bookingLinkedBeforeOrAt.at(-1) ??
    bookingLinkedAfter ??
    beforeOrAt.at(-1) ??
    filtered.find((snapshot) => locationTimeValue(snapshot.recordedAt) > eventTime) ??
    null
  );
}

function locationTimeValue(value?: string | null) {
  if (!value) {
    return Number.NaN;
  }
  return new Date(value).getTime();
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
