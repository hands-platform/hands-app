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
import { readPlainRecord } from '../../lib/admin-format';
import { type AdminLiveOperationsPolicy } from '../../lib/operations-policy';
import { bookingLocationNeedsOpsFromFacts } from '../../lib/booking-status-location-helpers';
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
import { bookingGateRejectionLaneFacts } from './booking-gate-rejection-lane-facts';
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
  bookingNextActionOwnerInput,
  bookingNextActionPriorityInput,
  bookingNextOperatorActionInput,
  type BookingNextActionInputReaders,
} from './booking-next-action-inputs';
import {
  bookingNextActionOwnerFromFacts,
  type BookingNextActionOwner,
} from './booking-next-action-owner';
import { orderedBookingNextActions } from './booking-next-action-order';
import { bookingNextOperatorActionFromFacts } from './booking-next-operator-action';
import { bookingMatchesMonitorBasicFilters } from './booking-monitor-basic-filters';
import { bookingMonitorCheckFlagsInputFromBooking } from './booking-monitor-check-flags-inputs';
import { bookingMatchesMonitorEvidenceFilter } from './booking-monitor-evidence-match';
import { bookingMonitorEvidenceMatchReadersFromBooking } from './booking-monitor-evidence-match-readers';
import { bookingMatchesMonitorView } from './booking-monitor-view-match';
import { bookingMonitorViewMatchReadersFromBooking } from './booking-monitor-view-match-readers';
import { bookingOpsSignalState, type BookingOpsSignalTone } from './booking-ops-signal-state';
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
import { bookingCommandDecisionStripInput } from './booking-command-decision-strip-inputs';
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
  bookingChatEvidenceNeedsOpsFromReaders,
  bookingDecisionEvidenceMissingFromReaders,
} from './booking-chat-evidence-ops-state';
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
import { bookingMatchingEscalationRowInputFromBooking } from './booking-matching-escalation-row-inputs';
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
} from './booking-location-display';
import {
  bookingHasProviderLocation as hasProviderLocation,
  bookingLocationNeedsOpsInput,
} from './booking-location-ops-inputs';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
  bookingCustomerProtectionFactsFromBookings,
} from './booking-payment-closeout-facts';
import {
  bookingManualDecisionNeedsOpsInput,
  bookingPaymentNeedsOpsInput,
  bookingRefundReviewNeedsOpsInput,
} from './booking-payment-ops-inputs';
import { bookingPricingPolicySignalInput } from './booking-pricing-policy-inputs';
import { bookingAddressSnapshotStateInput } from './booking-address-snapshot-state-inputs';
import { bookingListStage as bookingListStageFromBooking } from './booking-list-stage-inputs';
import { bookingListActionChips } from './booking-list-action-chip-inputs';
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
    owner: bookingActionOwner(booking, nowMs, highestFlag),
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
    owner: bookingActionOwner(booking, nowMs),
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

function buildBookingMonitorSummaryFact(booking: AdminBooking, nowMs: number): BookingMonitorSummaryFact {
  return bookingMonitorSummaryFactFromInputs({
    addressNeedsOps: bookingAddressNeedsOps(booking),
    backupSelected: bookingIsBackupSelected(booking),
    checkSeverities: bookingCheckFlags(booking, nowMs).map((flag) => flag.severity),
    chatEvidenceNeedsOps: bookingChatEvidenceNeedsOps(booking, nowMs),
    chatRepairNeedsOps: bookingChatRepairNeedsOps(booking),
    closeoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    decisionEvidenceMissing: bookingDecisionEvidenceMissing(booking, nowMs),
    firstPickPending: bookingFirstPickPending(booking),
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
  });
}

function bookingListStage(booking: AdminBooking, nowMs: number): BookingListStage {
  return bookingListStageFromBooking(booking, nowMs, {
    marketplaceCount: bookingMarketplaceParticipantCount(booking),
    selectableCount: bookingCustomerSelectableCount(booking),
  });
}

function buildMatchingEscalationRows(
  bookings: AdminBooking[],
  nowMs: number,
): readonly AdminBookingMatchingEscalationRow[] {
  return buildBookingMatchingEscalationRowsFromFacts(
    bookings.map((booking) =>
      bookingMatchingEscalationRowInputFromBooking(booking, nowMs, {
        marketplaceCount: bookingMarketplaceParticipantCount(booking),
        preferredAwaitingDecision: bookingFirstPickPending(booking),
        selectableCount: bookingCustomerSelectableCount(booking),
        selectionLabel: selectionLabel(booking),
        selectionPathLabel: selectionPathLabel(booking),
      }),
    ),
  );
}

function bookingMatchesView(booking: AdminBooking, view: BookingView, nowMs: number) {
  return bookingMatchesMonitorView(
    view,
    bookingMonitorViewMatchReadersFromBooking(booking, {
      addressNeedsOps: () => bookingAddressNeedsOps(booking),
      cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
      chatEvidenceNeedsOps: () => bookingChatEvidenceNeedsOps(booking, nowMs),
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
      paymentNeedsOps: () => bookingPaymentNeedsOps(booking),
      pricingPolicyNeedsOps: () => bookingPricingPolicyNeedsOps(booking),
      refundReviewNeedsOps: () => bookingRefundReviewNeedsOps(booking),
      stageKey: () => bookingListStage(booking, nowMs).key,
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
      addressNeedsOps: () => bookingAddressNeedsOps(booking),
      alertEvidenceNeedsOps: () => bookingAlertEvidenceNeedsOps(booking, nowMs),
      cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
      closeoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
      locationNeedsOps: () => bookingLocationNeedsOps(booking, nowMs),
      paymentNeedsOps: () => bookingPaymentNeedsOps(booking),
    }),
  );
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
  return bookingNextActionPriorityFromFacts(
    bookingNextActionPriorityInput(bookingNextActionReaders(booking, nowMs, flag)),
  );
}

function bookingActionOwner(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingCheckFlag,
): BookingNextAction['owner'] {
  return bookingNextActionOwnerFromFacts(
    bookingNextActionOwnerInput(bookingNextActionReaders(booking, nowMs, flag)),
  );
}

function bookingOperatorAction(booking: AdminBooking, nowMs: number, flag?: BookingCheckFlag) {
  return bookingNextOperatorActionFromFacts(
    bookingNextOperatorActionInput(bookingNextActionReaders(booking, nowMs, flag)),
  );
}

function bookingNextActionReaders(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingCheckFlag,
): BookingNextActionInputReaders {
  return {
    cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
    completedCloseoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
    firstPickPending: () => bookingFirstPickPending(booking),
    flagSeverity: flag?.severity,
    flagTitle: flag?.title,
    locationNeedsOps: () => bookingLocationNeedsOps(booking, nowMs),
    matchingChatReady: () => bookingMatchingChatReady(booking),
    paymentNeedsOps: () => bookingPaymentNeedsOps(booking),
    status: booking.status,
  };
}

function buildBookingGateRejectionLane(logs: AdminAuditLog[], nowMs: number): BookingCommandLane {
  const facts = bookingGateRejectionLaneFacts(
    logs.map((log) => ({
      createdAt: log.createdAt,
      reasonCode: bookingGateReasonCode(log),
    })),
    { relativeTimeLabel: (value) => relativeTimeLabel(value, nowMs) },
  );

  return {
    title: 'Blocked booking attempts',
    status: facts.totalCount > 0 ? `${facts.totalCount} stopped` : 'Clear',
    tone: facts.totalCount > 0 ? 'warn' : 'ok',
    detail:
      facts.totalCount > 0
        ? `${facts.customerTooFarCount} optional GPS distance, ${facts.partnerTooFarCount} first-pick distance, ${facts.serviceAreaCount} service-area, and ${facts.locationEvidenceCount} optional GPS evidence attempt(s). Latest ${facts.latestAge}.`
        : 'No booking create request has been blocked by the local booking gates.',
    href: '/bookings?view=blocked-create',
    metrics: [
      { label: 'Optional GPS evidence', value: facts.customerTooFarCount.toString() },
      { label: 'First-pick distance', value: facts.partnerTooFarCount.toString() },
      { label: 'Service area', value: facts.serviceAreaCount.toString() },
      { label: 'Optional GPS evidence attempts', value: facts.locationEvidenceCount.toString() },
      { label: 'Latest', value: facts.latestAge },
    ],
  };
}

function opsSignal(booking: AdminBooking) {
  const state = bookingOpsSignalState({
    backupSelected: () => bookingIsBackupSelected(booking),
    cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
    firstPickPending: () => bookingFirstPickPending(booking),
    marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    matchingChatReady: () => bookingMatchingChatReady(booking),
    payment: booking.payment,
    status: booking.status,
  });

  return bookingOpsSignal(state.tone, state.label);
}

function bookingOpsSignal(tone: BookingOpsSignalTone, label: string) {
  return <span className={`signal signal-${tone}`}>{label}</span>;
}

function bookingCheckFlags(booking: AdminBooking, nowMs: number): BookingCheckFlag[] {
  return bookingMonitorCheckFlagsFromFacts(
    bookingMonitorCheckFlagsInputFromBooking(booking, nowMs, {
      completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
      cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
      pricingPolicy: bookingPricingPolicySignal(booking),
      responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
      firstPickPending: bookingFirstPickPending(booking),
      marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    }),
  );
}

function bookingPaymentNeedsOps(booking: AdminBooking) {
  return bookingPaymentNeedsOpsFromFacts(
    bookingPaymentNeedsOpsInput({
      booking,
      completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
      cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    }),
  );
}

function bookingManualDecisionNeedsOps(booking: AdminBooking) {
  return bookingManualDecisionNeedsOpsFromFacts(
    bookingManualDecisionNeedsOpsInput({
      booking,
      cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
      completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    }),
  );
}

function bookingChatEvidenceNeedsOps(booking: AdminBooking, nowMs: number) {
  return bookingChatEvidenceNeedsOpsFromReaders({
    chatReady: bookingMatchingChatReady(booking),
    chatRepairNeedsOps: () => bookingChatRepairNeedsOps(booking),
    chatQuietNeedsOps: () => bookingChatQuietNeedsOps(booking),
    decisionEvidenceMissing: () => bookingDecisionEvidenceMissing(booking, nowMs),
    manualDecisionNeedsOps: () => bookingManualDecisionNeedsOps(booking),
    refundReviewNeedsOps: () => bookingRefundReviewNeedsOps(booking),
  });
}

function bookingDecisionEvidenceMissing(booking: AdminBooking, nowMs: number) {
  return bookingDecisionEvidenceMissingFromReaders({
    chatRepairNeedsOps: () => bookingChatRepairNeedsOps(booking),
    hasAlertTrace: () => bookingBackupAlertTraceSummary(booking, nowMs).totalNotified > 0,
    hasChatMessage: () => (booking.chatRoom?.messages?.length ?? 0) > 0,
    hasProviderLocation: () => hasProviderLocation(booking),
    manualDecisionNeedsOps: () => bookingManualDecisionNeedsOps(booking),
  });
}

function bookingRefundReviewNeedsOps(booking: AdminBooking) {
  return bookingRefundReviewNeedsOpsFromFacts(bookingRefundReviewNeedsOpsInput(booking));
}

function bookingPricingPolicyNeedsOps(booking: AdminBooking) {
  return bookingPricingPolicySignal(booking).status !== 'ready';
}

function bookingPricingPolicySignal(booking: AdminBooking): BookingPricingPolicySignal {
  return bookingPricingPolicySignalFromFacts(bookingPricingPolicySignalInput(booking));
}

function bookingListCommandDecisionStrip(booking: AdminBooking) {
  const addressState = bookingAddressSnapshotState(booking);
  const marketplaceCount = bookingMarketplaceParticipantCount(booking);

  return bookingCommandDecisionStrip(
    bookingCommandDecisionStripInput(booking, {
      addressLabel: addressState.detail,
      cashDebtNeedsSettlement: bookingCashDebtNeedsOps(booking),
      closeoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
      customerChoiceCandidateCount: bookingCustomerSelectableCount(booking),
      marketplaceEligibleCount: marketplaceCount,
      hasFinalPartner: bookingHasFinalPartner(booking),
      hasChatRoom: bookingMatchingChatReady(booking),
    }),
  );
}

function bookingAddressNeedsOps(booking: AdminBooking) {
  return !booking.addressSnapshot;
}

function bookingLocationNeedsOps(booking: AdminBooking, nowMs: number) {
  return bookingLocationNeedsOpsFromFacts(bookingLocationNeedsOpsInput(booking, nowMs));
}

function bookingAddressSnapshotState(booking: AdminBooking) {
  return bookingAddressSnapshotStateFromFacts(bookingAddressSnapshotStateInput(booking));
}

function bookingChatListState(booking: AdminBooking) {
  return bookingChatListStateFromFacts({
    status: booking.status,
    hasChatRoom: bookingMatchingChatReady(booking),
    messageCount: booking.chatRoom?.messages?.length ?? 0,
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

