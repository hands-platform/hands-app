'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AdminPageTemplate } from '../../components/admin-page-template';
import type {
  AdminAuditLog,
  AdminBooking,
  AdminBookingMonitorSummary,
  AdminBookingPage,
  AdminCompletedBookingOperationsSummary,
  AdminPostMatchCancellationOperationsSummary,
} from '../../lib/admin-api';
import { type AdminLiveOperationsPolicy } from '../../lib/operations-policy';
import {
  bookingCustomDateRangeError,
  bookingDateRangeFilterOptions,
  type BookingDateRangeFilter,
} from './booking-date-range-filter';
import {
  formatBookingClockTime as formatClockTime,
  orderBookingsForQueue,
  relativeTimeLabel,
} from './booking-list-time';
import type { BookingGateFilter } from './booking-gate-filters';
import { bookingViewOptions } from './booking-monitor-options';
import { bookingMonitorSummaryRows, compactBookingMonitorSummaryRows } from './booking-monitor-summary';
import type { BookingMonitorBlockedCreateSectionProps } from './booking-monitor-blocked-create-section';
import {
  BookingMonitorAdditionalQueuesSection,
  BookingMonitorFiltersSection,
} from './booking-monitor-filters-section';
import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';
import { BookingMonitorListSection, type BookingTableGroupKey } from './booking-monitor-list-section';
import type { BookingMonitorMatchingEscalationBoardProps } from './booking-monitor-matching-escalation-section';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';
import { buildBookingMonitorSummaryFact } from './booking-monitor-summary-model';
import {
  bookingMonitorIsRecordsView,
  bookingMonitorUsesRealtime,
  startBookingMonitorRealtime,
  type BookingMonitorRealtimeState,
} from './booking-monitor-realtime';
import { bookingListDefaultSort, type BookingMonitorRouteKind } from './booking-monitor-route-load-plan';
import { buildAdminBookingMonitorVisibleModel } from './booking-monitor-visible-model';
import { buildBookingMonitorListRow } from './booking-monitor-list-row-model';
import { emptyBookingMessage } from './booking-empty-message';
import { buildBookingMonitorGateModel } from './booking-monitor-gate-model';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';
import type { BookingPostMatchCancellationBoardProps } from './booking-post-match-cancellations-section';
import {
  postMatchCancellationReasonFilterOptions,
  type BookingPostMatchCancellationReasonFilter,
} from './booking-post-match-cancellation-reason';
import { readAdminQueueAge, readAdminQueueSlaFilter, readAdminQueueSort } from '../../lib/admin-queue-list';
import type { AdminQueueAgeCounts, AdminQueueSlaSummary } from '../../lib/admin-queue-list';
import type { DashboardDataScope, DashboardSourceState } from '../dashboard-trace-summary';

type Props = {
  bookings: AdminBooking[];
  bookingCreateRejections?: AdminAuditLog[];
  bookingListLoadFailed?: boolean;
  queueAgeCounts?: AdminQueueAgeCounts;
  queueSla?: AdminQueueSlaSummary;
  dateRangePath?: string;
  dateRangeSearchParams?: readonly (readonly [string, string])[];
  completedOperationsSummary?: AdminCompletedBookingOperationsSummary;
  dataGeneratedAt?: string;
  dataPartialSourceCount: number;
  dataScope: DashboardDataScope;
  dataSourceState: DashboardSourceState;
  initialCustomDateFrom?: string;
  initialCustomDateTo?: string;
  initialCancellationReasonFilter?: BookingPostMatchCancellationReasonFilter;
  initialDateRangeFilter?: BookingDateRangeFilter;
  initialNowMs?: number;
  initialView: BookingView;
  initialEvidenceFilter?: BookingEvidenceFilter;
  initialGateFilter?: BookingGateFilter;
  initialSearchQuery?: string;
  liveOperationsPolicy: AdminLiveOperationsPolicy;
  overviewSummary?: AdminBookingMonitorSummary;
  pageDescription?: string;
  pageTitle?: string;
  postMatchCancellationOperationsSummary?: AdminPostMatchCancellationOperationsSummary;
  showCompletedCloseoutBoard?: boolean;
  showEmptyViewOptions?: boolean;
  showMatchingEscalation?: boolean;
  showPostMatchCancellationBoard?: boolean;
  summaryLabels?: readonly string[];
  serverPagination?: AdminBookingPage['pagination'];
  tableGroupKeys?: readonly BookingTableGroupKey[];
  useOperationsTable?: boolean;
  viewOptions?: typeof bookingViewOptions;
};

type BookingView = BookingPageView;

const BookingMonitorBlockedCreateSection = dynamic<BookingMonitorBlockedCreateSectionProps>(
  () =>
    import('./booking-monitor-blocked-create-section').then(
      (module) => module.BookingMonitorBlockedCreateSection,
    ),
  { loading: () => null, ssr: false },
);

const BookingMonitorMatchingEscalationBoard = dynamic<BookingMonitorMatchingEscalationBoardProps>(
  () =>
    import('./booking-monitor-matching-escalation-section').then(
      (module) => module.BookingMonitorMatchingEscalationBoard,
    ),
  { loading: () => null, ssr: false },
);

const BookingPostMatchCancellationBoard = dynamic<BookingPostMatchCancellationBoardProps>(
  () =>
    import('./booking-post-match-cancellations-section').then(
      (module) => module.BookingPostMatchCancellationBoard,
    ),
  { loading: () => null, ssr: false },
);

const BookingCompletedCloseoutSection = dynamic(
  () =>
    import('./booking-completed-closeout-section').then((module) => module.BookingCompletedCloseoutSection),
  { loading: () => null, ssr: false },
);

export function BookingMonitor({
  bookings,
  bookingCreateRejections = [],
  bookingListLoadFailed = false,
  queueAgeCounts,
  queueSla,
  completedOperationsSummary,
  dataGeneratedAt,
  dataPartialSourceCount,
  dataScope,
  dataSourceState,
  dateRangePath = '/bookings',
  dateRangeSearchParams = [],
  initialCustomDateFrom = '',
  initialCustomDateTo = '',
  initialCancellationReasonFilter = 'all',
  initialDateRangeFilter = 'today',
  initialNowMs,
  initialView,
  initialEvidenceFilter = 'all',
  initialGateFilter = 'all',
  initialSearchQuery = '',
  liveOperationsPolicy,
  overviewSummary,
  pageDescription,
  pageTitle,
  postMatchCancellationOperationsSummary,
  showCompletedCloseoutBoard = false,
  showEmptyViewOptions = false,
  showMatchingEscalation = true,
  showPostMatchCancellationBoard = true,
  summaryLabels,
  serverPagination,
  tableGroupKeys,
  useOperationsTable = false,
  viewOptions = bookingViewOptions,
}: Props) {
  const router = useRouter();
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [lastRefreshLabel, setLastRefreshLabel] = useState('pending');
  const [nowMs, setNowMs] = useState(initialNowMs ?? 0);
  const [hasMounted, setHasMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const refreshPendingRef = useRef(false);
  const [realtimeState, setRealtimeState] = useState<BookingMonitorRealtimeState>('connecting');
  const [view, setView] = useState<BookingView>(initialView);
  const searchQuery = initialSearchQuery;
  const queueAge = readAdminQueueAge(searchParamValue(dateRangeSearchParams, 'age'));
  const routeKind: BookingMonitorRouteKind =
    dateRangePath === '/bookings/completed'
      ? 'completed'
      : dateRangePath === '/bookings/post-match-cancellations'
        ? 'postMatchCancellations'
        : 'all';
  const defaultQueueSort = bookingListDefaultSort(routeKind, view);
  const queueSort = readAdminQueueSort(searchParamValue(dateRangeSearchParams, 'sort') || defaultQueueSort);
  const queueSlaFilter = readAdminQueueSlaFilter(searchParamValue(dateRangeSearchParams, 'sla'));
  const isPostMatchCancellationWorkspace = dateRangePath === '/bookings/post-match-cancellations';
  const statusFilter = 'all';
  const paymentFilter = 'all';
  const evidenceFilter = initialEvidenceFilter;
  const [dateRangeFilter, setDateRangeFilter] = useState<BookingDateRangeFilter>(initialDateRangeFilter);
  const [customDateFrom, setCustomDateFrom] = useState(initialCustomDateFrom);
  const [customDateTo, setCustomDateTo] = useState(initialCustomDateTo);
  const [customDateError, setCustomDateError] = useState<string | null>(null);
  const [gateFilter, setGateFilter] = useState<BookingGateFilter>(initialGateFilter);
  const currentTimeMs = nowMs;
  const markRefreshed = useCallback((refreshedAt: Date) => {
    setLastRefreshLabel(formatClockTime(refreshedAt));
    setNowMs(refreshedAt.getTime());
  }, []);
  const refreshBookingData = useCallback(() => {
    if (refreshPendingRef.current) return;

    refreshPendingRef.current = true;
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    refreshPendingRef.current = isPending;
  }, [isPending]);

  const orderedBookings = useMemo(
    () => orderBookingsForQueue(bookings, queueSort, Boolean(serverPagination)),
    [bookings, queueSort, serverPagination],
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

  const summary = useMemo(() => {
    if (overviewSummary) {
      return [
        ['Needs action', overviewSummary.needsAction.toString()],
        ['Live bookings', overviewSummary.activeBookings.toString()],
        ['Matching now', overviewSummary.matchingNow.toString()],
        ['Service in progress', overviewSummary.serviceInProgress.toString()],
        ['Data anomaly', (overviewSummary.anomalyBookings ?? 0).toString()],
        ['Blocked today', overviewSummary.blockedCreateAttemptsToday.toString()],
      ] as const;
    }

    if (completedOperationsSummary) {
      const rows = [
        ['Closeout checks', completedOperationsSummary.closeoutChecks.toString()],
        ['Payment checks', completedOperationsSummary.paymentChecks.toString()],
        ['Cash debt', completedOperationsSummary.cashDebt.toString()],
        ['Pricing checks', completedOperationsSummary.pricingChecks.toString()],
        ['Refund review', completedOperationsSummary.refundReview.toString()],
        ['Expired', completedOperationsSummary.expired.toString()],
      ] as const;
      return completedOperationsSummary.oldestCloseoutAt
        ? [
            ...rows,
            [
              'Oldest waiting',
              relativeTimeLabel(completedOperationsSummary.oldestCloseoutAt, currentTimeMs).replace(
                / ago$/u,
                '',
              ),
            ] as const,
          ]
        : rows;
    }

    if (postMatchCancellationOperationsSummary) {
      return [];
    }

    const rows = bookingMonitorSummaryRows({
      blockedCreateAttemptCount: orderedBookingCreateRejections.length,
      bookings: orderedBookings.map((booking) => buildBookingMonitorSummaryFact(booking, currentTimeMs)),
    });

    if (summaryLabels) {
      const rowMap = new Map(rows);
      return summaryLabels.map((label) => [label, rowMap.get(label) ?? '0'] as const);
    }

    return compactBookingMonitorSummaryRows(rows);
  }, [
    completedOperationsSummary,
    currentTimeMs,
    orderedBookingCreateRejections.length,
    orderedBookings,
    overviewSummary,
    postMatchCancellationOperationsSummary,
    summaryLabels,
  ]);

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
  const visibleBookings = serverPagination ? orderedBookings : visibleBookingModel.visibleBookings;
  const bookingListRows = useMemo(
    () => visibleBookings.map((booking) => buildBookingMonitorListRow(booking, currentTimeMs, nowMs, view)),
    [currentTimeMs, nowMs, view, visibleBookings],
  );
  const bookingViewCounts = useMemo(() => {
    if (completedOperationsSummary) {
      return new Map<string, number>([
        ['all', completedOperationsSummary.totalRecords],
        ['payment', completedOperationsSummary.paymentChecks],
        ['cash-debt', completedOperationsSummary.cashDebt],
        ['closeout', completedOperationsSummary.closeoutChecks],
        ['pricing', completedOperationsSummary.pricingChecks],
        ['refund-review', completedOperationsSummary.refundReview],
        ['expired', completedOperationsSummary.expired],
      ]);
    }

    if (postMatchCancellationOperationsSummary) {
      return new Map<string, number>([
        ['manual-decision', postMatchCancellationOperationsSummary.needsDecisionCount],
        ['post-match-cancellations', postMatchCancellationOperationsSummary.resolvedCount],
        ['no-show', postMatchCancellationOperationsSummary.noShowReviewCount],
      ]);
    }

    if (!overviewSummary) {
      return visibleBookingModel.bookingViewCounts;
    }

    const counts = new Map<string, number>([
      ['active', overviewSummary.activeBookings],
      ['attention', overviewSummary.needsAction],
      ['matching', overviewSummary.matchingNow],
      ['in-service', overviewSummary.serviceInProgress],
      ['data-anomaly', overviewSummary.anomalyBookings ?? 0],
      ['blocked-create', overviewSummary.blockedCreateAttemptsToday],
      ['first-pick', overviewSummary.preferredPending ?? 0],
      ['marketplace', overviewSummary.openMatching ?? 0],
      ['customer-choice', overviewSummary.customerChoice ?? 0],
      ['matched', overviewSummary.matchedHandoff ?? 0],
      ['matching-delays', overviewSummary.matchingDelays ?? 0],
      ['handoff-repair', overviewSummary.chatMissingCount ?? 0],
      ['no-supply', overviewSummary.supplyIntervention ?? 0],
    ]);
    if (view === 'all' || view === 'usage-unresolved') {
      counts.set(view, serverPagination?.totalRows ?? 0);
    }
    return counts;
  }, [
    completedOperationsSummary,
    overviewSummary,
    postMatchCancellationOperationsSummary,
    serverPagination?.totalRows,
    view,
    visibleBookingModel.bookingViewCounts,
  ]);
  const activeView =
    viewOptions.find((item) => item.view === view) ??
    bookingViewOptions.find((item) => item.view === view) ??
    viewOptions[0] ??
    bookingViewOptions[0];
  const showBookingList = view !== 'blocked-create';
  const usesRealtime = bookingMonitorUsesRealtime(dateRangePath, view);
  const isRecordsView = bookingMonitorIsRecordsView(dateRangePath, view);
  useEffect(() => {
    if (!hasMounted) return undefined;

    const timer = window.setTimeout(() => markRefreshed(new Date()), 0);
    return () => window.clearTimeout(timer);
  }, [bookings, hasMounted, markRefreshed]);

  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      const mountedAt = new Date();
      setHasMounted(true);
      markRefreshed(mountedAt);
    }, 0);

    if (!liveUpdates || !usesRealtime) {
      return () => window.clearTimeout(mountTimer);
    }

    const stopRealtime = startBookingMonitorRealtime({
      connectSocket: async ({ socketBaseUrl, token }) => {
        const { io } = await import('socket.io-client');
        return io(socketBaseUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          withCredentials: true,
        });
      },
      loadToken: async () => {
        const response = await fetch('/api/admin/realtime-token', { cache: 'no-store' });
        if (!response.ok) throw new Error('Realtime token unavailable');

        const body = (await response.json()) as { socketBaseUrl?: string; token?: string };
        if (!body.socketBaseUrl || !body.token) {
          throw new Error('Realtime token response incomplete');
        }
        return { socketBaseUrl: body.socketBaseUrl, token: body.token };
      },
      onStateChange: setRealtimeState,
      refresh: refreshBookingData,
    });

    return () => {
      window.clearTimeout(mountTimer);
      stopRealtime();
    };
  }, [liveUpdates, markRefreshed, refreshBookingData, usesRealtime]);

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
  const viewHrefFor = useCallback(
    (nextView: BookingPageView) =>
      bookingViewHref({
        path: dateRangePath,
        searchParams: dateRangeSearchParams,
        view: nextView,
      }),
    [dateRangePath, dateRangeSearchParams],
  );
  const pageHrefFor = useCallback(
    (page: number) =>
      bookingPageHref({
        page,
        path: dateRangePath,
        searchParams: dateRangeSearchParams,
      }),
    [dateRangePath, dateRangeSearchParams],
  );
  const queueAgeHrefFor = useCallback(
    (age: ReturnType<typeof readAdminQueueAge>) =>
      bookingQueueHref({ age, path: dateRangePath, searchParams: dateRangeSearchParams }),
    [dateRangePath, dateRangeSearchParams],
  );
  const queueSortHrefFor = useCallback(
    (sort: ReturnType<typeof readAdminQueueSort>) =>
      bookingQueueHref({ path: dateRangePath, searchParams: dateRangeSearchParams, sort }),
    [dateRangePath, dateRangeSearchParams],
  );
  const queueSlaHrefFor = useCallback(
    (sla: ReturnType<typeof readAdminQueueSlaFilter>) =>
      bookingQueueHref({ path: dateRangePath, searchParams: dateRangeSearchParams, sla }),
    [dateRangePath, dateRangeSearchParams],
  );
  const filterResetHref = useMemo(
    () => bookingFilterResetHref(dateRangePath, dateRangeSearchParams, view),
    [dateRangePath, dateRangeSearchParams, view],
  );
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    (view !== 'no-show' && initialCancellationReasonFilter !== 'all') ||
    queueAge !== 'all' ||
    queueSlaFilter !== 'all' ||
    (isPostMatchCancellationWorkspace &&
      queueSort !== (view === 'post-match-cancellations' ? 'newest' : 'oldest')) ||
    (isPostMatchCancellationWorkspace && view === 'post-match-cancellations' && dateRangeFilter !== '30d'),
  );
  const submitCustomDateRange = useCallback((event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    const error = bookingCustomDateRangeError(
      String(formData.get('dateFrom') ?? ''),
      String(formData.get('dateTo') ?? ''),
    );
    setCustomDateError(error);
    if (error) {
      event.preventDefault();
      window.requestAnimationFrame(() => {
        form.querySelector<HTMLInputElement>('input[aria-label="Start date"]')?.focus();
      });
    }
  }, []);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setView(initialView);
      setDateRangeFilter(initialDateRangeFilter);
      setCustomDateFrom(initialCustomDateFrom);
      setCustomDateTo(initialCustomDateTo);
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [initialCustomDateFrom, initialCustomDateTo, initialDateRangeFilter, initialView]);

  return (
    <AdminPageTemplate
      actions={
        usesRealtime ? (
          <BookingMonitorToolbarSection
            isPending={isPending}
            liveUpdates={liveUpdates}
            onRefreshNow={refreshBookingData}
            onToggleLiveUpdates={toggleLiveUpdates}
            realtimeState={realtimeDisplayState}
          />
        ) : undefined
      }
      contentClassName={showCompletedCloseoutBoard ? 'booking-monitor booking-completed-monitor' : 'booking-monitor'}
      description={
        pageDescription ??
        'Live operational view for matching, Partner selection, chat, and payment readiness.'
      }
      title={isRecordsView ? 'Booking records' : (pageTitle ?? 'Live bookings')}
    >
      {!isRecordsView && (
        <BookingMonitorLiveStatusSection
          auditFixtureVisible={bookings.some((booking) => booking.dataClass === 'test')}
          dataClass={overviewSummary?.dataClass}
          dataGeneratedAt={dataGeneratedAt}
          dataPartialSourceCount={dataPartialSourceCount}
          dataScope={dataScope}
          dataScopeEnd={overviewSummary?.scopeEnd}
          dataScopeStart={overviewSummary?.scopeStart}
          dataSourceState={dataSourceState}
          hasMounted={hasMounted}
          isPending={isPending}
          lastRefreshLabel={lastRefreshLabel}
          realtimeState={realtimeDisplayState}
          summary={completedOperationsSummary ? [] : summary}
        />
      )}

      {showPostMatchCancellationBoard && (
        <BookingPostMatchCancellationBoard
          periodLabel={postMatchCancellationResolvedPeriodLabel(
            dateRangeSearchParams,
            initialCustomDateFrom,
            initialCustomDateTo,
          )}
          summary={postMatchCancellationOperationsSummary}
        />
      )}

      {showMatchingEscalation && (
        <BookingMonitorMatchingEscalationBoard
          bookings={orderedBookings}
          currentTimeMs={currentTimeMs}
          liveOperationsPolicy={liveOperationsPolicy}
        />
      )}

      {showCompletedCloseoutBoard && <BookingCompletedCloseoutSection />}

      <BookingMonitorFiltersSection
        age={queueAge}
        ageCounts={queueAgeCounts}
        ageHref={queueAgeHrefFor}
        queueSla={queueSla}
        slaFilter={queueSlaFilter}
        slaHref={queueSlaHrefFor}
        activeView={activeView}
        baseVisibleBookingCount={serverPagination?.totalRows ?? visibleBookingModel.baseVisibleBookingCount}
        cancellationReasonFilter={initialCancellationReasonFilter}
        cancellationReasonFilterOptions={
          dateRangePath === '/bookings/post-match-cancellations' && view !== 'no-show'
            ? postMatchCancellationReasonFilterOptions
            : undefined
        }
        customDateFrom={customDateFrom}
        customDateError={customDateError}
        customDateTo={customDateTo}
        filterResetHref={filterResetHref}
        hasActiveFilters={hasActiveFilters}
        dateRangeFormAction={dateRangePath}
        dateRangeFilter={dateRangeFilter}
        dateRangeLabel={
          isPostMatchCancellationWorkspace
            ? 'Decision period'
            : dateRangePath === '/bookings/completed'
              ? 'Closed period'
              : undefined
        }
        dateRangeHiddenInputs={dateRangeSearchParams}
        dateRangeHrefFor={dateRangeHrefFor}
        dateRangeFilterOptions={bookingDateRangeFilterOptions}
        onCustomDateFromChange={setCustomDateFrom}
        onCustomDateSubmit={submitCustomDateRange}
        onCustomDateToChange={setCustomDateTo}
        onDateRangeFilterChange={(nextDateRange) => {
          setCustomDateError(null);
          setDateRangeFilter(nextDateRange);
        }}
        onViewChange={setView}
        searchClearHref={bookingSearchClearHref(dateRangePath, dateRangeSearchParams)}
        searchQuery={searchQuery}
        showAdditionalQueues={!isPostMatchCancellationWorkspace && dateRangePath !== '/bookings'}
        showDateRange={
          (isPostMatchCancellationWorkspace && view === 'post-match-cancellations') ||
          dateRangePath === '/bookings/completed' ||
          !useOperationsTable ||
          [
            'all',
            'pre-match-cancelled',
            'preferred-rejected',
            'preferred-no-response',
            'usage-unresolved',
          ].includes(view)
        }
        queueAgeHelp={
          isPostMatchCancellationWorkspace
            ? 'Decision age starts at cancellation time. If unavailable, the latest recorded update is used.'
            : dateRangePath === '/bookings/completed'
              ? 'Waiting time starts from the terminal booking event.'
              : undefined
        }
        queueAgeLabel={
          isPostMatchCancellationWorkspace
            ? 'Decision age'
            : dateRangePath === '/bookings/completed'
              ? 'Waiting'
              : undefined
        }
        queueSortOptions={
          isPostMatchCancellationWorkspace
            ? [
                { label: 'Oldest first', value: 'oldest' },
                { label: 'Newest first', value: 'newest' },
              ]
            : dateRangePath === '/bookings/completed'
              ? [
                  { label: 'Longest waiting', value: 'oldest' },
                  { label: 'Recently closed', value: 'newest' },
                ]
              : undefined
        }
        showEmptyViewOptions={showEmptyViewOptions}
        showQueueAge={
          !isPostMatchCancellationWorkspace ||
          (view !== 'post-match-cancellations' &&
            (view !== 'no-show' || (bookingViewCounts.get('no-show') ?? 0) > 0))
        }
        sort={queueSort}
        sortHref={queueSortHrefFor}
        title={
          isPostMatchCancellationWorkspace
            ? 'Post-match cancellation queues'
            : dateRangePath === '/bookings/completed'
              ? 'Closeout queues'
              : undefined
        }
        view={view}
        viewCounts={bookingViewCounts}
        viewHrefFor={viewHrefFor}
        viewOptions={viewOptions}
        visibleBookingCount={visibleBookings.length}
      />

      {showBookingList && (
        <BookingMonitorListSection
          emptyMessage={
            isPostMatchCancellationWorkspace
              ? postMatchCancellationEmptyMessage(view, hasActiveFilters)
              : emptyBookingMessage(
                  view,
                  dateRangePath === '/bookings/completed' || isRecordsView
                    ? {
                        age: queueAge,
                        completedWorkspace: dateRangePath === '/bookings/completed',
                        dateRangeFilter,
                        searchQuery,
                      }
                    : {
                        age: queueAge,
                        hasActiveFilters,
                        queueLabel: activeView.label,
                        searchQuery,
                      },
                )
          }
          emptyResetHref={isRecordsView && searchQuery.trim() ? filterResetHref : undefined}
          hideEmptyGroups={view === 'all'}
          loadFailed={bookingListLoadFailed}
          operationsWorkspace={
            useOperationsTable
              ? bookingOperationsWorkspace(
                  view,
                  activeView.label,
                  activeView.description,
                  dateRangePath,
                  serverPagination?.totalRows ?? visibleBookings.length,
                )
              : undefined
          }
          nowMs={currentTimeMs}
          rows={bookingListRows}
          retryHref={pageHrefFor(serverPagination?.page ?? 1)}
          returnHref={pageHrefFor(serverPagination?.page ?? 1)}
          serverPagination={serverPagination ? { ...serverPagination, hrefForPage: pageHrefFor } : undefined}
          visibleGroupKeys={view === 'all' ? undefined : tableGroupKeys}
        />
      )}

      {dateRangePath === '/bookings' && !isRecordsView && (
        <BookingMonitorAdditionalQueuesSection
          onViewChange={setView}
          view={view}
          viewCounts={bookingViewCounts}
          viewHrefFor={viewHrefFor}
          viewOptions={viewOptions}
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

function postMatchCancellationResolvedPeriodLabel(
  searchParams: readonly (readonly [string, string])[],
  customDateFrom: string,
  customDateTo: string,
) {
  const range = (searchParamValue(searchParams, 'dateRange') as BookingDateRangeFilter | undefined) ?? '30d';
  if (range === 'custom' && customDateFrom && customDateTo) return `${customDateFrom} to ${customDateTo}`;
  if (range === '30d') return 'Last 30 days';
  return bookingDateRangeFilterOptions.find((option) => option.value === range)?.label ?? 'Last 30 days';
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
  params.delete('page');

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

function bookingViewHref({
  path,
  searchParams,
  view,
}: {
  readonly path: string;
  readonly searchParams: readonly (readonly [string, string])[];
  readonly view: BookingPageView;
}) {
  const params = new URLSearchParams(searchParams.map(([key, value]) => [key, value]));
  params.set('view', view);
  if (path === '/bookings/post-match-cancellations') {
    params.delete('sort');
    if (view === 'no-show') params.delete('cancellationReason');
    if (view === 'post-match-cancellations') {
      params.delete('age');
      params.delete('sla');
      if (!params.has('dateRange')) params.set('dateRange', '30d');
    } else {
      params.delete('dateRange');
      params.delete('dateFrom');
      params.delete('dateTo');
    }
  }
  if (view !== 'matching-delays' && view !== 'manual-decision' && view !== 'no-show') {
    params.delete('sla');
  }
  params.delete('page');
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function bookingPageHref({
  page,
  path,
  searchParams,
}: {
  readonly page: number;
  readonly path: string;
  readonly searchParams: readonly (readonly [string, string])[];
}) {
  const params = new URLSearchParams(searchParams.map(([key, value]) => [key, value]));
  if (page > 1) {
    params.set('page', String(page));
  } else {
    params.delete('page');
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function bookingSearchClearHref(path: string, searchParams: readonly (readonly [string, string])[]) {
  const params = new URLSearchParams(searchParams.map(([key, value]) => [key, value]));
  params.delete('page');
  params.delete('q');
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function bookingFilterResetHref(
  path: string,
  searchParams: readonly (readonly [string, string])[],
  view: BookingPageView,
) {
  const params = new URLSearchParams(searchParams.map(([key, value]) => [key, value]));
  for (const key of ['age', 'cancellationReason', 'dateFrom', 'dateTo', 'page', 'q', 'sla', 'sort']) {
    params.delete(key);
  }
  if (path === '/bookings/post-match-cancellations' && view === 'post-match-cancellations') {
    params.set('dateRange', '30d');
  } else if (path === '/bookings/post-match-cancellations') {
    params.delete('dateRange');
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function postMatchCancellationEmptyMessage(view: BookingPageView, hasActiveFilters: boolean) {
  if (hasActiveFilters) return 'No cancellation records match the current filters.';
  if (view === 'no-show') return 'No no-show cases currently need review.';
  if (view === 'manual-decision') return 'No cancellations currently need a decision.';
  return 'No resolved cancellation records are available in the selected decision period.';
}

export function bookingOperationsWorkspace(
  view: BookingPageView,
  activeViewLabel: string,
  activeViewDescription: string,
  pagePath: string,
  resultCount: number,
) {
  if (pagePath === '/bookings/completed') {
    const descriptions: Partial<Record<BookingPageView, string>> = {
      closeout: 'Completed services with one or more missing closeout records.',
      payment:
        'Includes cash commission, refund mismatch, unresolved authorization, and payment release exceptions.',
      pricing: 'Completed services whose booked price or Partner payout rule cannot be verified.',
      all: 'Completed, refunded, and expired records closed in the selected period.',
      expired: 'Expired booking records closed in the selected period.',
    };
    const historyView = view === 'expired' || view === 'all';
    return {
      description: descriptions[view] ?? activeViewDescription,
      detailPagePath: pagePath,
      detailView: view,
      title: activeViewLabel,
      tone: historyView
        ? ('neutral' as const)
        : resultCount > 0
          ? ('warning' as const)
          : ('success' as const),
    };
  }

  if (pagePath === '/bookings/post-match-cancellations') {
    return {
      description: 'Exact server-filtered matched cancellation queue for evidence and fee outcome review.',
      detailPagePath: pagePath,
      detailView: view,
      title: activeViewLabel,
      tone: view === 'post-match-cancellations' ? ('neutral' as const) : ('warning' as const),
    };
  }

  switch (view) {
    case 'attention':
      return {
        description: 'Stalled live bookings that need an operator decision or repair.',
        detailPagePath: pagePath,
        detailView: view,
        title: 'Needs action',
        tone: resultCount > 0 ? ('warning' as const) : ('success' as const),
      };
    case 'matching':
      return {
        description: 'Requests still waiting for a final Partner match.',
        detailPagePath: pagePath,
        detailView: view,
        title: 'Matching now',
        tone: 'info' as const,
      };
    case 'matching-delays':
      return {
        description:
          'Expired matching requests or requests past the configured wait threshold without participation.',
        detailPagePath: pagePath,
        detailView: view,
        title: 'Matching delays',
        tone: resultCount > 0 ? ('warning' as const) : ('success' as const),
      };
    case 'handoff-repair':
    case 'no-supply':
      return {
        description: activeViewDescription,
        detailPagePath: pagePath,
        detailView: view,
        title: activeViewLabel,
        tone: resultCount > 0 ? ('warning' as const) : ('success' as const),
      };
    case 'data-anomaly':
      return {
        description: 'Active-state records older than 24 hours, kept outside live operations for repair.',
        detailPagePath: pagePath,
        detailView: view,
        title: 'Data anomaly',
        tone: resultCount > 0 ? ('danger' as const) : ('success' as const),
      };
    case 'all':
    case 'pre-match-cancelled':
    case 'preferred-rejected':
    case 'preferred-no-response':
      return {
        description: 'Historical booking outcomes in the selected period.',
        detailPagePath: pagePath,
        detailView: view,
        title: view === 'all' ? 'Booking records' : activeViewLabel,
        tone: 'neutral' as const,
      };
    case 'active':
    case 'in-service':
      return {
        description: activeViewDescription,
        detailPagePath: pagePath,
        detailView: view,
        title: activeViewLabel,
        tone: 'info' as const,
      };
    default:
      return {
        description: activeViewDescription,
        detailPagePath: pagePath,
        detailView: view,
        title: activeViewLabel,
        tone: 'success' as const,
      };
  }
}

function setOptionalSearchParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function searchParamValue(searchParams: readonly (readonly [string, string])[], key: string) {
  return searchParams.find(([candidate]) => candidate === key)?.[1];
}

function bookingQueueHref({
  age,
  path,
  searchParams,
  sla,
  sort,
}: {
  readonly age?: ReturnType<typeof readAdminQueueAge>;
  readonly path: string;
  readonly searchParams: readonly (readonly [string, string])[];
  readonly sla?: ReturnType<typeof readAdminQueueSlaFilter>;
  readonly sort?: ReturnType<typeof readAdminQueueSort>;
}) {
  const params = new URLSearchParams(searchParams.map(([key, value]) => [key, value]));
  if (age) {
    setOptionalSearchParam(params, 'age', age === 'all' ? '' : age);
  }
  if (sort) {
    const view = searchParamValue(searchParams, 'view') ?? 'attention';
    const kind: BookingMonitorRouteKind =
      path === '/bookings/completed'
        ? 'completed'
        : path === '/bookings/post-match-cancellations'
          ? 'postMatchCancellations'
          : 'all';
    setOptionalSearchParam(params, 'sort', sort === bookingListDefaultSort(kind, view) ? '' : sort);
  }
  if (sla) {
    setOptionalSearchParam(params, 'sla', sla === 'all' ? '' : sla);
  }
  params.delete('page');
  const value = params.toString();
  return value ? `${path}?${value}` : path;
}
