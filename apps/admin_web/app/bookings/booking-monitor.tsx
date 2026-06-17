'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuditLog, AdminBooking } from '../../lib/admin-api';
import { buildBookingLiveMatchingPolicyCards } from '../../lib/booking-live-matching-policy-cards';
import { compareBookingMonitorListOrder } from '../../lib/booking-monitor-list-order';
import { readPlainRecord } from '../../lib/admin-format';
import { type AdminLiveOperationsPolicy } from '../../lib/operations-policy';
import { emptyBookingMessage } from './booking-empty-message';
import {
  bookingTimestamp,
  formatBookingClockTime as formatClockTime,
} from './booking-list-time';
import type { BookingGateFilter } from './booking-gate-filters';
import {
  bookingPaymentFilterOptions,
  bookingStatusFilterOptions,
} from './booking-monitor-filter-options';
import {
  bookingEvidenceFilterOptions,
  bookingViewOptions,
} from './booking-monitor-options';
import { bookingMonitorSummaryRows } from './booking-monitor-summary';
import { BookingMonitorCommandRouteSections } from './booking-monitor-command-route-sections';
import { BookingMonitorBlockedCreateSection } from './booking-monitor-blocked-create-section';
import { BookingMonitorCustomerProtectionSection } from './booking-monitor-customer-protection-section';
import { buildBookingMonitorCustomerProtectionBoard } from './booking-monitor-customer-protection-model';
import { buildBookingDispatchPartnerShortcuts } from './booking-dispatch-partner-shortcuts';
import { bookingMatchingWindowLabel } from './booking-matching-window';
import { buildBookingMonitorMatchingFlowTimeline } from './booking-monitor-matching-flow';
import { BookingMonitorFiltersSection } from './booking-monitor-filters-section';
import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';
import { BookingMonitorListSection } from './booking-monitor-list-section';
import { buildBookingMonitorNextActions } from './booking-monitor-next-actions-model';
import { BookingMonitorMarketplaceSection } from './booking-monitor-marketplace-section';
import { BookingMonitorMatchingEscalationSection } from './booking-monitor-matching-escalation-section';
import { BookingMonitorNextActionsSection } from './booking-monitor-next-actions-section';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';
import { buildBookingMonitorCommandRouteModel } from './booking-monitor-command-route-model';
import { buildBookingMonitorCommandCenter } from './booking-monitor-command-center-model';
import { buildBookingMonitorSummaryFact } from './booking-monitor-summary-model';
import {
  buildBookingMonitorMatchingEscalationBoard,
  buildBookingMonitorMatchingEscalationRows,
} from './booking-monitor-matching-escalation-model';
import {
  bookingCustomerLabel,
  bookingProviderLabel,
} from './booking-monitor-labels';
import { buildBookingMonitorMarketplacePanelModel } from './booking-monitor-marketplace-model';
import { buildAdminBookingMonitorVisibleModel } from './booking-monitor-visible-model';
import { buildBookingMonitorListRow } from './booking-monitor-list-row-model';
import { buildBookingMonitorPrimaryCommandQueue } from './booking-monitor-primary-command-queue-model';
import { buildBookingMonitorGateModel } from './booking-monitor-gate-model';
import type { BookingEvidenceFilter, BookingPageView } from './booking-page-params';

type Props = {
  bookings: AdminBooking[];
  bookingCreateRejections?: AdminAuditLog[];
  initialView: BookingView;
  initialEvidenceFilter?: BookingEvidenceFilter;
  initialGateFilter?: BookingGateFilter;
  liveOperationsPolicy: AdminLiveOperationsPolicy;
};

type BookingView = BookingPageView;

export function BookingMonitor({
  bookings,
  bookingCreateRejections = [],
  initialView,
  initialEvidenceFilter = 'all',
  initialGateFilter = 'all',
  liveOperationsPolicy,
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
  const {
    bookingGateRejectionLane,
    bookingGateTriage,
    orderedBookingCreateRejections,
    visibleBookingCreateRejections,
  } = gateModel;

  const summary = useMemo(
    () =>
      bookingMonitorSummaryRows({
        blockedCreateAttemptCount: orderedBookingCreateRejections.length,
        bookings: orderedBookings.map((booking) => buildBookingMonitorSummaryFact(booking, currentTimeMs)),
      }),
    [currentTimeMs, orderedBookingCreateRejections.length, orderedBookings],
  );

  const commandCenter = useMemo(
    () => buildBookingMonitorCommandCenter(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const primaryCommandQueue = useMemo(
    () => buildBookingMonitorPrimaryCommandQueue(orderedBookings),
    [orderedBookings],
  );
  const nextActions = useMemo(
    () => buildBookingMonitorNextActions(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const customerProtectionBoard = useMemo(
    () => buildBookingMonitorCustomerProtectionBoard(orderedBookings),
    [orderedBookings],
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
        evidenceFilter,
        nowMs: currentTimeMs,
        paymentFilter,
        searchQuery,
        statusFilter,
        view,
      }),
    [
      currentTimeMs,
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
    () => visibleBookings.map((booking) => buildBookingMonitorListRow(booking, currentTimeMs, nowMs)),
    [currentTimeMs, nowMs, visibleBookings],
  );
  const marketplacePanel = useMemo(
    () =>
      buildBookingMonitorMarketplacePanelModel({
        marketplaceRadiusMeters: liveOperationsPolicy.marketplaceRadiusMeters,
        nowMs: currentTimeMs,
        orderedBookings,
        visibleBookings,
      }),
    [currentTimeMs, liveOperationsPolicy.marketplaceRadiusMeters, orderedBookings, visibleBookings],
  );

  const statusFilterOptions = useMemo(
    () => bookingStatusFilterOptions(orderedBookings),
    [orderedBookings],
  );
  const paymentFilterOptions = useMemo(
    () => bookingPaymentFilterOptions(orderedBookings),
    [orderedBookings],
  );

  const bookingViewCounts = visibleBookingModel.bookingViewCounts;
  const activeView = bookingViewOptions.find((item) => item.view === view) ?? bookingViewOptions[0];
  const commandRouteModel = useMemo(
    () =>
      buildBookingMonitorCommandRouteModel({
        activeView,
        blockedCreateCount: orderedBookingCreateRejections.length,
        blockedCreateDetail: bookingGateRejectionLane.detail,
        commandCenter,
        topNextAction: nextActions[0],
        view,
        visibleBookingCount: visibleBookings.length,
      }),
    [
      activeView,
      bookingGateRejectionLane.detail,
      commandCenter,
      nextActions,
      orderedBookingCreateRejections.length,
      view,
      visibleBookings.length,
    ],
  );
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setEvidenceFilter('all');
    setGateFilter('all');
  }, []);

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
        onRefreshNow={refreshNow}
        onToggleAutoRefresh={toggleAutoRefresh}
      />

      <BookingMonitorCommandRouteSections
        autoRefresh={autoRefresh}
        commandSummaryCards={commandRouteModel.commandSummaryCards}
        hasMounted={hasMounted}
        isPending={isPending}
        lastRefreshLabel={lastRefreshLabel}
        primaryCommandQueue={primaryCommandQueue}
      />

      <BookingMonitorLiveStatusSection
        hasMounted={hasMounted}
        isPending={isPending}
        lastRefreshLabel={lastRefreshLabel}
        summary={summary}
      />

      <BookingMonitorMatchingEscalationSection
        dispatchPartnerShortcuts={dispatchPartnerShortcuts}
        getCustomerLabel={bookingCustomerLabel}
        getMatchingWindowLabel={(booking) => bookingMatchingWindowLabel(booking, currentTimeMs)}
        livePolicyCards={livePolicyCards}
        matchingEscalationBoard={matchingEscalationBoard}
        matchingEscalationRows={matchingEscalationRows}
        matchingFlowTimeline={matchingFlowTimeline}
      />

      <BookingMonitorNextActionsSection
        getCustomerLabel={bookingCustomerLabel}
        getProviderLabel={bookingProviderLabel}
        nextActions={nextActions}
        nowMs={currentTimeMs}
      />

      <BookingMonitorCustomerProtectionSection
        getCustomerLabel={bookingCustomerLabel}
        lanes={customerProtectionBoard}
      />

      <BookingMonitorFiltersSection
        activeView={activeView}
        baseVisibleBookingCount={visibleBookingModel.baseVisibleBookingCount}
        evidenceFilter={evidenceFilter}
        evidenceFilterOptions={bookingEvidenceFilterOptions}
        onClearFilters={clearFilters}
        onEvidenceFilterChange={setEvidenceFilter}
        onPaymentFilterChange={setPaymentFilter}
        onSearchQueryChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onViewChange={setView}
        paymentFilter={paymentFilter}
        paymentFilterOptions={paymentFilterOptions}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        statusFilterOptions={statusFilterOptions}
        view={view}
        viewCounts={bookingViewCounts}
        viewOptions={bookingViewOptions}
        visibleBookingCount={visibleBookings.length}
      />

      {view === 'blocked-create' && (
        <BookingMonitorBlockedCreateSection
          bookingGateTriage={bookingGateTriage}
          gateFilter={gateFilter}
          onGateFilterChange={setGateFilter}
          orderedBookingCreateRejections={orderedBookingCreateRejections}
          visibleBookingCreateRejections={visibleBookingCreateRejections}
        />
      )}

      <BookingMonitorMarketplaceSection
        getCustomerLabel={bookingCustomerLabel}
        getMatchingWindowLabel={(booking) => bookingMatchingWindowLabel(booking, currentTimeMs)}
        marketplaceBookingCoveragePills={marketplacePanel.marketplaceBookingCoveragePills}
        marketplaceBookingCoverageRows={marketplacePanel.marketplaceBookingCoverageRows}
        marketplaceBookingCoverageSummary={marketplacePanel.marketplaceBookingCoverageSummary}
        marketplaceLedgerPills={marketplacePanel.marketplaceLedgerPills}
        marketplaceLedgerRows={marketplacePanel.marketplaceLedgerRows}
        marketplaceLedgerSummary={marketplacePanel.marketplaceLedgerSummary}
        marketplaceOperatingQueue={marketplacePanel.marketplaceOperatingQueue}
        marketplaceOperationsCards={marketplacePanel.marketplaceOperationsCards}
      />

      <BookingMonitorListSection emptyMessage={emptyBookingMessage(view)} rows={bookingListRows} />
    </div>
  );
}
