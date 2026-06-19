'use client';

import { useMemo } from 'react';
import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  isPostMatchCancellationReviewBooking,
  postMatchCancellationResolution,
} from '../booking-post-match-cancellations-model';
import {
  BookingMonitorListSection,
  type BookingMonitorListRow,
  type BookingTableGroupKey,
} from '../booking-monitor-list-section';
import { buildBookingMonitorListRow } from '../booking-monitor-list-row-model';

export type BookingDetailLifecycleListRow = {
  readonly groupKey: BookingTableGroupKey;
  readonly row: BookingMonitorListRow;
};

type BookingDetailLifecycleListSectionProps = {
  readonly booking: AdminBookingDetail;
};

export function BookingDetailLifecycleListSection({
  booking,
}: BookingDetailLifecycleListSectionProps) {
  const lifecycleRows = useMemo(
    () => bookingDetailLifecycleListRows(booking, Date.now()),
    [booking],
  );

  if (lifecycleRows.length === 0) {
    return null;
  }

  return (
    <section className="booking-detail-lifecycle-list" id="booking-detail-lifecycle-list">
      <div className="ops-section-header admin-mt-16">
        <div>
          <h2>Booking lifecycle lists</h2>
          <p className="muted">
            The same booking-list rows are shown here as the reservation moves through each operations stage.
          </p>
        </div>
        <span className="pill pill-info">{lifecycleRows.length} list stage(s)</span>
      </div>

      {lifecycleRows.map(({ groupKey, row }) => (
        <BookingMonitorListSection
          emptyMessage="No booking row for this lifecycle stage."
          key={groupKey}
          rows={[row]}
          visibleGroupKeys={[groupKey]}
        />
      ))}
    </section>
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
