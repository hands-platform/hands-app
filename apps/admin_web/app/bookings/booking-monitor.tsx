'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuditLog, AdminBooking } from '../../lib/admin-api';
import { bookingRequestOpenedAt } from '../../lib/admin-booking-time';
import { buildBookingLiveMatchingPolicyCards } from '../../lib/booking-live-matching-policy-cards';
import { compareBookingMonitorListOrder } from '../../lib/booking-monitor-list-order';
import { readPlainRecord } from '../../lib/admin-format';
import { type AdminLiveOperationsPolicy } from '../../lib/operations-policy';
import {
  bookingDateRangeFilterOptions,
  type BookingDateRangeFilter,
} from './booking-date-range-filter';
import { bookingTimestamp, formatBookingClockTime as formatClockTime } from './booking-list-time';
import type { BookingGateFilter } from './booking-gate-filters';
import { bookingPaymentFilterOptions, bookingStatusFilterOptions } from './booking-monitor-filter-options';
import { bookingEvidenceFilterOptions, bookingViewOptions } from './booking-monitor-options';
import { bookingMonitorSummaryRows, compactBookingMonitorSummaryRows } from './booking-monitor-summary';
import { BookingMonitorBlockedCreateSection } from './booking-monitor-blocked-create-section';
import { buildBookingDispatchPartnerShortcuts } from './booking-dispatch-partner-shortcuts';
import { bookingMatchingWindowLabel } from './booking-matching-window';
import { buildBookingMonitorMatchingFlowTimeline } from './booking-monitor-matching-flow';
import { BookingMonitorFiltersSection } from './booking-monitor-filters-section';
import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';
import {
  BookingMonitorListSection,
  type BookingTableGroupKey,
} from './booking-monitor-list-section';
import { BookingMonitorMatchingEscalationSection } from './booking-monitor-matching-escalation-section';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';
import { buildBookingMonitorSummaryFact } from './booking-monitor-summary-model';
import {
  buildBookingMonitorMatchingEscalationBoard,
  buildBookingMonitorMatchingEscalationRows,
} from './booking-monitor-matching-escalation-model';
import { bookingCustomerLabel } from './booking-monitor-labels';
import { buildAdminBookingMonitorVisibleModel } from './booking-monitor-visible-model';
import { buildBookingMonitorListRow } from './booking-monitor-list-row-model';
import { buildBookingMonitorGateModel } from './booking-monitor-gate-model';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';
import { buildBookingPostMatchCancellationBoard } from './booking-post-match-cancellations-model';
import { BookingPostMatchCancellationsSection } from './booking-post-match-cancellations-section';

type Props = {
  bookings: AdminBooking[];
  bookingCreateRejections?: AdminAuditLog[];
  initialView: BookingView;
  initialEvidenceFilter?: BookingEvidenceFilter;
  initialGateFilter?: BookingGateFilter;
  liveOperationsPolicy: AdminLiveOperationsPolicy;
  pageDescription?: string;
  pageTitle?: string;
  showEmptyViewOptions?: boolean;
  showMatchingEscalation?: boolean;
  showPostMatchCancellationBoard?: boolean;
  summaryLabels?: readonly string[];
  tableGroupKeys?: readonly BookingTableGroupKey[];
  viewOptions?: typeof bookingViewOptions;
};

type BookingView = BookingPageView;

export function BookingMonitor({
  bookings,
  bookingCreateRejections = [],
  initialView,
  initialEvidenceFilter = 'all',
  initialGateFilter = 'all',
  liveOperationsPolicy,
  pageDescription,
  pageTitle,
  showEmptyViewOptions = false,
  showMatchingEscalation = true,
  showPostMatchCancellationBoard = true,
  summaryLabels,
  tableGroupKeys,
  viewOptions = bookingViewOptions,
}: Props) {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshLabel, setLastRefreshLabel] = useState('pending');
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<BookingView>(initialView);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<BookingDateRangeFilter>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [evidenceFilter, setEvidenceFilter] = useState<BookingEvidenceFilter>(initialEvidenceFilter);
  const [gateFilter, setGateFilter] = useState<BookingGateFilter>(initialGateFilter);
  const currentTimeMs = nowMs ?? 0;
  const markRefreshed = useCallback((refreshedAt: Date) => {
    setLastRefreshLabel(formatClockTime(refreshedAt));
    setNowMs(refreshedAt.getTime());
  }, []);

  const orderedBookings = useMemo(
    () =>
      [...bookings].sort((left, right) =>
        compareBookingMonitorListOrder(
          { status: left.status, sortTimestampMs: bookingTimestamp(left) },
          { status: right.status, sortTimestampMs: bookingTimestamp(right) },
        ),
      ),
    [bookings],
  );
  const gateModel = useMemo(
    () =>
      buildBookingMonitorGateModel({
        activeFilter: gateFilter,
        logs: bookingCreateRejections,
        nowMs: currentTimeMs,
      }),
    [bookingCreateRejections, currentTimeMs, gateFilter],
  );
  const { bookingGateTriage, orderedBookingCreateRejections, visibleBookingCreateRejections } = gateModel;

  const summary = useMemo(
    () => {
      const rows = bookingMonitorSummaryRows({
        blockedCreateAttemptCount: orderedBookingCreateRejections.length,
        bookings: orderedBookings.map((booking) => buildBookingMonitorSummaryFact(booking, currentTimeMs)),
      });

      if (summaryLabels) {
        const rowMap = new Map(rows);
        return summaryLabels.map((label) => [label, rowMap.get(label) ?? '0'] as const);
      }

      return compactBookingMonitorSummaryRows(rows);
    },
    [currentTimeMs, orderedBookingCreateRejections.length, orderedBookings, summaryLabels],
  );

  const postMatchCancellationBoard = useMemo(
    () => buildBookingPostMatchCancellationBoard(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const matchingEscalationBoard = useMemo(
    () => buildBookingMonitorMatchingEscalationBoard(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const livePolicyCards = useMemo(
    () => buildBookingLiveMatchingPolicyCards(liveOperationsPolicy),
    [liveOperationsPolicy],
  );
  const matchingEscalationRows = useMemo(
    () => buildBookingMonitorMatchingEscalationRows(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const matchingFlowTimeline = useMemo(
    () => buildBookingMonitorMatchingFlowTimeline(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const dispatchPartnerShortcuts = useMemo(
    () => buildBookingDispatchPartnerShortcuts(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );

  const visibleBookingModel = useMemo(
    () =>
      buildAdminBookingMonitorVisibleModel({
        blockedCreateCount: orderedBookingCreateRejections.length,
        bookings: orderedBookings,
        customDateFrom,
        customDateTo,
        dateRangeFilter,
        evidenceFilter,
        nowMs: currentTimeMs,
        paymentFilter,
        searchQuery,
        statusFilter,
        view,
      }),
    [
      currentTimeMs,
      customDateFrom,
      customDateTo,
      dateRangeFilter,
      evidenceFilter,
      orderedBookingCreateRejections.length,
      orderedBookings,
      paymentFilter,
      searchQuery,
      statusFilter,
      view,
    ],
  );
  const visibleBookings = visibleBookingModel.visibleBookings;
  const bookingListRows = useMemo(
    () =>
      [...visibleBookings]
        .sort(compareBookingRequestTimeDescending)
        .map((booking) => buildBookingMonitorListRow(booking, currentTimeMs, nowMs)),
    [currentTimeMs, nowMs, visibleBookings],
  );
  const statusFilterOptions = useMemo(() => bookingStatusFilterOptions(orderedBookings), [orderedBookings]);
  const paymentFilterOptions = useMemo(() => bookingPaymentFilterOptions(orderedBookings), [orderedBookings]);

  const bookingViewCounts = visibleBookingModel.bookingViewCounts;
  const activeView =
    viewOptions.find((item) => item.view === view) ??
    bookingViewOptions.find((item) => item.view === view) ??
    viewOptions[0] ??
    bookingViewOptions[0];
  const showBookingList = view !== 'blocked-create';
  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      const mountedAt = new Date();
      setHasMounted(true);
      markRefreshed(mountedAt);
    }, 0);

    if (!autoRefresh) {
      return () => window.clearTimeout(mountTimer);
    }

    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
        markRefreshed(new Date());
      });
    }, 10000);

    return () => {
      window.clearTimeout(mountTimer);
      window.clearInterval(timer);
    };
  }, [autoRefresh, markRefreshed, router]);

  const refreshNow = () => {
    startTransition(() => {
      router.refresh();
      markRefreshed(new Date());
    });
  };
  const toggleAutoRefresh = () => setAutoRefresh((value) => !value);

  return (
    <div className="booking-monitor">
      <BookingMonitorToolbarSection
        autoRefresh={autoRefresh}
        description={pageDescription}
        onRefreshNow={refreshNow}
        onToggleAutoRefresh={toggleAutoRefresh}
        title={pageTitle}
      />

      <BookingMonitorLiveStatusSection
        hasMounted={hasMounted}
        isPending={isPending}
        lastRefreshLabel={lastRefreshLabel}
        summary={summary}
      />

      {showMatchingEscalation && (
        <BookingMonitorMatchingEscalationSection
          dispatchPartnerShortcuts={dispatchPartnerShortcuts}
          getCustomerLabel={bookingCustomerLabel}
          getMatchingWindowLabel={(booking) => bookingMatchingWindowLabel(booking, currentTimeMs)}
          livePolicyCards={livePolicyCards}
          matchingEscalationBoard={matchingEscalationBoard}
          matchingEscalationRows={matchingEscalationRows}
          matchingFlowTimeline={matchingFlowTimeline}
        />
      )}

      {showPostMatchCancellationBoard && (
        <BookingPostMatchCancellationsSection board={postMatchCancellationBoard} />
      )}

      <BookingMonitorFiltersSection
        activeView={activeView}
        baseVisibleBookingCount={visibleBookingModel.baseVisibleBookingCount}
        customDateFrom={customDateFrom}
        customDateTo={customDateTo}
        dateRangeFilter={dateRangeFilter}
        dateRangeFilterOptions={bookingDateRangeFilterOptions}
        evidenceFilter={evidenceFilter}
        evidenceFilterOptions={bookingEvidenceFilterOptions}
        onCustomDateFromChange={setCustomDateFrom}
        onCustomDateToChange={setCustomDateTo}
        onDateRangeFilterChange={setDateRangeFilter}
        onEvidenceFilterChange={setEvidenceFilter}
        onPaymentFilterChange={setPaymentFilter}
        onSearchQueryChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onViewChange={setView}
        paymentFilter={paymentFilter}
        paymentFilterOptions={paymentFilterOptions}
        searchQuery={searchQuery}
        showEmptyViewOptions={showEmptyViewOptions}
        statusFilter={statusFilter}
        statusFilterOptions={statusFilterOptions}
        view={view}
        viewCounts={bookingViewCounts}
        viewOptions={viewOptions}
        visibleBookingCount={visibleBookings.length}
      />

      {showBookingList && (
        <BookingMonitorListSection
          emptyMessage="No bookings match the current filters."
          rows={bookingListRows}
          visibleGroupKeys={tableGroupKeys}
        />
      )}

      {view === 'blocked-create' && (
        <BookingMonitorBlockedCreateSection
          bookingGateTriage={bookingGateTriage}
          gateFilter={gateFilter}
          onGateFilterChange={setGateFilter}
          orderedBookingCreateRejections={orderedBookingCreateRejections}
          visibleBookingCreateRejections={visibleBookingCreateRejections}
        />
      )}
    </div>
  );
}

function compareBookingRequestTimeDescending(left: AdminBooking, right: AdminBooking) {
  return bookingRequestTimeMs(right) - bookingRequestTimeMs(left);
}

function bookingRequestTimeMs(booking: AdminBooking) {
  const value = bookingRequestOpenedAt(booking);
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
