import type { AdminAuditLog } from '../../lib/admin-api';
import {
  bookingGateMatchesFilter,
  buildBookingGateTriage,
  type BookingGateFilter,
} from './booking-gate-filters';
import { buildBookingGateRejectionLane } from './booking-gate-rejection-lane';
import { relativeTimeLabel } from './booking-list-time';

export function buildBookingMonitorGateModel({
  activeFilter,
  logs,
  nowMs,
}: {
  readonly activeFilter: BookingGateFilter;
  readonly logs: readonly AdminAuditLog[];
  readonly nowMs: number;
}) {
  const orderedBookingCreateRejections = [...logs].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return {
    bookingGateRejectionLane: buildBookingGateRejectionLane(orderedBookingCreateRejections, nowMs),
    bookingGateTriage: buildBookingGateTriage(orderedBookingCreateRejections, activeFilter, (log) =>
      relativeTimeLabel(log.createdAt, nowMs),
    ),
    orderedBookingCreateRejections,
    visibleBookingCreateRejections: orderedBookingCreateRejections.filter((log) =>
      bookingGateMatchesFilter(log, activeFilter),
    ),
  };
}
