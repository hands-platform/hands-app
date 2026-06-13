import type { AdminBooking } from '../../lib/admin-api';
import { bookingMatchesMonitorBasicFilters } from './booking-monitor-basic-filters';
import { bookingViewOptions } from './booking-monitor-options';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';
import { bookingMatchesSearch } from './booking-search';

type BookingMonitorVisibleMatchers = {
  readonly matchesEvidenceFilter: (
    booking: AdminBooking,
    evidenceFilter: BookingEvidenceFilter,
  ) => boolean;
  readonly matchesView: (booking: AdminBooking, view: BookingPageView) => boolean;
};

type BuildBookingMonitorVisibleModelInput = {
  readonly blockedCreateCount: number;
  readonly bookings: readonly AdminBooking[];
  readonly evidenceFilter: BookingEvidenceFilter;
  readonly matchers: BookingMonitorVisibleMatchers;
  readonly paymentFilter: string;
  readonly searchQuery: string;
  readonly statusFilter: string;
  readonly view: BookingPageView;
};

export function buildBookingMonitorVisibleModel({
  blockedCreateCount,
  bookings,
  evidenceFilter,
  matchers,
  paymentFilter,
  searchQuery,
  statusFilter,
  view,
}: BuildBookingMonitorVisibleModelInput) {
  const baseVisibleBookings =
    view === 'blocked-create'
      ? []
      : bookings.filter((booking) => matchers.matchesView(booking, view));

  return {
    baseVisibleBookingCount: baseVisibleBookings.length,
    bookingViewCounts: buildBookingMonitorViewCounts(
      bookings,
      blockedCreateCount,
      matchers.matchesView,
    ),
    visibleBookings: baseVisibleBookings.filter(
      (booking) =>
        bookingMatchesSearch(booking, searchQuery) &&
        bookingMatchesMonitorBasicFilters({
          paymentFilter,
          paymentMethod: booking.payment?.method,
          status: booking.status,
          statusFilter,
        }) &&
        matchers.matchesEvidenceFilter(booking, evidenceFilter),
    ),
  };
}

function buildBookingMonitorViewCounts(
  bookings: readonly AdminBooking[],
  blockedCreateCount: number,
  matchesView: BookingMonitorVisibleMatchers['matchesView'],
) {
  return new Map(
    bookingViewOptions.map((option) => [
      option.view,
      option.view === 'blocked-create'
        ? blockedCreateCount
        : bookings.filter((booking) => matchesView(booking, option.view)).length,
    ]),
  );
}
