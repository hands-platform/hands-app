'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
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
  type BookingListStageKey,
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
  shortId,
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
  stagePillClass,
  type BookingActionPriority,
  type BookingCommandTone,
} from './booking-command-display';
import { emptyBookingMessage } from './booking-empty-message';
import {
  bookingAgeLabel,
  bookingCreatedTimestamp,
  bookingRecencyLabel as recencyLabel,
  bookingTimestamp,
  formatBookingClockTime as formatClockTime,
  formatBookingDate as formatDate,
  relativeTimeLabel,
} from './booking-list-time';
import {
  bookingGateCount,
  bookingGateFilterOptions,
  bookingGateMatchesFilter,
  buildBookingGateTriage,
  type BookingGateFilter,
} from './booking-gate-filters';
import { bookingGateReasonCode, bookingGateRejectionInfo } from './booking-gate-rejections';
import { bookingMatchingPolicySnapshot } from './booking-matching-policy-snapshot';
import {
  bookingServiceOptionLabel,
  bookingServicePayoutRuleLabel,
  bookingServicePriceLabel,
} from './booking-service-labels';
import { bookingMatchesSearch, uniqueSortedOptions } from './booking-search';
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

type BookingMonitorSummaryRow = readonly [string, string];

const activeStatuses = new Set(['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const terminalBookingStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);
const locationRequiredStatuses = new Set(['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const STALE_LOCATION_MINUTES = 30;
const EXPIRED_LOCATION_HOURS = 24;
const bookingEvidenceFilterOptions: Array<{ value: BookingEvidenceFilter; label: string }> = [
  { value: 'all', label: 'All evidence' },
  { value: 'address', label: 'Address snapshot check' },
  { value: 'partner', label: 'Partner selection check' },
  { value: 'chat', label: 'Chat archive check' },
  { value: 'money', label: 'Payment / wallet check' },
  { value: 'location', label: 'Location check' },
  { value: 'alerts', label: 'Alert delivery check' },
  { value: 'closeout', label: 'Closeout evidence check' },
];

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
        bookings: orderedBookings,
        nowMs: currentTimeMs,
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
    () => uniqueSortedOptions(orderedBookings.map((booking) => booking.status)),
    [orderedBookings],
  );
  const paymentFilterOptions = useMemo(
    () => uniqueSortedOptions(orderedBookings.map((booking) => booking.payment?.method ?? 'NO_PAYMENT')),
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

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Booking Monitor</h1>
          <p className="muted">
            Live operational view for matching, partner selection, chat, and payment readiness.
          </p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => setAutoRefresh((value) => !value)}>
            {autoRefresh ? 'Pause refresh' : 'Resume refresh'}
          </button>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                router.refresh();
                const refreshedAt = new Date();
                setLastRefreshLabel(formatClockTime(refreshedAt));
                setNowMs(refreshedAt.getTime());
              });
            }}
          >
            Refresh now
          </button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Booking operations command summary</h2>
            <p className="muted">
              Start here before drilling into booking records: lane size, first-pick and 10km marketplace
              pressure, customer protection, payment closeout, and handoff quality.
            </p>
          </div>
          <span className="pill pill-info">
            {autoRefresh ? 'Auto refresh on' : 'Auto refresh paused'} /{' '}
            {isPending ? 'refreshing' : `last ${hasMounted ? lastRefreshLabel : 'pending'}`}
          </span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {commandSummaryCards.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.label}>
              <span className="signal signal-info">{item.label}</span>
              <h3>{item.value}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className="pill">{item.owner}</span>
                <span className="pill">{item.action}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="ops-section-header" style={{ marginTop: 16 }}>
          <div>
            <h3>Primary command queue</h3>
            <p className="muted">
              Grouped by the same booking command decision used in each detail page: address,
              matching, chat, and finance.
            </p>
          </div>
          <span className="pill pill-info">
            {primaryCommandQueue.reduce((total, item) => total + item.count, 0)} booking(s)
          </span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 12 }}>
          {primaryCommandQueue.map((item) => (
            <Link className="ops-task-card" href={item.href} key={`${item.status}-${item.primaryAction}`}>
              <span className={`pill ${item.tone}`}>{item.status}</span>
              <h3>{item.count} booking(s)</h3>
              <p>{item.primaryAction}</p>
              <p className="muted">{item.detail}</p>
              <div className="participant-list">
                {item.sampleBookingIds.map((bookingId) => (
                  <span className="pill" key={bookingId}>
                    {shortId(bookingId)}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Booking operations route map</h2>
            <p className="muted">
              Follow the actual HANDS booking path from direct first-pick to 10km marketplace,
              customer selection, chat repair, cash fee debt, and closeout.
            </p>
          </div>
          <span className="pill pill-info">No auto assignment</span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {operatorRouteCards.map((item) => (
            <Link className="ops-task-card" href={item.href} key={item.label}>
              <span className="signal signal-info">{item.label}</span>
              <h3>{item.value}</h3>
              <p>{item.detail}</p>
              <div className="participant-list">
                <span className="pill">{item.owner}</span>
                <span className="pill">{item.action}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid">
        {summary.map(([label, value]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{value}</h2>
          </div>
        ))}
      </section>

      <div className="monitor-meta">
        <span>{isPending ? 'Refreshing...' : 'Ready'}</span>
        <span suppressHydrationWarning>Last refresh {hasMounted ? lastRefreshLabel : 'pending'}</span>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Booking command center</h2>
            <p className="muted">
              One-glance control for dispatch pressure, customer protection, payment closeout, and handoff
              quality.
            </p>
          </div>
          <span className="pill pill-info">Operator first view</span>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {commandCenterWithGate.map((lane) => (
            <Link className="card" href={lane.href} key={lane.title}>
              <p>{lane.title}</p>
              <h2>{lane.status}</h2>
              <span className={`signal ${commandToneClass(lane.tone)}`}>{commandToneLabel(lane.tone)}</span>
              <p className="muted" style={{ marginTop: 8 }}>
                {lane.detail}
              </p>
              <div className="participant-list" style={{ marginTop: 10 }}>
                {lane.metrics.map((item) => (
                  <span className="pill" key={item.label}>
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Matching escalation board</h2>
            <p className="muted">
              Direct first-pick partner flow, 10-minute response window, marketplace partner participation,
              and customer final selection in one operating board.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Change matching rules
          </Link>
        </div>
        <div className="ops-section-header" style={{ marginTop: 14 }}>
          <div>
            <h3>Applied operations policy</h3>
            <p className="muted">
              Live Admin policy values used as the default when a booking does not carry its own saved
              matching snapshot.
            </p>
          </div>
          <span className="pill pill-info">Live policy default</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {livePolicyCards.map((card) => (
            <div key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.helper}</small>
            </div>
          ))}
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {matchingEscalationBoard.map((lane) => (
            <Link className="ops-task-card" href={lane.href} key={lane.title}>
              <span className={`signal ${commandToneClass(lane.tone)}`}>{commandToneLabel(lane.tone)}</span>
              <h3>{lane.title}</h3>
              <p>{lane.detail}</p>
              <div className="participant-list">
                <span className="pill">{lane.status}</span>
                {lane.metrics.map((metricItem) => (
                  <span className="pill" key={`${lane.title}-${metricItem.label}`}>
                    {metricItem.label}: {metricItem.value}
                  </span>
                ))}
              </div>
              {lane.bookings.length > 0 ? (
                <div className="stack">
                  {lane.bookings.slice(0, 3).map((booking) => (
                    <span className="muted" key={`${lane.title}-${booking.id}`}>
                      {shortId(booking.id)} / {bookingServiceOptionLabel(booking)} /{' '}
                      {bookingMatchingWindowLabel(booking, currentTimeMs)}
                    </span>
                  ))}
                </div>
              ) : null}
              <small>{lane.operatorAction}</small>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <h3>Matching flow timeline</h3>
          <p className="muted">
            Stage view for direct partner requests, marketplace participation, customer final choice, and
            chat/location handoff.
          </p>
          <div className="ops-task-grid" style={{ marginTop: 12 }}>
            {matchingFlowTimeline.map((step) => (
              <Link className="ops-task-card" href={step.href} key={step.stage}>
                <span className={`signal ${commandToneClass(step.tone)}`}>{step.stage}</span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
                <div className="participant-list">
                  <span className="pill">{step.status}</span>
                  {step.metrics.map((metricItem) => (
                    <span className="pill" key={`${step.stage}-${metricItem.label}`}>
                      {metricItem.label}: {metricItem.value}
                    </span>
                  ))}
                </div>
                {step.bookings.length > 0 ? (
                  <div className="stack">
                    {step.bookings.slice(0, 3).map((booking) => (
                      <span className="muted" key={`${step.stage}-${booking.id}`}>
                        {shortId(booking.id)} / {bookingServiceOptionLabel(booking)} /{' '}
                        {bookingMatchingWindowLabel(booking, currentTimeMs)}
                      </span>
                    ))}
                  </div>
                ) : null}
                <small>{step.operatorAction}</small>
              </Link>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <h3>Dispatch partner repair shortcuts</h3>
          <p className="muted">
            Use these when a matching booking needs partner supply, partner acceptance repair, cash-fee
            cleanup, or policy adjustment.
          </p>
          <div className="service-trace-summary" style={{ marginTop: 12 }}>
            {dispatchPartnerShortcuts.map((item) => (
              <Link
                className={`ops-task-breakdown-item ops-task-breakdown-${bookingDashboardTone(item.tone)}`}
                href={item.href}
                key={item.title}
              >
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </Link>
            ))}
          </div>
        </div>
        <div className="participant-list" style={{ marginTop: 14 }}>
          {matchingEscalationRows.slice(0, 6).map((item) => (
            <Link className="card" href={`/bookings/${item.booking.id}`} key={`matching-${item.booking.id}`}>
              <div className="ops-section-header">
                <div>
                  <p>
                    {shortId(item.booking.id)} / {bookingCustomerLabel(item.booking)}
                  </p>
                  <h3>{item.title}</h3>
                </div>
                <span className={`signal ${commandToneClass(item.tone)}`}>{commandToneLabel(item.tone)}</span>
              </div>
              <p className="muted">{item.detail}</p>
              <p>{item.operatorAction}</p>
              <div className="participant-list">
                {item.tags.map((tag) => (
                  <span className="pill" key={`${item.booking.id}-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {matchingEscalationRows.length === 0 && (
            <div className="card">
              <h3>No matching escalation right now</h3>
              <p className="muted">
                Open matching, marketplace participation, customer final selection, and chat handoff are
                clear.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Next operator actions</h2>
            <p className="muted">
              Booking checklist ordered by customer wait, finance follow-up, and operational aging.
            </p>
          </div>
          <span className={`pill ${nextActions.length > 0 ? 'pill-warn' : 'pill-success'}`}>
            {nextActions.length > 0 ? `${nextActions.length} action(s)` : 'Clear'}
          </span>
        </div>
        <div className="participant-list" style={{ marginTop: 12 }}>
          {nextActions.map((item) => (
            <Link className="card" href={item.href} key={`${item.booking.id}-${item.title}`}>
              <div className="ops-section-header">
                <div>
                  <p>
                    {shortId(item.booking.id)} / {bookingServiceOptionLabel(item.booking)}
                  </p>
                  <h2>{item.title}</h2>
                </div>
                <span className={`signal ${commandToneClass(item.tone)}`}>{commandToneLabel(item.tone)}</span>
              </div>
              <p className="muted">{item.detail}</p>
              <p>
                <strong>{item.owner}</strong> / {actionOrderLabel(item.priority)}: {item.operatorAction}
              </p>
              <p className="muted">
                {bookingCustomerLabel(item.booking)} / {bookingProviderLabel(item.booking)}
              </p>
              <div className="participant-list" style={{ marginTop: 10 }}>
                <span className="pill">{item.booking.status}</span>
                <span className="pill">{item.owner}</span>
                <span className="pill">{actionOrderLabel(item.priority)}</span>
                <span className="pill">{bookingAgeLabel(item.booking, currentTimeMs)}</span>
                {item.tags.map((tag) => (
                  <span className="pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {nextActions.length === 0 && (
            <div className="card">
              <h2>Booking operations are clear</h2>
              <p className="muted">
                No expired matching, unresolved payment, stale live location, missing chat, or pricing policy
                blocker needs immediate review.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer protection closeout board</h2>
            <p className="muted">
              Focused closeout lanes for cancelled, expired, no-show, completed, and cash-fee debt bookings.
              Use this before ending a shift so customer payment and partner wallet outcomes are not left
              open.
            </p>
          </div>
          <span
            className={`pill ${
              customerProtectionBoard.some((lane) => lane.bookings.length > 0) ? 'pill-warn' : 'pill-success'
            }`}
          >
            {customerProtectionBoard.reduce((sum, lane) => sum + lane.bookings.length, 0)} open closeout
          </span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {customerProtectionBoard.map((lane) => (
            <Link className="ops-task-card" href={lane.href} key={lane.title}>
              <span className={`signal ${commandToneClass(lane.tone)}`}>{commandToneLabel(lane.tone)}</span>
              <h3>{lane.title}</h3>
              <p>{lane.detail}</p>
              <div className="participant-list">
                <span className="pill">{lane.status}</span>
                <span className="pill">{lane.bookings.length} booking(s)</span>
              </div>
              {lane.bookings.length > 0 ? (
                <div className="stack">
                  {lane.bookings.slice(0, 3).map((booking) => (
                    <span className="muted" key={`${lane.title}-${booking.id}`}>
                      {shortId(booking.id)} / {bookingCustomerLabel(booking)} /{' '}
                      {booking.payment?.status ?? 'no payment'}
                    </span>
                  ))}
                </div>
              ) : null}
              <small>{lane.operatorAction}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Booking operation filters</h2>
            <p className="muted">
              Active queue: <strong>{activeView.label}</strong> - {activeView.description}
            </p>
          </div>
          <span className={`pill ${view === 'all' ? 'pill-success' : 'pill-warn'}`}>
            Showing {visibleBookings.length} of {baseVisibleBookings.length}
          </span>
        </div>
        <div className="ops-filter-grid" style={{ marginBottom: 14 }}>
          <label>
            Search booking/customer/partner
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Booking ID, phone, partner, customer, service"
            />
          </label>
          <label>
            Booking status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statusFilterOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Payment method
            <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="all">All methods</option>
              {paymentFilterOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidence filter
            <select
              value={evidenceFilter}
              onChange={(event) => setEvidenceFilter(event.target.value as BookingEvidenceFilter)}
            >
              {bookingEvidenceFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="actions" style={{ alignSelf: 'end' }}>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPaymentFilter('all');
                setEvidenceFilter('all');
                setGateFilter('all');
              }}
            >
              Clear list filters
            </button>
          </div>
        </div>
        <div className="participant-list">
          {bookingViewOptions.map((option) => (
            <button
              key={option.view}
              type="button"
              onClick={() => setView(option.view)}
              disabled={view === option.view}
              title={option.description}
            >
              {option.label} ({bookingViewCounts.get(option.view) ?? 0})
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {activeView.operatorHint}
        </p>
      </section>

      {view === 'blocked-create' && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="ops-section-header">
            <div>
              <h2>Blocked booking attempts</h2>
              <p className="muted">
                Booking create requests stopped before payment authorization and matching. These records are
                evidence for support follow-up, not customer or partner priority decisions.
              </p>
            </div>
            <Link className="text-link" href="/audit-log?query=booking.create.rejected">
              Open audit log
            </Link>
          </div>
          <div className="filter-grid" style={{ marginTop: 14 }}>
            <label>
              Create gate filter
              <select
                value={gateFilter}
                onChange={(event) => setGateFilter(event.target.value as BookingGateFilter)}
              >
                {bookingGateFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({bookingGateCount(orderedBookingCreateRejections, option.value)})
                  </option>
                ))}
              </select>
            </label>
            <div className="actions" style={{ alignSelf: 'end' }}>
              <button type="button" onClick={() => setGateFilter('all')}>
                Clear create gate
              </button>
            </div>
          </div>
          <div className="ops-task-grid" style={{ marginTop: 14 }}>
            {bookingGateTriage.map((item) => (
              <article className="ops-task-card" key={item.filter}>
                <span className={`signal ${commandToneClass(item.tone)}`}>{item.status}</span>
                <h3>{item.label}</h3>
                <p>{item.operatorHint}</p>
                <div className="participant-list">
                  <span className="pill">{item.count} attempt(s)</span>
                  <span className="pill">Latest {item.latestAge}</span>
                </div>
                <div className="actions" style={{ marginTop: 12 }}>
                  <button type="button" onClick={() => setGateFilter(item.filter)}>
                    Show this gate
                  </button>
                  <Link className="text-link" href={item.auditHref}>
                    Audit evidence
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            {bookingGateFilterOptions.find((option) => option.value === gateFilter)?.operatorHint}
          </p>
          {visibleBookingCreateRejections.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 14 }}>
              No blocked booking create attempts match this create gate filter.
            </div>
          ) : (
            <div className="ops-task-grid" style={{ marginTop: 14 }}>
              {visibleBookingCreateRejections.slice(0, 30).map((log) => {
                const evidence = bookingGateRejectionInfo(log);
                return (
                  <article className="ops-task-card" key={log.id}>
                    <span className={`signal ${commandToneClass(evidence.tone)}`}>
                      {evidence.reasonLabel}
                    </span>
                    <h3>{shortId(log.id)}</h3>
                    <p>{evidence.operatorAction}</p>
                    <div className="participant-list">
                      <span className="pill">Created {formatDate(log.createdAt)}</span>
                      <span className="pill">{evidence.customerDistanceLabel}</span>
                      <span className="pill">{evidence.preferredPartnerDistanceLabel}</span>
                    </div>
                    <div className="stack" style={{ marginTop: 10 }}>
                      <span className="muted">Address: {evidence.addressText}</span>
                      <span className="muted">Optional customer GPS: {evidence.currentLocationLabel}</span>
                      <span className="muted">Booking pin: {evidence.bookingAddressLabel}</span>
                    </div>
                    <div className="actions" style={{ marginTop: 12 }}>
                      {evidence.customerHref && (
                        <Link className="text-link" href={evidence.customerHref}>
                          Customer detail
                        </Link>
                      )}
                      <Link className="text-link" href={`/audit-log?query=${encodeURIComponent(log.id)}`}>
                        Audit evidence
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Marketplace participant ledger</h2>
              <p className="muted">
                All participant records by booking, including first-pick, marketplace participants, declined
                responses, and the customer final choice. This is the operations record of who entered the
                request. It shows the Customer-selectable reason and Why not selectable for evidence-only
                rows. Marketplace visibility is not an activity record; wallet-blocked partners are
                stopped before participation and never create participant rows.
              </p>
          </div>
          <span className={`pill ${marketplaceLedgerSummary.total > 0 ? 'pill-info' : 'pill-neutral'}`}>
            All participant records {marketplaceLedgerSummary.total}
          </span>
        </div>
        <section className="card" style={{ marginTop: 14 }}>
          <div className="ops-section-header">
            <div>
              <h3>Marketplace record boundary</h3>
              <p className="muted">
                Operator shorthand for what is retained as evidence, what is blocked before a row is
                created, and where the customer final choice is verified.
              </p>
            </div>
            <span className="pill pill-info">Booking-address marketplace radius</span>
          </div>
          <div className="ops-task-grid" style={{ marginTop: 12 }}>
            <article className="ops-task-card">
              <span className="signal signal-info">Actual participation rows</span>
              <h3>{marketplaceLedgerSummary.total}</h3>
              <p>
                First-pick, marketplace participation, accepted, declined, and customer-selected rows
                stay in this ledger as the operational evidence trail.
              </p>
            </article>
            <article className="ops-task-card">
              <span className="signal signal-warn">Pre-finalization wallet gate</span>
              <h3>Not finalization rows</h3>
              <p>
                A negative-wallet Partner may see marketplace requests, but final acceptance, service start,
                and payout release wait until settlement.
              </p>
            </article>
            <article className="ops-task-card">
              <span className="signal signal-ok">Customer choice evidence</span>
              <h3>{marketplaceLedgerSummary.selected}</h3>
              <p>
                Customer fallback selection is retained when first-pick does not validly win. Operators verify
                the selected participant row and retained chat evidence.
              </p>
            </article>
          </div>
        </section>
        <section className="card" style={{ marginTop: 14 }}>
          <div className="ops-section-header">
            <div>
              <h3>Marketplace operating queue</h3>
              <p className="muted">
                Practical dispatch sequence for first-pick timer control, partner participation pool,
                customer final selection lane, chat handoff, and wallet unblock lane.
              </p>
            </div>
            <span className="pill pill-info">No auto assignment</span>
          </div>
          <div className="ops-task-grid" style={{ marginTop: 12 }}>
            {marketplaceOperatingQueue.map((item) => (
              <Link className="ops-task-card" href={item.href} key={item.step}>
                <span className={`signal ${commandToneClass(item.tone)}`}>{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <div className="participant-list">
                  <span className={`pill ${stagePillClass(item.tone)}`}>{item.status}</span>
                  <span className="pill">{item.value}</span>
                </div>
                <small>{item.operatorAction}</small>
                {item.bookings.length > 0 && (
                  <div className="stack" style={{ marginTop: 10 }}>
                    {item.bookings.slice(0, 3).map((booking) => (
                      <span className="muted" key={`${item.step}-${booking.id}`}>
                        {shortId(booking.id)} / {bookingServiceOptionLabel(booking)} /{' '}
                        {bookingCustomerLabel(booking)}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
        <section className="card" style={{ marginTop: 14, overflowX: 'auto' }}>
          <div className="ops-section-header">
            <div>
              <h3>Marketplace booking coverage board</h3>
              <p className="muted">
                Booking-level view of first-pick timer, 10 km alert trace, participant history,
                customer-selectable partners, wallet gate, and final customer selection. This board
                shows bookings with and without participants before drilling into the participant
                ledger.
              </p>
            </div>
            <div className="actions">
              {marketplaceBookingCoveragePills.map((pill) => (
                <span className={`pill ${pill.tone}`} key={pill.label}>
                  {pill.label}
                </span>
              ))}
            </div>
          </div>
          <div className="participant-list" style={{ marginTop: 12 }}>
            <span className="pill">Booking rows, not visibility events</span>
            <span className="pill">Wallet gate blocks finalization</span>
            <span className="pill">No auto assignment</span>
            <span className="pill">Final partner selected {marketplaceBookingCoverageSummary.selected}</span>
          </div>
          {marketplaceBookingCoverageRows.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 14 }}>
              No marketplace booking rows match the current filters.
            </div>
          ) : (
            <table className="table" style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>First-pick window</th>
                  <th>Participant history</th>
                  <th>Customer choice</th>
                  <th>10 km alert trace</th>
                  <th>Wallet gate</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {marketplaceBookingCoverageRows.slice(0, 30).map((row) => (
                  <tr key={row.booking.id}>
                    <td>
                      <strong>
                        <Link className="text-link" href={`/bookings/${row.booking.id}`}>
                          {shortId(row.booking.id)}
                        </Link>
                      </strong>
                      <div className="muted">{bookingCustomerLabel(row.booking)}</div>
                      <div className="muted">{bookingServiceOptionLabel(row.booking)}</div>
                    </td>
                    <td>
                      <span className={`pill ${row.firstPickTone}`}>{row.firstPickLabel}</span>
                      <div className="muted">{bookingMatchingWindowLabel(row.booking, currentTimeMs)}</div>
                    </td>
                    <td>
                      <strong>{row.participantCount} participant record(s)</strong>
                      <div className="muted">
                        {row.marketplaceParticipantCount} marketplace / {row.selectableCount} selectable
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${row.selectedPartnerTone}`}>
                        {row.selectedPartnerLabel}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${row.alertTone}`}>{row.alertLabel}</span>
                      <div className="muted">{row.alertDetail}</div>
                    </td>
                    <td>
                      <span className={`pill ${row.walletTone}`}>{row.walletLabel}</span>
                    </td>
                    <td>
                      <span className={`pill ${row.nextActionTone}`}>{row.nextAction}</span>
                    </td>
                  </tr>
                ))}
                {marketplaceBookingCoverageRows.length > 30 && (
                  <tr>
                    <td colSpan={7}>
                      Showing first 30 booking coverage rows. Narrow filters to inspect the rest.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
        <div className="participant-list" style={{ marginTop: 12 }}>
          <span className="pill pill-info">Participant rows only</span>
          <span className="pill pill-warn">Blocked wallet joins are not participant records</span>
          <span className="pill">Partners may view marketplace requests before join gate</span>
          <span className="pill">Customer-selected final partner only</span>
          <span className="pill">No automatic final assignment</span>
          {marketplaceLedgerPills.map((pill) => (
            <span className={`pill ${pill.tone}`} key={pill.label}>
              {pill.label}
            </span>
          ))}
          <span className="pill">Customer final choice</span>
          <span className="pill">Participant evidence</span>
          <span className="pill">Marketplace participation gate</span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {marketplaceOperationsCards.map((card) => (
            <Link className="ops-task-card" href={card.href} key={card.title}>
              <span className={`signal ${card.tone}`}>{card.title}</span>
              <h3>{card.value}</h3>
              <p>{card.detail}</p>
            </Link>
          ))}
        </div>
        {marketplaceLedgerRows.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 14 }}>
            No participant records match the current booking filters.
          </div>
        ) : (
          <table className="table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Customer / service</th>
                <th>Partner</th>
                <th>Participant evidence</th>
                <th>Status</th>
                <th>Distance</th>
                <th>Window / alerts</th>
                <th>Wallet signal</th>
                <th>Participation / response</th>
                <th>Customer choice</th>
              </tr>
            </thead>
            <tbody>
              {marketplaceLedgerRows.slice(0, 40).map((row) => (
                <tr key={`${row.booking.id}-${row.participant.id}`}>
                  <td>
                    <strong>
                      <Link className="text-link" href={`/bookings/${row.booking.id}`}>
                        {shortId(row.booking.id)}
                      </Link>
                    </strong>
                    <div className="muted">{row.booking.status}</div>
                  </td>
                  <td>
                    <strong>{bookingCustomerLabel(row.booking)}</strong>
                    <div className="muted">{bookingServiceOptionLabel(row.booking)}</div>
                  </td>
                  <td>
                    <strong>{row.partnerLabel}</strong>
                    <div className="muted">{row.participant.providerProfile?.user?.phone ?? 'No phone'}</div>
                    <span className="pill">{row.roleLabel}</span>
                  </td>
                  <td>
                    <span className={`pill ${row.evidenceTone}`}>{row.evidenceLabel}</span>
                    <div className="muted">{row.evidenceDetail}</div>
                  </td>
                  <td>
                    <span className={`pill ${row.statusTone}`}>{row.statusLabel}</span>
                    <div className="muted">{row.participant.providerStatusAtJoin ?? 'Partner state not saved'}</div>
                  </td>
                  <td>
                    <strong>{row.distanceLabel}</strong>
                    <div>
                      <span className={`pill ${row.distancePolicyTone}`}>{row.distancePolicyLabel}</span>
                    </div>
                    <div className="muted">{row.distancePolicyHelper}</div>
                  </td>
                  <td>
                    <div>{row.windowLabel}</div>
                    <span className={`pill ${row.alertTone}`}>{row.alertLabel}</span>
                  </td>
                  <td>
                    <span className={`pill ${row.walletTone}`}>{row.walletLabel}</span>
                  </td>
                  <td>
                    <div>{row.joinedLabel}</div>
                    <div className="muted">{row.respondedLabel}</div>
                  </td>
                  <td>
                    <span className={`pill ${row.choiceTone}`}>{row.choiceLabel}</span>
                    <div className="participant-list" style={{ marginTop: 6 }}>
                      <span className={`pill ${row.chatHandoffTone}`}>{row.chatHandoffLabel}</span>
                    </div>
                    <div className="muted">{row.choiceReason}</div>
                    <small>{row.choiceNextStep}</small>
                  </td>
                </tr>
              ))}
              {marketplaceLedgerRows.length > 40 && (
                <tr>
                  <td colSpan={10}>
                    Showing first 40 participant records. Narrow the booking filters to inspect the rest.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Booking / stage</th>
              <th>Address / customer</th>
              <th>Customer choice</th>
              <th title="Matching rule snapshot">Partner supply</th>
              <th>Chat / location</th>
              <th>Payment / wallet</th>
              <th title="Primary booking command Booking gate reason Action status strip">Ops check</th>
            </tr>
          </thead>
          <tbody>
            {visibleBookings.map((booking) => {
              const flags = bookingCheckFlags(booking, currentTimeMs);
              const checkSignal = bookingCheckLevel(flags);
              const servicePriceLabel = bookingServicePriceLabel(booking);
              const servicePayoutLabel = bookingServicePayoutRuleLabel(booking);
              const pricingPolicy = bookingPricingPolicySignal(booking);
              const matchingPolicy = bookingMatchingPolicySnapshot(booking);
              const stage = bookingListStage(booking, currentTimeMs);
              const addressState = bookingAddressSnapshotState(booking);
              const chatState = bookingChatListState(booking);
              const closureState = bookingClosureListSignal(booking);
              const actionChips = bookingListActionChips(booking, currentTimeMs);
              const matchingRuleSnapshot = bookingMatchingRuleSnapshot(booking, currentTimeMs);
              const finalGateReason = bookingFinalGateReason(booking);
              const commandDecisionStrip = bookingListCommandDecisionStrip(booking);
              return (
                <tr id={`booking-${booking.id}`} key={booking.id}>
                  <td>
                    <strong>
                      <Link className="text-link" href={`/bookings/${booking.id}`}>
                        {shortId(booking.id)}
                      </Link>
                    </strong>
                    <div className="muted">{bookingServiceOptionLabel(booking)}</div>
                    <div className="muted">{servicePriceLabel}</div>
                    {servicePayoutLabel && <div className="muted">{servicePayoutLabel}</div>}
                    {pricingPolicy.status !== 'ready' && (
                      <span className={`pill ${pricingPolicy.tone}`}>{pricingPolicy.label}</span>
                    )}
                    <div className="muted">
                      Opened {formatDate(bookingRequestOpenedAt(booking))}
                    </div>
                    <div className="muted">{recencyLabel(booking, nowMs)}</div>
                    <div style={{ marginTop: 8 }}>
                      <Link className={`pill ${stagePillClass(stage.tone)}`} href={stage.href}>
                        {stage.label}
                      </Link>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {stage.detail}
                    </div>
                    <div className="muted">{stage.action}</div>
                    <div style={{ marginTop: 8 }}>
                      <StatusBadge status={booking.status} />
                    </div>
                    {closureState && (
                      <div className="participant-list" style={{ marginTop: 8 }}>
                        <span className={`pill ${closureState.tone}`}>{closureState.label}</span>
                        <span className="muted">{closureState.detail}</span>
                      </div>
                    )}
                    <div className="muted">
                      {booking.expiresAt ? `Expires ${formatDate(booking.expiresAt)}` : 'No expiry set'}
                    </div>
                    <div className="muted">{matchingPolicySummaryLabel(matchingPolicy)}</div>
                  </td>
                  <td>
                    <span className={`pill ${addressState.tone}`}>{addressState.label}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {addressState.detail}
                    </div>
                    <div className="muted">{addressState.pin}</div>
                    <div style={{ marginTop: 10 }}>
                      <strong>{booking.customerProfile?.user?.fullName ?? 'Customer'}</strong>
                    </div>
                    <div className="muted">{booking.customerProfile?.user?.phone ?? 'No phone'}</div>
                  </td>
                  <td>
                    <span className={`pill ${selectionToneClass(booking)}`}>{selectionLabel(booking)}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {customerVisibleStateLabel(booking)}
                    </div>
                    <div className="muted">{selectionPathLabel(booking)}</div>
                    {booking.selectedProvider ? (
                      <div className="muted">
                        Final partner: {partnerDisplayName(booking.selectedProvider)}
                      </div>
                    ) : (
                      <div className="muted">Final partner: waiting for customer choice</div>
                    )}
                    <div className="muted">{bookingBackupAlertTraceLabel(booking, currentTimeMs)}</div>
                  </td>
                  <td>
                    <strong>{booking.participants?.length ?? 0} participant row(s)</strong>
                    <div className="muted">
                      First-pick {partnerDisplayName(booking.preferredProvider, 'none')}
                    </div>
                    <div className="muted">
                      {booking.preferredProvider?.user?.phone
                        ? `First-pick phone ${booking.preferredProvider.user.phone}`
                        : 'First-pick partner not set'}
                    </div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      <span className={`pill ${matchingPolicy ? 'pill-info' : 'pill-warn'}`}>
                        {matchingPolicy ? 'Saved policy' : 'Live policy default'}
                      </span>
                      <span className={`pill ${bookingBackupAlertTraceTone(booking)}`}>
                        {bookingBackupAlertTracePill(booking)}
                      </span>
                    </div>
                    <div className="stack" style={{ marginTop: 10 }}>
                      <span className="muted">Matching rule snapshot</span>
                      <span className={`pill ${matchingRuleSnapshot.sourceTone}`}>
                        {matchingRuleSnapshot.sourceLabel}
                      </span>
                      <span className="muted">{matchingRuleSnapshot.windowLabel}</span>
                      <span className="muted">{matchingRuleSnapshot.radiusLabel}</span>
                      <span className="muted">{matchingRuleSnapshot.supplyLabel}</span>
                      <span className="muted">{matchingRuleSnapshot.customerChoiceLabel}</span>
                      <small>{matchingRuleSnapshot.operatorAction}</small>
                    </div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      {booking.preferredProvider && (
                        <span className="pill" style={{ background: '#eef6e8', borderColor: '#b9d4a8' }}>
                          First-pick: {partnerDisplayName(booking.preferredProvider)}{' '}
                          {preferredProviderStateLabel(booking)}
                        </span>
                      )}
                      {booking.selectedProvider &&
                        bookingSelectedPartnerIdForChoice(booking) !== bookingPreferredPartnerIdForChoice(booking) && (
                          <span className="pill pill-success">
                            Final: {partnerDisplayName(booking.selectedProvider)}
                          </span>
                        )}
                      {marketplaceParticipants(booking)
                        .slice(0, 4)
                        .map((participant) => (
                          <span className="pill" key={participant.id}>
                            Marketplace: {partnerDisplayName(participant.providerProfile)} (
                            {participant.status})
                          </span>
                        ))}
                    </div>
                    {marketplaceParticipants(booking).length > 4 && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        +{marketplaceParticipants(booking).length - 4} more marketplace partner(s)
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`pill ${chatState.tone}`}>{chatState.label}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {chatState.detail}
                    </div>
                    <div className="muted">{bookingLocationSignalLabel(booking, currentTimeMs)}</div>
                    <div className="participant-list" style={{ marginTop: 8 }}>
                      <span className={`pill ${bookingLocationToneClass(booking, currentTimeMs)}`}>
                        {bookingLocationPillLabel(booking, currentTimeMs)}
                      </span>
                    </div>
                  </td>
                  <td>
                    {booking.payment?.status ?? 'NONE'}
                    <div className="muted">
                      {booking.payment
                        ? `${booking.payment.amount} ${booking.payment.currency ?? 'VND'} - ${booking.payment.method}`
                        : 'No payment'}
                    </div>
                    {booking.payment?.id && (
                      <div className="actions" style={{ marginTop: 8 }}>
                        <Link className="text-link" href={`/bookings/${booking.id}`}>
                          Detail
                        </Link>
                        <Link className="text-link" href={`/payments#payment-${booking.payment.id}`}>
                          Open payment
                        </Link>
                        {(booking.status === 'REFUNDED' || booking.payment.status === 'REFUNDED') && (
                          <Link className="text-link" href="/refunds">
                            Refund board
                          </Link>
                        )}
                      </div>
                    )}
                    {bookingCashDebtNeedsOps(booking) && (
                      <div style={{ marginTop: 8 }}>
                        <span className="pill pill-warn">Partner wallet debt</span>
                      </div>
                    )}
                    {bookingCashDebtNeedsOps(booking) && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        Cash fee debt{' '}
                        {money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}
                      </div>
                    )}
                    {booking.earning?.id && (
                      <div className="actions" style={{ marginTop: 8 }}>
                        <Link className="text-link" href={`/earnings#earning-${booking.earning.id}`}>
                          Open earning
                        </Link>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`signal ${checkSignal.tone}`}>{checkSignal.label}</span>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {checkSignal.helper}
                    </div>
                    {flags.length > 0 && <div className="muted">{flags[0].title}</div>}
                    <div style={{ marginTop: 8 }}>{opsSignal(booking)}</div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {nextAction(booking)}
                    </div>
                    <div className="participant-list" style={{ marginTop: 10 }}>
                      <span className="muted">Primary booking command</span>
                      <Link
                        className={`pill ${commandDecisionStrip.tone}`}
                        href={`/bookings/${booking.id}#booking-command-decision-strip`}
                        title={commandDecisionStrip.primaryDetail}
                      >
                        {commandDecisionStrip.primaryAction}
                      </Link>
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {commandDecisionStrip.status}: {commandDecisionStrip.primaryDetail}
                    </div>
                    <div className="participant-list" style={{ marginTop: 10 }}>
                      <span className="muted">Booking gate reason</span>
                      <Link
                        className={`pill ${finalGateReason.tone}`}
                        href={finalGateReason.href}
                        title={finalGateReason.detail}
                      >
                        {finalGateReason.label}
                      </Link>
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {finalGateReason.detail}
                    </div>
                    <div className="participant-list" style={{ marginTop: 10 }}>
                      <span className="muted">Action status strip</span>
                      {actionChips.map((chip) => (
                        <Link
                          className={`pill ${chip.tone}`}
                          href={chip.href}
                          key={chip.label}
                          title={chip.detail}
                        >
                          {chip.label}
                        </Link>
                      ))}
                    </div>
                    {closureState && (
                      <div className="muted" style={{ marginTop: 8 }}>
                        Closure evidence: {closureState.detail}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibleBookings.length === 0 && (
              <tr>
                <td colSpan={7}>{emptyBookingMessage(view)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

const bookingViewOptions: Array<{
  view: BookingView;
  label: string;
  description: string;
  operatorHint: string;
}> = [
  {
    view: 'active',
    label: 'Active only',
    description: 'live dispatch work across matching, arrival, and in-service states.',
    operatorHint:
      'Use this during operations to catch stalled matching, missing location, or unresolved payment follow-up.',
  },
  {
    view: 'attention',
    label: 'Follow-up queue',
    description: 'bookings with expired matching, unresolved payment, or missing chat after matching.',
    operatorHint: 'Use this as the first dispatch checklist view when the dashboard shows attention needed.',
  },
  {
    view: 'matching',
    label: 'Matching ops',
    description:
      'direct first-pick, marketplace participant, final customer selection, and chat handoff work.',
    operatorHint:
      'Use this during live dispatch to manage the 10-minute partner response window and marketplace participant escalation.',
  },
  {
    view: 'first-pick',
    label: 'Stage 1 first-pick',
    description: 'open bookings where the selected partner still has the first response window.',
    operatorHint:
      'Use this to monitor the 10-minute response window, push delivery, KYC, wallet gate, and partner decision timing.',
  },
  {
    view: 'marketplace',
    label: 'Stage 2 marketplace',
    description: 'open bookings where marketplace partners can participate or need a dispatch nudge.',
    operatorHint:
      'Use this to manage the marketplace participant pool, stale location checks, and availability alert delivery.',
  },
  {
    view: 'customer-choice',
    label: 'Stage 3 choice',
      description: 'open bookings with participating/accepted partners waiting for customer final selection.',
    operatorHint:
      'Use this when customer support should guide the customer to choose one final partner before matched chat opens.',
  },
  {
    view: 'handoff-repair',
    label: 'Stage 4 repair',
    description: 'matched bookings whose final partner is selected but chat handoff is missing.',
    operatorHint:
      'Use this as a dispatch repair queue. Chat must be fixed before arrival, start, and completion flow.',
  },
  {
    view: 'no-supply',
    label: 'No supply',
    description: 'open matching bookings with no partner participation yet.',
    operatorHint:
      'Use this when customers are waiting but no partner participation is recorded. Call/notify nearby partners or review location/service pricing.',
  },
  {
    view: 'blocked-create',
    label: 'Blocked create',
    description: 'booking create attempts rejected before payment authorization and matching.',
    operatorHint:
      'Use this to debug optional GPS evidence, service address, and first-pick partner distance gates before support follow-up.',
  },
  {
    view: 'address',
    label: 'Address check',
    description: 'bookings missing the immutable customer service address snapshot.',
    operatorHint:
      'Use this before dispatch. A confirmed address snapshot protects customer, partner, and admin records.',
  },
  {
    view: 'manual-decision',
    label: 'Manual decision',
    description:
      'cancelled, expired, no-show, cash-debt, or completed closeout bookings that need admin evidence review.',
    operatorHint:
      'Use this before changing outcomes, refunds, cash fee settlement, or closeout records. Decide from factual evidence only.',
  },
  {
    view: 'payment',
    label: 'Payment ops',
    description: 'bookings whose payment state can block closeout, refund, capture, or settlement.',
    operatorHint:
      'Use this to catch completed authorized payments, cancelled unresolved holds, cash pending, and missing refs.',
  },
  {
    view: 'cash-debt',
    label: 'Cash debt',
    description: 'cash bookings that created partner fee/tax debt and can block marketplace alerts, participation, or payout release.',
    operatorHint:
      'Use this with Cash Settlements to confirm deposit or admin offset before the partner participates in marketplace bookings again.',
  },
  {
    view: 'closeout',
    label: 'Closeout ops',
    description: 'completed bookings missing capture, earning, tax, platform fee, or wallet ledger records.',
    operatorHint:
      'Use this after service completion to reconcile payment capture, partner earning, tax logs, and wallet ledger entries.',
  },
  {
    view: 'pricing',
    label: 'Pricing ops',
    description: 'bookings whose service price is not backed by the active service payout matrix.',
    operatorHint:
      'Use this after changing service prices or payout rules to catch hidden finance mismatches before settlement.',
  },
  {
    view: 'location',
    label: 'Location ops',
    description: 'on-the-way or in-service bookings with missing or stale partner location records.',
    operatorHint:
      'Use this only for live service states. The MVP tracks last-known location, not live route streaming.',
  },
  {
    view: 'chat',
    label: 'Chat live',
    description: 'bookings where customer/partner communication is already available.',
    operatorHint:
      'Use this to inspect service handoff quality, quiet chats, and route/location expectations.',
  },
  {
    view: 'chat-repair',
    label: 'Chat repair',
    description: 'matched or active bookings whose chat room is missing.',
    operatorHint:
      'Use this when a matched customer and partner cannot coordinate. Repair chat before arrival, service start, or completion.',
  },
  {
    view: 'chat-evidence',
    label: 'Chat evidence',
    description:
      'bookings where chat, location, alerts, or notes should be reviewed before a manual outcome.',
    operatorHint:
      'Use this before cancellation, no-show, payment release, refund, or closeout decisions that depend on communication evidence.',
  },
  {
    view: 'evidence-missing',
    label: 'Evidence missing',
    description:
      'manual-decision bookings that do not yet have enough retained chat, location, or alert context.',
    operatorHint:
      'Use this to add an operator note or repair missing records before changing a booking outcome.',
  },
  {
    view: 'refund-review',
    label: 'Refund review',
    description:
      'bookings whose payment or refund state needs admin review after cancellation, expiry, no-show, or dispute.',
    operatorHint:
      'Use this with the evidence board before releasing, refunding, or reconciling customer payment movement.',
  },
  {
    view: 'expired',
    label: 'Expired',
    description: 'bookings closed by timeout and waiting for payment release or customer follow-up review.',
    operatorHint:
      'Use this after manual or automatic expiry to confirm payment release, refund decision, and customer communication.',
  },
  {
    view: 'no-show',
    label: 'No-show',
    description: 'bookings closed as no-show but still needing payment, customer, or partner review.',
    operatorHint:
      'Use this after marking no-show to confirm payment outcome, partner debt, and customer communication.',
  },
  {
    view: 'all',
    label: 'All bookings',
    description: 'full booking history for investigation, finance follow-up, and audit review.',
    operatorHint: 'Use this when you need cancelled, completed, refunded, or old matching records.',
  },
];

function buildBookingCommandCenter(bookings: AdminBooking[], nowMs: number): BookingCommandLane[] {
  const active = bookings.filter((booking) => activeStatuses.has(booking.status));
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const noSupply = open.filter((booking) => (booking.participants?.length ?? 0) === 0);
  const preferredPending = open.filter((booking) => bookingFirstPickPending(booking));
  const expiredMatching = open.filter(
    (booking) => booking.expiresAt && new Date(booking.expiresAt).getTime() < nowMs,
  );
  const matchedWithoutChat = bookings.filter((booking) => bookingChatRepairNeedsOps(booking));
  const paymentChecks = bookings.filter((booking) => bookingPaymentNeedsOps(booking));
  const noShow = bookings.filter((booking) => booking.status === 'NO_SHOW');
  const closeoutChecks = bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking));
  const pricingChecks = bookings.filter((booking) => bookingPricingPolicyNeedsOps(booking));
  const cashDebt = bookings.filter((booking) => bookingCashDebtNeedsOps(booking));
  const locationChecks = bookings.filter((booking) => bookingLocationNeedsOps(booking, nowMs));
  const backupSelected = bookings.filter((booking) => isBackupSelected(booking));
  const chatEvidence = bookings.filter((booking) => bookingChatEvidenceNeedsOps(booking, nowMs));
  const evidenceMissing = bookings.filter((booking) => bookingDecisionEvidenceMissing(booking, nowMs));
  const refundReview = bookings.filter((booking) => bookingRefundReviewNeedsOps(booking));
  const quietChat = bookings.filter(
    (booking) =>
      booking.chatRoom &&
      (booking.chatRoom.messages?.length ?? 0) === 0 &&
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );

  return [
    {
      title: 'Dispatch pressure',
      status: noSupply.length > 0 || expiredMatching.length > 0 ? 'Action needed' : 'Stable',
      tone: expiredMatching.length > 0 ? 'danger' : noSupply.length > 0 ? 'warn' : 'ok',
      detail:
        noSupply.length > 0
          ? 'Open matching has customer demand without partner supply.'
          : 'Active booking demand has enough current operating data.',
      href:
        noSupply.length > 0 || expiredMatching.length > 0
          ? noSupply.length > 0
            ? '/bookings?view=no-supply'
            : '/bookings?view=attention'
          : '/bookings?view=active',
      metrics: [
        metric('active', active.length),
        metric('open', open.length),
        metric('no supply', noSupply.length),
        metric('preferred pending', preferredPending.length),
      ],
    },
    {
      title: 'Customer protection',
      status: expiredMatching.length > 0 || matchedWithoutChat.length > 0 ? 'Protect now' : 'Clear',
      tone:
        expiredMatching.length > 0 || matchedWithoutChat.length > 0
          ? 'danger'
          : locationChecks.length > 0
            ? 'warn'
            : 'ok',
      detail:
        expiredMatching.length > 0
          ? 'Matching window expired before a final partner was selected.'
          : 'Customer-facing booking handoff has no critical blocker.',
      href:
        expiredMatching.length > 0 || matchedWithoutChat.length > 0
          ? '/bookings?view=attention'
          : '/bookings?view=location',
      metrics: [
        metric('expired', expiredMatching.length),
        metric('no chat', matchedWithoutChat.length),
        metric('location checks', locationChecks.length),
        metric('quiet chat', quietChat.length),
      ],
    },
    {
      title: 'Evidence readiness',
      status:
        evidenceMissing.length > 0 ? 'Needs records' : chatEvidence.length > 0 ? 'Review ready' : 'Clear',
      tone: evidenceMissing.length > 0 ? 'warn' : chatEvidence.length > 0 ? 'info' : 'ok',
      detail:
        evidenceMissing.length > 0
          ? 'Some manual outcome bookings need retained chat, alert, or location context before action.'
          : chatEvidence.length > 0
            ? 'Communication evidence is available for bookings that may need operator review.'
            : 'No booking currently needs a chat evidence decision board review.',
      href:
        evidenceMissing.length > 0
          ? '/bookings?view=evidence-missing'
          : chatEvidence.length > 0
            ? '/bookings?view=chat-evidence'
            : '/bookings?view=manual-decision',
      metrics: [
        metric('chat evidence', chatEvidence.length),
        metric('evidence missing', evidenceMissing.length),
        metric('refund review', refundReview.length),
        metric('quiet chat', quietChat.length),
      ],
    },
    {
      title: 'Payment closeout',
      status:
        paymentChecks.length > 0 || closeoutChecks.length > 0 || noShow.length > 0 || pricingChecks.length > 0
          ? 'Review'
          : 'Ready',
      tone:
        closeoutChecks.length > 0
          ? 'danger'
          : paymentChecks.length > 0
            ? 'danger'
            : noShow.length > 0
              ? 'warn'
              : pricingChecks.length > 0
                ? 'warn'
                : 'ok',
      detail:
        closeoutChecks.length > 0
          ? 'Completed bookings are missing earning, tax, platform fee, or wallet closeout records.'
          : paymentChecks.length > 0
            ? 'Some bookings need capture, release, refund, cash debt, or missing reference review.'
            : noShow.length > 0
              ? 'No-show bookings need a clear payment and customer communication outcome.'
              : 'Payment and service pricing policy records are aligned.',
      href:
        closeoutChecks.length > 0
          ? '/bookings?view=closeout'
          : paymentChecks.length > 0
            ? cashDebt.length > 0
              ? '/bookings?view=cash-debt'
              : '/bookings?view=payment'
            : noShow.length > 0
              ? '/bookings?view=no-show'
              : '/bookings?view=pricing',
      metrics: [
        metric('payment', paymentChecks.length),
        metric('closeout', closeoutChecks.length),
        metric('no-show', noShow.length),
        metric('pricing', pricingChecks.length),
        metric('cash debt', cashDebt.length),
        metric(
          'missing refs',
          bookings.filter(
            (booking) => booking.payment?.status === 'AUTHORIZED' && !booking.payment.providerRef,
          ).length,
        ),
      ],
    },
    {
      title: 'Handoff quality',
      status: locationChecks.length > 0 || quietChat.length > 0 ? 'Monitor' : 'Clear',
      tone: locationChecks.length > 0 ? 'warn' : quietChat.length > 0 ? 'info' : 'ok',
      detail:
        locationChecks.length > 0
          ? 'Live service state has missing or stale last-known partner location.'
          : 'Chat, marketplace selection, and location handoff look normal.',
      href: locationChecks.length > 0 ? '/bookings?view=location' : '/bookings?view=chat',
      metrics: [
        metric('location', locationChecks.length),
        metric('marketplace chosen', backupSelected.length),
        metric('chat live', bookings.filter((booking) => bookingMatchingChatReady(booking)).length),
        metric('quiet chat', quietChat.length),
      ],
    },
  ];
}

function buildBookingNextActions(bookings: AdminBooking[], nowMs: number): BookingNextAction[] {
  return bookings
    .map<BookingNextAction | null>((booking) => {
      const flags = bookingCheckFlags(booking, nowMs);
      const highestFlag = flags.sort((left, right) => checkFlagWeight(right) - checkFlagWeight(left))[0];

      if (highestFlag) {
        return {
          booking,
          title: highestFlag.title,
          detail: nextAction(booking),
          operatorAction: bookingOperatorAction(booking, nowMs, highestFlag),
          owner: bookingActionOwner(booking, highestFlag),
          priority: bookingActionPriority(booking, nowMs, highestFlag),
          tone:
            highestFlag.severity === 'high' ? 'danger' : highestFlag.severity === 'medium' ? 'warn' : 'info',
          href: `/bookings/${booking.id}`,
          tags: [
            booking.payment?.method ? `payment ${booking.payment.method}` : 'payment missing',
            booking.chatRoom ? 'chat ready' : 'chat pending',
            selectionLabel(booking),
          ],
        } satisfies BookingNextAction;
      }

      if (activeStatuses.has(booking.status)) {
        return {
          booking,
          title: 'Monitor active booking',
          detail: nextAction(booking),
          operatorAction: bookingOperatorAction(booking, nowMs),
          owner: bookingActionOwner(booking),
          priority: bookingActionPriority(booking, nowMs),
          tone: 'info',
          href: `/bookings/${booking.id}`,
          tags: [
            booking.payment?.status ? `payment ${booking.payment.status}` : 'payment pending',
            bookingLocationPillLabel(booking, nowMs),
          ],
        } satisfies BookingNextAction;
      }

      return null;
    })
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

function buildCustomerProtectionBoard(bookings: AdminBooking[]): BookingProtectionLane[] {
  const cancelledUnresolved = bookings.filter(
    (booking) =>
      booking.status === 'CANCELLED' &&
      Boolean(booking.payment) &&
      !['RELEASED', 'REFUNDED'].includes(booking.payment?.status ?? ''),
  );
  const expiredUnresolved = bookings.filter(
    (booking) =>
      booking.status === 'EXPIRED' &&
      Boolean(booking.payment) &&
      !['RELEASED', 'REFUNDED'].includes(booking.payment?.status ?? ''),
  );
  const noShowUnresolved = bookings.filter(
    (booking) =>
      booking.status === 'NO_SHOW' &&
      Boolean(booking.payment) &&
      !['RELEASED', 'REFUNDED'].includes(booking.payment?.status ?? ''),
  );
  const completedCloseout = bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking));
  const cashDebt = bookings.filter((booking) => bookingCashDebtNeedsOps(booking));

  return [
    {
      title: 'Cancelled payment release',
      status: cancelledUnresolved.length ? 'Release/refund' : 'Clear',
      tone: cancelledUnresolved.length ? 'danger' : 'ok',
      detail:
        cancelledUnresolved.length > 0
          ? 'Customer cancelled, but the linked payment is not released or refunded yet.'
          : 'Cancelled bookings have no unresolved payment hold in the current snapshot.',
      operatorAction: 'Open payment queue and close customer money movement before support follow-up.',
      href: '/bookings?view=payment',
      bookings: cancelledUnresolved,
    },
    {
      title: 'Expired matching closeout',
      status: expiredUnresolved.length ? 'Timeout review' : 'Clear',
      tone: expiredUnresolved.length ? 'danger' : 'ok',
      detail:
        expiredUnresolved.length > 0
          ? 'Matching expired before final partner selection, but payment still needs an outcome.'
          : 'Expired bookings have payment release/refund state aligned.',
      operatorAction: 'Release the hold, confirm customer notification, and check retry/alert history.',
      href: '/bookings?view=expired',
      bookings: expiredUnresolved,
    },
    {
      title: 'No-show outcome',
      status: noShowUnresolved.length ? 'Evidence needed' : 'Clear',
      tone: noShowUnresolved.length ? 'warn' : 'ok',
      detail:
        noShowUnresolved.length > 0
          ? 'No-show bookings still need a payment, fee, or customer support decision.'
          : 'No-show bookings have no unresolved payment in the current snapshot.',
      operatorAction: 'Review chat, arrival/location evidence, customer response, then decide payment handling.',
      href: '/bookings?view=no-show',
      bookings: noShowUnresolved,
    },
    {
      title: 'Completed service reconciliation',
      status: completedCloseout.length ? 'Closeout missing' : 'Clear',
      tone: completedCloseout.length ? 'danger' : 'ok',
      detail:
        completedCloseout.length > 0
          ? 'Completed bookings are missing capture, earning, tax, platform fee, or wallet ledger records.'
          : 'Completed bookings are reconciled against payment and ledger requirements.',
      operatorAction: 'Run or inspect closeout before payout, tax, and review workflows continue.',
      href: '/bookings?view=closeout',
      bookings: completedCloseout,
    },
    {
      title: 'Cash fee debt',
      status: cashDebt.length ? 'Partner blocked' : 'Clear',
      tone: cashDebt.length ? 'danger' : 'ok',
      detail:
        cashDebt.length > 0
          ? 'Cash bookings created negative wallet balances that require settlement before final acceptance, service start, or payout release.'
          : 'No cash booking currently creates an unpaid HANDS fee debt blocker.',
      operatorAction: 'Collect Partner fee deposit or settle from available earnings before final acceptance, service start, or payout release.',
      href: '/bookings?view=cash-debt',
      bookings: cashDebt,
    },
  ];
}

function buildMatchingEscalationBoard(
  bookings: AdminBooking[],
  nowMs: number,
): readonly AdminBookingMatchingEscalationLane[] {
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const expiredWindow = open.filter((booking) => bookingMatchingWindowExpired(booking, nowMs));
  const firstPickWaiting = open.filter((booking) => bookingFirstPickPending(booking));
  const noMarketplaceSupply = open.filter((booking) => bookingMarketplaceParticipantCount(booking) === 0);
  const marketplaceReady = open.filter((booking) => bookingMarketplaceParticipantCount(booking) > 0);
  const customerFinalSelection = open.filter((booking) => bookingCustomerSelectableCount(booking) > 0);
  const matchedWithoutChat = bookings.filter(
    (booking) => booking.status === 'MATCHED' && !bookingMatchingChatReady(booking),
  );
  const chatReady = bookings.filter((booking) => bookingMatchingChatReady(booking));

  return buildBookingMatchingEscalationBoard({
    chatReady,
    customerFinalSelection,
    expiredWindow,
    firstPickWaiting,
    marketplaceReady,
    matchedWithoutChat,
    noMarketplaceSupply,
  });
}

function buildBookingDispatchPartnerShortcuts(
  bookings: AdminBooking[],
  nowMs: number,
): BookingDispatchPartnerShortcut[] {
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const noPartnerSupply = openMatching.filter((booking) => bookingMarketplaceParticipantCount(booking) === 0);
  const firstPickWaiting = openMatching.filter((booking) => bookingFirstPickPending(booking));
  const customerSelection = openMatching.filter((booking) => bookingCustomerSelectableCount(booking) > 0);
  const cashDebt = bookings.filter((booking) => bookingCashDebtNeedsOps(booking));
  const locationChecks = bookings.filter((booking) => bookingLocationNeedsOps(booking, nowMs));

  return [
    {
      title: 'Partner handoff',
      value: 'Open',
      detail: 'Full partner command view with direct, marketplace, KYC, wallet, location, and alert lanes.',
      href: '/partners',
      tone: openMatching.length ? 'info' : 'ok',
    },
    {
      title: 'Direct-ready partners',
      value: firstPickWaiting.length.toString(),
      detail: 'Use when preferred partners must answer inside the response window.',
      href: '/partners?review=direct-ready',
      tone: firstPickWaiting.length ? 'warn' : 'ok',
    },
    {
      title: 'Marketplace-ready',
      value: noPartnerSupply.length.toString(),
      detail: 'Use when open matching has no marketplace supply or customer options.',
      href: '/partners?review=marketplace-ready',
      tone: noPartnerSupply.length ? 'warn' : 'ok',
    },
    {
      title: 'Acceptance blockers',
      value: customerSelection.length.toString(),
      detail: 'Repair KYC, bank, wallet, location, push, or control gates before dispatch pressure rises.',
      href: '/partners?review=acceptance-blocked',
      tone: customerSelection.length ? 'info' : 'ok',
    },
    {
      title: 'Cash fee debt',
      value: cashDebt.length.toString(),
      detail: 'Cash bookings can create negative Partner wallets that block final acceptance, service start, and payout release.',
      href: '/cash-settlements',
      tone: cashDebt.length ? 'danger' : 'ok',
    },
    {
      title: 'Location refresh',
      value: locationChecks.length.toString(),
      detail: 'Live booking location checks should send operators to partner location freshness review.',
      href: '/partners?review=location',
      tone: locationChecks.length ? 'warn' : 'ok',
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

function buildMatchingFlowTimeline(bookings: AdminBooking[], nowMs: number): readonly AdminBookingMatchingFlowStep[] {
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const firstPickWaiting = open.filter((booking) => bookingFirstPickPending(booking));
  const firstPickExpired = firstPickWaiting.filter((booking) => bookingMatchingWindowExpired(booking, nowMs));
  const noSupply = open.filter((booking) => bookingMarketplaceParticipantCount(booking) === 0);
  const marketplaceVisible = open.filter((booking) => bookingMarketplaceParticipantCount(booking) > 0);
  const backupAlerted = open.filter((booking) => bookingBackupAlertTraceSummary(booking).totalNotified > 0);
  const customerChoice = open.filter((booking) => bookingCustomerSelectableCount(booking) > 0);
  const matched = bookings.filter((booking) => booking.status === 'MATCHED');
  const matchedWithoutChat = matched.filter((booking) => !bookingMatchingChatReady(booking));
  const liveHandoff = bookings.filter((booking) =>
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );
  const locationChecks = liveHandoff.filter((booking) => bookingLocationNeedsOps(booking, nowMs));

  return buildBookingMatchingFlowTimeline({
    backupAlerted,
    customerChoice,
    firstPickExpired,
    firstPickWaiting,
    liveHandoff,
    locationChecks,
    marketplaceVisible,
    matched,
    matchedWithoutChat,
    noSupply,
  });
}

function bookingStageCounts(bookings: AdminBooking[], nowMs: number) {
  return bookings.reduce((counts, booking) => {
    const stage = bookingListStage(booking, nowMs).key;
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
    return counts;
  }, new Map<BookingListStageKey, number>());
}

function bookingMonitorSummaryRows(input: {
  bookings: AdminBooking[];
  blockedCreateAttemptCount: number;
  nowMs: number;
}): BookingMonitorSummaryRow[] {
  const open = input.bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const matched = input.bookings.filter((booking) => booking.status === 'MATCHED');
  const active = input.bookings.filter((booking) => activeStatuses.has(booking.status));
  const noParticipants = open.filter((booking) => (booking.participants?.length ?? 0) === 0);
  const waitingSelection = open.filter((booking) => bookingMarketplaceParticipantCount(booking) > 0);
  const preferredPending = open.filter((booking) => bookingFirstPickPending(booking));
  const backupChosen = input.bookings.filter((booking) => isBackupSelected(booking));
  const chatLive = input.bookings.filter((booking) => bookingMatchingChatReady(booking));
  const noShow = input.bookings.filter((booking) => booking.status === 'NO_SHOW');
  const expired = input.bookings.filter((booking) => booking.status === 'EXPIRED');
  const policySnapshots = input.bookings.filter((booking) => bookingMatchingPolicySnapshot(booking));
  const paymentChecks = input.bookings.filter((booking) => bookingPaymentNeedsOps(booking));
  const closeoutChecks = input.bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking));
  const pricingChecks = input.bookings.filter((booking) => bookingPricingPolicyNeedsOps(booking));
  const addressChecks = input.bookings.filter((booking) => bookingAddressNeedsOps(booking));
  const locationChecks = input.bookings.filter((booking) => bookingLocationNeedsOps(booking, input.nowMs));
  const chatRepair = input.bookings.filter((booking) => bookingChatRepairNeedsOps(booking));
  const chatEvidence = input.bookings.filter((booking) => bookingChatEvidenceNeedsOps(booking, input.nowMs));
  const evidenceMissing = input.bookings.filter((booking) =>
    bookingDecisionEvidenceMissing(booking, input.nowMs),
  );
  const refundReview = input.bookings.filter((booking) => bookingRefundReviewNeedsOps(booking));
  const actionChecks = input.bookings.filter((booking) =>
    bookingCheckFlags(booking, input.nowMs).some((flag) => flag.severity === 'high'),
  );
  const stageCounts = bookingStageCounts(input.bookings, input.nowMs);

  return [
    ['Active bookings', active.length.toString()],
    ['Open matching', open.length.toString()],
    ['Matched', matched.length.toString()],
    ['Follow-up queue', actionChecks.length.toString()],
    ['Blocked create attempts', input.blockedCreateAttemptCount.toString()],
    ['Stage 1 first-pick', (stageCounts.get('first-pick') ?? 0).toString()],
    ['Stage 2 marketplace', (stageCounts.get('marketplace') ?? 0).toString()],
    ['Stage 3 customer choice', (stageCounts.get('customer-choice') ?? 0).toString()],
    ['Stage 4 handoff repair', (stageCounts.get('handoff-repair') ?? 0).toString()],
    ['No partners yet', noParticipants.length.toString()],
    ['First-pick pending', preferredPending.length.toString()],
    ['Marketplace options', waitingSelection.length.toString()],
    ['Marketplace selected', backupChosen.length.toString()],
    ['Chat live', chatLive.length.toString()],
    ['No-show', noShow.length.toString()],
    ['Expired', expired.length.toString()],
    ['Policy snapshots', policySnapshots.length.toString()],
    ['Address checks', addressChecks.length.toString()],
    ['Payment checks', paymentChecks.length.toString()],
    ['Closeout checks', closeoutChecks.length.toString()],
    ['Pricing checks', pricingChecks.length.toString()],
    ['Location checks', locationChecks.length.toString()],
    ['Chat repair', chatRepair.length.toString()],
    ['Chat evidence review', chatEvidence.length.toString()],
    ['Evidence missing', evidenceMissing.length.toString()],
    ['Refund review', refundReview.length.toString()],
  ];
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
    isHandoffStatus: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(
      booking.status,
    ),
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
  if (view === 'attention') {
    return bookingCheckFlags(booking, nowMs).some((flag) => flag.severity === 'high');
  }
  if (view === 'matching') {
    return bookingMatchingEscalationNeedsOps(booking, nowMs);
  }
  if (view === 'first-pick') {
    return bookingListStage(booking, nowMs).key === 'first-pick';
  }
  if (view === 'marketplace') {
    return bookingListStage(booking, nowMs).key === 'marketplace';
  }
  if (view === 'customer-choice') {
    return bookingListStage(booking, nowMs).key === 'customer-choice';
  }
  if (view === 'handoff-repair') {
    return bookingListStage(booking, nowMs).key === 'handoff-repair';
  }
  if (view === 'no-supply') {
    return booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0;
  }
  if (view === 'address') {
    return bookingAddressNeedsOps(booking);
  }
  if (view === 'manual-decision') {
    return bookingManualDecisionNeedsOps(booking);
  }
  if (view === 'payment') {
    return bookingPaymentNeedsOps(booking);
  }
  if (view === 'cash-debt') {
    return bookingCashDebtNeedsOps(booking);
  }
  if (view === 'closeout') {
    return bookingCompletedCloseoutNeedsOps(booking);
  }
  if (view === 'pricing') {
    return bookingPricingPolicyNeedsOps(booking);
  }
  if (view === 'location') {
    return bookingLocationNeedsOps(booking, nowMs);
  }
  if (view === 'chat') {
    return bookingMatchingChatReady(booking);
  }
  if (view === 'chat-repair') {
    return bookingChatRepairNeedsOps(booking);
  }
  if (view === 'chat-evidence') {
    return bookingChatEvidenceNeedsOps(booking, nowMs);
  }
  if (view === 'evidence-missing') {
    return bookingDecisionEvidenceMissing(booking, nowMs);
  }
  if (view === 'refund-review') {
    return bookingRefundReviewNeedsOps(booking);
  }
  if (view === 'expired') {
    return booking.status === 'EXPIRED';
  }
  if (view === 'no-show') {
    return booking.status === 'NO_SHOW';
  }
  if (view === 'all') {
    return true;
  }
  return activeStatuses.has(booking.status);
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
  if (evidenceFilter === 'all') {
    return true;
  }
  if (evidenceFilter === 'address') {
    return bookingAddressNeedsOps(booking);
  }
  if (evidenceFilter === 'partner') {
    return (
      booking.status === 'OPEN_MATCHING' || (activeStatuses.has(booking.status) && !bookingHasFinalPartner(booking))
    );
  }
  if (evidenceFilter === 'chat') {
    return bookingChatRepairNeedsOps(booking) || bookingMatchingChatReady(booking);
  }
  if (evidenceFilter === 'money') {
    return (
      bookingPaymentNeedsOps(booking) ||
      bookingCashDebtNeedsOps(booking) ||
      bookingCompletedCloseoutNeedsOps(booking)
    );
  }
  if (evidenceFilter === 'location') {
    return bookingLocationNeedsOps(booking, nowMs) || hasProviderLocation(booking);
  }
  if (evidenceFilter === 'alerts') {
    return bookingAlertEvidenceNeedsOps(booking, nowMs);
  }
  if (evidenceFilter === 'closeout') {
    return (
      terminalBookingStatuses.has(booking.status) ||
      bookingCompletedCloseoutNeedsOps(booking) ||
      booking.status === 'NO_SHOW'
    );
  }
  return true;
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
  if (flag?.severity === 'high') {
    return 'P0';
  }
  if (
    booking.status === 'NO_SHOW' ||
    booking.status === 'EXPIRED' ||
    bookingPaymentNeedsOps(booking) ||
    bookingCompletedCloseoutNeedsOps(booking)
  ) {
    return 'P0';
  }
  if (
    flag?.severity === 'medium' ||
    booking.status === 'MATCHED' ||
    booking.status === 'PROVIDER_ON_THE_WAY' ||
    bookingLocationNeedsOps(booking, nowMs)
  ) {
    return 'P1';
  }
  if (booking.status === 'OPEN_MATCHING' || booking.status === 'ARRIVED' || booking.status === 'IN_SERVICE') {
    return 'P2';
  }
  return 'P3';
}

function bookingActionOwner(booking: AdminBooking, flag?: BookingCheckFlag): BookingNextAction['owner'] {
  if (
    flag?.title.toLowerCase().includes('payment') ||
    flag?.title.toLowerCase().includes('closeout') ||
    flag?.title.toLowerCase().includes('cash') ||
    flag?.title.toLowerCase().includes('payout') ||
    bookingPaymentNeedsOps(booking) ||
    bookingCompletedCloseoutNeedsOps(booking)
  ) {
    return 'Finance';
  }
  if (booking.status === 'NO_SHOW' || flag?.title.toLowerCase().includes('no-show')) {
    return 'Safety';
  }
  if (
    booking.status === 'CANCELLED' ||
    booking.status === 'EXPIRED' ||
    flag?.title.toLowerCase().includes('chat')
  ) {
    return 'Support';
  }
  return 'Dispatch';
}

function bookingOperatorAction(booking: AdminBooking, nowMs: number, flag?: BookingCheckFlag) {
  if (bookingCashDebtNeedsOps(booking)) {
    return 'Confirm Partner wallet debt and request company fee settlement before final acceptance, service start, or payout release resumes.';
  }
  if (bookingCompletedCloseoutNeedsOps(booking)) {
    return 'Run closeout reconciliation so payment, earning, tax, fee, and wallet records match.';
  }
  if (bookingPaymentNeedsOps(booking)) {
    return 'Open the booking payment panel and decide capture, release, refund, cash debt, or missing reference handling.';
  }
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
  if (bookingLocationNeedsOps(booking, nowMs)) {
    return 'Ask the partner to refresh location once; use last-known location only, no live routing.';
  }
  if (booking.status === 'IN_SERVICE') {
    return 'Monitor completion timing and prepare payment capture or cash fee ledger closeout.';
  }
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

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}

function opsSignal(booking: AdminBooking) {
  const participantCount = bookingMarketplaceParticipantCount(booking);
  if (booking.status === 'NO_SHOW') {
    return booking.payment && !['RELEASED', 'REFUNDED'].includes(booking.payment.status) ? (
      <span className="signal signal-warn">No-show, check payment</span>
    ) : (
      <span className="signal signal-ok">No-show closed</span>
    );
  }
  if (booking.status === 'EXPIRED') {
    return booking.payment?.status === 'RELEASED' ? (
      <span className="signal signal-ok">Expired and released</span>
    ) : (
      <span className="signal signal-warn">Expired, check payment</span>
    );
  }
  if (booking.status === 'CANCELLED') {
    return booking.payment?.status === 'RELEASED' ? (
      <span className="signal signal-ok">Cancelled and released</span>
    ) : (
      <span className="signal signal-warn">Cancelled, check payment</span>
    );
  }
  if (booking.status === 'REFUNDED') {
    return <span className="signal signal-warn">Refunded</span>;
  }
  if (bookingCashDebtNeedsOps(booking)) {
    return <span className="signal signal-warn">Cash fee debt</span>;
  }
  if (
    booking.status === 'OPEN_MATCHING' &&
    bookingFirstPickPending(booking)
  ) {
    return <span className="signal signal-warn">First-pick partner pending</span>;
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    return <span className="signal signal-warn">No marketplace partners yet</span>;
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount > 0) {
    return <span className="signal signal-info">Marketplace options ready</span>;
  }
  if (booking.status === 'MATCHED' && isBackupSelected(booking)) {
    return <span className="signal signal-info">Marketplace partner selected</span>;
  }
  if (booking.status === 'MATCHED' && !bookingMatchingChatReady(booking)) {
    return <span className="signal signal-warn">Chat missing</span>;
  }
  return <span className="signal signal-ok">Normal</span>;
}

type BookingCheckFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
};

function bookingCheckFlags(booking: AdminBooking, nowMs: number): BookingCheckFlag[] {
  const flags: BookingCheckFlag[] = [];
  const paymentStatus = booking.payment?.status;
  const participantCount = bookingMarketplaceParticipantCount(booking);
  const expired = nowMs > 0 && booking.expiresAt ? new Date(booking.expiresAt).getTime() < nowMs : false;

  if (
    booking.status === 'CANCELLED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({ severity: 'high', title: 'Cancelled payment unresolved' });
  }
  if (
    booking.status === 'EXPIRED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
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
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({ severity: 'high', title: 'No-show payment unresolved' });
  }
  if (bookingCashDebtNeedsOps(booking)) {
    flags.push({ severity: 'high', title: 'Cash fee debt blocks marketplace alerts' });
  }
  const pricingPolicy = bookingPricingPolicySignal(booking);
  if (pricingPolicy.status === 'blocked') {
    flags.push({ severity: 'high', title: pricingPolicy.label });
  } else if (pricingPolicy.status === 'warning') {
    flags.push({ severity: 'medium', title: pricingPolicy.label });
  }
  if (booking.status === 'OPEN_MATCHING' && expired) {
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
  if (bookingChatQuietNeedsOps(booking)) {
    flags.push({ severity: 'low', title: 'Chat quiet' });
  }
  if (paymentStatus === 'AUTHORIZED' && !booking.payment?.providerRef) {
    flags.push({ severity: 'medium', title: 'Payment reference missing' });
  }

  return flags;
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
  const finalSelectionCopy = bookingFinalSelectionCopy(booking.matchingEvidence?.finalSelection);
  if (finalSelectionCopy) {
    return finalSelectionCopy.label;
  }

  if (!booking.preferredProvider) {
    return 'No first-pick partner';
  }

  if (isBackupSelected(booking)) {
    return 'Marketplace partner selected';
  }

  if (booking.status === 'OPEN_MATCHING' && bookingFirstPickPending(booking)) {
    return 'First-pick partner pending';
  }

  if (preferredProviderStateLabel(booking) === 'declined') {
    return 'First-pick partner declined';
  }

  if (booking.status === 'MATCHED') {
    return 'Final partner selected';
  }

  if (isSelectedProviderParticipant(booking)) {
    return 'First-pick partner is active';
  }

  return 'First-pick partner requested';
}

function selectionPathLabel(booking: AdminBooking) {
  const marketplaceCount = bookingMarketplaceParticipantCount(booking);
  const finalSelectionCopy = bookingFinalSelectionCopy(booking.matchingEvidence?.finalSelection);

  if (!booking.preferredProvider) {
    return marketplaceCount > 0 ? 'Open pool request with marketplace supply' : 'Open pool request';
  }

  if (finalSelectionCopy?.pathLabel) {
    return finalSelectionCopy.pathLabel;
  }

  if (booking.status === 'OPEN_MATCHING' && bookingFirstPickPending(booking)) {
    return marketplaceCount > 0
      ? 'Direct request first, with marketplace partners already waiting'
      : 'Direct request first, waiting on the first-pick partner';
  }

  if (isBackupSelected(booking)) {
    return 'Direct request escalated to marketplace participation, then the guest chose a marketplace partner';
  }

  if (booking.status === 'MATCHED') {
    return 'Direct request confirmed by the first-pick partner';
  }

  if (marketplaceCount > 0) {
    return 'Marketplace partners are available while the first-pick partner stays in the flow';
  }

  return 'Direct request remains the active path';
}

function selectionToneClass(booking: AdminBooking) {
  const finalSelectionCopy = bookingFinalSelectionCopy(booking.matchingEvidence?.finalSelection);
  if (finalSelectionCopy) {
    return finalSelectionCopy.toneClass;
  }

  if (!booking.preferredProvider) {
    return 'pill-neutral';
  }

  if (booking.status === 'OPEN_MATCHING' && bookingFirstPickPending(booking)) {
    return 'pill-warn';
  }

  if (preferredProviderStateLabel(booking) === 'declined') {
    return 'pill-info';
  }

  if (booking.status === 'MATCHED') {
    return 'pill-success';
  }

  if (isSelectedProviderParticipant(booking)) {
    return 'pill-success';
  }

  return 'pill-neutral';
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
    if (booking.matchingEvidence.firstPickStatus === 'REJECTED') {
      return 'declined';
    }
    if (
      booking.matchingEvidence.firstPickStatus === 'ACCEPTED' ||
      booking.matchingEvidence.firstPickStatus === 'SELECTED'
    ) {
      return 'confirmed';
    }
    return 'pending';
  }

  const participant = preferredParticipantState(booking);
  if (!participant) {
    return 'requested';
  }
  if (participant.status === 'REJECTED') {
    return 'declined';
  }
  if (participant.status === 'ACCEPTED' || participant.status === 'SELECTED') {
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
  const freshness = providerLocationFreshness(booking, nowMs);
  if (freshness === 'recent') {
    return 'Location recent';
  }
  if (freshness === 'stale') {
    return 'Location stale';
  }
  if (freshness === 'expired') {
    return 'Location too old';
  }
  return 'No location';
}

function bookingLocationToneClass(booking: AdminBooking, nowMs: number) {
  const freshness = providerLocationFreshness(booking, nowMs);
  if (freshness === 'recent') {
    return 'pill-success';
  }
  if (freshness === 'stale') {
    return 'pill-warn';
  }
  if (freshness === 'expired') {
    return 'pill-info';
  }
  return 'pill-neutral';
}

function providerLocationFreshness(
  booking: AdminBooking,
  nowMs: number,
): 'recent' | 'stale' | 'expired' | 'missing' {
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
