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
import {
  buildBookingMatchingFlowTimeline,
  type BookingMatchingFlowStep,
} from '../../lib/booking-matching-flow-timeline';
import {
  buildBookingMatchingRuleSnapshot,
  matchingPolicySummaryLabel,
  type BookingMatchingRuleSnapshot,
} from '../../lib/booking-matching-rule-snapshot';
import { bookingRequestOpenedAt } from '../../lib/admin-booking-time';
import {
  bookingListActionChipsFromFacts,
  type BookingListActionChip,
} from '../../lib/booking-list-action-chips';
import {
  bookingListStageFromFacts,
  type BookingListStage,
} from '../../lib/booking-list-stage';
import { compareBookingMonitorListOrder } from '../../lib/booking-monitor-list-order';
import {
  bookingCheckLevel,
  type BookingCheckLevelFlag as BookingCheckFlag,
} from '../../lib/booking-check-level';
import { bookingMonitorCheckFlagsFromFacts } from '../../lib/booking-monitor-check-flags';
import {
  buildBookingCommandSummaryCards,
  buildBookingOperatorRouteCards,
} from '../../lib/booking-command-route-cards';
import { marketplaceDisplayText as displayMarketplaceText } from '../../lib/admin-copy';
import {
  formatMoney as money,
  readPlainRecord,
} from '../../lib/admin-format';
import { type AdminLiveOperationsPolicy } from '../../lib/operations-policy';
import {
  bookingLocationNeedsOpsFromFacts,
  hasProviderCoordinate,
} from '../../lib/booking-status-location-helpers';
import { bookingCommandDecisionStrip } from '../../lib/booking-command-decision-strip';
import { bookingAddressSnapshotStateFromFacts } from '../../lib/booking-address-snapshot-state';
import { bookingChatListStateFromFacts } from '../../lib/booking-chat-list-state';
import { bookingFinalGateReason as buildBookingFinalGateReasonFromFacts } from '../../lib/booking-final-gate-reason';
import { bookingPrimaryCommandSummary } from '../../lib/booking-primary-command-summary';
import { bookingPrimaryCommandHref } from '../../lib/booking-primary-command-href';
import { bookingNextActionCopy } from '../../lib/booking-next-action-copy';
import {
  bookingPricingPolicySignalFromFacts,
  type BookingPricingPolicySignal,
} from '../../lib/booking-pricing-policy-signal';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import { bookingAlertEvidenceNeedsOpsFromFacts } from './booking-alert-evidence-needs-ops';
import { coordinatePairLabel, readAddressText } from './booking-address-readers';
import {
  actionOrderLabel,
  bookingDashboardTone,
  commandToneClass,
  commandToneLabel,
  type BookingActionPriority,
  type BookingCommandTone,
} from './booking-command-display';
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
import { bookingGateReasonCode } from './booking-gate-rejections';
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
import {
  bookingCheckFlagSeverityWeight,
  bookingNextActionPriorityFromFacts,
} from './booking-next-action-priority';
import {
  bookingNextActionOwnerFromFacts,
  type BookingNextActionOwner,
} from './booking-next-action-owner';
import { orderedBookingNextActions } from './booking-next-action-order';
import { bookingNextOperatorActionFromFacts } from './booking-next-operator-action';
import { bookingMatchesMonitorBasicFilters } from './booking-monitor-basic-filters';
import { bookingMatchesMonitorEvidenceFilter } from './booking-monitor-evidence-match';
import { bookingMatchesMonitorView } from './booking-monitor-view-match';
import {
  activeBookingStatuses as activeStatuses,
  bookingMonitorSummaryRows,
  type BookingMonitorSummaryFact,
} from './booking-monitor-summary';
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
import { bookingCustomerVisibleStateLabel } from './booking-customer-visible-state';
import {
  bookingChatQuietNeedsOps,
  bookingChatRepairNeedsOps,
  bookingHasQuietHandoffChat,
  bookingMatchingChatReady,
  isHandoffBookingStatus,
} from './booking-chat-handoff-state';
import {
  bookingClosureListSignal,
  terminalBookingStatuses,
} from './booking-closure-list-signal';
import {
  bookingDispatchPartnerShortcutFacts as buildBookingDispatchPartnerShortcutFactsFromFacts,
} from './booking-dispatch-partner-shortcut-facts';
import {
  bookingMatchingWindowExpired,
  bookingMatchingWindowLabel,
} from './booking-matching-window';
import { bookingMarketplaceCoverageInput } from './booking-marketplace-coverage-inputs';
import { bookingMarketplaceOperatingQueueFact } from './booking-marketplace-operating-queue-inputs';
import { bookingMarketplaceParticipantLedgerInputs } from './booking-marketplace-participant-ledger-inputs';
import { bookingMatchingEscalationNeedsOps } from './booking-matching-escalation-needs-ops';
import { bookingMatchingEscalationBoardInput } from './booking-matching-escalation-board-inputs';
import { bookingMatchingEscalationRowInput } from './booking-matching-escalation-row-inputs';
import { bookingMatchingFlowTimelineInput } from './booking-matching-flow-timeline-inputs';
import {
  bookingMonitorSelectionFromFacts,
  bookingMonitorSelectionLabel,
  bookingMonitorSelectionPathLabel,
  bookingMonitorSelectionToneClass,
} from './booking-monitor-selection';
import { bookingMonitorSelectionFactsFromBooking } from './booking-monitor-selection-inputs';
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
  bookingFinalPartnerLabel,
  bookingHasFinalPartner,
} from './booking-final-partner-state';
import { bookingMarketplaceOperationsBookingFact } from './booking-marketplace-operations-card-inputs';
import {
  bookingIsBackupSelected,
  bookingIsSelectedProviderParticipant,
  bookingPreferredAwaitingDecision,
  bookingPreferredProviderStateLabel,
} from './booking-preferred-provider-state';
import {
  bookingLocationPillLabel,
  bookingLocationSignalLabel,
  bookingLocationToneClass,
  providerLocationFreshness,
} from './booking-location-display';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
  bookingCustomerProtectionFactsFromBookings,
} from './booking-payment-closeout-facts';
import { BookingMonitorFiltersSection } from './booking-monitor-filters-section';
import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';
import {
  BookingMonitorListSection,
  type BookingMonitorListRow,
} from './booking-monitor-list-section';
import { BookingMonitorMarketplaceSection } from './booking-monitor-marketplace-section';
import { BookingMonitorMatchingEscalationSection } from './booking-monitor-matching-escalation-section';
import { BookingMonitorNextActionsSection } from './booking-monitor-next-actions-section';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';
import { bookingMatchesSearch } from './booking-search';
import {
  buildMarketplaceBookingCoverageRows as buildMarketplaceBookingCoverageRowsFromFacts,
  buildMarketplaceBookingCoveragePills,
  buildMarketplaceBookingCoverageSummary,
  type MarketplaceBookingCoverageRow,
} from '../../lib/marketplace-booking-coverage';
import {
  buildMarketplaceOperationsCardCounts,
  buildMarketplaceOperationsCards as buildMarketplaceOperationsCardItems,
  type MarketplaceOperationsCard,
} from '../../lib/marketplace-operations-cards';
import {
  buildMarketplaceParticipantLedgerRows as buildMarketplaceParticipantLedgerRowsFromFacts,
  buildMarketplaceParticipantLedgerPills,
  buildMarketplaceParticipantLedgerSummary,
  type MarketplaceParticipantLedgerRow,
} from '../../lib/marketplace-participant-ledger';
import {
  buildMarketplaceOperatingQueueBuckets,
  buildMarketplaceOperatingQueueItems,
  type MarketplaceOperatingQueueItem,
} from '../../lib/marketplace-operating-queue';
import {
  bookingManualDecisionNeedsOpsFromFacts,
  bookingPaymentOutcomeNeedsReview,
  bookingPaymentNeedsOpsFromFacts,
  bookingRefundReviewNeedsOpsFromFacts,
} from '../../lib/booking-payment-ops';
import { bookingFinalGateReasonPresentation } from '../../lib/booking-final-gate-reason';
import {
  bookingCustomerSelectableParticipantsForBooking as buildBookingCustomerSelectableParticipants,
  bookingMarketplaceParticipantsForBooking as buildBookingMarketplaceParticipants,
} from '../../lib/booking-participant-choice';
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

type BookingNextAction = {
  booking: AdminBooking;
  title: string;
  detail: string;
  operatorAction: string;
  owner: BookingNextActionOwner;
  priority: BookingActionPriority;
  tone: BookingCommandTone;
  href: string;
  tags: string[];
};

type BookingProtectionLane = BookingCustomerProtectionLane<AdminBooking>;

type AdminBookingMatchingEscalationLane = BookingMatchingEscalationLane<AdminBooking>;
type AdminBookingMatchingEscalationRow = BookingMatchingEscalationRow<AdminBooking>;

type AdminBookingMatchingFlowStep = BookingMatchingFlowStep<AdminBooking>;

type BookingDispatchPartnerShortcut = {
  title: string;
  value: string;
  detail: string;
  href: string;
  tone: BookingCommandLane['tone'];
};

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

type AdminMarketplaceParticipantLedgerRow = MarketplaceParticipantLedgerRow<AdminBooking, BookingParticipant>;

type AdminMarketplaceBookingCoverageRow = MarketplaceBookingCoverageRow<AdminBooking>;

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
        bookings: orderedBookings.map((booking) => bookingMonitorSummaryFact(booking, currentTimeMs)),
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
          const strip = bookingListCommandDecisionStrip(booking);
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
    () => buildBookingNextActions(orderedBookings, currentTimeMs),
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
    () => buildMatchingFlowTimeline(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );
  const dispatchPartnerShortcuts = useMemo(
    () => buildBookingDispatchPartnerShortcuts(orderedBookings, currentTimeMs),
    [currentTimeMs, orderedBookings],
  );

  const baseVisibleBookings = useMemo(() => {
    if (view === 'blocked-create') {
      return [];
    }
    return orderedBookings.filter((booking) => bookingMatchesView(booking, view, currentTimeMs));
  }, [currentTimeMs, orderedBookings, view]);

  const visibleBookings = useMemo(() => {
    return baseVisibleBookings.filter(
      (booking) =>
        bookingMatchesSearch(booking, searchQuery) &&
        bookingMatchesMonitorBasicFilters({
          paymentFilter,
          paymentMethod: booking.payment?.method,
          status: booking.status,
          statusFilter,
        }) &&
        bookingMatchesEvidenceFilter(booking, evidenceFilter, currentTimeMs),
    );
  }, [baseVisibleBookings, currentTimeMs, evidenceFilter, paymentFilter, searchQuery, statusFilter]);
  const bookingListRows = useMemo(
    () => visibleBookings.map((booking) => buildBookingMonitorListRow(booking, currentTimeMs, nowMs)),
    [currentTimeMs, nowMs, visibleBookings],
  );
  const marketplaceLedgerRows = useMemo(
    () =>
      buildMarketplaceParticipantLedgerRows(
        visibleBookings,
        currentTimeMs,
        liveOperationsPolicy.marketplaceRadiusMeters,
      ),
    [currentTimeMs, liveOperationsPolicy.marketplaceRadiusMeters, visibleBookings],
  );
  const marketplaceBookingCoverageRows = useMemo(
    () => buildMarketplaceBookingCoverageRows(visibleBookings, currentTimeMs),
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
    () => buildMarketplaceOperationsCards(visibleBookings, marketplaceLedgerRows, currentTimeMs),
    [currentTimeMs, marketplaceLedgerRows, visibleBookings],
  );
  const marketplaceOperatingQueue = useMemo(
    () => buildMarketplaceOperatingQueue(orderedBookings, currentTimeMs),
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

  const bookingViewCounts = useMemo(
    () =>
      new Map(
        bookingViewOptions.map((option) => [
          option.view,
          option.view === 'blocked-create'
            ? orderedBookingCreateRejections.length
            : orderedBookings.filter((booking) => bookingMatchesView(booking, option.view, currentTimeMs))
                .length,
        ]),
      ),
    [currentTimeMs, orderedBookingCreateRejections.length, orderedBookings],
  );
  const activeView = bookingViewOptions.find((item) => item.view === view) ?? bookingViewOptions[0];
  const topNextAction = nextActions[0];
  const dispatchCommandLane =
    commandCenter.find((lane) => lane.title === 'Dispatch pressure') ?? commandCenter[0];
  const protectionCommandLane =
    commandCenter.find((lane) => lane.title === 'Customer protection') ?? commandCenter[1];
  const paymentCommandLane =
    commandCenter.find((lane) => lane.title === 'Payment closeout') ?? commandCenter[2];
  const handoffCommandLane =
    commandCenter.find((lane) => lane.title === 'Handoff quality') ?? commandCenter[3];
  const topActionCard = topNextAction
    ? {
        actionLabel: actionOrderLabel(topNextAction.priority),
        href: topNextAction.href,
        operatorAction: topNextAction.operatorAction,
        owner: topNextAction.owner,
        priority: topNextAction.priority,
      }
    : undefined;
  const commandSummaryCards = buildBookingCommandSummaryCards({
    activeView: {
      label: activeView.label,
      operatorHint: activeView.operatorHint,
      view,
    },
    blockedCreateCount: orderedBookingCreateRejections.length,
    blockedCreateDetail: bookingGateRejectionLane.detail,
    lanes: {
      dispatch: dispatchCommandLane,
      handoff: handoffCommandLane,
      payment: paymentCommandLane,
      protection: protectionCommandLane,
    },
    topAction: topActionCard,
    visibleBookingCount: visibleBookings.length,
  });
  const operatorRouteCards = buildBookingOperatorRouteCards({
    blockedCreateCount: orderedBookingCreateRejections.length,
    blockedCreateDetail: bookingGateRejectionLane.detail,
    bookingViewCounts,
    topAction: topActionCard,
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
        commandSummaryCards={commandSummaryCards}
        hasMounted={hasMounted}
        isPending={isPending}
        lastRefreshLabel={lastRefreshLabel}
        operatorRouteCards={operatorRouteCards}
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
        baseVisibleBookingCount={baseVisibleBookings.length}
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
  const flags = bookingCheckFlags(booking, currentTimeMs);
  const matchingPolicy = bookingMatchingPolicySnapshot(booking);
  const marketplaceParticipantRows = marketplaceParticipants(booking);
  const cashDebtNeedsOps = bookingCashDebtNeedsOps(booking);

  return {
    actionChips: bookingListActionChips(booking, currentTimeMs),
    addressState: bookingAddressSnapshotState(booking),
    backupAlert: bookingMonitorListBackupAlert(booking, currentTimeMs),
    booking,
    cashDebtAmountLabel: bookingMonitorListCashDebtAmountLabel(booking, cashDebtNeedsOps),
    cashDebtNeedsOps,
    chatState: bookingChatListState(booking),
    checkSignal: bookingCheckLevel(flags),
    closureState: bookingClosureListSignal(booking, { formatDate }),
    commandDecisionStrip: bookingListCommandDecisionStrip(booking),
    customerVisibleStateLabel: customerVisibleStateLabel(booking),
    expiresAtLabel: booking.expiresAt ? formatDate(booking.expiresAt) : null,
    finalGateReason: bookingFinalGateReason(booking),
    finalPartnerLabel: booking.selectedProvider ? partnerDisplayName(booking.selectedProvider) : null,
    firstCheckTitle: flags[0]?.title ?? null,
    firstPickPhoneLabel: bookingMonitorListFirstPickPhoneLabel(booking),
    hasMatchingPolicySnapshot: Boolean(matchingPolicy),
    location: bookingMonitorListLocation(booking, currentTimeMs),
    matchingPolicySummaryLabel: matchingPolicySummaryLabel(matchingPolicy),
    matchingRuleSnapshot: bookingMatchingRuleSnapshot(booking, currentTimeMs),
    marketplaceParticipantOverflowCount:
      bookingMonitorListMarketplaceParticipantOverflowCount(marketplaceParticipantRows),
    marketplaceParticipants: bookingMonitorListMarketplaceParticipants(marketplaceParticipantRows),
    nextActionLabel: nextAction(booking),
    openedDateLabel: formatDate(bookingRequestOpenedAt(booking)),
    opsSignal: opsSignal(booking),
    preferredPartnerLabel: partnerDisplayName(booking.preferredProvider, 'none'),
    preferredProviderStateLabel: booking.preferredProvider
      ? bookingPreferredProviderStateLabel(booking)
      : null,
    pricingPolicy: bookingPricingPolicySignal(booking),
    recencyLabel: recencyLabel(booking, nowMs),
    selectedFinalPartnerPillLabel: bookingMonitorListSelectedFinalPartnerPillLabel(booking),
    selection: bookingMonitorListSelection(booking),
    serviceOptionLabel: bookingServiceOptionLabel(booking),
    servicePayoutLabel: bookingServicePayoutRuleLabel(booking) ?? null,
    servicePriceLabel: bookingServicePriceLabel(booking),
    stage: bookingListStage(booking, currentTimeMs),
  };
}

function bookingMonitorListLocation(
  booking: AdminBooking,
  currentTimeMs: number,
): BookingMonitorListRow['location'] {
  return {
    pillLabel: bookingLocationPillLabel(booking, currentTimeMs),
    signalLabel: bookingLocationSignalLabel(booking, currentTimeMs),
    toneClass: bookingLocationToneClass(booking, currentTimeMs),
  };
}

function bookingMonitorListSelection(booking: AdminBooking): BookingMonitorListRow['selection'] {
  return bookingMonitorSelectionFromFacts(bookingSelectionFacts(booking));
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
    chatEvidence: bookings.filter((booking) => bookingChatEvidenceNeedsOps(booking, nowMs)),
    chatReady: bookings.filter((booking) => bookingMatchingChatReady(booking)),
    closeoutChecks: bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking)),
    evidenceMissing: bookings.filter((booking) => bookingDecisionEvidenceMissing(booking, nowMs)),
    expiredMatching: open.filter(
      (booking) => booking.expiresAt && new Date(booking.expiresAt).getTime() < nowMs,
    ),
    locationChecks: bookings.filter((booking) => bookingLocationNeedsOps(booking, nowMs)),
    matchedWithoutChat: bookings.filter((booking) => bookingChatRepairNeedsOps(booking)),
    missingAuthorizedPaymentRefs: bookings.filter(
      (booking) => booking.payment?.status === 'AUTHORIZED' && !booking.payment.providerRef,
    ),
    noShow: bookings.filter((booking) => booking.status === 'NO_SHOW'),
    noSupply: open.filter((booking) => (booking.participants?.length ?? 0) === 0),
    open,
    paymentChecks: bookings.filter((booking) => bookingPaymentNeedsOps(booking)),
    preferredPending: open.filter((booking) => bookingFirstPickPending(booking)),
    pricingChecks: bookings.filter((booking) => bookingPricingPolicyNeedsOps(booking)),
    quietChat: bookings.filter((booking) => bookingHasQuietHandoffChat(booking)),
    refundReview: bookings.filter((booking) => bookingRefundReviewNeedsOps(booking)),
  };
}

function buildBookingNextActions(bookings: AdminBooking[], nowMs: number): BookingNextAction[] {
  return orderedBookingNextActions(
    bookings
      .map((booking) => bookingNextActionCandidate(booking, nowMs))
      .filter((item): item is BookingNextAction => Boolean(item)),
    (action) => bookingTimestamp(action.booking),
  );
}

function bookingNextActionCandidate(booking: AdminBooking, nowMs: number): BookingNextAction | null {
  const highestFlag = highestBookingCheckFlag(booking, nowMs);
  if (highestFlag) {
    return bookingFlagNextAction(booking, nowMs, highestFlag);
  }
  if (activeStatuses.has(booking.status)) {
    return bookingActiveNextAction(booking, nowMs);
  }
  return null;
}

function highestBookingCheckFlag(booking: AdminBooking, nowMs: number) {
  return [...bookingCheckFlags(booking, nowMs)].sort(
    (left, right) =>
      bookingCheckFlagSeverityWeight(right.severity) -
      bookingCheckFlagSeverityWeight(left.severity),
  )[0];
}

function bookingFlagNextAction(
  booking: AdminBooking,
  nowMs: number,
  highestFlag: BookingCheckFlag,
): BookingNextAction {
  return {
    booking,
    title: highestFlag.title,
    detail: nextAction(booking),
    operatorAction: bookingOperatorAction(booking, nowMs, highestFlag),
    owner: bookingActionOwner(booking, highestFlag),
    priority: bookingActionPriority(booking, nowMs, highestFlag),
    tone: highestFlag.severity === 'high' ? 'danger' : highestFlag.severity === 'medium' ? 'warn' : 'info',
    href: `/bookings/${booking.id}`,
    tags: bookingFlagNextActionTags(booking),
  };
}

function bookingActiveNextAction(booking: AdminBooking, nowMs: number): BookingNextAction {
  return {
    booking,
    title: 'Monitor active booking',
    detail: nextAction(booking),
    operatorAction: bookingOperatorAction(booking, nowMs),
    owner: bookingActionOwner(booking),
    priority: bookingActionPriority(booking, nowMs),
    tone: 'info',
    href: `/bookings/${booking.id}`,
    tags: bookingActiveNextActionTags(booking, nowMs),
  };
}

function bookingFlagNextActionTags(booking: AdminBooking) {
  return [
    booking.payment?.method ? `payment ${booking.payment.method}` : 'payment missing',
    booking.chatRoom ? 'chat ready' : 'chat pending',
    selectionLabel(booking),
  ];
}

function bookingActiveNextActionTags(booking: AdminBooking, nowMs: number) {
  return [
    booking.payment?.status ? `payment ${booking.payment.status}` : 'payment pending',
    bookingLocationPillLabel(booking, nowMs),
  ];
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

function buildBookingDispatchPartnerShortcuts(
  bookings: AdminBooking[],
  nowMs: number,
): BookingDispatchPartnerShortcut[] {
  const facts = buildBookingDispatchPartnerShortcutFacts(bookings, nowMs);

  return [
    {
      title: 'Partner handoff',
      value: 'Open',
      detail: 'Full partner command view with direct, marketplace, KYC, wallet, location, and alert lanes.',
      href: '/partners',
      tone: facts.openMatching.length ? 'info' : 'ok',
    },
    {
      title: 'Direct-ready partners',
      value: facts.firstPickWaiting.length.toString(),
      detail: 'Use when preferred partners must answer inside the response window.',
      href: '/partners?review=direct-ready',
      tone: facts.firstPickWaiting.length ? 'warn' : 'ok',
    },
    {
      title: 'Marketplace-ready',
      value: facts.noPartnerSupply.length.toString(),
      detail: 'Use when open matching has no marketplace supply or customer options.',
      href: '/partners?review=marketplace-ready',
      tone: facts.noPartnerSupply.length ? 'warn' : 'ok',
    },
    {
      title: 'Acceptance blockers',
      value: facts.customerSelection.length.toString(),
      detail: 'Repair KYC, bank, wallet, location, push, or control gates before dispatch pressure rises.',
      href: '/partners?review=acceptance-blocked',
      tone: facts.customerSelection.length ? 'info' : 'ok',
    },
    {
      title: 'Cash fee debt',
      value: facts.cashDebt.length.toString(),
      detail: 'Cash bookings can create negative Partner wallets that block final acceptance, service start, and payout release.',
      href: '/cash-settlements',
      tone: facts.cashDebt.length ? 'danger' : 'ok',
    },
    {
      title: 'Location refresh',
      value: facts.locationChecks.length.toString(),
      detail: 'Live booking location checks should send operators to partner location freshness review.',
      href: '/partners?review=location',
      tone: facts.locationChecks.length ? 'warn' : 'ok',
    },
    {
      title: 'Policy controls',
      value: 'Edit',
      detail: 'Tune response window, marketplace radius, invitation limits, and stale location rules.',
      href: '/operations-policy',
      tone: 'info',
    },
  ];
}

function buildBookingDispatchPartnerShortcutFacts(bookings: AdminBooking[], nowMs: number) {
  return buildBookingDispatchPartnerShortcutFactsFromFacts(
    bookings.map((booking) => {
      const open = booking.status === 'OPEN_MATCHING';

      return {
        booking,
        cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
        customerSelectableCount: open ? bookingCustomerSelectableCount(booking) : 0,
        firstPickPending: open ? bookingFirstPickPending(booking) : false,
        locationNeedsOps: bookingLocationNeedsOps(booking, nowMs),
        marketplaceParticipantCount: open ? bookingMarketplaceParticipantCount(booking) : 0,
        status: booking.status,
      };
    }),
  );
}

function buildMatchingFlowTimeline(bookings: AdminBooking[], nowMs: number): readonly AdminBookingMatchingFlowStep[] {
  return buildBookingMatchingFlowTimeline(buildMatchingFlowTimelineFacts(bookings, nowMs));
}

function buildMatchingFlowTimelineFacts(bookings: AdminBooking[], nowMs: number) {
  return bookingMatchingFlowTimelineInput(
    bookings.map((booking) => {
      const status = booking.status;
      const open = status === 'OPEN_MATCHING';
      const matched = status === 'MATCHED';
      const liveHandoff = isHandoffBookingStatus(status);

      return {
        backupAlertNotifiedCount: open ? bookingBackupAlertTraceSummary(booking).totalNotified : 0,
        booking,
        customerSelectableCount: open ? bookingCustomerSelectableCount(booking) : 0,
        firstPickPending: open ? bookingFirstPickPending(booking) : false,
        hasChatRoom: matched ? bookingMatchingChatReady(booking) : false,
        isLiveHandoff: liveHandoff,
        locationNeedsOps: liveHandoff ? bookingLocationNeedsOps(booking, nowMs) : false,
        marketplaceParticipantCount: open ? bookingMarketplaceParticipantCount(booking) : 0,
        responseWindowExpired: open ? bookingMatchingWindowExpired(booking, nowMs) : false,
        status,
      };
    }),
  );
}

function bookingMonitorSummaryFact(booking: AdminBooking, nowMs: number): BookingMonitorSummaryFact {
  return {
    addressNeedsOps: bookingAddressNeedsOps(booking),
    backupSelected: bookingIsBackupSelected(booking),
    chatEvidenceNeedsOps: bookingChatEvidenceNeedsOps(booking, nowMs),
    chatRepairNeedsOps: bookingChatRepairNeedsOps(booking),
    closeoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    decisionEvidenceMissing: bookingDecisionEvidenceMissing(booking, nowMs),
    firstPickPending: bookingFirstPickPending(booking),
    highPriorityCheck: bookingCheckFlags(booking, nowMs).some((flag) => flag.severity === 'high'),
    locationNeedsOps: bookingLocationNeedsOps(booking, nowMs),
    marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    matchingChatReady: bookingMatchingChatReady(booking),
    participantCount: booking.participants?.length ?? 0,
    paymentNeedsOps: bookingPaymentNeedsOps(booking),
    policySnapshotPresent: Boolean(bookingMatchingPolicySnapshot(booking)),
    pricingPolicyNeedsOps: bookingPricingPolicyNeedsOps(booking),
    refundReviewNeedsOps: bookingRefundReviewNeedsOps(booking),
    stageKey: bookingListStage(booking, nowMs).key,
    status: booking.status,
  };
}

function bookingListStage(booking: AdminBooking, nowMs: number): BookingListStage {
  return bookingListStageFromFacts({
    bookingId: booking.id,
    hasChatRoom: bookingMatchingChatReady(booking),
    isHandoffStatus: isHandoffBookingStatus(booking.status),
    isTerminalStatus: terminalBookingStatuses.has(booking.status),
    locationNeedsOps: bookingLocationNeedsOps(booking, nowMs),
    matchingEvidence: booking.matchingEvidence,
    marketplaceAlertNotifiedCount: bookingBackupAlertTraceSummary(booking).totalNotified,
    marketplaceCount: bookingMarketplaceParticipantCount(booking),
    responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
    selectableCount: bookingCustomerSelectableCount(booking),
    selectedPartnerPresent: bookingHasFinalPartner(booking),
    status: booking.status,
  });
}

function buildMatchingEscalationRows(
  bookings: AdminBooking[],
  nowMs: number,
): readonly AdminBookingMatchingEscalationRow[] {
  return buildBookingMatchingEscalationRowsFromFacts(
    bookings.map((booking) => {
      const hasChatRoom = bookingMatchingChatReady(booking);
      const responseWindowExpired = bookingMatchingWindowExpired(booking, nowMs);

      return bookingMatchingEscalationRowInput(booking, {
        hasChatRoom,
        marketplaceCount: bookingMarketplaceParticipantCount(booking),
        preferredAwaitingDecision: bookingFirstPickPending(booking),
        responseWindowExpired,
        selectableCount: bookingCustomerSelectableCount(booking),
        selectionLabel: selectionLabel(booking),
        selectionPathLabel: selectionPathLabel(booking),
        windowLabel: bookingMatchingWindowLabel(booking, nowMs),
      });
    }),
  );
}

function bookingMatchesView(booking: AdminBooking, view: BookingView, nowMs: number) {
  return bookingMatchesMonitorView(view, {
    activeStatus: () => activeStatuses.has(booking.status),
    addressNeedsOps: () => bookingAddressNeedsOps(booking),
    cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
    chatEvidenceNeedsOps: () => bookingChatEvidenceNeedsOps(booking, nowMs),
    chatLive: () => bookingMatchingChatReady(booking),
    chatRepairNeedsOps: () => bookingChatRepairNeedsOps(booking),
    closeoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
    decisionEvidenceMissing: () => bookingDecisionEvidenceMissing(booking, nowMs),
    highPriorityCheck: () => bookingCheckFlags(booking, nowMs).some((flag) => flag.severity === 'high'),
    locationNeedsOps: () => bookingLocationNeedsOps(booking, nowMs),
    manualDecisionNeedsOps: () => bookingManualDecisionNeedsOps(booking),
    matchingEscalationNeedsOps: () =>
      bookingMatchingEscalationNeedsOps(booking, {
        hasChatRoom: bookingMatchingChatReady(booking),
        responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
      }),
    noSupply: () => booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0,
    paymentNeedsOps: () => bookingPaymentNeedsOps(booking),
    pricingPolicyNeedsOps: () => bookingPricingPolicyNeedsOps(booking),
    refundReviewNeedsOps: () => bookingRefundReviewNeedsOps(booking),
    stageKey: () => bookingListStage(booking, nowMs).key,
    status: () => booking.status,
  });
}

function bookingMatchesEvidenceFilter(
  booking: AdminBooking,
  evidenceFilter: BookingEvidenceFilter,
  nowMs: number,
) {
  return bookingMatchesMonitorEvidenceFilter(evidenceFilter, {
    activeStatus: () => activeStatuses.has(booking.status),
    addressNeedsOps: () => bookingAddressNeedsOps(booking),
    alertEvidenceNeedsOps: () => bookingAlertEvidenceNeedsOps(booking, nowMs),
    cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
    chatLive: () => bookingMatchingChatReady(booking),
    chatRepairNeedsOps: () => bookingChatRepairNeedsOps(booking),
    closeoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
    hasFinalPartner: () => bookingHasFinalPartner(booking),
    hasProviderLocation: () => hasProviderLocation(booking),
    locationNeedsOps: () => bookingLocationNeedsOps(booking, nowMs),
    paymentNeedsOps: () => bookingPaymentNeedsOps(booking),
    status: () => booking.status,
    terminalStatus: () => terminalBookingStatuses.has(booking.status),
  });
}

function bookingAlertEvidenceNeedsOps(booking: AdminBooking, nowMs: number) {
  const summary = bookingBackupAlertTraceSummary(booking, nowMs);
  return bookingAlertEvidenceNeedsOpsFromFacts({
    alertBatchCount: summary.batchCount,
    participantCount: booking.participants?.length,
    stageKey: () => bookingListStage(booking, nowMs).key,
    status: booking.status,
  });
}

function bookingActionPriority(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingCheckFlag,
): BookingNextAction['priority'] {
  return bookingNextActionPriorityFromFacts({
    completedCloseoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
    flagSeverity: flag?.severity,
    locationNeedsOps: () => bookingLocationNeedsOps(booking, nowMs),
    paymentNeedsOps: () => bookingPaymentNeedsOps(booking),
    status: booking.status,
  });
}

function bookingActionOwner(booking: AdminBooking, flag?: BookingCheckFlag): BookingNextAction['owner'] {
  return bookingNextActionOwnerFromFacts({
    completedCloseoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
    flagTitle: flag?.title,
    paymentNeedsOps: () => bookingPaymentNeedsOps(booking),
    status: booking.status,
  });
}

function bookingOperatorAction(booking: AdminBooking, nowMs: number, flag?: BookingCheckFlag) {
  return bookingNextOperatorActionFromFacts({
    cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
    completedCloseoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
    firstPickPending: () => bookingFirstPickPending(booking),
    flagTitle: flag?.title,
    locationNeedsOps: () => bookingLocationNeedsOps(booking, nowMs),
    matchingChatReady: () => bookingMatchingChatReady(booking),
    paymentNeedsOps: () => bookingPaymentNeedsOps(booking),
    status: booking.status,
  });
}

function buildBookingGateRejectionLane(logs: AdminAuditLog[], nowMs: number): BookingCommandLane {
  const customerTooFar = logs.filter(
    (log) => bookingGateReasonCode(log) === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR',
  );
  const partnerTooFar = logs.filter((log) => bookingGateReasonCode(log) === 'PREFERRED_PARTNER_TOO_FAR');
  const serviceArea = logs.filter(
    (log) => bookingGateReasonCode(log) === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
  );
  const locationEvidence = logs.filter((log) =>
    bookingGateReasonCode(log).startsWith('CUSTOMER_CURRENT_LOCATION_'),
  );
  const latest = logs[0];
  const latestAge = latest ? relativeTimeLabel(latest.createdAt, nowMs) : 'none';

  return {
    title: 'Blocked booking attempts',
    status: logs.length > 0 ? `${logs.length} stopped` : 'Clear',
    tone: logs.length > 0 ? 'warn' : 'ok',
    detail:
      logs.length > 0
        ? `${customerTooFar.length} optional GPS distance, ${partnerTooFar.length} first-pick distance, ${serviceArea.length} service-area, and ${locationEvidence.length} optional GPS evidence attempt(s). Latest ${latestAge}.`
        : 'No booking create request has been blocked by the local booking gates.',
    href: '/bookings?view=blocked-create',
    metrics: [
      { label: 'Optional GPS evidence', value: customerTooFar.length.toString() },
      { label: 'First-pick distance', value: partnerTooFar.length.toString() },
      { label: 'Service area', value: serviceArea.length.toString() },
      { label: 'Optional GPS evidence attempts', value: locationEvidence.length.toString() },
      { label: 'Latest', value: latestAge },
    ],
  };
}

function opsSignal(booking: AdminBooking) {
  const participantCount = bookingMarketplaceParticipantCount(booking);
  if (booking.status === 'NO_SHOW') {
    return booking.payment && bookingPaymentOutcomeNeedsReview(booking.payment.status)
      ? bookingOpsSignal('warn', 'No-show, check payment')
      : bookingOpsSignal('ok', 'No-show closed');
  }
  if (booking.status === 'EXPIRED') {
    return booking.payment?.status === 'RELEASED'
      ? bookingOpsSignal('ok', 'Expired and released')
      : bookingOpsSignal('warn', 'Expired, check payment');
  }
  if (booking.status === 'CANCELLED') {
    return booking.payment?.status === 'RELEASED'
      ? bookingOpsSignal('ok', 'Cancelled and released')
      : bookingOpsSignal('warn', 'Cancelled, check payment');
  }
  if (booking.status === 'REFUNDED') {
    return bookingOpsSignal('warn', 'Refunded');
  }
  if (bookingCashDebtNeedsOps(booking)) {
    return bookingOpsSignal('warn', 'Cash fee debt');
  }
  if (
    booking.status === 'OPEN_MATCHING' &&
    bookingFirstPickPending(booking)
  ) {
    return bookingOpsSignal('warn', 'First-pick partner pending');
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    return bookingOpsSignal('warn', 'No marketplace partners yet');
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount > 0) {
    return bookingOpsSignal('info', 'Marketplace options ready');
  }
  if (booking.status === 'MATCHED' && bookingIsBackupSelected(booking)) {
    return bookingOpsSignal('info', 'Marketplace partner selected');
  }
  if (booking.status === 'MATCHED' && !bookingMatchingChatReady(booking)) {
    return bookingOpsSignal('warn', 'Chat missing');
  }
  return bookingOpsSignal('ok', 'Normal');
}

function bookingOpsSignal(tone: 'info' | 'ok' | 'warn', label: string) {
  return <span className={`signal signal-${tone}`}>{label}</span>;
}

function bookingCheckFlags(booking: AdminBooking, nowMs: number): BookingCheckFlag[] {
  const isOpenMatching = booking.status === 'OPEN_MATCHING';
  const providerLocationAvailable = hasProviderLocation(booking);
  const hasChatRoom = bookingMatchingChatReady(booking);

  return bookingMonitorCheckFlagsFromFacts({
    status: booking.status,
    hasPayment: Boolean(booking.payment),
    paymentStatus: booking.payment?.status,
    paymentProviderRef: booking.payment?.providerRef,
    completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    pricingPolicy: bookingPricingPolicySignal(booking),
    matchingWindowExpired: isOpenMatching && bookingMatchingWindowExpired(booking, nowMs),
    firstPickPending: isOpenMatching && bookingFirstPickPending(booking),
    participantCount: bookingMarketplaceParticipantCount(booking),
    matchingChatReady: booking.status === 'MATCHED' ? hasChatRoom : true,
    hasProviderLocation: providerLocationAvailable,
    providerLocationFreshness: providerLocationAvailable
      ? providerLocationFreshness(booking, nowMs)
      : 'missing',
    hasChatRoom,
    chatMessageCount: booking.chatRoom?.messages?.length ?? 0,
  });
}

function bookingPaymentNeedsOps(booking: AdminBooking) {
  return bookingPaymentNeedsOpsFromFacts({
    status: booking.status,
    payment: booking.payment,
    completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
  });
}

function bookingManualDecisionNeedsOps(booking: AdminBooking) {
  return bookingManualDecisionNeedsOpsFromFacts({
    status: booking.status,
    cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
  });
}

function bookingChatEvidenceNeedsOps(booking: AdminBooking, nowMs: number) {
  const chatReady = bookingMatchingChatReady(booking);
  return (
    bookingChatRepairNeedsOps(booking) ||
    bookingChatQuietNeedsOps(booking) ||
    bookingDecisionEvidenceMissing(booking, nowMs) ||
    (bookingManualDecisionNeedsOps(booking) && chatReady) ||
    (bookingRefundReviewNeedsOps(booking) && chatReady)
  );
}

function bookingDecisionEvidenceMissing(booking: AdminBooking, nowMs: number) {
  if (!bookingManualDecisionNeedsOps(booking) && !bookingChatRepairNeedsOps(booking)) {
    return false;
  }
  const hasChatMessage = (booking.chatRoom?.messages?.length ?? 0) > 0;
  const hasLocation = hasProviderLocation(booking);
  const hasAlertTrace = bookingBackupAlertTraceSummary(booking, nowMs).totalNotified > 0;
  return !(hasChatMessage || hasLocation || hasAlertTrace);
}

function bookingRefundReviewNeedsOps(booking: AdminBooking) {
  return bookingRefundReviewNeedsOpsFromFacts({
    status: booking.status,
    payment: booking.payment,
    refundCount: booking.refunds?.length,
    paymentRefundCount: booking.payment?.refunds?.length,
  });
}

function bookingPricingPolicyNeedsOps(booking: AdminBooking) {
  return bookingPricingPolicySignal(booking).status !== 'ready';
}

function bookingPricingPolicySignal(booking: AdminBooking): BookingPricingPolicySignal {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  return bookingPricingPolicySignalFromFacts({
    hasBookedService: Boolean(bookedService),
    hasService: Boolean(service),
    customerPrice: bookedService?.price ?? booking.payment?.amount,
    minimumPrice: service?.basePrice,
    priceStep: service?.priceStep,
    payoutRules: service?.payoutRules ?? [],
  });
}

function bookingListCommandDecisionStrip(booking: AdminBooking) {
  const addressState = bookingAddressSnapshotState(booking);
  const marketplaceCount = bookingMarketplaceParticipantCount(booking);

  return bookingCommandDecisionStrip({
    bookingStatus: booking.status,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressLabel: addressState.detail,
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidateCount: bookingCustomerSelectableCount(booking),
    marketplaceEligibleCount: marketplaceCount,
    hasFinalPartner: bookingHasFinalPartner(booking),
    hasChatRoom: bookingMatchingChatReady(booking),
    messageCount: booking.chatRoom?.messages?.length ?? 0,
    paymentMethod: booking.payment?.method ?? 'NONE',
    paymentStatus: booking.payment?.status ?? 'NONE',
    cashDebtNeedsSettlement: bookingCashDebtNeedsOps(booking),
    closeoutOpenItemCount: bookingCompletedCloseoutNeedsOps(booking) ? 1 : 0,
  });
}

function bookingAddressNeedsOps(booking: AdminBooking) {
  return !booking.addressSnapshot;
}

function bookingLocationNeedsOps(booking: AdminBooking, nowMs: number) {
  return bookingLocationNeedsOpsFromFacts({
    status: booking.status,
    hasProviderLocation: hasProviderLocation(booking),
    providerLocationFreshness: providerLocationFreshness(booking, nowMs),
  });
}

function bookingAddressSnapshotState(booking: AdminBooking) {
  const snapshot = booking.addressSnapshot;
  const legacyAddress = readAddressText(booking.address);
  return bookingAddressSnapshotStateFromFacts({
    hasAddressSnapshot: Boolean(snapshot),
    snapshotAddressText: snapshot?.addressText ? displayMarketplaceText(snapshot.addressText) : null,
    snapshotPinLabel: snapshot ? coordinatePairLabel(snapshot.latitude, snapshot.longitude) : null,
    legacyAddressText: legacyAddress ? displayMarketplaceText(legacyAddress) : null,
    legacyPinLabel: coordinatePairLabel(booking.lat, booking.lng),
  });
}

function bookingChatListState(booking: AdminBooking) {
  return bookingChatListStateFromFacts({
    status: booking.status,
    hasChatRoom: bookingMatchingChatReady(booking),
    messageCount: booking.chatRoom?.messages?.length ?? 0,
  });
}

function bookingListActionChips(booking: AdminBooking, nowMs: number): readonly BookingListActionChip[] {
  const paymentNeedsOps = bookingPaymentNeedsOps(booking);
  const locationNeedsOps = bookingLocationNeedsOps(booking, nowMs);
  const chatNeedsRepair = bookingChatRepairNeedsOps(booking);
  const cashDebtNeedsOps = bookingCashDebtNeedsOps(booking);
  const closeoutNeedsOps = bookingCompletedCloseoutNeedsOps(booking);
  const pricingNeedsOps = bookingPricingPolicyNeedsOps(booking);
  const chatState = bookingChatListState(booking);
  const pricingPolicy = bookingPricingPolicySignal(booking);
  const paymentAmount = booking.payment
    ? money(Number(booking.payment.amount ?? 0), booking.payment.currency)
    : 'No payment record';

  return bookingListActionChipsFromFacts({
    cashDebtNeedsOps,
    chatNeedsRepair,
    chatState,
    closeoutNeedsOps,
    locationDetail: bookingLocationSignalLabel(booking, nowMs),
    locationNeedsOps,
    paymentDetail: booking.payment
      ? `${booking.payment.method} / ${booking.payment.status} / ${paymentAmount}`
      : 'No payment record is attached to this booking.',
    paymentNeedsOps,
    pricingDetail: pricingPolicy.label,
    pricingNeedsOps,
    pricingTone: pricingPolicy.tone,
  });
}

function bookingFinalGateReason(booking: AdminBooking) {
  const reason = buildBookingFinalGateReasonFromFacts({
    cashDebt: bookingCashDebtNeedsOps(booking),
    walletLedgerLabel: 'Cash fee settlement required',
    hasAddressSnapshot: !bookingAddressNeedsOps(booking),
    bookingStatus: booking.status,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredAwaitingDecision: bookingFirstPickPending(booking),
    customerChoiceCandidates: bookingCustomerSelectableCount(booking),
    marketplaceParticipants: bookingMarketplaceParticipantCount(booking),
    selected: bookingHasFinalPartner(booking),
    hasChatRoom: bookingMatchingChatReady(booking),
  });
  return bookingFinalGateReasonPresentation({
    bookingId: booking.id,
    reason,
  });
}

function hasProviderLocation(booking: AdminBooking) {
  if (hasProviderCoordinate(booking.selectedProvider)) {
    return true;
  }
  return (booking.participants ?? []).some((participant) =>
    hasProviderCoordinate(participant.providerProfile),
  );
}

function nextAction(booking: AdminBooking) {
  return bookingNextActionCopy({
    status: booking.status,
    hasPayment: Boolean(booking.payment),
    paymentStatus: booking.payment?.status ?? null,
    cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredAwaitingDecision: bookingFirstPickPending(booking),
    marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    backupSelected: bookingIsBackupSelected(booking),
    completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
  });
}

function bookingMatchingRuleSnapshot(booking: AdminBooking, nowMs: number): BookingMatchingRuleSnapshot {
  const policy = bookingMatchingPolicySnapshot(booking);
  const marketplaceCount = bookingMarketplaceParticipantCount(booking);
  const selectableCount = bookingCustomerSelectableCount(booking);
  const alertSummary = bookingBackupAlertTraceSummary(booking, nowMs);

  return buildBookingMatchingRuleSnapshot({
    hasChatRoom: bookingMatchingChatReady(booking),
    isTerminalStatus: terminalBookingStatuses.has(booking.status),
    marketplaceCount,
    openMatchingWindowLabel: bookingMatchingWindowLabel(booking, nowMs),
    policy,
    selectableCount,
    selectedPartnerLabel: booking.selectedProvider ? partnerDisplayName(booking.selectedProvider) : null,
    status: booking.status,
    totalNotified: alertSummary.totalNotified,
  });
}

function customerVisibleStateLabel(booking: AdminBooking) {
  const selectableCount = bookingCustomerSelectableCount(booking);
  const marketplaceCount = bookingMarketplaceParticipantCount(booking);
  return bookingCustomerVisibleStateLabel(booking, {
    selectedPartnerLabel: bookingFinalPartnerLabel(booking),
    hasChatRoom: bookingMatchingChatReady(booking),
    customerSelectablePartnerCount: selectableCount,
    preferredAwaitingDecision: bookingFirstPickPending(booking),
    marketplacePartnerCount: marketplaceCount,
  });
}

function bookingCustomerLabel(booking: AdminBooking) {
  return booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
}

function bookingProviderLabel(booking: AdminBooking) {
  const provider =
    booking.selectedProvider?.displayName ??
    booking.preferredProvider?.displayName ??
    marketplaceParticipants(booking)[0]?.providerProfile?.displayName;
  return provider ? `Partner ${partnerDisplayName({ displayName: provider })}` : 'Partner pending';
}

function partnerDisplayName(provider?: { displayName?: string | null } | null, fallback = 'Partner') {
  return displayMarketplaceText(provider?.displayName ?? fallback);
}

function marketplaceParticipants(booking: AdminBooking) {
  return buildBookingMarketplaceParticipants(booking);
}

function buildMarketplaceBookingCoverageRows(
  bookings: AdminBooking[],
  nowMs: number,
): readonly AdminMarketplaceBookingCoverageRow[] {
  return buildMarketplaceBookingCoverageRowsFromFacts(
    bookings.map((booking) => {
      const hasPreferredProvider = Boolean(booking.preferredProvider);

      return bookingMarketplaceCoverageInput(booking, nowMs, {
        backupSelected: hasPreferredProvider && bookingIsBackupSelected(booking),
        firstPickPending: hasPreferredProvider && bookingFirstPickPending(booking),
        hasFinalPartner: bookingHasFinalPartner(booking),
        marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
        matchingWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
        preferredProviderState: hasPreferredProvider
          ? bookingPreferredProviderStateLabel(booking)
          : null,
        selectableCount: bookingCustomerSelectableCount(booking),
        selectedPartnerLabel: bookingFinalPartnerLabel(booking),
      });
    }),
  );
}

function buildMarketplaceParticipantLedgerRows(
  bookings: AdminBooking[],
  nowMs: number,
  marketplaceRadiusMeters: number,
): readonly AdminMarketplaceParticipantLedgerRow[] {
  return bookings.flatMap((booking) =>
    buildMarketplaceParticipantLedgerRowsFromFacts(
      bookingMarketplaceParticipantLedgerInputs(booking, nowMs, marketplaceRadiusMeters),
    ),
  );
}

function buildMarketplaceOperationsCards(
  bookings: AdminBooking[],
  ledgerRows: readonly AdminMarketplaceParticipantLedgerRow[],
  nowMs: number,
): MarketplaceOperationsCard[] {
  return buildMarketplaceOperationsCardItems(
    buildMarketplaceOperationsCardCounts({
      bookings: bookings.map((booking) =>
        bookingMarketplaceOperationsBookingFact(booking, nowMs, {
          hasCustomerSelectablePartner: bookingCustomerSelectableCount(booking) > 0,
          marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
          selectedPartnerPresent: bookingHasFinalPartner(booking),
        }),
      ),
      ledgerRows,
    }),
  );
}

function buildMarketplaceOperatingQueue(
  bookings: AdminBooking[],
  nowMs: number,
): MarketplaceOperatingQueueItem<AdminBooking>[] {
  return buildMarketplaceOperatingQueueItems(
    buildMarketplaceOperatingQueueBuckets(
      bookings.map((booking) =>
        bookingMarketplaceOperatingQueueFact(booking, {
          hasCustomerSelectablePartner: bookingCustomerSelectableCount(booking) > 0,
          marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
          preferredAwaitingDecision: bookingFirstPickPending(booking),
          responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
        }),
      ),
    ),
  );
}

function customerSelectableParticipants(booking: AdminBooking) {
  return buildBookingCustomerSelectableParticipants(booking);
}

function bookingMarketplaceParticipantCount(booking: AdminBooking) {
  return booking.matchingEvidence?.marketplaceParticipantCount ?? marketplaceParticipants(booking).length;
}

function bookingCustomerSelectableCount(booking: AdminBooking) {
  return booking.matchingEvidence?.selectableParticipantCount ?? customerSelectableParticipants(booking).length;
}

function bookingFirstPickPending(booking: AdminBooking) {
  return bookingPreferredAwaitingDecision(booking);
}

function selectionLabel(booking: AdminBooking) {
  return bookingMonitorSelectionLabel(bookingSelectionFacts(booking));
}

function selectionPathLabel(booking: AdminBooking) {
  return bookingMonitorSelectionPathLabel(bookingSelectionFacts(booking));
}

function selectionToneClass(booking: AdminBooking) {
  return bookingMonitorSelectionToneClass(bookingSelectionFacts(booking));
}

function bookingSelectionFacts(booking: AdminBooking) {
  const hasPreferredProvider = Boolean(booking.preferredProvider);
  return bookingMonitorSelectionFactsFromBooking(booking, {
    firstPickPending: bookingFirstPickPending(booking),
    isBackupSelected: bookingIsBackupSelected(booking),
    isSelectedProviderParticipant: bookingIsSelectedProviderParticipant(booking),
    marketplaceCount: bookingMarketplaceParticipantCount(booking),
    preferredProviderState: hasPreferredProvider ? bookingPreferredProviderStateLabel(booking) : null,
  });
}

