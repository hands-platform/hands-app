'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuditLog, AdminBooking } from '../../lib/admin-api';
import { buildBookingLiveMatchingPolicyCards } from '../../lib/booking-live-matching-policy-cards';
import { compareBookingMonitorListOrder } from '../../lib/booking-monitor-list-order';
import { readPlainRecord } from '../../lib/admin-format';
import { type AdminLiveOperationsPolicy } from '../../lib/operations-policy';
import { bookingPrimaryCommandSummary } from '../../lib/booking-primary-command-summary';
import { bookingPrimaryCommandHref } from '../../lib/booking-primary-command-href';
import { emptyBookingMessage } from './booking-empty-message';
import {
  bookingTimestamp,
  formatBookingClockTime as formatClockTime,
  relativeTimeLabel,
} from './booking-list-time';
import {
  bookingGateMatchesFilter,
  buildBookingGateTriage,
  type BookingGateFilter,
} from './booking-gate-filters';
import { buildBookingGateRejectionLane } from './booking-gate-rejection-lane';
import {
  bookingPaymentFilterOptions,
  bookingStatusFilterOptions,
} from './booking-monitor-filter-options';
import {
  bookingEvidenceFilterOptions,
  bookingViewOptions,
} from './booking-monitor-options';
import { bookingMonitorSummaryRows } from './booking-monitor-summary';
import { BookingMonitorCommandCenterSection } from './booking-monitor-command-center-section';
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
import { buildBookingMonitorCommandDecisionStrip } from './booking-monitor-command-decision-model';
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
import { bookingMonitorMatchesView } from './booking-monitor-view-model';
import {
  buildBookingMonitorMarketplaceCoverageRows,
  buildBookingMonitorMarketplaceOperatingQueue,
  buildBookingMonitorMarketplaceOperationsCards,
  buildBookingMonitorMarketplaceParticipantLedgerRows,
} from './booking-monitor-marketplace-model';
import { buildBookingMonitorVisibleModel } from './booking-monitor-visible-model';
import { bookingMonitorMatchesEvidenceFilter } from './booking-monitor-evidence-model';
import { buildBookingMonitorListRow } from './booking-monitor-list-row-model';
import {
  buildMarketplaceBookingCoveragePills,
  buildMarketplaceBookingCoverageSummary,
} from '../../lib/marketplace-booking-coverage';
import {
  buildMarketplaceParticipantLedgerPills,
  buildMarketplaceParticipantLedgerSummary,
} from '../../lib/marketplace-participant-ledger';
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
  const orderedBookingCreateRejections = useMemo(
    () =>
      [...bookingCreateRejections].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [bookingCreateRejections],
  );
  const visibleBookingCreateRejections = useMemo(
    () => orderedBookingCreateRejections.filter((log) => bookingGateMatchesFilter(log, gateFilter)),
    [gateFilter, orderedBookingCreateRejections],
  );
  const bookingGateTriage = useMemo(
    () =>
      buildBookingGateTriage(orderedBookingCreateRejections, gateFilter, (log) =>
        relativeTimeLabel(log.createdAt, currentTimeMs),
      ),
    [currentTimeMs, gateFilter, orderedBookingCreateRejections],
  );

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
  const bookingGateRejectionLane = useMemo(
    () => buildBookingGateRejectionLane(orderedBookingCreateRejections, currentTimeMs),
    [currentTimeMs, orderedBookingCreateRejections],
  );
  const commandCenterWithGate = useMemo(
    () => [bookingGateRejectionLane, ...commandCenter],
    [bookingGateRejectionLane, commandCenter],
  );
  const primaryCommandQueue = useMemo(
    () =>
      bookingPrimaryCommandSummary(
        orderedBookings.map((booking) => {
          const strip = buildBookingMonitorCommandDecisionStrip(booking);
          return {
            bookingId: booking.id,
            href: bookingPrimaryCommandHref(strip.status),
            strip,
          };
        }),
      ),
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
      buildBookingMonitorVisibleModel({
        blockedCreateCount: orderedBookingCreateRejections.length,
        bookings: orderedBookings,
        evidenceFilter,
        matchers: {
          matchesEvidenceFilter: (booking, filter) =>
            bookingMonitorMatchesEvidenceFilter(booking, filter, currentTimeMs),
          matchesView: (booking, bookingView) =>
            bookingMonitorMatchesView(booking, bookingView, currentTimeMs),
        },
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
  const marketplaceLedgerRows = useMemo(
    () =>
      buildBookingMonitorMarketplaceParticipantLedgerRows(
        visibleBookings,
        currentTimeMs,
        liveOperationsPolicy.marketplaceRadiusMeters,
      ),
    [currentTimeMs, liveOperationsPolicy.marketplaceRadiusMeters, visibleBookings],
  );
  const marketplaceBookingCoverageRows = useMemo(
    () => buildBookingMonitorMarketplaceCoverageRows(visibleBookings, currentTimeMs),
    [currentTimeMs, visibleBookings],
  );
  const marketplaceBookingCoverageSummary = useMemo(
    () => buildMarketplaceBookingCoverageSummary(marketplaceBookingCoverageRows),
    [marketplaceBookingCoverageRows],
  );
  const marketplaceBookingCoveragePills = useMemo(
    () => buildMarketplaceBookingCoveragePills(marketplaceBookingCoverageSummary),
    [marketplaceBookingCoverageSummary],
  );
  const marketplaceLedgerSummary = useMemo(
    () => buildMarketplaceParticipantLedgerSummary(marketplaceLedgerRows),
    [marketplaceLedgerRows],
  );
  const marketplaceLedgerPills = useMemo(
    () => buildMarketplaceParticipantLedgerPills(marketplaceLedgerSummary),
    [marketplaceLedgerSummary],
  );
  const marketplaceOperationsCards = useMemo(
    () =>
      buildBookingMonitorMarketplaceOperationsCards(
        visibleBookings,
        marketplaceLedgerRows,
        currentTimeMs,
      ),
    [currentTimeMs, marketplaceLedgerRows, visibleBookings],
  );
  const marketplaceOperatingQueue = useMemo(
    () => buildBookingMonitorMarketplaceOperatingQueue(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
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
  const commandRouteModel = buildBookingMonitorCommandRouteModel({
    activeView,
    blockedCreateCount: orderedBookingCreateRejections.length,
    blockedCreateDetail: bookingGateRejectionLane.detail,
    bookingViewCounts,
    commandCenter,
    topNextAction: nextActions[0],
    view,
    visibleBookingCount: visibleBookings.length,
  });

  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      const mountedAt = new Date();
      setHasMounted(true);
      setLastRefreshLabel(formatClockTime(mountedAt));
      setNowMs(mountedAt.getTime());
    }, 0);

    if (!autoRefresh) {
      return () => window.clearTimeout(mountTimer);
    }

    const timer = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
        const refreshedAt = new Date();
        setLastRefreshLabel(formatClockTime(refreshedAt));
        setNowMs(refreshedAt.getTime());
      });
    }, 10000);

    return () => {
      window.clearTimeout(mountTimer);
      window.clearInterval(timer);
    };
  }, [autoRefresh, router]);

  const refreshNow = () => {
    startTransition(() => {
      router.refresh();
      const refreshedAt = new Date();
      setLastRefreshLabel(formatClockTime(refreshedAt));
      setNowMs(refreshedAt.getTime());
    });
  };
  const toggleAutoRefresh = () => setAutoRefresh((value) => !value);

  return (
    <>
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
        operatorRouteCards={commandRouteModel.operatorRouteCards}
        primaryCommandQueue={primaryCommandQueue}
      />

      <BookingMonitorLiveStatusSection
        hasMounted={hasMounted}
        isPending={isPending}
        lastRefreshLabel={lastRefreshLabel}
        summary={summary}
      />

      <BookingMonitorCommandCenterSection lanes={commandCenterWithGate} />

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
        onClearFilters={() => {
          setSearchQuery('');
          setStatusFilter('all');
          setPaymentFilter('all');
          setEvidenceFilter('all');
          setGateFilter('all');
        }}
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
        marketplaceBookingCoveragePills={marketplaceBookingCoveragePills}
        marketplaceBookingCoverageRows={marketplaceBookingCoverageRows}
        marketplaceBookingCoverageSummary={marketplaceBookingCoverageSummary}
        marketplaceLedgerPills={marketplaceLedgerPills}
        marketplaceLedgerRows={marketplaceLedgerRows}
        marketplaceLedgerSummary={marketplaceLedgerSummary}
        marketplaceOperatingQueue={marketplaceOperatingQueue}
        marketplaceOperationsCards={marketplaceOperationsCards}
      />

      <BookingMonitorListSection emptyMessage={emptyBookingMessage(view)} rows={bookingListRows} />
    </>
  );
}
