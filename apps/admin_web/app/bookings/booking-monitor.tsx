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
import { humanizeClosureReason } from '../../lib/booking-closure-summary';
import {
  bookingListActionChipsFromFacts,
  type BookingListActionChip,
} from '../../lib/booking-list-action-chips';
import {
  bookingListStageFromFacts,
  type BookingListStage,
} from '../../lib/booking-list-stage';
import { bookingCheckLevel } from '../../lib/booking-check-level';
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
  isPreferredAwaitingDecision as isPreferredAwaitingDecisionByStatus,
  providerLocationFreshnessFromTimestamp,
} from '../../lib/booking-status-location-helpers';
import { bookingCommandDecisionStrip } from '../../lib/booking-command-decision-strip';
import { bookingAddressSnapshotStateFromFacts } from '../../lib/booking-address-snapshot-state';
import { bookingChatListStateFromFacts } from '../../lib/booking-chat-list-state';
import { bookingFinalGateReason as buildBookingFinalGateReasonFromFacts } from '../../lib/booking-final-gate-reason';
import { bookingPrimaryCommandSummary } from '../../lib/booking-primary-command-summary';
import { bookingPrimaryCommandHref } from '../../lib/booking-primary-command-href';
import { bookingNextActionCopy } from '../../lib/booking-next-action-copy';
import { bookingFinalSelectionCopy } from '../../lib/booking-final-selection-copy';
import { bookingPricingPolicySignalFromFacts } from '../../lib/booking-pricing-policy-signal';
import { customerVisibleStateLabelFromFacts } from '../../lib/customer-visible-state-label';
import {
  bookingBackupAlertTraceLabel,
  bookingBackupAlertTracePill,
  bookingBackupAlertTraceSummary,
  bookingBackupAlertTraceTone,
} from './booking-alert-trace';
import { coordinatePairLabel, readAddressText } from './booking-address-readers';
import {
  actionOrderLabel,
  bookingDashboardTone,
  commandToneClass,
  commandToneLabel,
  commandToneWeight,
  type BookingActionPriority,
  type BookingCommandTone,
} from './booking-command-display';
import { emptyBookingMessage } from './booking-empty-message';
import {
  bookingCreatedTimestamp,
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
  activeBookingStatuses as activeStatuses,
  bookingMonitorSummaryRows,
  type BookingMonitorSummaryFact,
} from './booking-monitor-summary';
import { BookingMonitorCommandCenterSection } from './booking-monitor-command-center-section';
import { BookingMonitorCommandRouteSections } from './booking-monitor-command-route-sections';
import { BookingMonitorBlockedCreateSection } from './booking-monitor-blocked-create-section';
import { BookingMonitorCustomerProtectionSection } from './booking-monitor-customer-protection-section';
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
  bookingChatQuietNeedsOps as buildBookingChatQuietNeedsOps,
  bookingChatRepairNeedsOps as buildBookingChatRepairNeedsOps,
} from '../../lib/booking-chat-repair-action-state';
import { bookingCashDebtNeedsSettlement } from '../../lib/booking-finance-flags';
import {
  buildMarketplaceBookingCoverageRows as buildMarketplaceBookingCoverageRowsFromFacts,
  buildMarketplaceBookingCoveragePills,
  buildMarketplaceBookingCoverageSummary,
  type MarketplaceBookingCoverageRow,
  type MarketplaceBookingCoverageTone,
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
  bookingCompletedCloseoutNeedsOpsFromFacts,
  bookingManualDecisionNeedsOpsFromFacts,
  bookingPaymentNeedsOpsFromFacts,
  bookingRefundReviewNeedsOpsFromFacts,
} from '../../lib/booking-payment-ops';
import { bookingFinalGateReasonPresentation } from '../../lib/booking-final-gate-reason';
import {
  bookingCustomerSelectableParticipantsForBooking as buildBookingCustomerSelectableParticipants,
  bookingMarketplaceParticipantsForBooking as buildBookingMarketplaceParticipants,
  bookingParticipantPartnerId,
  bookingPreferredPartnerIdForChoice,
  bookingSelectedPartnerIdForChoice,
  isCustomerSelectableBookingParticipant,
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

type BookingCommandLane = {
  title: string;
  status: string;
  tone: BookingCommandTone;
  detail: string;
  href: string;
  metrics: Array<{ label: string; value: string }>;
};

type BookingNextAction = {
  booking: AdminBooking;
  title: string;
  detail: string;
  operatorAction: string;
  owner: 'Dispatch' | 'Finance' | 'Support' | 'Safety';
  priority: BookingActionPriority;
  tone: BookingCommandTone;
  href: string;
  tags: string[];
};

type BookingProtectionLane = {
  title: string;
  status: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  detail: string;
  operatorAction: string;
  href: string;
  bookings: AdminBooking[];
};

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

type MarketplaceCoveragePillState = {
  readonly label: string;
  readonly tone: MarketplaceBookingCoverageTone;
};

type ProviderLocationFreshness = 'recent' | 'stale' | 'expired' | 'missing';

const terminalBookingStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);
const resolvedPaymentOutcomeStatuses = new Set(['RELEASED', 'REFUNDED']);
const handoffBookingStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const locationRequiredStatuses = new Set(['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const p0ActionPriorityStatuses = new Set(['NO_SHOW', 'EXPIRED']);
const p1ActionPriorityStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY']);
const p2ActionPriorityStatuses = new Set(['OPEN_MATCHING', 'ARRIVED', 'IN_SERVICE']);
const financeActionFlagKeywords = ['payment', 'closeout', 'cash', 'payout'] as const;
const bookingLocationPillLabels: Record<ProviderLocationFreshness, string> = {
  expired: 'Location too old',
  missing: 'No location',
  recent: 'Location recent',
  stale: 'Location stale',
};
const bookingLocationToneClasses: Record<ProviderLocationFreshness, string> = {
  expired: 'pill-info',
  missing: 'pill-neutral',
  recent: 'pill-success',
  stale: 'pill-warn',
};
const STALE_LOCATION_MINUTES = 30;
const EXPIRED_LOCATION_HOURS = 24;

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
      [...bookings].sort((left, right) => {
        const leftPriority = bookingPriority(left);
        const rightPriority = bookingPriority(right);
        if (leftPriority !== rightPriority) {
          return rightPriority - leftPriority;
        }

        return bookingTimestamp(right) - bookingTimestamp(left);
      }),
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
        bookingMatchesStatusFilter(booking, statusFilter) &&
        bookingMatchesPaymentFilter(booking, paymentFilter) &&
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
    closureState: bookingClosureListSignal(booking),
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
    preferredProviderStateLabel: booking.preferredProvider ? preferredProviderStateLabel(booking) : null,
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

function bookingMonitorListBackupAlert(
  booking: AdminBooking,
  currentTimeMs: number,
): BookingMonitorListRow['backupAlert'] {
  return {
    label: bookingBackupAlertTraceLabel(booking, currentTimeMs),
    pill: bookingBackupAlertTracePill(booking),
    tone: bookingBackupAlertTraceTone(booking),
  };
}

function bookingMonitorListCashDebtAmountLabel(booking: AdminBooking, cashDebtNeedsOps: boolean) {
  if (!cashDebtNeedsOps) {
    return null;
  }
  return money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency);
}

function bookingMonitorListFirstPickPhoneLabel(booking: AdminBooking) {
  return booking.preferredProvider?.user?.phone
    ? `First-pick phone ${booking.preferredProvider.user.phone}`
    : 'First-pick partner not set';
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

function bookingMonitorListMarketplaceParticipantOverflowCount(
  participants: readonly BookingParticipant[],
) {
  return Math.max(0, participants.length - 4);
}

function bookingMonitorListMarketplaceParticipants(
  participants: readonly BookingParticipant[],
): BookingMonitorListRow['marketplaceParticipants'] {
  return participants.slice(0, 4).map((participant) => ({
    id: participant.id,
    partnerLabel: partnerDisplayName(participant.providerProfile),
    status: participant.status,
  }));
}

function bookingMonitorListSelectedFinalPartnerPillLabel(booking: AdminBooking) {
  if (
    !booking.selectedProvider ||
    bookingSelectedPartnerIdForChoice(booking) === bookingPreferredPartnerIdForChoice(booking)
  ) {
    return null;
  }
  return partnerDisplayName(booking.selectedProvider);
}

function bookingMonitorListSelection(booking: AdminBooking): BookingMonitorListRow['selection'] {
  return {
    label: selectionLabel(booking),
    pathLabel: selectionPathLabel(booking),
    toneClass: selectionToneClass(booking),
  };
}

function buildBookingCommandCenter(bookings: AdminBooking[], nowMs: number): BookingCommandLane[] {
  const facts = buildBookingCommandCenterFacts(bookings, nowMs);

  return [
    {
      title: 'Dispatch pressure',
      status: facts.noSupply.length > 0 || facts.expiredMatching.length > 0 ? 'Action needed' : 'Stable',
      tone: facts.expiredMatching.length > 0 ? 'danger' : facts.noSupply.length > 0 ? 'warn' : 'ok',
      detail:
        facts.noSupply.length > 0
          ? 'Open matching has customer demand without partner supply.'
          : 'Active booking demand has enough current operating data.',
      href:
        facts.noSupply.length > 0 || facts.expiredMatching.length > 0
          ? facts.noSupply.length > 0
            ? '/bookings?view=no-supply'
            : '/bookings?view=attention'
          : '/bookings?view=active',
      metrics: [
        metric('active', facts.active.length),
        metric('open', facts.open.length),
        metric('no supply', facts.noSupply.length),
        metric('preferred pending', facts.preferredPending.length),
      ],
    },
    {
      title: 'Customer protection',
      status:
        facts.expiredMatching.length > 0 || facts.matchedWithoutChat.length > 0
          ? 'Protect now'
          : 'Clear',
      tone:
        facts.expiredMatching.length > 0 || facts.matchedWithoutChat.length > 0
          ? 'danger'
          : facts.locationChecks.length > 0
            ? 'warn'
            : 'ok',
      detail:
        facts.expiredMatching.length > 0
          ? 'Matching window expired before a final partner was selected.'
          : 'Customer-facing booking handoff has no critical blocker.',
      href:
        facts.expiredMatching.length > 0 || facts.matchedWithoutChat.length > 0
          ? '/bookings?view=attention'
          : '/bookings?view=location',
      metrics: [
        metric('expired', facts.expiredMatching.length),
        metric('no chat', facts.matchedWithoutChat.length),
        metric('location checks', facts.locationChecks.length),
        metric('quiet chat', facts.quietChat.length),
      ],
    },
    {
      title: 'Evidence readiness',
      status:
        facts.evidenceMissing.length > 0
          ? 'Needs records'
          : facts.chatEvidence.length > 0
            ? 'Review ready'
            : 'Clear',
      tone:
        facts.evidenceMissing.length > 0 ? 'warn' : facts.chatEvidence.length > 0 ? 'info' : 'ok',
      detail:
        facts.evidenceMissing.length > 0
          ? 'Some manual outcome bookings need retained chat, alert, or location context before action.'
          : facts.chatEvidence.length > 0
            ? 'Communication evidence is available for bookings that may need operator review.'
            : 'No booking currently needs a chat evidence decision board review.',
      href:
        facts.evidenceMissing.length > 0
          ? '/bookings?view=evidence-missing'
          : facts.chatEvidence.length > 0
            ? '/bookings?view=chat-evidence'
            : '/bookings?view=manual-decision',
      metrics: [
        metric('chat evidence', facts.chatEvidence.length),
        metric('evidence missing', facts.evidenceMissing.length),
        metric('refund review', facts.refundReview.length),
        metric('quiet chat', facts.quietChat.length),
      ],
    },
    {
      title: 'Payment closeout',
      status:
        facts.paymentChecks.length > 0 ||
        facts.closeoutChecks.length > 0 ||
        facts.noShow.length > 0 ||
        facts.pricingChecks.length > 0
          ? 'Review'
          : 'Ready',
      tone:
        facts.closeoutChecks.length > 0
          ? 'danger'
          : facts.paymentChecks.length > 0
            ? 'danger'
            : facts.noShow.length > 0
              ? 'warn'
              : facts.pricingChecks.length > 0
                ? 'warn'
                : 'ok',
      detail:
        facts.closeoutChecks.length > 0
          ? 'Completed bookings are missing earning, tax, platform fee, or wallet closeout records.'
          : facts.paymentChecks.length > 0
            ? 'Some bookings need capture, release, refund, cash debt, or missing reference review.'
            : facts.noShow.length > 0
              ? 'No-show bookings need a clear payment and customer communication outcome.'
              : 'Payment and service pricing policy records are aligned.',
      href:
        facts.closeoutChecks.length > 0
          ? '/bookings?view=closeout'
          : facts.paymentChecks.length > 0
            ? facts.cashDebt.length > 0
              ? '/bookings?view=cash-debt'
              : '/bookings?view=payment'
            : facts.noShow.length > 0
              ? '/bookings?view=no-show'
              : '/bookings?view=pricing',
      metrics: [
        metric('payment', facts.paymentChecks.length),
        metric('closeout', facts.closeoutChecks.length),
        metric('no-show', facts.noShow.length),
        metric('pricing', facts.pricingChecks.length),
        metric('cash debt', facts.cashDebt.length),
        metric('missing refs', facts.missingAuthorizedPaymentRefs.length),
      ],
    },
    {
      title: 'Handoff quality',
      status: facts.locationChecks.length > 0 || facts.quietChat.length > 0 ? 'Monitor' : 'Clear',
      tone: facts.locationChecks.length > 0 ? 'warn' : facts.quietChat.length > 0 ? 'info' : 'ok',
      detail:
        facts.locationChecks.length > 0
          ? 'Live service state has missing or stale last-known partner location.'
          : 'Chat, marketplace selection, and location handoff look normal.',
      href: facts.locationChecks.length > 0 ? '/bookings?view=location' : '/bookings?view=chat',
      metrics: [
        metric('location', facts.locationChecks.length),
        metric('marketplace chosen', facts.backupSelected.length),
        metric('chat live', facts.chatReady.length),
        metric('quiet chat', facts.quietChat.length),
      ],
    },
  ];
}

function buildBookingCommandCenterFacts(bookings: AdminBooking[], nowMs: number) {
  const active = bookings.filter((booking) => activeStatuses.has(booking.status));
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');

  return {
    active,
    backupSelected: bookings.filter((booking) => isBackupSelected(booking)),
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
    quietChat: bookings.filter(
      (booking) =>
        booking.chatRoom &&
        (booking.chatRoom.messages?.length ?? 0) === 0 &&
        isHandoffBookingStatus(booking.status),
    ),
    refundReview: bookings.filter((booking) => bookingRefundReviewNeedsOps(booking)),
  };
}

function buildBookingNextActions(bookings: AdminBooking[], nowMs: number): BookingNextAction[] {
  return bookings
    .map((booking) => bookingNextActionCandidate(booking, nowMs))
    .filter((item): item is BookingNextAction => Boolean(item))
    .sort((left, right) => {
      const toneDelta = commandToneWeight(right.tone) - commandToneWeight(left.tone);
      if (toneDelta !== 0) {
        return toneDelta;
      }
      return bookingTimestamp(right.booking) - bookingTimestamp(left.booking);
    })
    .slice(0, 5);
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
    (left, right) => checkFlagWeight(right) - checkFlagWeight(left),
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
  const facts = buildCustomerProtectionFacts(bookings);

  return [
    {
      title: 'Cancelled payment release',
      status: facts.cancelledUnresolved.length ? 'Release/refund' : 'Clear',
      tone: facts.cancelledUnresolved.length ? 'danger' : 'ok',
      detail:
        facts.cancelledUnresolved.length > 0
          ? 'Customer cancelled, but the linked payment is not released or refunded yet.'
          : 'Cancelled bookings have no unresolved payment hold in the current snapshot.',
      operatorAction: 'Open payment queue and close customer money movement before support follow-up.',
      href: '/bookings?view=payment',
      bookings: facts.cancelledUnresolved,
    },
    {
      title: 'Expired matching closeout',
      status: facts.expiredUnresolved.length ? 'Timeout review' : 'Clear',
      tone: facts.expiredUnresolved.length ? 'danger' : 'ok',
      detail:
        facts.expiredUnresolved.length > 0
          ? 'Matching expired before final partner selection, but payment still needs an outcome.'
          : 'Expired bookings have payment release/refund state aligned.',
      operatorAction: 'Release the hold, confirm customer notification, and check retry/alert history.',
      href: '/bookings?view=expired',
      bookings: facts.expiredUnresolved,
    },
    {
      title: 'No-show outcome',
      status: facts.noShowUnresolved.length ? 'Evidence needed' : 'Clear',
      tone: facts.noShowUnresolved.length ? 'warn' : 'ok',
      detail:
        facts.noShowUnresolved.length > 0
          ? 'No-show bookings still need a payment, fee, or customer support decision.'
          : 'No-show bookings have no unresolved payment in the current snapshot.',
      operatorAction: 'Review chat, arrival/location evidence, customer response, then decide payment handling.',
      href: '/bookings?view=no-show',
      bookings: facts.noShowUnresolved,
    },
    {
      title: 'Completed service reconciliation',
      status: facts.completedCloseout.length ? 'Closeout missing' : 'Clear',
      tone: facts.completedCloseout.length ? 'danger' : 'ok',
      detail:
        facts.completedCloseout.length > 0
          ? 'Completed bookings are missing capture, earning, tax, platform fee, or wallet ledger records.'
          : 'Completed bookings are reconciled against payment and ledger requirements.',
      operatorAction: 'Run or inspect closeout before payout, tax, and review workflows continue.',
      href: '/bookings?view=closeout',
      bookings: facts.completedCloseout,
    },
    {
      title: 'Cash fee debt',
      status: facts.cashDebt.length ? 'Partner blocked' : 'Clear',
      tone: facts.cashDebt.length ? 'danger' : 'ok',
      detail:
        facts.cashDebt.length > 0
          ? 'Cash bookings created negative wallet balances that require settlement before final acceptance, service start, or payout release.'
          : 'No cash booking currently creates an unpaid HANDS fee debt blocker.',
      operatorAction: 'Collect Partner fee deposit or settle from available earnings before final acceptance, service start, or payout release.',
      href: '/bookings?view=cash-debt',
      bookings: facts.cashDebt,
    },
  ];
}

function buildCustomerProtectionFacts(bookings: AdminBooking[]) {
  return {
    cancelledUnresolved: terminalBookingsWithUnresolvedPayment(bookings, 'CANCELLED'),
    cashDebt: bookings.filter((booking) => bookingCashDebtNeedsOps(booking)),
    completedCloseout: bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking)),
    expiredUnresolved: terminalBookingsWithUnresolvedPayment(bookings, 'EXPIRED'),
    noShowUnresolved: terminalBookingsWithUnresolvedPayment(bookings, 'NO_SHOW'),
  };
}

function terminalBookingsWithUnresolvedPayment(bookings: AdminBooking[], status: string) {
  return bookings.filter(
    (booking) =>
      booking.status === status &&
      Boolean(booking.payment) &&
      paymentOutcomeNeedsReview(booking.payment?.status),
  );
}

function paymentOutcomeNeedsReview(status?: string | null) {
  return !resolvedPaymentOutcomeStatuses.has(status ?? '');
}

function isHandoffBookingStatus(status: string) {
  return handoffBookingStatuses.has(status);
}

function buildMatchingEscalationBoard(
  bookings: AdminBooking[],
  nowMs: number,
): readonly AdminBookingMatchingEscalationLane[] {
  return buildBookingMatchingEscalationBoard(buildMatchingEscalationFacts(bookings, nowMs));
}

function buildMatchingEscalationFacts(bookings: AdminBooking[], nowMs: number) {
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');

  return {
    chatReady: bookings.filter((booking) => bookingMatchingChatReady(booking)),
    customerFinalSelection: open.filter((booking) => bookingCustomerSelectableCount(booking) > 0),
    expiredWindow: open.filter((booking) => bookingMatchingWindowExpired(booking, nowMs)),
    firstPickWaiting: open.filter((booking) => bookingFirstPickPending(booking)),
    marketplaceReady: open.filter((booking) => bookingMarketplaceParticipantCount(booking) > 0),
    matchedWithoutChat: bookings.filter(
      (booking) => booking.status === 'MATCHED' && !bookingMatchingChatReady(booking),
    ),
    noMarketplaceSupply: open.filter((booking) => bookingMarketplaceParticipantCount(booking) === 0),
  };
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
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');

  return {
    cashDebt: bookings.filter((booking) => bookingCashDebtNeedsOps(booking)),
    customerSelection: openMatching.filter((booking) => bookingCustomerSelectableCount(booking) > 0),
    firstPickWaiting: openMatching.filter((booking) => bookingFirstPickPending(booking)),
    locationChecks: bookings.filter((booking) => bookingLocationNeedsOps(booking, nowMs)),
    noPartnerSupply: openMatching.filter((booking) => bookingMarketplaceParticipantCount(booking) === 0),
    openMatching,
  };
}

function buildMatchingFlowTimeline(bookings: AdminBooking[], nowMs: number): readonly AdminBookingMatchingFlowStep[] {
  return buildBookingMatchingFlowTimeline(buildMatchingFlowTimelineFacts(bookings, nowMs));
}

function buildMatchingFlowTimelineFacts(bookings: AdminBooking[], nowMs: number) {
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const firstPickWaiting = open.filter((booking) => bookingFirstPickPending(booking));
  const matched = bookings.filter((booking) => booking.status === 'MATCHED');
  const liveHandoff = bookings.filter((booking) => isHandoffBookingStatus(booking.status));

  return {
    backupAlerted: open.filter((booking) => bookingBackupAlertTraceSummary(booking).totalNotified > 0),
    customerChoice: open.filter((booking) => bookingCustomerSelectableCount(booking) > 0),
    firstPickExpired: firstPickWaiting.filter((booking) => bookingMatchingWindowExpired(booking, nowMs)),
    firstPickWaiting,
    liveHandoff,
    locationChecks: liveHandoff.filter((booking) => bookingLocationNeedsOps(booking, nowMs)),
    marketplaceVisible: open.filter((booking) => bookingMarketplaceParticipantCount(booking) > 0),
    matched,
    matchedWithoutChat: matched.filter((booking) => !bookingMatchingChatReady(booking)),
    noSupply: open.filter((booking) => bookingMarketplaceParticipantCount(booking) === 0),
  };
}

function bookingMonitorSummaryFact(booking: AdminBooking, nowMs: number): BookingMonitorSummaryFact {
  return {
    addressNeedsOps: bookingAddressNeedsOps(booking),
    backupSelected: isBackupSelected(booking),
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

function bookingClosureListSignal(booking: AdminBooking) {
  if (booking.closedAt) {
    const actor = booking.closedByRole ? booking.closedByRole.toLowerCase() : 'actor missing';
    const reason = booking.closedReason ? humanizeClosureReason(booking.closedReason) : 'reason not saved';
    const note = booking.closedNote ? ` / ${booking.closedNote}` : '';

    return {
      label: `Closed ${formatDate(booking.closedAt)}`,
      detail: `${actor} closure / ${reason}${note}`,
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-info',
    };
  }

  if (terminalBookingStatuses.has(booking.status)) {
    return {
      label: 'Terminal',
      detail: 'Terminal booking has no explicit closure actor/reason saved yet.',
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-warn',
    };
  }

  return null;
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
    bookings.map((booking) => ({
      booking,
      hasChatRoom: bookingMatchingChatReady(booking),
      hasPreferredPartner: Boolean(booking.preferredProvider),
      marketplaceCount: bookingMarketplaceParticipantCount(booking),
      needsOps: bookingMatchingEscalationNeedsOps(booking, nowMs),
      preferredAwaitingDecision: bookingFirstPickPending(booking),
      responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
      selectableCount: bookingCustomerSelectableCount(booking),
      selectionLabel: selectionLabel(booking),
      selectionPathLabel: selectionPathLabel(booking),
      sortTimestamp: bookingTimestamp(booking),
      status: booking.status,
      windowLabel: bookingMatchingWindowLabel(booking, nowMs),
    })),
  );
}

function metric(label: string, value: number) {
  return { label, value: value.toString() };
}

function bookingMatchesView(booking: AdminBooking, view: BookingView, nowMs: number) {
  switch (view) {
    case 'attention':
      return bookingCheckFlags(booking, nowMs).some((flag) => flag.severity === 'high');
    case 'matching':
      return bookingMatchingEscalationNeedsOps(booking, nowMs);
    case 'first-pick':
      return bookingListStage(booking, nowMs).key === 'first-pick';
    case 'marketplace':
      return bookingListStage(booking, nowMs).key === 'marketplace';
    case 'customer-choice':
      return bookingListStage(booking, nowMs).key === 'customer-choice';
    case 'handoff-repair':
      return bookingListStage(booking, nowMs).key === 'handoff-repair';
    case 'no-supply':
      return booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0;
    case 'address':
      return bookingAddressNeedsOps(booking);
    case 'manual-decision':
      return bookingManualDecisionNeedsOps(booking);
    case 'payment':
      return bookingPaymentNeedsOps(booking);
    case 'cash-debt':
      return bookingCashDebtNeedsOps(booking);
    case 'closeout':
      return bookingCompletedCloseoutNeedsOps(booking);
    case 'pricing':
      return bookingPricingPolicyNeedsOps(booking);
    case 'location':
      return bookingLocationNeedsOps(booking, nowMs);
    case 'chat':
      return bookingMatchingChatReady(booking);
    case 'chat-repair':
      return bookingChatRepairNeedsOps(booking);
    case 'chat-evidence':
      return bookingChatEvidenceNeedsOps(booking, nowMs);
    case 'evidence-missing':
      return bookingDecisionEvidenceMissing(booking, nowMs);
    case 'refund-review':
      return bookingRefundReviewNeedsOps(booking);
    case 'expired':
      return booking.status === 'EXPIRED';
    case 'no-show':
      return booking.status === 'NO_SHOW';
    case 'all':
      return true;
    case 'active':
    case 'blocked-create':
    default:
      return activeStatuses.has(booking.status);
  }
}

function bookingMatchesStatusFilter(booking: AdminBooking, statusFilter: string) {
  return statusFilter === 'all' || booking.status === statusFilter;
}

function bookingMatchesPaymentFilter(booking: AdminBooking, paymentFilter: string) {
  return paymentFilter === 'all' || (booking.payment?.method ?? 'NO_PAYMENT') === paymentFilter;
}

function bookingMatchesEvidenceFilter(
  booking: AdminBooking,
  evidenceFilter: BookingEvidenceFilter,
  nowMs: number,
) {
  switch (evidenceFilter) {
    case 'all':
      return true;
    case 'address':
      return bookingAddressNeedsOps(booking);
    case 'partner':
      return (
        booking.status === 'OPEN_MATCHING' ||
        (activeStatuses.has(booking.status) && !bookingHasFinalPartner(booking))
      );
    case 'chat':
      return bookingChatRepairNeedsOps(booking) || bookingMatchingChatReady(booking);
    case 'money':
      return (
        bookingPaymentNeedsOps(booking) ||
        bookingCashDebtNeedsOps(booking) ||
        bookingCompletedCloseoutNeedsOps(booking)
      );
    case 'location':
      return bookingLocationNeedsOps(booking, nowMs) || hasProviderLocation(booking);
    case 'alerts':
      return bookingAlertEvidenceNeedsOps(booking, nowMs);
    case 'closeout':
      return (
        terminalBookingStatuses.has(booking.status) ||
        bookingCompletedCloseoutNeedsOps(booking) ||
        booking.status === 'NO_SHOW'
      );
    default:
      return true;
  }
}

function bookingAlertEvidenceNeedsOps(booking: AdminBooking, nowMs: number) {
  const summary = bookingBackupAlertTraceSummary(booking, nowMs);
  if (summary.batchCount > 0) {
    return true;
  }
  return (
    booking.status === 'OPEN_MATCHING' &&
    ((booking.participants?.length ?? 0) === 0 || bookingListStage(booking, nowMs).key === 'marketplace')
  );
}

function checkFlagWeight(flag: BookingCheckFlag) {
  if (flag.severity === 'high') {
    return 3;
  }
  if (flag.severity === 'medium') {
    return 2;
  }
  return 1;
}

function bookingActionPriority(
  booking: AdminBooking,
  nowMs: number,
  flag?: BookingCheckFlag,
): BookingNextAction['priority'] {
  if (bookingNeedsP0Action(booking, flag)) {
    return 'P0';
  }
  if (bookingNeedsP1Action(booking, nowMs, flag)) {
    return 'P1';
  }
  if (bookingNeedsP2Action(booking)) {
    return 'P2';
  }
  return 'P3';
}

function bookingNeedsP0Action(booking: AdminBooking, flag?: BookingCheckFlag) {
  return (
    flag?.severity === 'high' ||
    p0ActionPriorityStatuses.has(booking.status) ||
    bookingPaymentNeedsOps(booking) ||
    bookingCompletedCloseoutNeedsOps(booking)
  );
}

function bookingNeedsP1Action(booking: AdminBooking, nowMs: number, flag?: BookingCheckFlag) {
  return (
    flag?.severity === 'medium' ||
    p1ActionPriorityStatuses.has(booking.status) ||
    bookingLocationNeedsOps(booking, nowMs)
  );
}

function bookingNeedsP2Action(booking: AdminBooking) {
  return p2ActionPriorityStatuses.has(booking.status);
}

function bookingActionOwner(booking: AdminBooking, flag?: BookingCheckFlag): BookingNextAction['owner'] {
  const flagTitle = bookingCheckFlagSearchText(flag);
  if (
    bookingCheckFlagTitleHasAny(flagTitle, financeActionFlagKeywords) ||
    bookingPaymentNeedsOps(booking) ||
    bookingCompletedCloseoutNeedsOps(booking)
  ) {
    return 'Finance';
  }
  if (booking.status === 'NO_SHOW' || flagTitle.includes('no-show')) {
    return 'Safety';
  }
  if (
    booking.status === 'CANCELLED' ||
    booking.status === 'EXPIRED' ||
    flagTitle.includes('chat')
  ) {
    return 'Support';
  }
  return 'Dispatch';
}

function bookingCheckFlagSearchText(flag?: BookingCheckFlag) {
  return flag?.title.toLowerCase() ?? '';
}

function bookingCheckFlagTitleHasAny(flagTitle: string, keywords: readonly string[]) {
  return keywords.some((keyword) => flagTitle.includes(keyword));
}

function bookingOperatorAction(booking: AdminBooking, nowMs: number, flag?: BookingCheckFlag) {
  const paymentAction = bookingPaymentOperatorAction(booking);
  if (paymentAction) {
    return paymentAction;
  }
  const statusAction = bookingStatusOperatorAction(booking);
  if (statusAction) {
    return statusAction;
  }
  const locationAction = bookingLocationOperatorAction(booking, nowMs);
  if (locationAction) {
    return locationAction;
  }
  const serviceAction = bookingServiceOperatorAction(booking);
  if (serviceAction) {
    return serviceAction;
  }
  return bookingFallbackOperatorAction(flag);
}

function bookingPaymentOperatorAction(booking: AdminBooking) {
  if (bookingCashDebtNeedsOps(booking)) {
    return 'Confirm Partner wallet debt and request company fee settlement before final acceptance, service start, or payout release resumes.';
  }
  if (bookingCompletedCloseoutNeedsOps(booking)) {
    return 'Run closeout reconciliation so payment, earning, tax, fee, and wallet records match.';
  }
  if (bookingPaymentNeedsOps(booking)) {
    return 'Open the booking payment panel and decide capture, release, refund, cash debt, or missing reference handling.';
  }
  return null;
}

function bookingStatusOperatorAction(booking: AdminBooking) {
  if (booking.status === 'NO_SHOW') {
    return 'Record customer and partner notes, then close payment and safety follow-up.';
  }
  if (booking.status === 'EXPIRED') {
    return 'Release the hold, notify the customer, and confirm no partner remains assigned.';
  }
  if (
    booking.status === 'OPEN_MATCHING' &&
    bookingFirstPickPending(booking)
  ) {
    return 'Monitor the first-pick partner response window and prepare marketplace partner options.';
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 'Check nearby partner supply and notification delivery until the customer has options.';
  }
  if (booking.status === 'MATCHED' && !bookingMatchingChatReady(booking)) {
    return 'Create or repair chat handoff before the service moves forward.';
  }
  return null;
}

function bookingLocationOperatorAction(booking: AdminBooking, nowMs: number) {
  if (bookingLocationNeedsOps(booking, nowMs)) {
    return 'Ask the partner to refresh location once; use last-known location only, no live routing.';
  }
  return null;
}

function bookingServiceOperatorAction(booking: AdminBooking) {
  if (booking.status === 'IN_SERVICE') {
    return 'Monitor completion timing and prepare payment capture or cash fee ledger closeout.';
  }
  return null;
}

function bookingFallbackOperatorAction(flag?: BookingCheckFlag) {
  return flag
    ? `Review ${flag.title.toLowerCase()} and add an ops note before closing.`
    : 'Keep watching status, chat, and partner handoff.';
}

function bookingPriority(booking: AdminBooking) {
  if (booking.status === 'NO_SHOW') {
    return 6;
  }
  if (booking.status === 'IN_SERVICE') {
    return 5;
  }
  if (booking.status === 'PROVIDER_ON_THE_WAY' || booking.status === 'ARRIVED') {
    return 4;
  }
  if (booking.status === 'MATCHED') {
    return 3;
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 2;
  }
  return 1;
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
    return booking.payment && paymentOutcomeNeedsReview(booking.payment.status)
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
  if (booking.status === 'MATCHED' && isBackupSelected(booking)) {
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

type BookingCheckFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
};

function bookingCheckFlags(booking: AdminBooking, nowMs: number): BookingCheckFlag[] {
  return [
    ...bookingPaymentOutcomeCheckFlags(booking),
    ...bookingPricingCheckFlags(booking),
    ...bookingMatchingCheckFlags(booking, nowMs),
    ...bookingLocationCheckFlags(booking, nowMs),
    ...bookingChatCheckFlags(booking),
    ...bookingPaymentReferenceCheckFlags(booking),
  ];
}

function bookingPaymentOutcomeCheckFlags(booking: AdminBooking): BookingCheckFlag[] {
  const flags: BookingCheckFlag[] = [];
  const paymentStatus = booking.payment?.status;

  if (
    booking.status === 'CANCELLED' &&
    booking.payment &&
    paymentOutcomeNeedsReview(paymentStatus)
  ) {
    flags.push({ severity: 'high', title: 'Cancelled payment unresolved' });
  }
  if (
    booking.status === 'EXPIRED' &&
    booking.payment &&
    paymentOutcomeNeedsReview(paymentStatus)
  ) {
    flags.push({ severity: 'high', title: 'Expired payment unresolved' });
  }
  if (booking.status === 'COMPLETED' && paymentStatus === 'AUTHORIZED') {
    flags.push({ severity: 'high', title: 'Completed service still on hold' });
  }
  if (bookingCompletedCloseoutNeedsOps(booking)) {
    flags.push({ severity: 'high', title: 'Completed closeout incomplete' });
  }
  if (
    booking.status === 'NO_SHOW' &&
    booking.payment &&
    paymentOutcomeNeedsReview(paymentStatus)
  ) {
    flags.push({ severity: 'high', title: 'No-show payment unresolved' });
  }
  if (bookingCashDebtNeedsOps(booking)) {
    flags.push({ severity: 'high', title: 'Cash fee debt blocks marketplace alerts' });
  }

  return flags;
}

function bookingPricingCheckFlags(booking: AdminBooking): BookingCheckFlag[] {
  const pricingPolicy = bookingPricingPolicySignal(booking);
  if (pricingPolicy.status === 'blocked') {
    return [{ severity: 'high', title: pricingPolicy.label }];
  }
  if (pricingPolicy.status === 'warning') {
    return [{ severity: 'medium', title: pricingPolicy.label }];
  }
  return [];
}

function bookingMatchingCheckFlags(booking: AdminBooking, nowMs: number): BookingCheckFlag[] {
  const flags: BookingCheckFlag[] = [];
  const participantCount = bookingMarketplaceParticipantCount(booking);

  if (booking.status === 'OPEN_MATCHING' && bookingMatchingWindowExpired(booking, nowMs)) {
    flags.push({ severity: 'high', title: 'Matching window expired' });
  }
  if (booking.status === 'OPEN_MATCHING' && bookingFirstPickPending(booking)) {
    flags.push({ severity: 'medium', title: 'First-pick partner pending' });
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({ severity: 'medium', title: 'No partner supply' });
  }
  if (booking.status === 'MATCHED' && !bookingMatchingChatReady(booking)) {
    flags.push({ severity: 'high', title: 'Matched without chat' });
  }

  return flags;
}

function bookingLocationCheckFlags(booking: AdminBooking, nowMs: number): BookingCheckFlag[] {
  const flags: BookingCheckFlag[] = [];

  if (locationRequiredStatuses.has(booking.status) && !hasProviderLocation(booking)) {
    flags.push({ severity: 'medium', title: 'No partner location record' });
  }
  if (
    locationRequiredStatuses.has(booking.status) &&
    hasProviderLocation(booking) &&
    providerLocationFreshness(booking, nowMs) !== 'recent'
  ) {
    flags.push({ severity: 'medium', title: 'Partner location is stale' });
  }

  return flags;
}

function bookingChatCheckFlags(booking: AdminBooking): BookingCheckFlag[] {
  if (bookingChatQuietNeedsOps(booking)) {
    return [{ severity: 'low', title: 'Chat quiet' }];
  }
  return [];
}

function bookingPaymentReferenceCheckFlags(booking: AdminBooking): BookingCheckFlag[] {
  if (booking.payment?.status === 'AUTHORIZED' && !booking.payment.providerRef) {
    return [{ severity: 'medium', title: 'Payment reference missing' }];
  }
  return [];
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

function bookingChatQuietNeedsOps(booking: AdminBooking) {
  return buildBookingChatQuietNeedsOps({
    status: booking.status,
    hasChatRoom: bookingMatchingChatReady(booking),
    messageCount: booking.chatRoom?.messages?.length ?? 0,
  });
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

function bookingCompletedCloseoutNeedsOps(booking: AdminBooking) {
  return bookingCompletedCloseoutNeedsOpsFromFacts(booking);
}

function bookingPricingPolicyNeedsOps(booking: AdminBooking) {
  return bookingPricingPolicySignal(booking).status !== 'ready';
}

function bookingPricingPolicySignal(booking: AdminBooking): {
  status: 'ready' | 'warning' | 'blocked';
  label: string;
  tone: string;
} {
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

function bookingCashDebtNeedsOps(booking: AdminBooking) {
  return bookingCashDebtNeedsSettlement({
    paymentMethod: booking.payment?.method,
    hasEarning: Boolean(booking.earning),
    earningNetAmount: booking.earning?.netAmount,
    earningStatus: booking.earning?.status,
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

function bookingChatRepairNeedsOps(booking: AdminBooking) {
  return buildBookingChatRepairNeedsOps({
    status: booking.status,
    hasChatRoom: bookingMatchingChatReady(booking),
  });
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
    backupSelected: isBackupSelected(booking),
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
  return customerVisibleStateLabelFromFacts({
    status: booking.status,
    selectedPartnerLabel: bookingFinalPartnerLabel(booking),
    hasChatRoom: bookingMatchingChatReady(booking),
    customerSelectablePartnerCount: selectableCount,
    hasPreferredPartner: Boolean(booking.preferredProvider),
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

function isSelectedProviderParticipant(booking: AdminBooking) {
  const selectedProviderId = bookingSelectedPartnerIdForChoice(booking);
  if (!selectedProviderId) {
    return false;
  }

  return (booking.participants ?? []).some(
    (participant) =>
      bookingParticipantPartnerId(participant) === selectedProviderId && participant.status !== 'REJECTED',
  );
}

function isBackupSelected(booking: AdminBooking) {
  const selectedProviderId = bookingSelectedPartnerIdForChoice(booking);
  const preferredProviderId = bookingPreferredPartnerIdForChoice(booking);
  return Boolean(selectedProviderId && preferredProviderId && selectedProviderId !== preferredProviderId);
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
      const participants = booking.participants ?? [];
      const trace = bookingBackupAlertTraceSummary(booking, nowMs);
      const firstPick = firstPickCoverageState(booking, nowMs);
      const wallet = bookingMarketplaceWalletSignal(booking);
      const next = marketplaceBookingNextAction(booking, nowMs);

      return {
        booking,
        chatRepairNeeded: bookingChatRepairNeedsOps(booking),
        firstPickLabel: firstPick.label,
        firstPickTone: firstPick.tone,
        marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
        nextActionLabel: next.label,
        nextActionTone: next.tone,
        participantCount: participants.length,
        selectableCount: bookingCustomerSelectableCount(booking),
        selectedPartnerLabel: bookingFinalPartnerLabel(booking),
        sortTimestamp: bookingCreatedTimestamp(booking),
        status: booking.status,
        traceBatchCount: trace.batchCount,
        traceLastAge: trace.lastAge,
        traceLastStage: trace.lastStage,
        traceTotalNotified: trace.totalNotified,
        walletLabel: wallet.walletLabel,
        walletTone: wallet.walletTone,
      };
    }),
  );
}

function firstPickCoverageState(booking: AdminBooking, nowMs: number): MarketplaceCoveragePillState {
  if (!booking.preferredProvider) {
    return { label: 'Open marketplace', tone: 'pill-neutral' };
  }
  if (isBackupSelected(booking)) {
    return { label: 'Marketplace selected', tone: 'pill-success' };
  }
  if (booking.status === 'MATCHED') {
    return { label: 'First-pick matched', tone: 'pill-success' };
  }
  if (preferredProviderStateLabel(booking) === 'declined') {
    return { label: 'First-pick declined', tone: 'pill-info' };
  }
  if (bookingMatchingWindowExpired(booking, nowMs)) {
    return { label: 'First-pick overdue', tone: 'pill-danger' };
  }
  if (bookingFirstPickPending(booking)) {
    return { label: 'First-pick pending', tone: 'pill-warn' };
  }
  return { label: 'First-pick recorded', tone: 'pill-info' };
}

function marketplaceBookingNextAction(booking: AdminBooking, nowMs: number): MarketplaceCoveragePillState {
  if (bookingCashDebtNeedsOps(booking)) {
    return { label: 'Clear cash fee debt', tone: 'pill-danger' };
  }
  if (bookingChatRepairNeedsOps(booking)) {
    return { label: 'Repair chat handoff', tone: 'pill-danger' };
  }
  if (booking.status === 'OPEN_MATCHING' && bookingMatchingWindowExpired(booking, nowMs)) {
    return { label: 'Review expired timer', tone: 'pill-danger' };
  }
  if (booking.status === 'OPEN_MATCHING' && bookingCustomerSelectableCount(booking) > 0) {
    return { label: 'Customer final choice', tone: 'pill-warn' };
  }
  if (booking.status === 'OPEN_MATCHING' && bookingMarketplaceParticipantCount(booking) === 0) {
    return { label: 'Nudge marketplace supply', tone: 'pill-warn' };
  }
  if (booking.status === 'OPEN_MATCHING' && bookingFirstPickPending(booking)) {
    return { label: 'Wait for first-pick', tone: 'pill-warn' };
  }
  if (bookingHasFinalPartner(booking)) {
    return { label: 'Monitor handoff', tone: 'pill-success' };
  }
  return { label: 'Monitor', tone: 'pill-info' };
}

function buildMarketplaceParticipantLedgerRows(
  bookings: AdminBooking[],
  nowMs: number,
  marketplaceRadiusMeters: number,
): readonly AdminMarketplaceParticipantLedgerRow[] {
  return bookings.flatMap((booking) =>
    buildMarketplaceParticipantLedgerRowsFromFacts(
      (booking.participants ?? [])
        .filter((participant) => Boolean(participant.providerProfile?.id))
        .map((participant) => {
        const distanceMeters = typeof participant.distanceMeters === 'number' ? participant.distanceMeters : null;
        const selectedPartnerId = bookingSelectedPartnerIdForChoice(booking);
        const participantPartnerId = bookingParticipantPartnerId(participant);
        const preferredPartnerId = bookingPreferredPartnerIdForChoice(booking);
        return {
          alertLabel: bookingBackupAlertTracePill(booking),
          alertTone: bookingBackupAlertTraceTone(booking),
          booking,
          bookingStatus: booking.status,
          customerSelectable: isCustomerSelectableBookingParticipant(participant, preferredPartnerId),
          distanceMeters,
          hasChatRoom: bookingMatchingChatReady(booking),
          joinedLabel: participant.joinedAt
            ? `${formatDate(participant.joinedAt)} / ${relativeTimeLabel(participant.joinedAt, nowMs)}`
            : 'Participation time not saved',
          marketplaceRadiusMeters,
          participant,
          participantPartnerId,
          partnerLabel: partnerDisplayName(participant.providerProfile),
          preferredPartnerId,
          respondedLabel: participant.respondedAt
            ? `Responded ${formatDate(participant.respondedAt)}`
            : 'No response time saved',
          selectedPartnerId,
          sortTimestamp: bookingParticipantTimestamp(participant),
          status: participant.status ?? 'UNKNOWN',
          ...bookingMarketplaceWalletSignal(booking),
          windowLabel: bookingMatchingWindowLabel(booking, nowMs),
        };
      }),
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
      bookings: bookings.map((booking) => ({
        alertTraceBatchCount: bookingBackupAlertTraceSummary(booking, nowMs).batchCount,
        hasCustomerSelectablePartner: bookingCustomerSelectableCount(booking) > 0,
        hasWalletDebt: bookingHasPartnerWalletDebtSignal(booking),
        marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
        selectedPartnerPresent: bookingHasFinalPartner(booking),
        status: booking.status,
      })),
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
      bookings.map((booking) => ({
        booking,
        cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
        chatRepairNeedsOps: bookingChatRepairNeedsOps(booking),
        hasCustomerSelectablePartner: bookingCustomerSelectableCount(booking) > 0,
        hasPreferredPartner: Boolean(booking.preferredProvider),
        marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
        preferredAwaitingDecision: bookingFirstPickPending(booking),
        responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
        status: booking.status,
      })),
    ),
  );
}

function bookingParticipantTimestamp(participant: BookingParticipant) {
  const value = participant.respondedAt ?? participant.joinedAt;
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function bookingMarketplaceWalletSignal(booking: AdminBooking): {
  readonly walletLabel: string;
  readonly walletTone: MarketplaceBookingCoverageTone;
} {
  if (bookingHasPartnerWalletDebtSignal(booking)) {
    return {
      walletLabel: `Cash fee debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`,
      walletTone: 'pill-warn',
    };
  }
  if (booking.earning) {
    return {
      walletLabel: `Wallet ${money(booking.earning.netAmount ?? 0, booking.earning.currency)}`,
      walletTone: booking.earning.status === 'PAID' ? 'pill-success' : 'pill-info',
    };
  }
  if (booking.payment?.method === 'CASH') {
    return { walletLabel: 'Cash closeout pending', walletTone: 'pill-warn' };
  }
  return { walletLabel: 'Wallet pending', walletTone: 'pill-neutral' };
}

function bookingHasPartnerWalletDebtSignal(booking: AdminBooking) {
  return bookingCashDebtNeedsSettlement({
    paymentMethod: booking.payment?.method,
    hasEarning: Boolean(booking.earning),
    earningNetAmount: booking.earning?.netAmount,
    earningStatus: booking.earning?.status,
  });
}

function customerSelectableParticipants(booking: AdminBooking) {
  return buildBookingCustomerSelectableParticipants(booking);
}

function bookingMatchingChatReady(booking: AdminBooking) {
  return booking.matchingEvidence?.chatReady ?? Boolean(booking.chatRoom);
}

function bookingMarketplaceParticipantCount(booking: AdminBooking) {
  return booking.matchingEvidence?.marketplaceParticipantCount ?? marketplaceParticipants(booking).length;
}

function bookingCustomerSelectableCount(booking: AdminBooking) {
  return booking.matchingEvidence?.selectableParticipantCount ?? customerSelectableParticipants(booking).length;
}

function bookingFirstPickPending(booking: AdminBooking) {
  return isPreferredAwaitingDecision(booking);
}

function bookingHasFinalPartner(booking: AdminBooking) {
  if (booking.selectedProvider) {
    return true;
  }
  return (
    booking.matchingEvidence?.finalSelection === 'FIRST_PICK_ACCEPTED' ||
    booking.matchingEvidence?.finalSelection === 'CUSTOMER_SELECTED_PARTNER'
  );
}

function bookingFinalPartnerLabel(booking: AdminBooking) {
  if (booking.selectedProvider) {
    return partnerDisplayName(booking.selectedProvider, 'selected');
  }
  if (booking.matchingEvidence?.finalSelection === 'FIRST_PICK_ACCEPTED' && booking.preferredProvider) {
    return partnerDisplayName(booking.preferredProvider, 'selected');
  }
  return null;
}

function bookingMatchingEscalationNeedsOps(booking: AdminBooking, nowMs: number) {
  if (booking.status === 'OPEN_MATCHING') {
    return true;
  }
  if (booking.status === 'MATCHED' && !bookingMatchingChatReady(booking)) {
    return true;
  }
  return bookingMatchingWindowExpired(booking, nowMs);
}

function bookingMatchingWindowExpired(booking: AdminBooking, nowMs: number) {
  if (booking.status !== 'OPEN_MATCHING' || !booking.expiresAt || nowMs <= 0) {
    return false;
  }
  const expiresAt = new Date(booking.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt < nowMs;
}

function bookingMatchingWindowLabel(booking: AdminBooking, nowMs: number) {
  if (!booking.expiresAt || nowMs <= 0) {
    return 'window pending';
  }
  const expiresAt = new Date(booking.expiresAt).getTime();
  if (!Number.isFinite(expiresAt)) {
    return 'window invalid';
  }

  const minutes = Math.round((expiresAt - nowMs) / 60_000);
  if (minutes < 0) {
    return `${Math.abs(minutes)}m overdue`;
  }
  if (minutes === 0) {
    return 'expires now';
  }
  return `${minutes}m left`;
}

function selectionLabel(booking: AdminBooking) {
  const facts = bookingSelectionFacts(booking);
  if (facts.finalSelectionCopy) {
    return facts.finalSelectionCopy.label;
  }

  if (!facts.hasPreferredProvider) {
    return 'No first-pick partner';
  }

  if (facts.isBackupSelected) {
    return 'Marketplace partner selected';
  }

  if (facts.firstPickPending) {
    return 'First-pick partner pending';
  }

  if (facts.preferredProviderState === 'declined') {
    return 'First-pick partner declined';
  }

  if (facts.isMatched) {
    return 'Final partner selected';
  }

  if (facts.isSelectedProviderParticipant) {
    return 'First-pick partner is active';
  }

  return 'First-pick partner requested';
}

function selectionPathLabel(booking: AdminBooking) {
  const facts = bookingSelectionFacts(booking);

  if (!facts.hasPreferredProvider) {
    return facts.marketplaceCount > 0 ? 'Open pool request with marketplace supply' : 'Open pool request';
  }

  if (facts.finalSelectionCopy?.pathLabel) {
    return facts.finalSelectionCopy.pathLabel;
  }

  if (facts.firstPickPending) {
    return facts.marketplaceCount > 0
      ? 'Direct request first, with marketplace partners already waiting'
      : 'Direct request first, waiting on the first-pick partner';
  }

  if (facts.isBackupSelected) {
    return 'Direct request escalated to marketplace participation, then the guest chose a marketplace partner';
  }

  if (facts.isMatched) {
    return 'Direct request confirmed by the first-pick partner';
  }

  if (facts.marketplaceCount > 0) {
    return 'Marketplace partners are available while the first-pick partner stays in the flow';
  }

  return 'Direct request remains the active path';
}

function selectionToneClass(booking: AdminBooking) {
  const facts = bookingSelectionFacts(booking);
  if (facts.finalSelectionCopy) {
    return facts.finalSelectionCopy.toneClass;
  }

  if (!facts.hasPreferredProvider) {
    return 'pill-neutral';
  }

  if (facts.firstPickPending) {
    return 'pill-warn';
  }

  if (facts.preferredProviderState === 'declined') {
    return 'pill-info';
  }

  if (facts.isMatched) {
    return 'pill-success';
  }

  if (facts.isSelectedProviderParticipant) {
    return 'pill-success';
  }

  return 'pill-neutral';
}

function bookingSelectionFacts(booking: AdminBooking) {
  const hasPreferredProvider = Boolean(booking.preferredProvider);
  return {
    finalSelectionCopy: bookingFinalSelectionCopy(booking.matchingEvidence?.finalSelection),
    firstPickPending:
      hasPreferredProvider && booking.status === 'OPEN_MATCHING' && bookingFirstPickPending(booking),
    hasPreferredProvider,
    isBackupSelected: hasPreferredProvider && isBackupSelected(booking),
    isMatched: booking.status === 'MATCHED',
    isSelectedProviderParticipant: hasPreferredProvider && isSelectedProviderParticipant(booking),
    marketplaceCount: bookingMarketplaceParticipantCount(booking),
    preferredProviderState: hasPreferredProvider ? preferredProviderStateLabel(booking) : null,
  };
}

function preferredParticipantState(booking: AdminBooking) {
  const preferredProviderId = bookingPreferredPartnerIdForChoice(booking);
  if (!preferredProviderId) {
    return null;
  }

  return (
    (booking.participants ?? []).find(
      (participant) => bookingParticipantPartnerId(participant) === preferredProviderId,
    ) ?? null
  );
}

function isPreferredAwaitingDecision(booking: AdminBooking) {
  const participant = preferredParticipantState(booking);
  return isPreferredAwaitingDecisionByStatus({
    finalSelection: booking.matchingEvidence?.finalSelection,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredParticipantStatus: participant?.status,
  });
}

function preferredProviderStateLabel(booking: AdminBooking) {
  if (isBackupSelected(booking)) {
    return 'not final';
  }

  if (booking.matchingEvidence?.firstPickStatus) {
    return preferredPartnerDecisionLabel(booking.matchingEvidence.firstPickStatus);
  }

  const participant = preferredParticipantState(booking);
  if (!participant) {
    return 'requested';
  }
  return preferredPartnerDecisionLabel(participant.status);
}

function preferredPartnerDecisionLabel(status: string) {
  if (status === 'REJECTED') {
    return 'declined';
  }
  if (status === 'ACCEPTED' || status === 'SELECTED') {
    return 'confirmed';
  }
  return 'pending';
}

function bookingLocationSignalLabel(booking: AdminBooking, nowMs: number) {
  const provider = providerWithLocation(booking);
  if (!provider) {
    return 'Partner location: not shared yet';
  }

  const updatedAt = provider.currentLocationUpdatedAt;
  if (!updatedAt) {
    return 'Partner location: saved pin without timestamp';
  }

  const age = locationAgeLabel(updatedAt, nowMs);
  return `Partner location: ${age}`;
}

function bookingLocationPillLabel(booking: AdminBooking, nowMs: number) {
  return bookingLocationPillLabels[providerLocationFreshness(booking, nowMs)];
}

function bookingLocationToneClass(booking: AdminBooking, nowMs: number) {
  return bookingLocationToneClasses[providerLocationFreshness(booking, nowMs)];
}

function providerLocationFreshness(booking: AdminBooking, nowMs: number): ProviderLocationFreshness {
  const provider = providerWithLocation(booking);
  return providerLocationFreshnessFromTimestamp(
    provider?.currentLocationUpdatedAt,
    nowMs,
    STALE_LOCATION_MINUTES,
    EXPIRED_LOCATION_HOURS,
  );
}

function providerWithLocation(booking: AdminBooking) {
  if (hasProviderCoordinate(booking.selectedProvider)) {
    return booking.selectedProvider;
  }

  return (booking.participants ?? [])
    .map((participant) => participant.providerProfile)
    .find((provider) => hasProviderCoordinate(provider));
}

function locationAgeLabel(value: string, nowMs: number) {
  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'invalid timestamp';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const ageMinutes = Math.max(0, Math.round((reference - updatedAt) / 60_000));
  if (ageMinutes < 1) {
    return 'updated just now';
  }
  if (ageMinutes < 60) {
    return `updated ${ageMinutes}m ago`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `updated ${ageHours}h ago`;
}
