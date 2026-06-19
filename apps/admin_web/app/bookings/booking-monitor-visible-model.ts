import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMatchesDateRangeFilter,
  type BookingDateRangeFilter,
} from './booking-date-range-filter';
import { bookingMatchesMonitorBasicFilters } from './booking-monitor-basic-filters';
import { bookingMonitorMatchesEvidenceFilter } from './booking-monitor-evidence-model';
import { bookingViewOptions } from './booking-monitor-options';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';
import { bookingMonitorMatchesView } from './booking-monitor-view-model';
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
  readonly customDateFrom?: string;
  readonly customDateTo?: string;
  readonly dateRangeFilter?: BookingDateRangeFilter;
  readonly evidenceFilter: BookingEvidenceFilter;
  readonly matchers: BookingMonitorVisibleMatchers;
  readonly nowMs?: number;
  readonly paymentFilter: string;
  readonly searchQuery: string;
  readonly statusFilter: string;
  readonly view: BookingPageView;
};

export function buildBookingMonitorVisibleModel({
  blockedCreateCount,
  bookings,
  customDateFrom,
  customDateTo,
  dateRangeFilter = 'all',
  evidenceFilter,
  matchers,
  nowMs = Date.now(),
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
        bookingMatchesDateRangeFilter(booking, {
          customDateFrom,
          customDateTo,
          dateRangeFilter,
          nowMs,
        }) &&
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

export function buildAdminBookingMonitorVisibleModel({
  blockedCreateCount,
  bookings,
  customDateFrom,
  customDateTo,
  dateRangeFilter,
  evidenceFilter,
  nowMs,
  paymentFilter,
  searchQuery,
  statusFilter,
  view,
}: Omit<BuildBookingMonitorVisibleModelInput, 'matchers'> & { readonly nowMs: number }) {
  return buildBookingMonitorVisibleModel({
    blockedCreateCount,
    bookings,
    customDateFrom,
    customDateTo,
    dateRangeFilter,
    evidenceFilter,
    matchers: {
      matchesEvidenceFilter: (booking, filter) =>
        bookingMonitorMatchesEvidenceFilter(booking, filter, nowMs),
      matchesView: (booking, bookingView) => bookingMonitorMatchesView(booking, bookingView, nowMs),
    },
    nowMs,
    paymentFilter,
    searchQuery,
    statusFilter,
    view,
  });
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
