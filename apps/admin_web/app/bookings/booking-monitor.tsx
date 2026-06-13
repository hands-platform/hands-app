'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuditLog, AdminBooking } from '../../lib/admin-api';
import { buildBookingLiveMatchingPolicyCards } from '../../lib/booking-live-matching-policy-cards';
import {
  buildBookingMatchingEscalationBoard,
  type BookingMatchingEscalationLane,
} from '../../lib/booking-matching-escalation-board';
import {
  buildBookingMatchingEscalationRows as buildBookingMatchingEscalationRowsFromFacts,
  type BookingMatchingEscalationRow,
} from '../../lib/booking-matching-escalation-rows';
import { matchingPolicySummaryLabel } from '../../lib/booking-matching-rule-snapshot';
import { bookingRequestOpenedAt } from '../../lib/admin-booking-time';
import { compareBookingMonitorListOrder } from '../../lib/booking-monitor-list-order';
import { bookingCheckLevel } from '../../lib/booking-check-level';
import { readPlainRecord } from '../../lib/admin-format';
import { type AdminLiveOperationsPolicy } from '../../lib/operations-policy';
import { bookingPrimaryCommandSummary } from '../../lib/booking-primary-command-summary';
import { bookingPrimaryCommandHref } from '../../lib/booking-primary-command-href';
import { bookingMonitorAlertEvidenceNeedsOps } from './booking-monitor-alert-evidence-model';
import { emptyBookingMessage } from './booking-empty-message';
import {
  bookingRecencyLabel as recencyLabel,
  bookingTimestamp,
  formatBookingClockTime as formatClockTime,
  formatBookingDate as formatDate,
  relativeTimeLabel,
} from './booking-list-time';
import {
  bookingGateMatchesFilter,
  buildBookingGateTriage,
  type BookingGateFilter,
} from './booking-gate-filters';
import { buildBookingGateRejectionLane } from './booking-gate-rejection-lane';
import { bookingMatchingPolicySnapshot } from './booking-matching-policy-snapshot';
import {
  bookingServiceOptionLabel,
  bookingServicePayoutRuleLabel,
  bookingServicePriceLabel,
} from './booking-service-labels';
import {
  bookingPaymentFilterOptions,
  bookingStatusFilterOptions,
} from './booking-monitor-filter-options';
import {
  bookingEvidenceFilterOptions,
  bookingViewOptions,
} from './booking-monitor-options';
import { bookingMatchesMonitorEvidenceFilter } from './booking-monitor-evidence-match';
import { bookingMonitorEvidenceMatchReadersFromBooking } from './booking-monitor-evidence-match-readers';
import { bookingMatchesMonitorView } from './booking-monitor-view-match';
import { bookingMonitorViewMatchReadersFromBooking } from './booking-monitor-view-match-readers';
import {
  activeBookingStatuses as activeStatuses,
  bookingMonitorSummaryRows,
  type BookingMonitorSummaryFact,
} from './booking-monitor-summary';
import { bookingMonitorSummaryFactFromInputs } from './booking-monitor-summary-inputs';
import { BookingMonitorCommandCenterSection } from './booking-monitor-command-center-section';
import {
  bookingCommandCenterFromFacts,
  type BookingCommandCenterLane,
} from './booking-command-center-board';
import { BookingMonitorCommandRouteSections } from './booking-monitor-command-route-sections';
import { BookingMonitorBlockedCreateSection } from './booking-monitor-blocked-create-section';
import { BookingMonitorCustomerProtectionSection } from './booking-monitor-customer-protection-section';
import {
  bookingCustomerProtectionBoardFromFacts,
  type BookingCustomerProtectionLane,
} from './booking-customer-protection-board';
import {
  bookingChatRepairNeedsOps,
  bookingHasQuietHandoffChat,
  bookingMatchingChatReady,
} from './booking-chat-handoff-state';
import {
  bookingClosureListSignal,
  terminalBookingStatuses,
} from './booking-closure-list-signal';
import { buildBookingDispatchPartnerShortcuts } from './booking-dispatch-partner-shortcuts';
import {
  bookingMatchingWindowExpired,
  bookingMatchingWindowLabel,
} from './booking-matching-window';
import {
  bookingCustomerSelectableCount,
  bookingMarketplaceCountFacts,
  bookingMarketplaceParticipantCount,
  bookingMarketplaceParticipants,
} from './booking-marketplace-count-facts';
import { bookingMatchingEscalationNeedsOps } from './booking-matching-escalation-needs-ops';
import { bookingMatchingEscalationBoardInput } from './booking-matching-escalation-board-inputs';
import { bookingMatchingEscalationRowInputFromBooking } from './booking-matching-escalation-row-inputs';
import { buildBookingMonitorMatchingFlowTimeline } from './booking-monitor-matching-flow';
import {
  bookingMonitorSelectionCopy,
  bookingMonitorSelectionLabelForBooking,
  bookingMonitorSelectionPathLabelForBooking,
} from './booking-monitor-selection-model';
import {
  bookingMonitorListCashDebtAmountLabel,
  bookingMonitorListFirstPickPhoneLabel,
} from './booking-monitor-list-labels';
import { bookingMonitorListBackupAlert } from './booking-monitor-list-backup-alert';
import {
  bookingMonitorListMarketplaceParticipantOverflowCount,
  bookingMonitorListMarketplaceParticipants,
  bookingMonitorListSelectedFinalPartnerPillLabel,
} from './booking-monitor-list-marketplace';
import {
  bookingIsBackupSelected,
  bookingPreferredAwaitingDecision as bookingFirstPickPending,
  bookingPreferredProviderStateLabel,
} from './booking-preferred-provider-state';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
  bookingCustomerProtectionFactsFromBookings,
} from './booking-payment-closeout-facts';
import { bookingListActionChips } from './booking-list-action-chip-inputs';
import { BookingMonitorFiltersSection } from './booking-monitor-filters-section';
import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';
import {
  BookingMonitorListSection,
  type BookingMonitorListRow,
} from './booking-monitor-list-section';
import {
  buildBookingMonitorAddressState,
  buildBookingMonitorChatState,
  buildBookingMonitorListLocation,
} from './booking-monitor-list-state-model';
import { buildBookingMonitorCustomerVisibleStateLabel } from './booking-monitor-customer-visible-model';
import { bookingMonitorCheckFlags } from './booking-monitor-check-flags-model';
import { buildBookingMonitorCommandDecisionStrip } from './booking-monitor-command-decision-model';
import { buildBookingMonitorListStage } from './booking-monitor-list-stage-model';
import { bookingMonitorNextActionLabel } from './booking-monitor-next-action-label';
import { buildBookingMonitorNextActions } from './booking-monitor-next-actions-model';
import { BookingMonitorMarketplaceSection } from './booking-monitor-marketplace-section';
import { BookingMonitorMatchingEscalationSection } from './booking-monitor-matching-escalation-section';
import { BookingMonitorNextActionsSection } from './booking-monitor-next-actions-section';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';
import { buildBookingMonitorCommandRouteModel } from './booking-monitor-command-route-model';
import {
  bookingMonitorAddressNeedsOps,
  bookingMonitorChatEvidenceNeedsOps,
  bookingMonitorDecisionEvidenceMissing,
  bookingMonitorLocationNeedsOps,
  bookingMonitorManualDecisionNeedsOps,
  bookingMonitorPaymentNeedsOps,
  bookingMonitorRefundReviewNeedsOps,
} from './booking-monitor-ops-state-model';
import {
  bookingCustomerLabel,
  bookingProviderLabel,
  partnerDisplayName,
} from './booking-monitor-labels';
import { buildBookingMonitorFinalGateReason } from './booking-monitor-final-gate-model';
import { buildBookingMonitorMatchingRuleSnapshot } from './booking-monitor-matching-rule-model';
import { bookingMonitorOpsSignal } from './booking-monitor-ops-signal';
import {
  bookingMonitorPricingPolicyNeedsOps,
  buildBookingMonitorPricingPolicySignal,
} from './booking-monitor-pricing-policy-model';
import {
  buildBookingMonitorMarketplaceCoverageRows,
  buildBookingMonitorMarketplaceOperatingQueue,
  buildBookingMonitorMarketplaceOperationsCards,
  buildBookingMonitorMarketplaceParticipantLedgerRows,
} from './booking-monitor-marketplace-model';
import { buildBookingMonitorVisibleModel } from './booking-monitor-visible-model';
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

type BookingCommandLane = BookingCommandCenterLane;

type BookingProtectionLane = BookingCustomerProtectionLane<AdminBooking>;

type AdminBookingMatchingEscalationLane = BookingMatchingEscalationLane<AdminBooking>;
type AdminBookingMatchingEscalationRow = BookingMatchingEscalationRow<AdminBooking>;

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
    () => buildBookingCommandCenter(orderedBookings, currentTimeMs),
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
    () => buildCustomerProtectionBoard(orderedBookings),
    [orderedBookings],
  );
  const matchingEscalationBoard = useMemo(
    () => buildMatchingEscalationBoard(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const livePolicyCards = useMemo(
    () => buildBookingLiveMatchingPolicyCards(liveOperationsPolicy),
    [liveOperationsPolicy],
  );
  const matchingEscalationRows = useMemo(
    () => buildMatchingEscalationRows(orderedBookings, currentTimeMs),
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
            bookingMatchesEvidenceFilter(booking, filter, currentTimeMs),
          matchesView: (booking, bookingView) => bookingMatchesView(booking, bookingView, currentTimeMs),
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
function buildBookingMonitorListRow(
  booking: AdminBooking,
  currentTimeMs: number,
  nowMs: number | null,
): BookingMonitorListRow {
  const flags = bookingMonitorCheckFlags(booking, currentTimeMs);
  const matchingPolicy = bookingMatchingPolicySnapshot(booking);
  const marketplaceParticipantRows = bookingMarketplaceParticipants(booking);
  const cashDebtNeedsOps = bookingCashDebtNeedsOps(booking);

  return {
    actionChips: bookingListActionChips(booking, currentTimeMs),
    addressState: buildBookingMonitorAddressState(booking),
    backupAlert: bookingMonitorListBackupAlert(booking, currentTimeMs),
    booking,
    cashDebtAmountLabel: bookingMonitorListCashDebtAmountLabel(booking, cashDebtNeedsOps),
    cashDebtNeedsOps,
    chatState: buildBookingMonitorChatState(booking),
    checkSignal: bookingCheckLevel(flags),
    closureState: bookingClosureListSignal(booking, { formatDate }),
    commandDecisionStrip: buildBookingMonitorCommandDecisionStrip(booking),
    customerVisibleStateLabel: buildBookingMonitorCustomerVisibleStateLabel(booking),
    expiresAtLabel: booking.expiresAt ? formatDate(booking.expiresAt) : null,
    finalGateReason: buildBookingMonitorFinalGateReason(booking),
    finalPartnerLabel: booking.selectedProvider ? partnerDisplayName(booking.selectedProvider) : null,
    firstCheckTitle: flags[0]?.title ?? null,
    firstPickPhoneLabel: bookingMonitorListFirstPickPhoneLabel(booking),
    hasMatchingPolicySnapshot: Boolean(matchingPolicy),
    location: buildBookingMonitorListLocation(booking, currentTimeMs),
    matchingPolicySummaryLabel: matchingPolicySummaryLabel(matchingPolicy),
    matchingRuleSnapshot: buildBookingMonitorMatchingRuleSnapshot(booking, currentTimeMs),
    marketplaceParticipantOverflowCount:
      bookingMonitorListMarketplaceParticipantOverflowCount(marketplaceParticipantRows),
    marketplaceParticipants: bookingMonitorListMarketplaceParticipants(marketplaceParticipantRows),
    nextActionLabel: bookingMonitorNextActionLabel(booking),
    openedDateLabel: formatDate(bookingRequestOpenedAt(booking)),
    opsSignal: bookingMonitorOpsSignal(booking),
    preferredPartnerLabel: partnerDisplayName(booking.preferredProvider, 'none'),
    preferredProviderStateLabel: booking.preferredProvider
      ? bookingPreferredProviderStateLabel(booking)
      : null,
    pricingPolicy: buildBookingMonitorPricingPolicySignal(booking),
    recencyLabel: recencyLabel(booking, nowMs),
    selectedFinalPartnerPillLabel: bookingMonitorListSelectedFinalPartnerPillLabel(booking),
    selection: bookingMonitorListSelection(booking),
    serviceOptionLabel: bookingServiceOptionLabel(booking),
    servicePayoutLabel: bookingServicePayoutRuleLabel(booking) ?? null,
    servicePriceLabel: bookingServicePriceLabel(booking),
    stage: buildBookingMonitorListStage(booking, currentTimeMs),
  };
}
function bookingMonitorListSelection(booking: AdminBooking): BookingMonitorListRow['selection'] {
  return bookingMonitorSelectionCopy(booking);
}

function buildBookingCommandCenter(bookings: AdminBooking[], nowMs: number): BookingCommandLane[] {
  return bookingCommandCenterFromFacts(buildBookingCommandCenterFacts(bookings, nowMs));
}

function buildBookingCommandCenterFacts(bookings: AdminBooking[], nowMs: number) {
  const active = bookings.filter((booking) => activeStatuses.has(booking.status));
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');

  return {
    active,
    backupSelected: bookings.filter((booking) => bookingIsBackupSelected(booking)),
    cashDebt: bookings.filter((booking) => bookingCashDebtNeedsOps(booking)),
    chatEvidence: bookings.filter((booking) => bookingMonitorChatEvidenceNeedsOps(booking, nowMs)),
    chatReady: bookings.filter((booking) => bookingMatchingChatReady(booking)),
    closeoutChecks: bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking)),
    evidenceMissing: bookings.filter((booking) => bookingMonitorDecisionEvidenceMissing(booking, nowMs)),
    expiredMatching: open.filter(
      (booking) => booking.expiresAt && new Date(booking.expiresAt).getTime() < nowMs,
    ),
    locationChecks: bookings.filter((booking) => bookingMonitorLocationNeedsOps(booking, nowMs)),
    matchedWithoutChat: bookings.filter((booking) => bookingChatRepairNeedsOps(booking)),
    missingAuthorizedPaymentRefs: bookings.filter(
      (booking) => booking.payment?.status === 'AUTHORIZED' && !booking.payment.providerRef,
    ),
    noShow: bookings.filter((booking) => booking.status === 'NO_SHOW'),
    noSupply: open.filter((booking) => (booking.participants?.length ?? 0) === 0),
    open,
    paymentChecks: bookings.filter((booking) => bookingMonitorPaymentNeedsOps(booking)),
    preferredPending: open.filter((booking) => bookingFirstPickPending(booking)),
    pricingChecks: bookings.filter((booking) => bookingMonitorPricingPolicyNeedsOps(booking)),
    quietChat: bookings.filter((booking) => bookingHasQuietHandoffChat(booking)),
    refundReview: bookings.filter((booking) => bookingMonitorRefundReviewNeedsOps(booking)),
  };
}

function buildCustomerProtectionBoard(bookings: AdminBooking[]): BookingProtectionLane[] {
  return bookingCustomerProtectionBoardFromFacts(bookingCustomerProtectionFactsFromBookings(bookings));
}

function buildMatchingEscalationBoard(
  bookings: AdminBooking[],
  nowMs: number,
): readonly AdminBookingMatchingEscalationLane[] {
  return buildBookingMatchingEscalationBoard(buildMatchingEscalationFacts(bookings, nowMs));
}

function buildMatchingEscalationFacts(bookings: AdminBooking[], nowMs: number) {
  return bookingMatchingEscalationBoardInput(
    bookings.map((booking) => ({
      booking,
      customerSelectableCount: bookingCustomerSelectableCount(booking),
      firstPickPending: bookingFirstPickPending(booking),
      hasChatRoom: bookingMatchingChatReady(booking),
      marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
      responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
      status: booking.status,
    })),
  );
}

function buildBookingMonitorSummaryFact(booking: AdminBooking, nowMs: number): BookingMonitorSummaryFact {
  return bookingMonitorSummaryFactFromInputs({
    addressNeedsOps: bookingMonitorAddressNeedsOps(booking),
    backupSelected: bookingIsBackupSelected(booking),
    checkSeverities: bookingMonitorCheckFlags(booking, nowMs).map((flag) => flag.severity),
    chatEvidenceNeedsOps: bookingMonitorChatEvidenceNeedsOps(booking, nowMs),
    chatRepairNeedsOps: bookingChatRepairNeedsOps(booking),
    closeoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    decisionEvidenceMissing: bookingMonitorDecisionEvidenceMissing(booking, nowMs),
    firstPickPending: bookingFirstPickPending(booking),
    locationNeedsOps: bookingMonitorLocationNeedsOps(booking, nowMs),
    marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    matchingChatReady: bookingMatchingChatReady(booking),
    participantCount: booking.participants?.length ?? 0,
    paymentNeedsOps: bookingMonitorPaymentNeedsOps(booking),
    policySnapshotPresent: Boolean(bookingMatchingPolicySnapshot(booking)),
    pricingPolicyNeedsOps: bookingMonitorPricingPolicyNeedsOps(booking),
    refundReviewNeedsOps: bookingMonitorRefundReviewNeedsOps(booking),
    stageKey: buildBookingMonitorListStage(booking, nowMs).key,
    status: booking.status,
  });
}

function buildMatchingEscalationRows(
  bookings: AdminBooking[],
  nowMs: number,
): readonly AdminBookingMatchingEscalationRow[] {
  return buildBookingMatchingEscalationRowsFromFacts(
    bookings.map((booking) => {
      const counts = bookingMarketplaceCountFacts(booking);
      return bookingMatchingEscalationRowInputFromBooking(booking, nowMs, {
        marketplaceCount: counts.marketplaceParticipantCount,
        preferredAwaitingDecision: bookingFirstPickPending(booking),
        selectableCount: counts.customerSelectableCount,
        selectionLabel: bookingMonitorSelectionLabelForBooking(booking),
        selectionPathLabel: bookingMonitorSelectionPathLabelForBooking(booking),
      });
    }),
  );
}

function bookingMatchesView(booking: AdminBooking, view: BookingView, nowMs: number) {
  return bookingMatchesMonitorView(
    view,
    bookingMonitorViewMatchReadersFromBooking(booking, {
      addressNeedsOps: () => bookingMonitorAddressNeedsOps(booking),
      cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
      chatEvidenceNeedsOps: () => bookingMonitorChatEvidenceNeedsOps(booking, nowMs),
      closeoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
      decisionEvidenceMissing: () => bookingMonitorDecisionEvidenceMissing(booking, nowMs),
      highPriorityCheck: () =>
        bookingMonitorCheckFlags(booking, nowMs).some((flag) => flag.severity === 'high'),
      locationNeedsOps: () => bookingMonitorLocationNeedsOps(booking, nowMs),
      manualDecisionNeedsOps: () => bookingMonitorManualDecisionNeedsOps(booking),
      matchingEscalationNeedsOps: () =>
        bookingMatchingEscalationNeedsOps(booking, {
          hasChatRoom: bookingMatchingChatReady(booking),
          responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
        }),
      paymentNeedsOps: () => bookingMonitorPaymentNeedsOps(booking),
      pricingPolicyNeedsOps: () => bookingMonitorPricingPolicyNeedsOps(booking),
      refundReviewNeedsOps: () => bookingMonitorRefundReviewNeedsOps(booking),
      stageKey: () => buildBookingMonitorListStage(booking, nowMs).key,
    }),
  );
}

function bookingMatchesEvidenceFilter(
  booking: AdminBooking,
  evidenceFilter: BookingEvidenceFilter,
  nowMs: number,
) {
  return bookingMatchesMonitorEvidenceFilter(
    evidenceFilter,
    bookingMonitorEvidenceMatchReadersFromBooking(booking, {
      addressNeedsOps: () => bookingMonitorAddressNeedsOps(booking),
      alertEvidenceNeedsOps: () => bookingMonitorAlertEvidenceNeedsOps(booking, nowMs),
      cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
      closeoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
      locationNeedsOps: () => bookingMonitorLocationNeedsOps(booking, nowMs),
      paymentNeedsOps: () => bookingMonitorPaymentNeedsOps(booking),
    }),
  );
}
