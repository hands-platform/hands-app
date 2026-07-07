import { notFound } from 'next/navigation';
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
  type BookingActionStatusSectionsProps,
} from './booking-action-status-sections';
import { BookingDetailLifecycleListSection } from './booking-detail-lifecycle-list-section';
import { BookingDetailChatTranscriptSection } from './booking-detail-chat-transcript-section';
import { BookingDetailPostMatchDecisionSection } from './booking-detail-post-match-decision-section';
import { BookingCloseoutSections, type BookingCloseoutSectionsProps } from './booking-closeout-sections';
import { BookingDetailDisclosureGroup } from './booking-detail-disclosure-group';
import {
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
import {
  bookingCommunicationMovementHandoff,
} from './booking-communication-movement-handoff';
import {
  bookingAddressSnapshotLabel,
  money,
  shortId,
} from './booking-formatters';
import { BookingEvidenceSections, type BookingEvidenceSectionsProps } from './booking-evidence-sections';
import {
  bookingCashDebtNeedsSettlement,
  bookingCashFeeSettlementPath,
} from './booking-cash-wallet-gate';
import { bookingDetailActionEvidenceGate } from './booking-detail-action-evidence-gate';
import { bookingDetailChatEvidenceDecisionBoard } from './booking-detail-chat-evidence-decision-board';
import { bookingDetailGateAndNotes } from './booking-detail-gate-and-notes';
import { bookingFinanceTrace } from './booking-finance-trace';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingAddressRadiusContract } from './booking-address-radius-contract';
import { bookingChatReady } from './booking-chat-evidence';
import {
  bookingChatRepairActionState,
} from './booking-chat-repair-state';
import { bookingOutcomeReviewPanel } from './booking-outcome-review-panel';
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
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { StatusBadge } from '../../../components/status-badge';
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
import {
  bookingDispatchPin,
  bookingMarketplacePartnerSupply,
} from './booking-marketplace-supply';
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
import { bookingCustomerSelectableParticipantsForFinalChoice } from './booking-participant-rules';
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
import { OPERATIONAL_POLICY_KEYS } from '../../../lib/operations-policy';
import { attentionLevel } from '../../../lib/admin-attention-flags';
import { bookingChatLifecycle } from '../../../lib/booking-chat-lifecycle';
import { bookingClosureSummary } from '../../../lib/booking-closure-summary';
import { bookingPayoutBatchEligibility as buildBookingPayoutBatchEligibilityFromFacts } from '../../../lib/booking-payout-batch-eligibility';
import {
  canCloseoutCompletedBooking,
  completedCloseoutLabel,
  completedCloseoutTone,
} from '../../../lib/booking-closeout-policy';
import {
  bookingOperatorNoteLines,
  canExpireBooking,
  canMarkNoShow,
} from '../../../lib/booking-operator-action-rules';
import {
  BOOKING_DETAIL_TERMINAL_STATUSES,
  shouldLoadBookingDetailMarketplaceProviders,
} from './booking-detail-marketplace-provider-loader';

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
  'Service pricing snapshot',
] as const;

const BOOKING_DETAIL_CHAT_PREVIEW_LIMIT = 12;
const BOOKING_DETAIL_NOTIFICATION_BATCH_PREVIEW_LIMIT = 4;
const BOOKING_DETAIL_NOTIFICATION_ROW_PREVIEW_LIMIT = 12;
const BOOKING_DETAIL_ACTIVITY_PREVIEW_LIMIT = 24;
const BOOKING_DETAIL_ACTIVITY_CSV_PREVIEW_LIMIT = 40;
const BOOKING_DETAIL_OPERATING_TIMELINE_PREVIEW_LIMIT = 18;
const BOOKING_DETAIL_MARKETPLACE_PROVIDER_PREVIEW_LIMIT = 40;
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
  const {
    booking,
    operationalPolicies,
    providers,
    rawNotifications,
  } = await loadBookingDetailPageData(id);

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
  const toolbarProps = bookingDetailToolbarProps({ booking, finalPartnerSummary });
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
  const financeTrace = bookingFinanceTrace(booking);
  const financeSummaryCards = bookingDetailFinanceSummaryCards(financeTrace);
  const financeFlags = bookingDetailFinanceFlags(booking, financeTrace);
  const cashFeeSettlementPath = bookingCashFeeSettlementPath(booking, financeTrace);
  const cashFeeDebtNeedsSettlement = bookingCashDebtNeedsSettlement(booking);
  const paymentEvidence = bookingPaymentEvidence(booking);
  const refundLedgerRows = paymentEvidence.refundRows;
  const refundLedgerCount = refundLedgerRows.length;
  const operatorNoteLines = bookingOperatorNoteLines(booking.notes);
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
  const visibleBookingActivityRecords = firstItems(bookingActivityRecords, BOOKING_DETAIL_ACTIVITY_PREVIEW_LIMIT);
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
    hasPlatformFeeLog:
      (booking.earning?.platformFeeLogs?.length ?? booking.platformFeeLogs?.length ?? 0) > 0,
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
  const outcomeReview = bookingOutcomeReviewPanel({
    booking,
    closeoutOpenItemCount: closeoutReadiness.openItems.length,
    closureSummary,
    messageCount,
    operatorNoteCount,
  });
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
    matchingExpiry: { canSubmit: canExpireBooking(booking.status), status: booking.status },
    noShow: { canSubmit: canMarkNoShow(booking.status), status: booking.status },
    notes: booking.notes,
    opsTaskCards,
    operatorNotesPlacement: booking.status === 'COMPLETED' ? 'after-actions' : 'before-actions',
    outcomeReview,
    showDispatchChecklist: !BOOKING_DETAIL_TERMINAL_STATUSES.has(booking.status),
    showLiveServiceBoard: booking.status === 'MATCHED' || booking.status === 'IN_SERVICE',
    showOutcomeReview: !showPostMatchDecisionBelowLifecycle,
    showStructuredOpsStatus: booking.status !== 'COMPLETED',
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
  const showAdvancedRecordsDisclosure =
    sectionVisibility.showDispatchDisclosure ||
    sectionVisibility.showEvidenceDisclosure ||
    sectionVisibility.showHistoryDisclosure ||
    sectionVisibility.showSettlementDisclosure;
  const advancedRecordSummaryItems = [
    sectionVisibility.showEvidenceDisclosure ? { label: 'Evidence', tone: 'pill-info' } : null,
    sectionVisibility.showDispatchDisclosure ? { label: 'Dispatch', tone: 'pill-success' } : null,
    sectionVisibility.showHistoryDisclosure ? { label: 'History', tone: 'pill-warn' } : null,
    sectionVisibility.showSettlementDisclosure ? { label: 'Settlement', tone: 'pill-neutral' } : null,
  ].filter((item): item is { label: string; tone: string } => Boolean(item));

  return (
    <AdminPageTemplate
      actions={<BookingDetailToolbar {...toolbarProps} />}
      contentClassName="booking-detail-page"
      description={`${toolbarProps.serviceLabel} - ${toolbarProps.status}`}
      title={`Booking ${shortId(booking.id)}`}
    >
      <span hidden>{bookingDetailAuthoritySourceMarkers.join(' | ')}</span>

      <BookingUnifiedDetailSection {...unifiedDetailProps} />

      <AdminReviewRecordsSection
        basePath={`/bookings/${id}`}
        customerReviews={bookingReviewRecords.customerReviews}
        description="Customer review and Partner evaluation records attached to this booking."
        id="booking-review-records"
        partnerEvaluations={bookingReviewRecords.partnerEvaluations}
        searchParams={detailSearchParams}
        title="Booking review records"
      />

      <BookingDetailChatTranscriptSection
        archiveHref={`/chat-archive?q=${encodeURIComponent(booking.id)}`}
        messages={visibleMessages}
        totalMessages={messageCount}
      />

      <BookingDetailLifecycleListSection booking={booking} />

      {showPostMatchDecisionBelowLifecycle && (
        <BookingDetailPostMatchDecisionSection
          bookingId={booking.id}
          outcomeReview={outcomeReview}
        />
      )}

      <BookingActionStatusSections {...actionStatusSectionsProps} />

      {sectionVisibility.showCloseoutReadiness && (
        <BookingCloseoutReadinessSection {...closeoutReadinessProps} />
      )}

      {showAdvancedRecordsDisclosure && (
        <BookingDetailDisclosureGroup
          helper="Open only when an operator needs deep evidence, dispatch, history, or settlement records."
          label="Advanced"
          summaryItems={advancedRecordSummaryItems}
          title="Booking records"
        >
          {sectionVisibility.showEvidenceDisclosure && (
            <div className="booking-detail-advanced-section">
              <div className="booking-detail-advanced-heading">
                <StatusBadge tone="info">Evidence</StatusBadge>
                <span className="booking-detail-advanced-heading-copy">
                  <strong>Decision and closeout evidence</strong>
                  <small>Chat, evidence packet, closeout links, and operator queue.</small>
                </span>
              </div>
              <BookingEvidenceSections {...evidenceSectionsProps} />
              <BookingCloseoutSections {...closeoutSectionsProps} />
              <BookingOperatorQueueSections {...operatorQueueSectionsProps} />
              <BookingHandoffChecklistSection {...handoffChecklistProps} />
              <BookingFullRecordIndex {...fullRecordIndexProps} />
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
              <BookingStageSnapshotSection {...stageSnapshotProps} />
              <BookingMatchingRuleSnapshotSection {...matchingRuleSnapshotProps} />
              <BookingCustomerWaitPanelSection {...customerWaitPanelProps} />
              <BookingAppliedPolicySection {...appliedPolicyProps} />
              <BookingAddressRadiusContractSection {...addressRadiusContractProps} />
              <BookingDispatchCandidateDecisionMatrixSection {...dispatchCandidateDecisionMatrixProps} />
              <BookingMarketplaceSupplySection {...marketplaceSupplyProps} />
            </div>
          )}

          {sectionVisibility.showHistoryDisclosure && (
            <div className="booking-detail-advanced-section">
              <div className="booking-detail-advanced-heading">
                <StatusBadge tone="warning">History</StatusBadge>
                <span className="booking-detail-advanced-heading-copy">
                  <strong>Operating movement and audit trail</strong>
                  <small>Movement ledger, notifications, audit rows, and activity export.</small>
                </span>
              </div>
              <BookingOperatingLedgerSection {...operatingLedgerProps} />
              <BookingOperatingSnapshotSection {...operatingSnapshotProps} />
              <BookingOperatingTimelineSection {...operatingTimelineProps} />
              <BookingCommunicationMovementHandoffSection {...communicationMovementHandoffProps} />
              <BookingChatLifecycleSection {...chatLifecycleProps} />
              <BookingOpsCommandCenter {...opsCommandCenterProps} />
              <BookingAlertTraceSection {...alertTraceProps} />
              <BookingOperationsAuditTraceSection {...operationsAuditTraceProps} />
              <BookingAttentionChecksSection {...attentionChecksProps} />
              <BookingActivityPanel {...activityPanelProps} />
            </div>
          )}

          {sectionVisibility.showSettlementDisclosure && (
            <div className="booking-detail-advanced-section">
              <div className="booking-detail-advanced-heading">
                <StatusBadge tone="neutral">Settlement</StatusBadge>
                <span className="booking-detail-advanced-heading-copy">
                  <strong>Wallet, payout, pricing, and full records</strong>
                  <small>Wallet evidence, payout eligibility, pricing, and raw record detail.</small>
                </span>
              </div>
              <BookingMarketplaceWalletEvidenceSection {...marketplaceWalletEvidenceProps} />
              <BookingFinanceCommandCenterSection {...financeCommandCenterProps} />
              <BookingPayoutBatchEligibilitySection {...payoutBatchEligibilityProps} />
              <BookingServicePricingSnapshotSection {...servicePricingSnapshotProps} />
              <BookingRecordDetailSections {...recordDetailSectionsProps} />
            </div>
          )}
        </BookingDetailDisclosureGroup>
      )}
    </AdminPageTemplate>
  );
}

async function loadBookingDetailPageData(id: string): Promise<BookingDetailPageData> {
  const encodedId = encodeURIComponent(id);
  const [booking, operationalPolicies, rawNotifications] = await Promise.all([
    adminGet<AdminBookingDetail | null>(`/admin/bookings/${encodedId}`, null),
    adminGet<AdminOperationalPolicySetting[]>(BOOKING_DETAIL_OPERATIONAL_POLICY_HREF, []),
    adminGet<AdminNotification[]>(
      `/admin/bookings/${encodedId}/notifications?take=${BOOKING_DETAIL_NOTIFICATION_ROW_PREVIEW_LIMIT}`,
      [],
    ),
  ]);
  const providers = shouldLoadBookingDetailMarketplaceProviders(booking)
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

function bookingNotificationTracePreview(trace: ReturnType<typeof bookingNotificationTrace>) {
  return {
    ...trace,
    backupBatches: firstItems(trace.backupBatches, BOOKING_DETAIL_NOTIFICATION_BATCH_PREVIEW_LIMIT),
    rows: firstItems(trace.rows, BOOKING_DETAIL_NOTIFICATION_ROW_PREVIEW_LIMIT),
    totalBackupBatches: trace.backupBatches.length,
    totalRows: trace.rows.length,
  };
}
