'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { AdminPageTemplate } from '../../components/admin-page-template';
import type { AdminAuditLog, AdminBooking } from '../../lib/admin-api';
import { bookingRequestOpenedAt } from '../../lib/admin-booking-time';
import { buildBookingLiveMatchingPolicyCards } from '../../lib/booking-live-matching-policy-cards';
import { compareBookingMonitorListOrder } from '../../lib/booking-monitor-list-order';
import { type AdminLiveOperationsPolicy } from '../../lib/operations-policy';
import {
  bookingDateRangeFilterOptions,
  type BookingDateRangeFilter,
} from './booking-date-range-filter';
import { bookingTimestamp, formatBookingClockTime as formatClockTime } from './booking-list-time';
import type { BookingGateFilter } from './booking-gate-filters';
import { bookingViewOptions } from './booking-monitor-options';
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
  BOOKING_MONITOR_REALTIME_EVENTS,
  type BookingMonitorRealtimeState,
} from './booking-monitor-realtime';
import {
  buildBookingMonitorMatchingEscalationBoard,
  buildBookingMonitorMatchingEscalationRows,
} from './booking-monitor-matching-escalation-model';
import { bookingCustomerLabel } from './booking-monitor-labels';
import { buildAdminBookingMonitorVisibleModel } from './booking-monitor-visible-model';
import { buildBookingMonitorListRow } from './booking-monitor-list-row-model';
import { buildBookingMonitorGateModel } from './booking-monitor-gate-model';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';
import { BookingCompletedCloseoutSection } from './booking-completed-closeout-section';
import { buildBookingPostMatchCancellationBoard } from './booking-post-match-cancellations-model';
import { BookingPostMatchCancellationsSection } from './booking-post-match-cancellations-section';

type Props = {
  bookings: AdminBooking[];
  bookingCreateRejections?: AdminAuditLog[];
  dateRangePath?: string;
  dateRangeSearchParams?: readonly (readonly [string, string])[];
  initialCustomDateFrom?: string;
  initialCustomDateTo?: string;
  initialDateRangeFilter?: BookingDateRangeFilter;
  initialNowMs?: number;
  initialView: BookingView;
  initialEvidenceFilter?: BookingEvidenceFilter;
  initialGateFilter?: BookingGateFilter;
  liveOperationsPolicy: AdminLiveOperationsPolicy;
  pageDescription?: string;
  pageTitle?: string;
  showCompletedCloseoutBoard?: boolean;
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
  dateRangePath = '/bookings',
  dateRangeSearchParams = [],
  initialCustomDateFrom = '',
  initialCustomDateTo = '',
  initialDateRangeFilter = 'today',
  initialNowMs,
  initialView,
  initialEvidenceFilter = 'all',
  initialGateFilter = 'all',
  liveOperationsPolicy,
  pageDescription,
  pageTitle,
  showCompletedCloseoutBoard = false,
  showEmptyViewOptions = false,
  showMatchingEscalation = true,
  showPostMatchCancellationBoard = true,
  summaryLabels,
  tableGroupKeys,
  viewOptions = bookingViewOptions,
}: Props) {
  const router = useRouter();
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [lastRefreshLabel, setLastRefreshLabel] = useState('pending');
  const [nowMs, setNowMs] = useState(initialNowMs ?? 0);
  const [hasMounted, setHasMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [realtimeState, setRealtimeState] = useState<BookingMonitorRealtimeState>('connecting');
  const [view, setView] = useState<BookingView>(initialView);
  const searchQuery = '';
  const statusFilter = 'all';
  const paymentFilter = 'all';
  const evidenceFilter = initialEvidenceFilter;
  const [dateRangeFilter, setDateRangeFilter] = useState<BookingDateRangeFilter>(initialDateRangeFilter);
  const [customDateFrom, setCustomDateFrom] = useState(initialCustomDateFrom);
  const [customDateTo, setCustomDateTo] = useState(initialCustomDateTo);
  const [gateFilter, setGateFilter] = useState<BookingGateFilter>(initialGateFilter);
  const currentTimeMs = nowMs;
  const markRefreshed = useCallback((refreshedAt: Date) => {
    setLastRefreshLabel(formatClockTime(refreshedAt));
    setNowMs(refreshedAt.getTime());
  }, []);
  const refreshBookingData = useCallback(() => {
    markRefreshed(new Date());
    startTransition(() => {
      router.refresh();
    });
  }, [markRefreshed, router]);

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

    if (!liveUpdates) {
      return () => window.clearTimeout(mountTimer);
    }

    let socket: Socket | null = null;
    let refreshTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let closed = false;
    const realtimeStateTimer = window.setTimeout(() => {
      setRealtimeState('connecting');
    }, 0);

    const scheduleRealtimeRefresh = () => {
      if (refreshTimer !== null) {
        return;
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refreshBookingData();
      }, 120);
    };

    const connectRealtime = async () => {
      try {
        const response = await fetch('/api/admin/realtime-token', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Realtime token unavailable');
        }

        const body = (await response.json()) as { socketBaseUrl?: string; token?: string };
        if (!body.socketBaseUrl || !body.token || closed) {
          throw new Error('Realtime token response incomplete');
        }

        const { io } = await import('socket.io-client');
        if (closed) {
          return;
        }

        socket = io(body.socketBaseUrl, {
          auth: { token: body.token },
          transports: ['websocket', 'polling'],
          withCredentials: true,
        });

        socket.on('connect', () => {
          setRealtimeState('live');
          scheduleRealtimeRefresh();
        });
        socket.on('connect_error', () => {
          if (closed || reconnectTimer !== null) {
            return;
          }
          setRealtimeState('error');
          socket?.disconnect();
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            void connectRealtime();
          }, 1000);
        });
        socket.on('disconnect', () => {
          if (!closed) {
            setRealtimeState('connecting');
          }
        });

        for (const eventName of BOOKING_MONITOR_REALTIME_EVENTS) {
          socket.on(eventName, scheduleRealtimeRefresh);
        }
      } catch {
        if (!closed) {
          setRealtimeState('error');
        }
      }
    };

    void connectRealtime();

    return () => {
      closed = true;
      window.clearTimeout(mountTimer);
      window.clearTimeout(realtimeStateTimer);
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.disconnect();
    };
  }, [liveUpdates, markRefreshed, refreshBookingData]);

  const toggleLiveUpdates = () => setLiveUpdates((value) => !value);
  const realtimeDisplayState = liveUpdates ? realtimeState : 'paused';
  const dateRangeHrefFor = useCallback(
    (range: BookingDateRangeFilter) =>
      bookingDateRangeHref({
        customDateFrom,
        customDateTo,
        path: dateRangePath,
        range,
        searchParams: dateRangeSearchParams,
      }),
    [customDateFrom, customDateTo, dateRangePath, dateRangeSearchParams],
  );

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setDateRangeFilter(initialDateRangeFilter);
      setCustomDateFrom(initialCustomDateFrom);
      setCustomDateTo(initialCustomDateTo);
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [initialCustomDateFrom, initialCustomDateTo, initialDateRangeFilter]);

  return (
    <AdminPageTemplate
      actions={<BookingMonitorToolbarSection liveUpdates={liveUpdates} onToggleLiveUpdates={toggleLiveUpdates} />}
      contentClassName="booking-monitor"
      description={pageDescription ?? 'Live operational view for matching, Partner selection, chat, and payment readiness.'}
      title={pageTitle ?? 'Booking Monitor'}
    >
      <BookingMonitorLiveStatusSection
        hasMounted={hasMounted}
        isPending={isPending}
        lastRefreshLabel={lastRefreshLabel}
        realtimeState={realtimeDisplayState}
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

      {showCompletedCloseoutBoard && <BookingCompletedCloseoutSection />}

      <BookingMonitorFiltersSection
        activeView={activeView}
        baseVisibleBookingCount={visibleBookingModel.baseVisibleBookingCount}
        customDateFrom={customDateFrom}
        customDateTo={customDateTo}
        dateRangeFormAction={dateRangePath}
        dateRangeFilter={dateRangeFilter}
        dateRangeHiddenInputs={dateRangeSearchParams}
        dateRangeHrefFor={dateRangeHrefFor}
        dateRangeFilterOptions={bookingDateRangeFilterOptions}
        onCustomDateFromChange={setCustomDateFrom}
        onCustomDateToChange={setCustomDateTo}
        onDateRangeFilterChange={setDateRangeFilter}
        onViewChange={setView}
        showEmptyViewOptions={showEmptyViewOptions}
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
    </AdminPageTemplate>
  );
}

function bookingDateRangeHref({
  customDateFrom,
  customDateTo,
  path,
  range,
  searchParams,
}: {
  readonly customDateFrom: string;
  readonly customDateTo: string;
  readonly path: string;
  readonly range: BookingDateRangeFilter;
  readonly searchParams: readonly (readonly [string, string])[];
}) {
  const params = new URLSearchParams(searchParams.map(([key, value]) => [key, value]));
  params.set('dateRange', range);

  if (range === 'custom') {
    setOptionalSearchParam(params, 'dateFrom', customDateFrom);
    setOptionalSearchParam(params, 'dateTo', customDateTo);
  } else {
    params.delete('dateFrom');
    params.delete('dateTo');
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function setOptionalSearchParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
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
