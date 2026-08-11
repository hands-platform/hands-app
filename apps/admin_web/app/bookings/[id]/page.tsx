import { notFound } from 'next/navigation';
// MVP authority contract markers kept for static authority guard only:
// Confirmed service address record, Finance evidence, Service pricing evidence.
import {
  BookingActivityPanel,
  type BookingActivityPanelProps,
  BookingFullRecordIndex,
  type BookingFullRecordIndexProps,
} from './booking-activity-panel';
import {
  buildBookingActivityCsvHref,
  buildBookingActivityRecords,
  buildBookingActivitySummary,
} from './booking-activity-records';
import {
  BookingActionStatusSections,
  BookingLiveServiceBoardSection,
  BookingOperatorNotesSection,
  BookingOutcomeReviewSection,
  type BookingActionStatusSectionsProps,
} from './booking-action-status-sections';
import { BookingDetailLifecycleListSection } from './booking-detail-lifecycle-list-section';
import { BookingDetailChatTranscriptSection } from './booking-detail-chat-transcript-section';
import { BookingDetailPostMatchDecisionSection } from './booking-detail-post-match-decision-section';
import { BookingCloseoutSections, type BookingCloseoutSectionsProps } from './booking-closeout-sections';
import {
  BookingCommandDecisionStripSection,
  BookingDetailToolbar,
  BookingMatchingRuleSnapshotSection,
  type BookingMatchingRuleSnapshotSectionProps,
} from './booking-command-briefing-sections';
import {
  BookingAlertTraceSection,
  type BookingAlertTraceSectionProps,
  BookingAttentionChecksSection,
  type BookingAttentionChecksSectionProps,
  BookingFinanceCommandCenterSection,
  type BookingFinanceCommandCenterSectionProps,
  BookingOperationsAuditTraceSection,
  type BookingOperationsAuditTraceSectionProps,
  BookingPayoutBatchEligibilitySection,
  type BookingPayoutBatchEligibilitySectionProps,
  BookingServicePricingSnapshotSection,
  type BookingServicePricingSnapshotSectionProps,
} from './booking-finance-trace-sections';
import {
  type BookingOpsCommandCenterProps,
  BookingOperatorQueueSections,
  BookingOpsCommandCenter,
  type BookingOperatorQueueSectionsProps,
} from './booking-operator-sections';
import {
  BookingChatLifecycleSection,
  type BookingChatLifecycleSectionProps,
  BookingCloseoutReadinessSection,
  type BookingCloseoutReadinessSectionProps,
  BookingCommunicationMovementHandoffSection,
  type BookingCommunicationMovementHandoffSectionProps,
  BookingHandoffChecklistSection,
  type BookingHandoffChecklistSectionProps,
  BookingMarketplaceWalletEvidenceSection,
  type BookingMarketplaceWalletEvidenceSectionProps,
  BookingOperatingLedgerSection,
  type BookingOperatingLedgerSectionProps,
  BookingOperatingSnapshotSection,
  type BookingOperatingSnapshotSectionProps,
  BookingOperatingTimelineSection,
  type BookingOperatingTimelineSectionProps,
} from './booking-operating-sections';
import {
  BookingRecordDetailSections,
  type BookingRecordDetailSectionsProps,
} from './booking-record-detail-sections';
import { bookingChatMessageCount } from '../booking-chat-message-count';
import { bookingPostMatchChatEvidenceRows } from '../booking-post-match-chat-evidence';
import { bookingRecordFinanceRows as buildBookingRecordFinanceRows } from './booking-record-finance-rows';
import { bookingRecordPaymentRows as buildBookingRecordPaymentRows } from './booking-record-info-rows';
import {
  BookingAddressRadiusContractSection,
  type BookingAddressRadiusContractSectionProps,
  BookingAppliedPolicySection,
  type BookingAppliedPolicySectionProps,
  BookingCustomerWaitPanelSection,
  type BookingCustomerWaitPanelSectionProps,
  BookingDispatchCandidateDecisionMatrixSection,
  type BookingDispatchCandidateDecisionMatrixSectionProps,
  BookingMarketplaceSupplySection,
  type BookingMarketplaceSupplySectionProps,
  BookingStageSnapshotSection,
  type BookingStageSnapshotSectionProps,
} from './booking-policy-supply-sections';
import { bookingCommunicationMovementHandoff } from './booking-communication-movement-handoff';
import { bookingAddressSnapshotLabel, money, shortId } from './booking-formatters';
import { BookingEvidenceSections, type BookingEvidenceSectionsProps } from './booking-evidence-sections';
import { bookingCashDebtNeedsSettlement, bookingCashFeeSettlementPath } from './booking-cash-wallet-gate';
import { bookingDetailActionEvidenceGate } from './booking-detail-action-evidence-gate';
import { bookingDetailChatEvidenceDecisionBoard } from './booking-detail-chat-evidence-decision-board';
import { bookingDetailGateAndNotes } from './booking-detail-gate-and-notes';
import { bookingFinanceTrace } from './booking-finance-trace';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingAddressRadiusContract } from './booking-address-radius-contract';
import { bookingChatReady } from './booking-chat-evidence';
import { bookingChatRepairActionState } from './booking-chat-repair-state';
import { bookingOutcomeReviewPanel } from './booking-outcome-review-panel';
import { isPostMatchCancellationBooking } from '../booking-post-match-cancellations-model';
import { bookingDetailConnectedRecordLinks } from './booking-detail-connected-record-links';
import { bookingDetailCloseoutChecklist } from './booking-detail-closeout-checklist';
import { bookingDetailDecisionReadiness } from './booking-detail-decision-readiness';
import { bookingDetailEvidenceBundleRows } from './booking-detail-evidence-bundle-rows';
import { bookingDetailEvidencePacket } from './booking-detail-evidence-packet';
import { bookingDetailFinanceFlags } from './booking-detail-finance-flags';
import { bookingDetailFinanceSummaryCards } from './booking-detail-finance-summary-cards';
import { bookingDetailFlowStages } from './booking-detail-flow-stages';
import { bookingDetailLocationTrail } from './booking-detail-location-trail';
import { bookingHandoffChecklist } from './booking-handoff-checklist';
import { bookingDetailOperatingLedger } from './booking-detail-operating-ledger';
import { bookingDetailRecordIndexCards } from './booking-detail-record-index-cards';
import {
  bookingDetailAttentionFlags,
  bookingDetailDispatchChecklist,
} from './booking-detail-dispatch-checks';
import { bookingDetailOperatorActionMatrix } from './booking-detail-operator-action-matrix';
import {
  bookingDetailOperatorCommandQueue,
  bookingDetailOpsTaskCards,
} from './booking-detail-operator-command-queue';
import { bookingDetailOpsCommandCenter } from './booking-detail-ops-command-center';
import { bookingDetailToolbarProps } from './booking-detail-toolbar-props';
import { bookingDetailSectionVisibility } from './booking-detail-section-visibility';
import { bookingUnifiedDetail } from './booking-unified-detail';
import {
  BookingUnifiedDetailSection,
  type BookingUnifiedDetailSectionProps,
} from './booking-unified-detail-section';
import {
  AdminReviewRecordsSection,
  reviewRecordsForBooking,
} from '../../../components/admin-review-records-section';
import { canViewAdminDeveloperSystem } from '../../../components/admin-developer-system-section';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminDisclosure, AdminSection } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime } from '../../../lib/admin-format';
import { bookingLiveServiceSignals } from './booking-live-service-signals';
import { bookingCloseoutReadiness } from './booking-closeout-readiness';
import { bookingOperatingSnapshot } from './booking-operating-snapshot';
import { bookingOperatingTimeline } from './booking-operating-timeline';
import { bookingCustomerWaitPanel } from './booking-customer-wait-panel';
import {
  bookingNotificationTrace,
  humanizeNotificationType,
  notificationDataBookingId,
} from './booking-notification-trace';
import { bookingOperationalPolicySnapshot } from './booking-operational-policy-snapshot';
import {
  auditMetadataSummary,
  bookingOperationsTrace,
  humanizeAuditAction,
} from './booking-operations-trace';
import { bookingDispatchPin, bookingMarketplacePartnerSupply } from './booking-marketplace-supply';
import { bookingMarketplaceWalletEvidence } from './booking-marketplace-wallet-evidence';
import { bookingDetailMatchingRuleSnapshot } from './booking-matching-rule-snapshot';
import { bookingPaymentEvidence } from './booking-payment-evidence';
import { bookingServicePricingSnapshotRows } from './booking-service-pricing-snapshot-rows';
import { bookingParticipantLedger } from './booking-participant-ledger';
import { bookingParticipantCounts } from './booking-participant-counts';
import {
  bookingDetailCustomerRows,
  bookingDetailHandoffRows,
  bookingDetailLocationTrailRows,
  bookingDetailServiceRows,
} from './booking-detail-record-rows';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
  bookingDetailExpiryEligibility,
} from './booking-participant-rules';
import {
  bookingDetailProviderLocationMetricHelper,
  bookingDetailProviderLocationMetricValue,
} from './booking-provider-location-metric';
import { bookingStageSnapshot } from './booking-stage-snapshot';
import { latestProviderLocation, latestProviderLocationFreshness } from './booking-status-location';
import {
  AdminBookingDetail,
  AdminNotification,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
} from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { OPERATIONAL_POLICY_KEYS } from '../../../lib/operations-policy';
import { attentionLevel } from '../../../lib/admin-attention-flags';
import { postMatchCancellationWorkspaceFromHref } from '../../../lib/admin-nav-match';
import { bookingChatLifecycle } from '../../../lib/booking-chat-lifecycle';
import { bookingClosureSummary } from '../../../lib/booking-closure-summary';
import { bookingPayoutBatchEligibility as buildBookingPayoutBatchEligibilityFromFacts } from '../../../lib/booking-payout-batch-eligibility';
import {
  canCloseoutCompletedBooking,
  completedCloseoutLabel,
  completedCloseoutTone,
} from '../../../lib/booking-closeout-policy';
import { bookingOperatorAuditNotes, canMarkNoShow } from '../../../lib/booking-operator-action-rules';
import { bookingCommandDecisionStrip } from '../../../lib/booking-command-decision-strip';
import { bookingCommandDecisionStripInput } from '../booking-command-decision-strip-inputs';
import { bookingStatusEvent, deadlineRelativeLabel } from '../booking-list-time';
import {
  BOOKING_DETAIL_TERMINAL_STATUSES,
  shouldLoadBookingDetailMarketplaceProviders,
} from './booking-detail-marketplace-provider-loader';
import {
  readBookingDetailCheckpoint,
  readBookingDetailReturnHref,
  readBookingDetailWorkspace,
} from './booking-detail-page-params';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type BookingDetailPageData = {
  booking: AdminBookingDetail | null;
  operationalPolicies: AdminOperationalPolicySetting[];
  rawNotifications: AdminNotification[];
  providers: AdminProvider[];
};

const bookingDetailAuthoritySourceMarkers = [
  'MVP authority contract',
  'NestJS business authority',
  'Confirmed service address',
  'customer fallback partner choice',
  'wallet gate',
  'Connected operations records',
  'Operator action availability',
  'Booking gate reason',
  'Booking full record index',
  'Finance evidence',
  'Cash settlement desk',
  'Tax policy',
  'Location trail',
  'Communication and movement handoff',
  'Chat lifecycle and retention',
  'All customer chats',
  'All Partner chats',
  'Service pricing evidence',
] as const;

const BOOKING_DETAIL_CHAT_PREVIEW_LIMIT = 12;
const BOOKING_DETAIL_NOTIFICATION_BATCH_PREVIEW_LIMIT = 4;
const BOOKING_DETAIL_NOTIFICATION_ROW_PREVIEW_LIMIT = 8;
const BOOKING_DETAIL_ACTIVITY_PREVIEW_LIMIT = 16;
const BOOKING_DETAIL_ACTIVITY_CSV_PREVIEW_LIMIT = 24;
const BOOKING_DETAIL_OPERATING_TIMELINE_PREVIEW_LIMIT = 12;
const BOOKING_DETAIL_MARKETPLACE_PROVIDER_PREVIEW_LIMIT = 40;
const BOOKING_DETAIL_VISIBLE_SECTIONS = {
  addressRadiusContract: false,
  addressSupplyCheck: false,
  alertRecords: false,
  appliedOperationsPolicy: false,
  bookingCloseoutChecklist: false,
  bookingHandoffChecklist: false,
  bookingStageStatus: false,
  chatLifecycle: false,
  chronologicalActivity: false,
  communicationMovementHandoff: false,
  customerWaitDecision: false,
  dispatchChecklist: false,
  liveServiceBoard: false,
  marketplaceWalletEvidence: false,
  matchingRuleStatus: false,
  operatingLedger: false,
  operatingSnapshot: false,
  operatingTimeline: false,
  operationsAuditRecords: false,
  payoutBatchEligibility: false,
  recordDetails: false,
  recordOverview: false,
  servicePricingEvidence: false,
} as const;
const BOOKING_DETAIL_OPERATIONAL_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
  OPERATIONAL_POLICY_KEYS.travelBufferMinutes,
  OPERATIONAL_POLICY_KEYS.preferredAcceptMode,
  OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
  OPERATIONAL_POLICY_KEYS.walletNegativeGate,
  OPERATIONAL_POLICY_KEYS.actionEvidenceGateMode,
  OPERATIONAL_POLICY_KEYS.cashSettlementClearance,
  OPERATIONAL_POLICY_KEYS.firstPickExpiryAction,
  OPERATIONAL_POLICY_KEYS.cancellationAfterMatch,
  OPERATIONAL_POLICY_KEYS.noShowEvidenceRequirement,
  OPERATIONAL_POLICY_KEYS.noShowPartnerReport,
  OPERATIONAL_POLICY_KEYS.partnerAlertChannel,
  OPERATIONAL_POLICY_KEYS.payoutBatchCycle,
] as const;
const BOOKING_DETAIL_OPERATIONAL_POLICY_HREF = `/admin/operational-policy?${new URLSearchParams({
  keys: BOOKING_DETAIL_OPERATIONAL_POLICY_KEYS.join(','),
}).toString()}`;

export default async function BookingDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const detailSearchParams = searchParams ? await searchParams : {};
  const actionNotice = bookingDetailActionNotice(detailSearchParams);
  const nowMs = new Date().getTime();
  const currentOperatorAccess = await getCurrentAdminOperatorAccess();
  const canViewDeveloperDiagnostics = canViewAdminDeveloperSystem(currentOperatorAccess);
  const detailWorkspace = readBookingDetailWorkspace(detailSearchParams);
  const includeOperationalRecords = true;
  const includeDeveloperDiagnostics = canViewDeveloperDiagnostics && detailWorkspace === 'diagnostics';
  const { booking, operationalPolicies, providers, rawNotifications } = await loadBookingDetailPageData(
    id,
    includeDeveloperDiagnostics,
    includeOperationalRecords,
  );

  if (!booking) {
    notFound();
  }

  const messages = [...(booking.chatRoom?.messages ?? [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const messageCount = bookingChatMessageCount(booking);
  const visibleMessages = latestItems(messages, BOOKING_DETAIL_CHAT_PREVIEW_LIMIT);
  const chatReady = bookingChatReady(booking);
  const finalPartnerSummary = bookingFinalPartnerSummary(booking);
  const participantCounts = bookingParticipantCounts(booking);
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking).length;
  const latestLocation = latestProviderLocation(booking);
  const locationFreshness = latestProviderLocationFreshness(booking);
  const locationTrailSnapshots = bookingDetailLocationTrail(booking);
  const locationTrailCount = locationTrailSnapshots.length;
  const addressLine = bookingAddressSnapshotLabel(booking);
  const addressPin = bookingDispatchPin(booking).label;
  const attentionFlags = bookingDetailAttentionFlags(booking);
  const attentionSummary = attentionLevel(attentionFlags);
  const liveSignals = bookingLiveServiceSignals(booking);
  const dispatchSteps = bookingDetailDispatchChecklist(booking);
  const opsTaskCards = bookingDetailOpsTaskCards(booking);
  const requestedOpsTaskType = readBookingDetailCheckpoint(detailSearchParams);
  const selectedOpsTask =
    opsTaskCards.find((task) => task.type === requestedOpsTaskType) ??
    opsTaskCards.find((task) => task.status !== 'DONE') ??
    opsTaskCards[0] ??
    null;
  const financeTrace = bookingFinanceTrace(booking);
  const financeSummaryCards = bookingDetailFinanceSummaryCards(financeTrace);
  const financeFlags = bookingDetailFinanceFlags(booking, financeTrace);
  const cashFeeSettlementPath = bookingCashFeeSettlementPath(booking, financeTrace);
  const cashFeeDebtNeedsSettlement = bookingCashDebtNeedsSettlement(booking);
  const paymentEvidence = bookingPaymentEvidence(booking);
  const refundLedgerRows = paymentEvidence.refundRows;
  const refundLedgerCount = refundLedgerRows.length;
  const operatorNotes = bookingOperatorAuditNotes(booking.auditLogs);
  const operatorNoteLines = operatorNotes.map((note) => note.content);
  const operatorNoteCount = operatorNoteLines.length;
  const closureSummary = bookingClosureSummary(booking);
  const servicePricingSnapshotRows = bookingServicePricingSnapshotRows(financeTrace);
  const policySnapshot = bookingOperationalPolicySnapshot(booking, operationalPolicies);
  const marketplaceSupply = bookingMarketplacePartnerSupply(booking, providers, operationalPolicies);
  const addressRadiusContract = bookingAddressRadiusContract(booking, marketplaceSupply);
  const customerWaitPanel = bookingCustomerWaitPanel(booking, marketplaceSupply, operationalPolicies);
  const stageSnapshot = bookingStageSnapshot(booking, customerWaitPanel, marketplaceSupply);
  const notificationTrace = bookingNotificationTrace(booking, rawNotifications);
  const visibleNotificationTrace = bookingNotificationTracePreview(notificationTrace);
  const notificationCount = notificationTrace.rows.length;
  const marketplaceAlertBatchCount = notificationTrace.backupBatches.length;
  const matchingRuleSnapshot = bookingDetailMatchingRuleSnapshot({
    booking,
    marketplaceSupply,
    customerWaitPanel,
    notificationTrace,
    walletBlocked: cashFeeDebtNeedsSettlement,
  });
  const operationsTrace = bookingOperationsTrace(booking, booking.auditLogs ?? []);
  const bookingActivityRecords = buildBookingActivityRecords({
    booking,
    notifications: rawNotifications,
    locationSnapshots: locationTrailSnapshots,
    closureSummary,
    humanizeAuditAction,
    auditMetadataSummary,
    notificationDataBookingId,
    humanizeNotificationType,
  });
  const bookingActivitySummary = buildBookingActivitySummary(bookingActivityRecords);
  const visibleBookingActivityRecords = firstItems(
    bookingActivityRecords,
    BOOKING_DETAIL_ACTIVITY_PREVIEW_LIMIT,
  );
  const bookingActivityCsvHref = buildBookingActivityCsvHref(
    booking,
    firstItems(bookingActivityRecords, BOOKING_DETAIL_ACTIVITY_CSV_PREVIEW_LIMIT),
  );
  const marketplaceWalletEvidence = bookingMarketplaceWalletEvidence({
    booking,
    marketplaceSupply,
    financeTrace,
    notificationTrace,
    walletDebt: cashFeeDebtNeedsSettlement,
  });
  const participantLedger = bookingParticipantLedger(booking, marketplaceSupply, notificationTrace);
  const chatLifecycle = bookingChatLifecycle(booking, messageCount);
  const handoffChecklist = bookingHandoffChecklist(booking, messageCount, latestLocation);
  const chatRepair = bookingChatRepairActionState(booking);
  const closeoutReadiness = bookingCloseoutReadiness({
    booking,
    financeFlags,
    latestLocation,
    messageCount,
    notificationCount,
  });
  const matchingExpiryEligibility = bookingDetailExpiryEligibility(booking);
  const commandDecisionStrip = bookingCommandDecisionStrip(
    bookingCommandDecisionStripInput(booking, {
      addressLabel: addressLine,
      cashDebtNeedsSettlement: cashFeeDebtNeedsSettlement,
      closeoutNeedsOps: closeoutReadiness.openItems.length > 0,
      customerChoiceCandidateCount: customerChoiceCandidates,
      hasChatRoom: Boolean(booking.chatRoom?.id),
      hasFinalPartner: finalPartnerSummary.selected,
      marketplaceEligibleCount: marketplaceSupply.eligibleCount,
    }),
  );
  const payoutBatchEligibility = buildBookingPayoutBatchEligibilityFromFacts({
    bookingStatus: booking.status,
    paymentExists: Boolean(booking.payment),
    paymentMethod: booking.payment?.method ?? null,
    paymentStatus: booking.payment?.status ?? null,
    customerPriceLabel: financeTrace.customerPrice,
    earningExists: Boolean(booking.earning),
    earningStatus: booking.earning?.status ?? null,
    earningNetAmountLabel: money(booking.earning?.netAmount, booking.earning?.currency),
    payoutBatchShortId: booking.earning?.payoutBatchId ? shortId(booking.earning.payoutBatchId) : null,
    hasTaxLog: (booking.earning?.taxLogs?.length ?? booking.taxLogs?.length ?? 0) > 0,
    hasPlatformFeeLog: (booking.earning?.platformFeeLogs?.length ?? booking.platformFeeLogs?.length ?? 0) > 0,
    hasWalletLedger:
      (booking.earning?.walletLedgerEntries?.length ?? booking.walletLedgerEntries?.length ?? 0) > 0,
    cashDebt: cashFeeDebtNeedsSettlement,
    walletLedgerLabel: financeTrace.walletLedger,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
    financeFlagTitles: financeFlags.map((flag) => flag.title),
    closeoutHelper: closeoutReadiness.helper,
  });
  const operatingSnapshot = bookingOperatingSnapshot({
    booking,
    addressLine,
    addressPin,
    attentionFlags,
    messageCount,
    notificationCount,
  });
  const unifiedDetail = bookingUnifiedDetail({
    addressLine,
    addressPin,
    booking,
    financeTrace,
    finalPartnerSummary,
    latestLocation,
    messageCount,
  });
  const statusEvent = bookingStatusEvent(booking);
  const customerContactTask = opsTaskCards.find((task) => task.type === 'CUSTOMER_CONTACTED');
  const selectableResponseCount = (booking.participants ?? []).filter((participant) =>
    ['ACCEPTED', 'JOINED'].includes(participant.status),
  ).length;
  const waitingResponseCount = (booking.participants ?? []).filter((participant) =>
    ['PENDING', 'REQUESTED'].includes(participant.status),
  ).length;
  const evaluatedSupplyCount = marketplaceSupply.evaluatedCount ?? marketplaceSupply.rows.length;
  const decisionFacts = [
    {
      label: 'Status',
      value: unifiedDetail.statusLabel,
      helper: statusEvent.relativeLabel(nowMs),
    },
    {
      label: 'Matching deadline',
      value: booking.expiresAt ? formatDateTime(booking.expiresAt) : 'Deadline unavailable',
      helper: deadlineRelativeLabel(booking.expiresAt, nowMs),
    },
    {
      label: 'Customer choice',
      value: `${customerChoiceCandidates} selectable / ${waitingResponseCount} waiting`,
      helper:
        selectableResponseCount > customerChoiceCandidates
          ? `${selectableResponseCount - customerChoiceCandidates} response(s) expired at the matching deadline.`
          : `${selectableResponseCount} accepted or joined response(s).`,
    },
    {
      label: 'Current supply',
      value: `${marketplaceSupply.eligibleCount} eligible / ${Math.max(evaluatedSupplyCount - marketplaceSupply.eligibleCount, 0)} excluded`,
      helper: `${evaluatedSupplyCount} Partners evaluated under current policy.`,
    },
    {
      label: 'Customer contact',
      value: customerContactTask ? humanizeBookingDetailLabel(customerContactTask.status) : 'Not recorded',
      helper: customerContactTask?.note || customerContactTask?.helper || 'No contact checkpoint exists.',
    },
    {
      label: 'Payment conclusion',
      value: booking.payment
        ? `${money(booking.payment.amount, booking.payment.currency)} ${humanizeBookingDetailLabel(booking.payment.status)}`
        : 'No payment record',
      helper: booking.payment
        ? `${humanizeBookingDetailLabel(booking.payment.method)} payment record.`
        : `${financeTrace.customerPrice} quoted service price; no refund required.`,
    },
  ];
  const activityRecordCount = bookingActivityRecords.length;
  const operatingTimeline = bookingOperatingTimeline({
    booking,
    addressLine,
    addressPin,
    latestLocation,
    messages: visibleMessages,
    notifications: firstItems(rawNotifications, BOOKING_DETAIL_NOTIFICATION_ROW_PREVIEW_LIMIT),
  });
  const visibleOperatingTimeline = firstItems(
    operatingTimeline,
    BOOKING_DETAIL_OPERATING_TIMELINE_PREVIEW_LIMIT,
  );
  const communicationMovementHandoff = bookingCommunicationMovementHandoff({
    booking,
    latestLocation,
    messages,
    notifications: rawNotifications,
  });
  const bookingRecordIndexCards = bookingDetailRecordIndexCards({
    booking,
    participantCounts,
    messageCount,
    paymentEvidence,
    financeTrace,
    providerLocationMetric: {
      helper: bookingDetailProviderLocationMetricHelper(booking),
      value: bookingDetailProviderLocationMetricValue(booking),
    },
    communicationMovementStatus: communicationMovementHandoff.status,
    locationTrailCount,
    notificationCount,
    marketplaceAlertBatchCount,
    operatorNoteCount,
    activityRecordCount,
  });
  const operatingLedger = bookingDetailOperatingLedger({
    booking,
    finalPartnerSummary,
    participantCounts,
    messageCount,
    paymentEvidence,
    financeTrace,
    financeFlagCount: financeFlags.length,
    latestLocation,
    addressPin,
    notificationTrace,
    activityRecordCount,
    operatorNoteLines,
    closureSummary,
  });
  const operatorCommandQueue = bookingDetailOperatorCommandQueue({
    booking,
    attentionFlags,
    messages,
    latestLocation,
  });
  const operatorActionMatrix = bookingDetailOperatorActionMatrix(booking);
  const backHref = readBookingDetailReturnHref(
    detailSearchParams,
    isPostMatchCancellationBooking(booking)
      ? '/bookings/post-match-cancellations?view=manual-decision'
      : '/bookings',
  );
  const outcomeReview = bookingOutcomeReviewPanel({
    booking,
    closeoutOpenItemCount: closeoutReadiness.openItems.length,
    closureSummary,
    messageCount,
    nowMs,
    operatorNoteCount,
    returnHref: backHref,
  });
  const postMatchWorkspace = postMatchCancellationWorkspaceFromHref(backHref);
  const toolbarProps = {
    ...bookingDetailToolbarProps({ booking, finalPartnerSummary }),
    backLabel: backHref.startsWith('/vietnam-overview')
      ? 'Vietnam overview'
      : backHref.startsWith('/chat-archive')
        ? 'Chat Evidence Search'
      : postMatchWorkspace
      ? postMatchWorkspace.label
      : 'booking monitor',
    backHref,
  };
  const showPostMatchDecisionBelowLifecycle = outcomeReview.postMatchDecision.visible;
  const evidencePacket = bookingDetailEvidencePacket({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    financeTrace,
    refundLedgerRows,
    operatorNoteLines,
    bookingActivityRecords,
  });
  const chatEvidenceDecisionBoard = bookingDetailChatEvidenceDecisionBoard({
    booking,
    latestLocation,
    messages,
    notificationCount,
    operatorNoteLines,
  });
  const { manualDecisionReadiness, decisionEvidenceGuardrails } = bookingDetailDecisionReadiness({
    booking,
    latestLocation,
    messageCount,
    notificationCount,
    operatorNoteCount,
    refundRowCount: refundLedgerCount,
    refundEvidence: paymentEvidence.refundEvidence,
    cashFeeDebtNeedsSettlement,
    closureStatus: closureSummary.status,
    closeoutReadiness,
    financeTrace,
  });
  const connectedRecordLinks = bookingDetailConnectedRecordLinks({
    booking,
    finalPartnerSummary,
    messageCount,
    notificationCount,
    paymentEvidence,
    financeTrace,
  });
  const failedAlertCount = notificationTrace.rows.filter((row) =>
    row.deliveryStatuses.includes('FAILED'),
  ).length;
  const evidenceAndCloseoutFacts = {
    booking,
    messages,
    latestLocation,
    notificationTrace,
    financeTrace,
    refundLedgerCount,
    operatorNoteLines,
    bookingActivityRecords,
    finalPartnerSummary,
    customerChoiceCandidates,
    failedAlertCount,
    chatReady,
  };
  const bookingEvidenceBundleRows = bookingDetailEvidenceBundleRows({
    ...evidenceAndCloseoutFacts,
    locationTrailCount,
  });
  const bookingCloseoutChecklist = bookingDetailCloseoutChecklist({
    ...evidenceAndCloseoutFacts,
    refundEvidence: paymentEvidence.refundEvidence,
    cashFeeDebtNeedsSettlement,
    closeoutReadiness,
  });
  const actionEvidenceGate = bookingDetailActionEvidenceGate({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    operatorNoteLines,
    refundLedgerCount,
    cashDebt: cashFeeDebtNeedsSettlement,
    closeoutReadiness,
  });
  const actionGateByAction = new Map(actionEvidenceGate.rows.map((row) => [row.action, row]));
  const opsCommandCenter = bookingDetailOpsCommandCenter({
    booking,
    attentionFlags,
    cashFeeDebtNeedsSettlement,
    locationFreshness,
  });
  const { finalGateReason, decisionNotePresets } = bookingDetailGateAndNotes({
    booking,
    latestLocation,
    messageCount,
    notificationCount,
    operatorNoteCount,
    refundRowCount: refundLedgerCount,
    customerChoiceCandidates,
    marketplaceParticipants: participantCounts.marketplace,
    walletLedgerLabel: financeTrace.walletLedger,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
  });
  const evidenceSectionsProps: BookingEvidenceSectionsProps = {
    bookingId: booking.id,
    bookingEvidenceBundleRows,
    chatEvidenceDecisionBoard,
    decisionEvidenceGuardrails,
    decisionNotePresets,
    evidencePacket,
    manualDecisionReadiness,
  };
  const closeoutSectionsProps: BookingCloseoutSectionsProps = {
    bookingCloseoutChecklist,
    connectedRecordLinks,
  };
  const operatorQueueSectionsProps: BookingOperatorQueueSectionsProps = {
    bookingId: booking.id,
    operatorActionMatrix,
    operatorCommandQueue,
  };
  const opsCommandCenterProps: BookingOpsCommandCenterProps = {
    actionEvidenceGate,
    actionGateByAction,
    badges: opsCommandCenter.badges,
    booking,
    cashDebtNeedsSettlement: opsCommandCenter.cashDebtNeedsSettlement,
    finalGateReason,
    instruction: opsCommandCenter.instruction,
  };
  const fullRecordIndexProps: BookingFullRecordIndexProps = {
    bookingId: booking.id,
    cards: bookingRecordIndexCards,
    csvHref: bookingActivityCsvHref,
    eventCount: activityRecordCount,
  };
  const actionStatusSectionsProps: BookingActionStatusSectionsProps = {
    bookingId: booking.id,
    chatRepair,
    closeout: {
      canSubmit: canCloseoutCompletedBooking(booking),
      label: completedCloseoutLabel(booking),
      tone: completedCloseoutTone(booking),
    },
    dispatchSteps,
    liveSignals,
    matchingExpiry: { canSubmit: matchingExpiryEligibility.allowed, status: booking.status },
    noShow: { canSubmit: canMarkNoShow(booking.status), status: booking.status },
    notes: booking.notes,
    operatorNotes,
    opsTaskCards,
    operatorNotesPlacement: 'hidden',
    outcomeReview,
    showDispatchChecklist:
      BOOKING_DETAIL_VISIBLE_SECTIONS.dispatchChecklist &&
      !BOOKING_DETAIL_TERMINAL_STATUSES.has(booking.status),
    showLiveServiceBoard: false,
    showOutcomeReview: false,
    showStructuredOpsStatus:
      !BOOKING_DETAIL_TERMINAL_STATUSES.has(booking.status) &&
      opsTaskCards.some((task) => task.status !== 'DONE'),
    selectedOpsTaskType: selectedOpsTask?.type ?? null,
  };
  const locationTrailRows = bookingDetailLocationTrailRows(locationTrailSnapshots, booking.id);
  const bookingRecordCustomerRows = bookingDetailCustomerRows({ booking, addressLine, addressPin });
  const bookingRecordServiceRows = bookingDetailServiceRows(booking);
  const bookingRecordHandoffRows = bookingDetailHandoffRows({
    booking,
    finalPartnerSummary,
    latestLocation,
  });
  const bookingRecordPaymentRows = buildBookingRecordPaymentRows({
    paymentIdLabel: booking.payment?.id ?? 'No payment',
    paymentMethodLabel: paymentEvidence.paymentMethod,
    paymentAmountLabel: paymentEvidence.paymentAmountLabel,
    refundCount: paymentEvidence.refundCount,
    earningLabel: booking.earning
      ? `${money(booking.earning.netAmount, booking.earning.currency)} / ${booking.earning.status}`
      : 'Not created',
    cashFeeDebtLabel: cashFeeDebtNeedsSettlement
      ? `${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)} / Partner blocked`
      : null,
    serviceFeedbackLabel: booking.review ? 'Submitted' : 'Not submitted',
  });
  const bookingRecordFinanceRows = buildBookingRecordFinanceRows(financeTrace);
  const recordDetailSectionsProps: BookingRecordDetailSectionsProps = {
    cashFeeSettlementPath,
    chatEvidenceRows: bookingPostMatchChatEvidenceRows({
      booking,
      messageCount,
    }),
    chatMessages: messages,
    customerProfileId: booking.customerProfile?.id,
    customerRows: bookingRecordCustomerRows,
    finalPartnerId: finalPartnerSummary.selected ? finalPartnerSummary.id : null,
    financeRows: bookingRecordFinanceRows,
    hasLatestPartnerLocation: Boolean(latestLocation),
    handoffRows: bookingRecordHandoffRows,
    locationTrailRows,
    participantLedger,
    paymentRows: bookingRecordPaymentRows,
    serviceRows: bookingRecordServiceRows,
    timelineStages: bookingDetailFlowStages(booking),
  };
  const activityPanelProps: BookingActivityPanelProps = {
    records: visibleBookingActivityRecords,
    summary: bookingActivitySummary,
    totalRecordCount: activityRecordCount,
  };
  const financeCommandCenterProps: BookingFinanceCommandCenterSectionProps = {
    financeFlags,
    financeSummaryCards,
  };
  const servicePricingSnapshotProps: BookingServicePricingSnapshotSectionProps = {
    financeFlags,
    servicePricingSnapshotRows,
  };
  const alertTraceProps: BookingAlertTraceSectionProps = {
    bookingId: booking.id,
    notificationTrace: visibleNotificationTrace,
  };
  const operationsAuditTraceProps: BookingOperationsAuditTraceSectionProps = {
    bookingId: booking.id,
    operationsTrace,
  };
  const attentionChecksProps: BookingAttentionChecksSectionProps = {
    attentionFlags,
    attentionSummary,
  };
  const payoutBatchEligibilityProps: BookingPayoutBatchEligibilitySectionProps = {
    payoutBatchEligibility,
  };
  const closeoutReadinessProps: BookingCloseoutReadinessSectionProps = {
    bookingStatus: booking.status,
    closeoutReadiness,
  };
  const operatingLedgerProps: BookingOperatingLedgerSectionProps = {
    operatingLedger,
  };
  const marketplaceWalletEvidenceProps: BookingMarketplaceWalletEvidenceSectionProps = {
    marketplaceWalletEvidence,
  };
  const handoffChecklistProps: BookingHandoffChecklistSectionProps = {
    handoffChecklist,
  };
  const operatingSnapshotProps: BookingOperatingSnapshotSectionProps = {
    operatingSnapshot,
  };
  const operatingTimelineProps: BookingOperatingTimelineSectionProps = {
    operatingTimeline: visibleOperatingTimeline,
  };
  const communicationMovementHandoffProps: BookingCommunicationMovementHandoffSectionProps = {
    communicationMovementHandoff,
  };
  const chatLifecycleProps: BookingChatLifecycleSectionProps = {
    chatLifecycle,
    messageCount,
  };
  const stageSnapshotProps: BookingStageSnapshotSectionProps = {
    stageSnapshot,
  };
  const customerWaitPanelProps: BookingCustomerWaitPanelSectionProps = {
    customerWaitPanel,
  };
  const appliedPolicyProps: BookingAppliedPolicySectionProps = {
    policySnapshot,
  };
  const addressRadiusContractProps: BookingAddressRadiusContractSectionProps = {
    addressRadiusContract,
  };
  const dispatchCandidateDecisionMatrixProps: BookingDispatchCandidateDecisionMatrixSectionProps = {
    marketplaceSupply,
  };
  const marketplaceSupplyProps: BookingMarketplaceSupplySectionProps = {
    marketplaceSupply,
  };
  const matchingRuleSnapshotProps: BookingMatchingRuleSnapshotSectionProps = {
    matchingRuleSnapshot,
  };
  const unifiedDetailProps: BookingUnifiedDetailSectionProps = {
    unifiedDetail,
  };
  const bookingReviewRecords = reviewRecordsForBooking(
    booking.review ? [booking.review] : [],
    booking.providerCustomerReview ? [booking.providerCustomerReview] : [],
    booking.id,
  );
  const sectionVisibility = bookingDetailSectionVisibility({
    hasChatMessages: messageCount > 0,
    hasCloseoutExceptions: closeoutReadiness.openItems.length > 0,
    hasEarning: Boolean(booking.earning),
    hasFinanceFlags: financeFlags.length > 0,
    hasMatchedAt: Boolean(booking.matchedAt),
    hasNotifications: notificationCount > 0,
    hasOperatorNotes: operatorNoteCount > 0,
    hasPayment: Boolean(booking.payment),
    hasPostMatchDecision: showPostMatchDecisionBelowLifecycle,
    hasSelectedPartner: Boolean(booking.selectedProviderId || booking.selectedProvider),
    status: booking.status,
  });
  const supportingRecords = (
    <>
      <div id="booking-people-and-communication">
        <span aria-hidden="true" className="booking-detail-anchor-target" id="customer" />
        <span aria-hidden="true" className="booking-detail-anchor-target" id="service" />
        <span aria-hidden="true" className="booking-detail-anchor-target" id="handoff" />
        <span aria-hidden="true" className="booking-detail-anchor-target" id="participants" />
        <span aria-hidden="true" className="booking-detail-anchor-target" id="location" />
        <span aria-hidden="true" className="booking-detail-anchor-target" id="chat-repair" />
        <BookingUnifiedDetailSection {...unifiedDetailProps} view="people" />
        {BOOKING_DETAIL_VISIBLE_SECTIONS.liveServiceBoard &&
        (booking.status === 'MATCHED' || booking.status === 'IN_SERVICE') ? (
          <BookingLiveServiceBoardSection liveSignals={liveSignals} />
        ) : null}
        {booking.chatRoom || messageCount > 0 || finalPartnerSummary.selected ? (
          <div id="chat">
            <BookingDetailChatTranscriptSection
              archiveHref={`/chat-archive?q=${encodeURIComponent(booking.id)}`}
              messages={visibleMessages}
              totalMessages={messageCount}
            />
          </div>
        ) : null}
      </div>

      <div id="finance">
        <span aria-hidden="true" className="booking-detail-anchor-target" id="payment" />
        {sectionVisibility.showSettlementDisclosure ? (
          <BookingUnifiedDetailSection {...unifiedDetailProps} view="finance" />
        ) : null}
      </div>
      {booking.status !== 'OPEN_MATCHING' ? (
        <div id="flow">
          <BookingDetailLifecycleListSection booking={booking} />
        </div>
      ) : null}

      {bookingReviewRecords.customerReviews.length > 0 ||
      bookingReviewRecords.partnerEvaluations.length > 0 ? (
        <AdminReviewRecordsSection
          basePath={`/bookings/${id}`}
          customerReviews={bookingReviewRecords.customerReviews}
          description="Customer review and Partner evaluation attached to this booking."
          id="booking-review-records"
          partnerEvaluations={bookingReviewRecords.partnerEvaluations}
          searchParams={detailSearchParams}
          title="Reviews"
        />
      ) : null}
      {outcomeReview.visible && !showPostMatchDecisionBelowLifecycle ? (
        <BookingOutcomeReviewSection outcomeReview={outcomeReview} />
      ) : null}
    </>
  );
  return (
    <AdminPageTemplate
      actions={<BookingDetailToolbar {...toolbarProps} />}
      contentClassName="booking-detail-page"
      description={`${unifiedDetail.statusLabel} · Booking ID ${booking.id}`}
      title={toolbarProps.serviceLabel}
    >
      <span hidden>{bookingDetailAuthoritySourceMarkers.join(' | ')}</span>

      {actionNotice ? (
        <p
          className={actionNotice.tone === 'error' ? 'admin-form-error admin-mb-16' : 'admin-form-success admin-mb-16'}
          role="status"
        >
          {actionNotice.message}
        </p>
      ) : null}

      <div id="booking-needs-action">
        {showPostMatchDecisionBelowLifecycle ? (
          <BookingDetailPostMatchDecisionSection bookingId={booking.id} outcomeReview={outcomeReview} />
        ) : (
          <BookingCommandDecisionStripSection
            commandDecisionStrip={commandDecisionStrip}
            decisionFacts={decisionFacts}
          />
        )}
        {!sectionVisibility.showCloseoutReadiness ? (
          <span aria-hidden="true" className="booking-detail-anchor-target" id="booking-closeout-readiness" />
        ) : null}
        {!matchingExpiryEligibility.allowed ? (
          <span aria-hidden="true" className="booking-detail-anchor-target" id="matching-expiry" />
        ) : null}
        {!canMarkNoShow(booking.status) ? (
          <span aria-hidden="true" className="booking-detail-anchor-target" id="no-show-handling" />
        ) : null}
        <BookingActionStatusSections {...actionStatusSectionsProps} />
        {booking.status === 'OPEN_MATCHING' && sectionVisibility.showDispatchDisclosure ? (
          <BookingMarketplaceSupplySection {...marketplaceSupplyProps} />
        ) : null}
        {sectionVisibility.showCloseoutReadiness ? (
          <BookingCloseoutReadinessSection {...closeoutReadinessProps} />
        ) : null}
      </div>

      <AdminSection
        className="booking-detail-section-navigation"
        description="Jump to one part of this booking without leaving the complete record."
        headerClassName={showPostMatchDecisionBelowLifecycle ? 'sr-only' : undefined}
        id="booking-section-navigation"
        title="Booking sections"
      >
        <AdminFilterChipGroup ariaLabel="Booking detail sections">
          <AdminFormControlLink href="#booking-needs-action">Needs action</AdminFormControlLink>
          <AdminFormControlLink href="#booking-unified-detail">Booking summary</AdminFormControlLink>
          {showPostMatchDecisionBelowLifecycle ? (
            <AdminFormControlLink href="#booking-supporting-records">Supporting records</AdminFormControlLink>
          ) : (
            <>
              <AdminFormControlLink href="#booking-people-and-communication">
                Customer / Partner / Chat
              </AdminFormControlLink>
              {sectionVisibility.showSettlementDisclosure ? (
                <AdminFormControlLink href="#booking-finance-system-detail">
                  Payment &amp; settlement
                </AdminFormControlLink>
              ) : null}
              <AdminFormControlLink href="#booking-detail-lifecycle-list">Booking timeline</AdminFormControlLink>
              {bookingReviewRecords.customerReviews.length > 0 ||
              bookingReviewRecords.partnerEvaluations.length > 0 ? (
                <AdminFormControlLink href="#booking-review-records">Reviews</AdminFormControlLink>
              ) : null}
            </>
          )}
          <AdminFormControlLink href="#operator-notes">Operator notes</AdminFormControlLink>
          <AdminFormControlLink href="#booking-operational-records">Operational records</AdminFormControlLink>
          {canViewDeveloperDiagnostics ? (
            <AdminFormControlLink
              href={`/bookings/${encodeURIComponent(booking.id)}?section=diagnostics#booking-developer-system`}
            >
              Developer/System
            </AdminFormControlLink>
          ) : null}
        </AdminFilterChipGroup>
      </AdminSection>

      {booking.status === 'OPEN_MATCHING' ? (
        <div id="flow">
          <BookingDetailLifecycleListSection booking={booking} />
        </div>
      ) : null}
      {booking.status === 'OPEN_MATCHING' ? (
        <BookingOperatorNotesSection auditNotes={operatorNotes} bookingId={booking.id} />
      ) : null}

      <BookingUnifiedDetailSection {...unifiedDetailProps} view="summary" />

      {showPostMatchDecisionBelowLifecycle ? (
        <AdminDisclosure
          className="booking-detail-section-disclosure"
          id="booking-supporting-records"
        >
          <summary className="booking-detail-section-summary">
            <span className="booking-detail-section-summary-copy">
              <strong>Supporting records</strong>
              <small>Customer, Partner, chat, money, timeline, and review records.</small>
            </span>
            <span className="booking-detail-section-summary-meta">Read-only</span>
          </summary>
          <div className="booking-detail-section-disclosure-body">{supportingRecords}</div>
        </AdminDisclosure>
      ) : (
        supportingRecords
      )}
      {booking.status !== 'OPEN_MATCHING' ? (
        <BookingOperatorNotesSection auditNotes={operatorNotes} bookingId={booking.id} />
      ) : null}

      <section aria-labelledby="booking-operational-records-title" id="booking-operational-records">
        <span aria-hidden="true" className="booking-detail-anchor-target" id="manual-decision-readiness" />
        <span aria-hidden="true" className="booking-detail-anchor-target" id="address-radius-contract" />
        <span aria-hidden="true" className="booking-detail-anchor-target" id="alerts" />
        <span aria-hidden="true" className="booking-detail-anchor-target" id="audit" />
        {!sectionVisibility.showDispatchDisclosure ? (
          <span aria-hidden="true" className="booking-detail-anchor-target" id="marketplace-supply" />
        ) : null}
        <div className="booking-detail-advanced-heading">
          <StatusBadge tone="info">Records</StatusBadge>
          <span className="booking-detail-advanced-heading-copy">
            <strong id="booking-operational-records-title">Operational records</strong>
            <small>Closeout, connected records, decision evidence, and matching policy.</small>
          </span>
        </div>
        <div className="booking-detail-advanced-section">
          <div className="booking-detail-advanced-heading">
            <StatusBadge tone="neutral">Core</StatusBadge>
            <span className="booking-detail-advanced-heading-copy">
              <strong>Closeout and connected records</strong>
              <small>Permanent booking links and the factual closeout record.</small>
            </span>
          </div>
          {BOOKING_DETAIL_VISIBLE_SECTIONS.bookingCloseoutChecklist ? (
            <BookingCloseoutSections {...closeoutSectionsProps} />
          ) : null}
          {BOOKING_DETAIL_VISIBLE_SECTIONS.bookingHandoffChecklist ? (
            <BookingHandoffChecklistSection {...handoffChecklistProps} />
          ) : null}
        </div>

        {sectionVisibility.showEvidenceDisclosure && (
          <div className="booking-detail-advanced-section">
            <div className="booking-detail-advanced-heading">
              <StatusBadge tone="info">Evidence</StatusBadge>
              <span className="booking-detail-advanced-heading-copy">
                <strong>Evidence summary</strong>
                <small>Decision completeness first; supporting records remain available in one disclosure.</small>
              </span>
            </div>
            <BookingEvidenceSections {...evidenceSectionsProps} />
            <BookingOperatorQueueSections {...operatorQueueSectionsProps} />
          </div>
        )}

        {sectionVisibility.showDispatchDisclosure && (
          <div className="booking-detail-advanced-section">
            <div className="booking-detail-advanced-heading">
              <StatusBadge tone="success">Dispatch</StatusBadge>
              <span className="booking-detail-advanced-heading-copy">
                <strong>Matching policy and supply checks</strong>
                <small>Stage, radius, wait, supply, and Partner candidate rules.</small>
              </span>
            </div>
            {BOOKING_DETAIL_VISIBLE_SECTIONS.bookingStageStatus ? (
              <BookingStageSnapshotSection {...stageSnapshotProps} />
            ) : null}
            {BOOKING_DETAIL_VISIBLE_SECTIONS.matchingRuleStatus ? (
              <BookingMatchingRuleSnapshotSection {...matchingRuleSnapshotProps} />
            ) : null}
            {BOOKING_DETAIL_VISIBLE_SECTIONS.customerWaitDecision ? (
              <BookingCustomerWaitPanelSection {...customerWaitPanelProps} />
            ) : null}
            {BOOKING_DETAIL_VISIBLE_SECTIONS.appliedOperationsPolicy ? (
              <BookingAppliedPolicySection {...appliedPolicyProps} />
            ) : null}
            {BOOKING_DETAIL_VISIBLE_SECTIONS.addressRadiusContract ? (
              <BookingAddressRadiusContractSection {...addressRadiusContractProps} />
            ) : null}
            {BOOKING_DETAIL_VISIBLE_SECTIONS.addressSupplyCheck ? (
              <BookingDispatchCandidateDecisionMatrixSection {...dispatchCandidateDecisionMatrixProps} />
            ) : null}
            {booking.status !== 'OPEN_MATCHING' ? (
              <BookingMarketplaceSupplySection {...marketplaceSupplyProps} />
            ) : null}
          </div>
        )}
      </section>

      {includeDeveloperDiagnostics ? (
        <section aria-labelledby="booking-developer-system-title" id="booking-developer-system">
          <div className="booking-detail-advanced-heading">
            <StatusBadge tone="warning">Developer/System</StatusBadge>
            <span className="booking-detail-advanced-heading-copy">
              <strong id="booking-developer-system-title">Developer/System diagnostics</strong>
              <small>Technical history, audit, settlement, wallet, pricing, and raw record evidence.</small>
            </span>
          </div>
          <BookingFullRecordIndex {...fullRecordIndexProps} />
          {sectionVisibility.showHistoryDisclosure ? (
            <div className="booking-detail-advanced-section">
              <div className="booking-detail-advanced-heading">
                <StatusBadge tone="warning">History</StatusBadge>
                <span className="booking-detail-advanced-heading-copy">
                  <strong>Operating movement and audit trail</strong>
                  <small>Movement history, notifications, audit rows, and activity export.</small>
                </span>
              </div>
              {BOOKING_DETAIL_VISIBLE_SECTIONS.operatingLedger ? (
                <BookingOperatingLedgerSection {...operatingLedgerProps} />
              ) : null}
              {BOOKING_DETAIL_VISIBLE_SECTIONS.operatingSnapshot ? (
                <BookingOperatingSnapshotSection {...operatingSnapshotProps} />
              ) : null}
              {BOOKING_DETAIL_VISIBLE_SECTIONS.operatingTimeline ? (
                <BookingOperatingTimelineSection {...operatingTimelineProps} />
              ) : null}
              {BOOKING_DETAIL_VISIBLE_SECTIONS.communicationMovementHandoff ? (
                <BookingCommunicationMovementHandoffSection {...communicationMovementHandoffProps} />
              ) : null}
              {BOOKING_DETAIL_VISIBLE_SECTIONS.chatLifecycle ? (
                <BookingChatLifecycleSection {...chatLifecycleProps} />
              ) : null}
              <BookingOpsCommandCenter {...opsCommandCenterProps} />
              {BOOKING_DETAIL_VISIBLE_SECTIONS.alertRecords ? (
                <BookingAlertTraceSection {...alertTraceProps} />
              ) : null}
              {BOOKING_DETAIL_VISIBLE_SECTIONS.operationsAuditRecords ? (
                <BookingOperationsAuditTraceSection {...operationsAuditTraceProps} />
              ) : null}
              <BookingAttentionChecksSection {...attentionChecksProps} />
              {BOOKING_DETAIL_VISIBLE_SECTIONS.chronologicalActivity ? (
                <BookingActivityPanel {...activityPanelProps} />
              ) : null}
            </div>
          ) : null}
          {sectionVisibility.showSettlementDisclosure ? (
            <div className="booking-detail-advanced-section">
              <div className="booking-detail-advanced-heading">
                <StatusBadge tone="neutral">Settlement</StatusBadge>
                <span className="booking-detail-advanced-heading-copy">
                  <strong>Wallet, payout, pricing, and full records</strong>
                  <small>Wallet evidence, payout eligibility, pricing, and full record detail.</small>
                </span>
              </div>
              {BOOKING_DETAIL_VISIBLE_SECTIONS.marketplaceWalletEvidence ? (
                <BookingMarketplaceWalletEvidenceSection {...marketplaceWalletEvidenceProps} />
              ) : null}
              <BookingFinanceCommandCenterSection {...financeCommandCenterProps} />
              {BOOKING_DETAIL_VISIBLE_SECTIONS.payoutBatchEligibility ? (
                <BookingPayoutBatchEligibilitySection {...payoutBatchEligibilityProps} />
              ) : null}
              {BOOKING_DETAIL_VISIBLE_SECTIONS.servicePricingEvidence ? (
                <BookingServicePricingSnapshotSection {...servicePricingSnapshotProps} />
              ) : null}
              {BOOKING_DETAIL_VISIBLE_SECTIONS.recordDetails ? (
                <BookingRecordDetailSections
                  {...recordDetailSectionsProps}
                  showOverviewSections={BOOKING_DETAIL_VISIBLE_SECTIONS.recordOverview}
                />
              ) : null}
            </div>
          ) : null}
          {!sectionVisibility.showHistoryDisclosure && !sectionVisibility.showSettlementDisclosure ? (
            <p className="muted admin-mt-12">
              No technical history or settlement diagnostics exist for this booking yet.
            </p>
          ) : null}
        </section>
      ) : null}
    </AdminPageTemplate>
  );
}

async function loadBookingDetailPageData(
  id: string,
  includeDeveloperDiagnostics: boolean,
  includeOperationalRecords: boolean,
): Promise<BookingDetailPageData> {
  const encodedId = encodeURIComponent(id);
  const [booking, operationalPolicies, rawNotifications] = await Promise.all([
    adminGet<AdminBookingDetail | null>(
      `/admin/bookings/${encodedId}?includeDiagnostics=${includeDeveloperDiagnostics ? 'true' : 'false'}`,
      null,
    ),
    includeOperationalRecords
      ? adminGet<AdminOperationalPolicySetting[]>(BOOKING_DETAIL_OPERATIONAL_POLICY_HREF, [])
      : Promise.resolve([]),
    adminGet<AdminNotification[]>(
      `/admin/bookings/${encodedId}/notifications?take=${BOOKING_DETAIL_NOTIFICATION_ROW_PREVIEW_LIMIT}`,
      [],
    ),
  ]);
  const providers =
    includeOperationalRecords && shouldLoadBookingDetailMarketplaceProviders(booking)
      ? await adminGet<AdminProvider[]>(
          `/admin/bookings/${encodedId}/marketplace-providers?take=${BOOKING_DETAIL_MARKETPLACE_PROVIDER_PREVIEW_LIMIT}`,
          [],
        )
      : [];

  return {
    booking,
    operationalPolicies,
    providers,
    rawNotifications,
  };
}

function firstItems<T>(items: readonly T[], limit: number): T[] {
  return items.length > limit ? items.slice(0, limit) : [...items];
}

function latestItems<T>(items: readonly T[], limit: number): T[] {
  return items.length > limit ? items.slice(-limit) : [...items];
}

function humanizeBookingDetailLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function bookingDetailActionNotice(params: Record<string, string | string[] | undefined>) {
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  switch (notice) {
    case 'note-saved':
      return { message: 'Operator note saved.', tone: 'success' as const };
    case 'note-failed':
      return { message: 'Operator note could not be saved. Review the entry and try again.', tone: 'error' as const };
    case 'expiry-complete':
      return { message: 'Booking expired and matching closed.', tone: 'success' as const };
    case 'expiry-failed':
      return {
        message: 'Booking could not be expired. Refresh and review the current matching state.',
        tone: 'error' as const,
      };
    default:
      return null;
  }
}

function bookingNotificationTracePreview(trace: ReturnType<typeof bookingNotificationTrace>) {
  return {
    ...trace,
    backupBatches: firstItems(trace.backupBatches, BOOKING_DETAIL_NOTIFICATION_BATCH_PREVIEW_LIMIT),
    rows: firstItems(trace.rows, BOOKING_DETAIL_NOTIFICATION_ROW_PREVIEW_LIMIT),
    totalBackupBatches: trace.backupBatches.length,
    totalRows: trace.rows.length,
  };
}
