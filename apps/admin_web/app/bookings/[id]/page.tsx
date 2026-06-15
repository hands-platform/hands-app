import { notFound } from 'next/navigation';
import {
  BookingActivityPanel,
  BookingFullRecordIndex,
} from './booking-activity-panel';
import {
  buildBookingActivityCsvHref,
  buildBookingActivityRecords,
  buildBookingActivitySummary,
} from './booking-activity-records';
import { BookingActionStatusSections } from './booking-action-status-sections';
import { BookingCloseoutSections } from './booking-closeout-sections';
import {
  BookingCommandDecisionStripSection,
  BookingDetailToolbar,
  BookingMatchingRuleSnapshotSection,
  BookingMetricGridSection,
  BookingMvpAuthorityContractSection,
  BookingOperationsQuickRailSection,
  BookingOperatorFirstReadSection,
  BookingPriorityBriefingSection,
  BookingRecentOperationsTimelineSection,
} from './booking-command-briefing-sections';
import {
  BookingAlertTraceSection,
  BookingAttentionChecksSection,
  BookingFinanceCommandCenterSection,
  BookingOperationsAuditTraceSection,
  BookingPayoutBatchEligibilitySection,
  BookingServicePricingSnapshotSection,
} from './booking-finance-trace-sections';
import { BookingOperatorQueueSections, BookingOpsCommandCenter } from './booking-operator-sections';
import {
  BookingChatLifecycleSection,
  BookingCloseoutReadinessSection,
  BookingCommunicationMovementHandoffSection,
  BookingHandoffChecklistSection,
  BookingMarketplaceWalletEvidenceSection,
  BookingOperatingLedgerSection,
  BookingOperatingSnapshotSection,
  BookingOperatingTimelineSection,
} from './booking-operating-sections';
import { BookingRecordDetailSections } from './booking-record-detail-sections';
import { bookingRecordFinanceRows as buildBookingRecordFinanceRows } from './booking-record-finance-rows';
import {
  bookingRecordPaymentRows as buildBookingRecordPaymentRows,
  bookingRecordServiceRows as buildBookingRecordServiceRows,
} from './booking-record-info-rows';
import {
  BookingAddressRadiusContractSection,
  BookingAppliedPolicySection,
  BookingCustomerWaitPanelSection,
  BookingDispatchCandidateDecisionMatrixSection,
  BookingMarketplaceSupplySection,
  BookingStageSnapshotSection,
} from './booking-policy-supply-sections';
import {
  bookingCommunicationMovementHandoff,
  messageSenderLabel,
} from './booking-communication-movement-handoff';
import {
  bookingAddressSnapshotLabel,
  bookingServiceOptionLabel,
  bookingServicePayoutRuleLabel,
  coordinateLabel,
  formatDate,
  isTerminalPayment,
  money,
  compactActivityText,
  providerName,
  shortId,
} from './booking-formatters';
import { BookingEvidenceSections } from './booking-evidence-sections';
import {
  bookingCashDebtNeedsSettlement,
  bookingCashFeeSettlementPath,
} from './booking-cash-wallet-gate';
import { bookingDetailOperatorFirstRead } from './booking-detail-operator-first-read';
import { bookingFinanceTrace } from './booking-finance-trace';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingAddressRadiusContract } from './booking-address-radius-contract';
import { bookingChatReady } from './booking-chat-evidence';
import {
  bookingChatRepairActionState,
} from './booking-chat-repair-state';
import { bookingDetailConnectedRecordLinks } from './booking-detail-connected-record-links';
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
import { bookingDetailOperatorPriorityBriefing } from './booking-detail-operator-priority-briefing';
import { bookingDetailMetricCards } from './booking-detail-metric-cards';
import { bookingDetailOperationsQuickRail } from './booking-detail-operations-quick-rail';
import { bookingLiveServiceSignals } from './booking-live-service-signals';
import { bookingCloseoutReadiness } from './booking-closeout-readiness';
import { bookingOperatingSnapshot } from './booking-operating-snapshot';
import { bookingOperatingTimeline } from './booking-operating-timeline';
import { bookingCustomerWaitPanel } from './booking-customer-wait-panel';
import { bookingMvpAuthorityContract } from './booking-mvp-authority-contract';
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
} from './booking-detail-record-rows';
import { bookingCustomerSelectableParticipantsForFinalChoice } from './booking-participant-rules';
import { bookingPreferredAwaitingDecision } from './booking-preferred-decision';
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
import { attentionLevel } from '../../../lib/admin-attention-flags';
import { bookingChatEvidenceDecisionBoard as buildBookingChatEvidenceDecisionBoard } from '../../../lib/booking-chat-evidence-decision-board';
import { bookingChatLifecycle } from '../../../lib/booking-chat-lifecycle';
import { bookingCommandDecisionStrip } from '../../../lib/booking-command-decision-strip';
import {
  bookingCloseoutChecklistRows as buildBookingCloseoutChecklistRowsFromFacts,
} from '../../../lib/booking-closeout-checklist-rows';
import { bookingClosureSummary } from '../../../lib/booking-closure-summary';
import { bookingDecisionEvidenceGuardrails as buildBookingDecisionEvidenceGuardrails } from '../../../lib/booking-decision-evidence-guardrails';
import { bookingDecisionNotePresets as buildBookingDecisionNotePresets } from '../../../lib/booking-decision-note-presets';
import { bookingActionEvidenceGate as buildBookingActionEvidenceGateFromFacts } from '../../../lib/booking-action-evidence-gate';
import { bookingFinalGateReason as buildBookingFinalGateReasonFromFacts } from '../../../lib/booking-final-gate-reason';
import { bookingManualDecisionReadiness as buildBookingManualDecisionReadiness } from '../../../lib/booking-manual-decision-readiness';
import { bookingPayoutBatchEligibility as buildBookingPayoutBatchEligibilityFromFacts } from '../../../lib/booking-payout-batch-eligibility';
import {
  canCloseoutCompletedBooking,
  completedCloseoutLabel,
  completedCloseoutTone,
} from '../../../lib/booking-closeout-policy';
import { bookingOpsBadges } from '../../../lib/booking-ops-badges';
import {
  bookingOperatorNoteLines,
  canExpireBooking,
  canMarkNoShow,
} from '../../../lib/booking-operator-action-rules';
import { primaryBookingOpsInstruction } from '../../../lib/booking-primary-ops-instruction';

type PageProps = {
  params: Promise<{ id: string }>;
};

const bookingDetailAuthoritySourceMarkers = [
  'MVP authority contract',
  'NestJS business authority',
  'BookingAddressSnapshot',
  'customer fallback Partner choice',
  'wallet gate',
  'Connected operations records',
  'Operator action availability',
  'Booking gate reason',
  'Booking full record index',
  'Finance trace',
  'Cash settlement desk',
  'Tax policy',
  'Location trail',
  'Communication and movement handoff',
  'Chat lifecycle and retention',
  'All customer chats',
  'All Partner chats',
  'Service pricing snapshot',
] as const;

const TERMINAL_BOOKING_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

export default async function BookingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [booking, operationalPolicies, rawNotifications, providers] = await Promise.all([
    adminGet<AdminBookingDetail | null>(`/admin/bookings/${id}`, null),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
    adminGet<AdminNotification[]>('/admin/notifications', []),
    adminGet<AdminProvider[]>('/admin/partners?view=list', []),
  ]);

  if (!booking) {
    notFound();
  }

  const service = booking.services?.[0];
  const messages = [...(booking.chatRoom?.messages ?? [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const chatReady = bookingChatReady(booking);
  const finalPartnerSummary = bookingFinalPartnerSummary(booking);
  const participantCounts = bookingParticipantCounts(booking);
  const latestLocation = latestProviderLocation(booking);
  const locationTrailSnapshots = bookingDetailLocationTrail(booking);
  const addressLine = bookingAddressSnapshotLabel(booking);
  const addressPin = booking.addressSnapshot
    ? coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)
    : coordinateLabel(booking.lat, booking.lng);
  const attentionFlags = bookingDetailAttentionFlags(booking);
  const attentionSummary = attentionLevel(attentionFlags);
  const liveSignals = bookingLiveServiceSignals(booking);
  const dispatchSteps = bookingDetailDispatchChecklist(booking);
  const opsTaskCards = bookingDetailOpsTaskCards(booking);
  const financeTrace = bookingFinanceTrace(booking);
  const financeSummaryCards = bookingDetailFinanceSummaryCards(financeTrace);
  const financeFlags = bookingDetailFinanceFlags(booking, financeTrace);
  const cashFeeSettlementPath = bookingCashFeeSettlementPath(booking, financeTrace);
  const paymentEvidence = bookingPaymentEvidence(booking);
  const refundLedgerRows = paymentEvidence.refundRows;
  const operatorNoteLines = bookingOperatorNoteLines(booking.notes);
  const closureSummary = bookingClosureSummary(booking);
  const servicePricingSnapshotRows = bookingServicePricingSnapshotRows(financeTrace);
  const policySnapshot = bookingOperationalPolicySnapshot(booking, operationalPolicies);
  const marketplaceSupply = bookingMarketplacePartnerSupply(booking, providers, operationalPolicies);
  const addressRadiusContract = bookingAddressRadiusContract(booking, marketplaceSupply);
  const customerWaitPanel = bookingCustomerWaitPanel(booking, marketplaceSupply, operationalPolicies);
  const mvpAuthorityContract = bookingMvpAuthorityContract({
    booking,
    operationalPolicies,
    marketplaceSupply,
    messageCount: messages.length,
    financeTrace,
    walletDebt: bookingCashDebtNeedsSettlement(booking),
    terminal: TERMINAL_BOOKING_STATUSES.has(booking.status),
  });
  const stageSnapshot = bookingStageSnapshot(booking, customerWaitPanel, marketplaceSupply);
  const notificationTrace = bookingNotificationTrace(booking, rawNotifications);
  const matchingRuleSnapshot = bookingDetailMatchingRuleSnapshot({
    booking,
    marketplaceSupply,
    customerWaitPanel,
    notificationTrace,
    walletBlocked: bookingCashDebtNeedsSettlement(booking),
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
  const bookingActivityCsvHref = buildBookingActivityCsvHref(booking, bookingActivityRecords);
  const marketplaceWalletEvidence = bookingMarketplaceWalletEvidence({
    booking,
    marketplaceSupply,
    financeTrace,
    notificationTrace,
    walletDebt: bookingCashDebtNeedsSettlement(booking),
  });
  const participantLedger = bookingParticipantLedger(booking, marketplaceSupply, notificationTrace);
  const chatLifecycle = bookingChatLifecycle(booking, messages.length);
  const handoffChecklist = bookingHandoffChecklist(booking, messages.length, latestLocation);
  const chatRepair = bookingChatRepairActionState(booking);
  const closeoutReadiness = bookingCloseoutReadiness({
    booking,
    financeFlags,
    latestLocation,
    messageCount: messages.length,
    notificationCount: notificationTrace.rows.length,
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
    cashDebt: bookingCashDebtNeedsSettlement(booking),
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
    messageCount: messages.length,
    notificationCount: notificationTrace.rows.length,
  });
  const operatingTimeline = bookingOperatingTimeline({
    booking,
    addressLine,
    addressPin,
    latestLocation,
    messages,
    notifications: rawNotifications,
  });
  const communicationMovementHandoff = bookingCommunicationMovementHandoff({
    booking,
    latestLocation,
    messages,
    notifications: rawNotifications,
  });
  const bookingRecordIndexCards = bookingDetailRecordIndexCards({
    booking,
    participantCounts,
    messageCount: messages.length,
    paymentEvidence,
    financeTrace,
    providerLocationMetric: {
      helper: bookingDetailProviderLocationMetricHelper(booking),
      value: bookingDetailProviderLocationMetricValue(booking),
    },
    communicationMovementStatus: communicationMovementHandoff.status,
    locationTrailCount: locationTrailSnapshots.length,
    notificationCount: notificationTrace.rows.length,
    marketplaceAlertBatchCount: notificationTrace.backupBatches.length,
    operatorNoteCount: operatorNoteLines.length,
    activityRecordCount: bookingActivityRecords.length,
  });
  const operatingLedger = bookingDetailOperatingLedger({
    booking,
    finalPartnerSummary,
    participantCounts,
    messageCount: messages.length,
    paymentEvidence,
    financeTrace,
    financeFlagCount: financeFlags.length,
    latestLocation,
    addressPin,
    notificationTrace,
    activityRecordCount: bookingActivityRecords.length,
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
  const operatorPriorityBriefing = bookingDetailOperatorPriorityBriefing({
    booking,
    operatorCommandQueue,
    closeoutReadiness,
    financeFlags,
    latestLocation,
    messageCount: messages.length,
  });
  const commandDecisionStrip = bookingCommandDecisionStrip({
    bookingStatus: booking.status,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressLabel: bookingAddressSnapshotLabel(booking),
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidateCount: bookingCustomerSelectableParticipantsForFinalChoice(booking).length,
    marketplaceEligibleCount: marketplaceSupply.eligibleCount,
    hasFinalPartner: finalPartnerSummary.selected,
    hasChatRoom: Boolean(booking.chatRoom),
    messageCount: messages.length,
    paymentMethod: booking.payment?.method ?? 'NONE',
    paymentStatus: booking.payment?.status ?? 'NONE',
    cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    closeoutOpenItemCount: closeoutReadiness.openItems.length,
  });
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
  const latestMessage = messages[messages.length - 1];
  const chatEvidenceDecisionBoard = buildBookingChatEvidenceDecisionBoard({
    bookingId: booking.id,
    bookingStatus: booking.status,
    hasChatRoom: Boolean(booking.chatRoom),
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    messageCount: messages.length,
    latestMessageAtLabel: latestMessage ? formatDate(latestMessage.createdAt) : null,
    latestMessagePreview: latestMessage
      ? `${messageSenderLabel(latestMessage)}: ${compactActivityText(latestMessage.body, 90)}`
      : null,
    hasLatestLocation: Boolean(latestLocation),
    latestLocationAtLabel: latestLocation ? formatDate(latestLocation.recordedAt) : null,
    latestLocationCoordinateLabel: latestLocation
      ? coordinateLabel(latestLocation.lat, latestLocation.lng)
      : null,
    alertCount: notificationTrace.rows.length,
    auditLogCount: booking.auditLogs?.length ?? 0,
    operatorNoteLines,
  });
  const manualDecisionEvidenceSummary = [
    messages.length > 0 ? `${messages.length} chat message(s)` : 'no chat messages',
    latestLocation ? `location ${formatDate(latestLocation.recordedAt)}` : 'no Partner pin',
    notificationTrace.rows.length > 0
      ? `${notificationTrace.rows.length} alert row(s)`
      : 'no alert rows',
    operatorNoteLines.length > 0
      ? `${operatorNoteLines.length} operator note(s)`
      : 'no operator notes',
  ].join(' / ');
  const cashFeeDebtNeedsSettlement = bookingCashDebtNeedsSettlement(booking);
  const manualDecisionReadiness = buildBookingManualDecisionReadiness({
    bookingStatus: booking.status,
    closureStatus: bookingClosureSummary(booking).status,
    canMarkNoShow: canMarkNoShow(booking.status),
    decisionEvidenceReady:
      messages.length > 0 ||
      Boolean(latestLocation) ||
      notificationTrace.rows.length > 0 ||
      operatorNoteLines.length > 0,
    evidenceSummary: manualDecisionEvidenceSummary,
    paymentExists: Boolean(booking.payment),
    paymentStatus: booking.payment?.status ?? 'NONE',
    paymentMethod: booking.payment?.method ?? 'NONE',
    refundRowCount: refundLedgerRows.length,
    refundEvidence: paymentEvidence.refundEvidence,
    cashFeeDebtNeedsSettlement,
    cashDebtEvidenceLabel: cashFeeDebtNeedsSettlement
      ? `Debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`
      : `${booking.payment?.method ?? 'NONE'} / ${booking.payment?.status ?? 'NONE'}`,
    closeoutStatus: closeoutReadiness.status,
    closeoutTone: closeoutReadiness.tone,
    closeoutHelper: closeoutReadiness.helper,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
  });
  const decisionFinalPartner = bookingFinalPartnerSummary(booking);
  const decisionEvidenceGuardrails = buildBookingDecisionEvidenceGuardrails({
    bookingStatus: booking.status,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressSnapshotLabel: bookingAddressSnapshotLabel(booking),
    addressPinLabel: booking.addressSnapshot
      ? coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)
      : 'No pin',
    hasSelectedPartner: decisionFinalPartner.selected,
    selectedPartnerLabel: decisionFinalPartner.label,
    participantCount: booking.participants?.length ?? 0,
    preferredPartnerLabel: providerName(booking.preferredProvider),
    hasChatRoom: Boolean(booking.chatRoom),
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    messageCount: messages.length,
    hasLatestLocation: Boolean(latestLocation),
    latestLocationAtLabel: latestLocation ? formatDate(latestLocation.recordedAt) : null,
    notificationCount: notificationTrace.rows.length,
    operatorNoteCount: operatorNoteLines.length,
    hasOpsTrail: (booking.opsTasks?.length ?? 0) > 0 || (booking.auditLogs?.length ?? 0) > 0,
    paymentStatus: booking.payment?.status ?? null,
    paymentMethod: booking.payment?.method ?? null,
    paymentAmountLabel: booking.payment
      ? money(booking.payment.amount, booking.payment.currency)
      : 'No payment amount',
    refundRowCount: refundLedgerRows.length,
    cashFeeDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    platformFeeLabel: financeTrace.platformFee,
    withholdingLabel: financeTrace.withholding,
    walletLedgerLabel: financeTrace.walletLedger,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
    financeLedgerRowCount:
      (booking.platformFeeLogs?.length ?? 0) +
      (booking.taxLogs?.length ?? 0) +
      (booking.walletLedgerEntries?.length ?? 0) +
      (booking.earning?.platformFeeLogs?.length ?? 0) +
      (booking.earning?.taxLogs?.length ?? 0) +
      (booking.earning?.walletLedgerEntries?.length ?? 0),
    partnerPayoutLabel: financeTrace.providerPayout,
  });
  const connectedRecordLinks = bookingDetailConnectedRecordLinks({
    booking,
    finalPartnerSummary,
    messageCount: messages.length,
    notificationCount: notificationTrace.rows.length,
    paymentEvidence,
    financeTrace,
  });
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking).length;
  const failedAlertCount = notificationTrace.rows.filter((row) =>
    row.deliveryStatuses.includes('FAILED'),
  ).length;
  const bookingEvidenceBundleRows = bookingDetailEvidenceBundleRows({
    booking,
    messages,
    latestLocation,
    locationTrailCount: locationTrailSnapshots.length,
    notificationTrace,
    financeTrace,
    refundLedgerCount: refundLedgerRows.length,
    operatorNoteLines,
    bookingActivityRecords,
    finalPartnerSummary,
    customerChoiceCandidates,
    failedAlertCount,
    chatReady,
  });
  const bookingCloseoutChecklist = buildBookingCloseoutChecklistRowsFromFacts({
    bookingId: booking.id,
    bookingStatus: booking.status,
    addressReady: Boolean(booking.addressSnapshot),
    addressLabel: bookingAddressSnapshotLabel(booking),
    finalPartnerId: finalPartnerSummary.selected ? finalPartnerSummary.id : null,
    finalPartnerLabel: finalPartnerSummary.selected ? finalPartnerSummary.label : null,
    customerChoiceCandidates,
    chatNeeded: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
      booking.status,
    ),
    chatReady,
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    chatMessageCount: messages.length,
    latestMessageAtLabel: latestMessage ? formatDate(latestMessage.createdAt) : null,
    cashDebt: cashFeeDebtNeedsSettlement,
    paymentStatus: booking.payment?.status ?? null,
    paymentMethod: booking.payment?.method ?? 'NONE',
    customerPriceLabel: financeTrace.customerPrice,
    partnerPayoutLabel: financeTrace.providerPayout,
    walletLedgerLabel: financeTrace.walletLedger,
    terminal: TERMINAL_BOOKING_STATUSES.has(booking.status),
    refundLedgerCount: refundLedgerRows.length,
    refundEvidence: paymentEvidence.refundEvidence,
    alertCount: notificationTrace.rows.length,
    failedAlertCount,
    closeoutStatus: closeoutReadiness.status,
    closeoutTone: closeoutReadiness.tone,
    closeoutHelper: closeoutReadiness.helper,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
    taxRows: booking.taxLogs?.length ?? booking.earning?.taxLogs?.length ?? 0,
    operatorTrailCount:
      operatorNoteLines.length + bookingActivityRecords.length + (booking.auditLogs?.length ?? 0),
    latestLocationLabel: latestLocation
      ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}`
      : null,
    notificationCount: notificationTrace.rows.length,
  });
  const manualOutcomeEvidenceLabel = [
    messages.length ? `${messages.length} chat message(s)` : null,
    latestLocation ? `location ${formatDate(latestLocation.recordedAt)}` : null,
    notificationTrace.rows.length ? `${notificationTrace.rows.length} alert row(s)` : null,
    operatorNoteLines.length ? `${operatorNoteLines.length} operator note(s)` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const actionEvidenceGate = buildBookingActionEvidenceGateFromFacts({
    bookingStatus: booking.status,
    paymentExists: Boolean(booking.payment?.id),
    paymentStatus: booking.payment?.status ?? 'NONE',
    paymentProviderRef: booking.payment?.providerRef ?? null,
    paymentMethod: booking.payment?.method ?? null,
    paymentIsTerminal: isTerminalPayment(booking.payment?.status ?? 'NONE'),
    hasChatArchive: Boolean(booking.chatRoom),
    hasDecisionEvidence: Boolean(
      messages.length ||
        latestLocation ||
        notificationTrace.rows.length ||
        operatorNoteLines.length ||
        booking.auditLogs?.length,
    ),
    manualOutcomeEvidenceLabel,
    refundLedgerCount: refundLedgerRows.length,
    cashDebt: bookingCashDebtNeedsSettlement(booking),
    closeoutAvailable: canCloseoutCompletedBooking(booking),
    closeoutStatus: closeoutReadiness.status,
    closeoutTone: closeoutReadiness.tone,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
    closeoutHelper: closeoutReadiness.helper,
    completedCloseoutLabel: completedCloseoutLabel(booking),
    completedCloseoutTone: completedCloseoutTone(booking),
    expireAvailable: canExpireBooking(booking.status),
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    expiresAtLabel: formatDate(booking.expiresAt),
    noShowAvailable: canMarkNoShow(booking.status),
  });
  const actionGateByAction = new Map(actionEvidenceGate.rows.map((row) => [row.action, row]));
  const marketplaceParticipants = participantCounts.marketplace;
  const finalGateReason = buildBookingFinalGateReasonFromFacts({
    cashDebt: bookingCashDebtNeedsSettlement(booking),
    walletLedgerLabel: financeTrace.walletLedger,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    bookingStatus: booking.status,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredAwaitingDecision: bookingPreferredAwaitingDecision(booking),
    customerChoiceCandidates,
    marketplaceParticipants,
    selected: bookingFinalPartnerSummary(booking).selected,
    hasChatRoom: Boolean(booking.chatRoom),
  });
  const decisionNotePresets = buildBookingDecisionNotePresets({
    bookingStatus: booking.status,
    messageCount: messages.length,
    hasLatestLocation: Boolean(latestLocation),
    notificationCount: notificationTrace.rows.length,
    operatorNoteCount: operatorNoteLines.length,
    paymentMethod: booking.payment?.method ?? 'NONE',
    paymentStatus: booking.payment?.status ?? 'NONE',
    refundRowCount: refundLedgerRows.length,
    cashFeeDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
  });
  const bookingOperationsQuickRail = bookingDetailOperationsQuickRail({
    booking,
    operatorPriorityStatus: operatorPriorityBriefing.status,
    matchingRuleStatus: matchingRuleSnapshot.status,
    evidenceLaneCount: bookingEvidenceBundleRows.length,
    connectedRecordCount: connectedRecordLinks.length,
    participantCounts,
    messageCount: messages.length,
    paymentEvidence,
    financeTrace,
    addressLine,
    addressPin,
    operatorQueue: operatorCommandQueue,
    activityRecordCount: bookingActivityRecords.length,
  });
  const bookingOperatorFirstRead = bookingDetailOperatorFirstRead({
    booking,
    addressLine,
    addressPin,
    matchingRuleStatus: matchingRuleSnapshot.status,
    customerWaitSignalStatus: customerWaitPanel.signalStatus,
    eligibleMarketplaceCount: marketplaceSupply.eligibleCount,
    finalPartnerSummary,
    participantCounts,
    messageCount: messages.length,
    paymentEvidence,
    financeTrace,
  });
  const bookingMetricCards = bookingDetailMetricCards({
    booking,
    closureSummary,
    messageCount: messages.length,
    attentionSummary,
  });
  const locationTrailRows = bookingDetailLocationTrailRows(locationTrailSnapshots);
  const bookingRecordCustomerRows = bookingDetailCustomerRows({ booking, addressLine, addressPin });
  const bookingRecordServiceRows = buildBookingRecordServiceRows({
    optionLabel: bookingServiceOptionLabel(booking),
    serviceName: service?.service?.name ?? 'Service pending',
    durationLabel: `${service?.service?.durationMin ?? '-'} min`,
    bookingPriceLabel: money(service?.price ?? booking.payment?.amount, booking.payment?.currency),
    adminMinimumLabel: money(service?.service?.basePrice, booking.payment?.currency),
    payoutRuleLabel: bookingServicePayoutRuleLabel(booking),
    notesLabel: booking.notes ?? 'No notes',
    createdLabel: formatDate(booking.createdAt),
    updatedLabel: formatDate(booking.updatedAt),
  });
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
    cashFeeDebtLabel: bookingCashDebtNeedsSettlement(booking)
      ? `${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)} / Partner blocked`
      : null,
    serviceFeedbackLabel: booking.review ? 'Submitted' : 'Not submitted',
  });
  const bookingRecordFinanceRows = buildBookingRecordFinanceRows(financeTrace);

  return (
    <>
      <span hidden>{bookingDetailAuthoritySourceMarkers.join(' | ')}</span>

      <BookingDetailToolbar
        bookingId={booking.id}
        chatRoomId={booking.chatRoom?.id}
        customerProfileId={booking.customerProfile?.id}
        finalPartnerId={finalPartnerSummary.selected ? finalPartnerSummary.id : null}
        paymentId={booking.payment?.id}
        refundId={booking.refunds?.[0]?.id}
        serviceLabel={bookingServiceOptionLabel(booking)}
        status={booking.status}
      />

      <BookingOperatorFirstReadSection rows={bookingOperatorFirstRead} />

      <BookingMetricGridSection metrics={bookingMetricCards} />

      <BookingOperationsQuickRailSection rows={bookingOperationsQuickRail} />

      <BookingMatchingRuleSnapshotSection matchingRuleSnapshot={matchingRuleSnapshot} />

      <BookingMvpAuthorityContractSection rows={mvpAuthorityContract} />

      <BookingRecentOperationsTimelineSection operatingTimeline={operatingTimeline} />

      <BookingCommandDecisionStripSection commandDecisionStrip={commandDecisionStrip} />

      <BookingPriorityBriefingSection operatorPriorityBriefing={operatorPriorityBriefing} />

      <BookingEvidenceSections
        bookingId={booking.id}
        decisionEvidenceGuardrails={decisionEvidenceGuardrails}
        evidencePacket={evidencePacket}
        chatEvidenceDecisionBoard={chatEvidenceDecisionBoard}
        manualDecisionReadiness={manualDecisionReadiness}
        decisionNotePresets={decisionNotePresets}
        bookingEvidenceBundleRows={bookingEvidenceBundleRows}
      />

      <BookingCloseoutSections
        bookingCloseoutChecklist={bookingCloseoutChecklist}
        connectedRecordLinks={connectedRecordLinks}
      />

      <BookingOperatorQueueSections
        bookingId={booking.id}
        operatorCommandQueue={operatorCommandQueue}
        operatorActionMatrix={operatorActionMatrix}
      />

      <BookingHandoffChecklistSection handoffChecklist={handoffChecklist} />

      <BookingFullRecordIndex
        bookingId={booking.id}
        cards={bookingRecordIndexCards}
        csvHref={bookingActivityCsvHref}
        eventCount={bookingActivityRecords.length}
      />

      <BookingMarketplaceWalletEvidenceSection marketplaceWalletEvidence={marketplaceWalletEvidence} />

      <BookingOperatingLedgerSection operatingLedger={operatingLedger} />

      <BookingCloseoutReadinessSection
        bookingStatus={booking.status}
        closeoutReadiness={closeoutReadiness}
      />

      <BookingOperatingSnapshotSection operatingSnapshot={operatingSnapshot} />

      <BookingOperatingTimelineSection operatingTimeline={operatingTimeline} />

      <BookingCommunicationMovementHandoffSection
        communicationMovementHandoff={communicationMovementHandoff}
      />

      <BookingChatLifecycleSection chatLifecycle={chatLifecycle} messageCount={messages.length} />

      <BookingOpsCommandCenter
        booking={booking}
        instruction={primaryBookingOpsInstruction(booking, {
          cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
        })}
        badges={bookingOpsBadges(booking, {
          attentionFlags: bookingDetailAttentionFlags(booking),
          cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
          locationFreshness: latestProviderLocationFreshness(booking),
        })}
        finalGateReason={finalGateReason}
        actionEvidenceGate={actionEvidenceGate}
        actionGateByAction={actionGateByAction}
        cashDebtNeedsSettlement={bookingCashDebtNeedsSettlement(booking)}
      />

      <BookingStageSnapshotSection stageSnapshot={stageSnapshot} />

      <BookingCustomerWaitPanelSection customerWaitPanel={customerWaitPanel} />

      <BookingAppliedPolicySection policySnapshot={policySnapshot} />

      <BookingAddressRadiusContractSection addressRadiusContract={addressRadiusContract} />

      <BookingDispatchCandidateDecisionMatrixSection marketplaceSupply={marketplaceSupply} />

      <BookingMarketplaceSupplySection marketplaceSupply={marketplaceSupply} />

      <BookingAlertTraceSection bookingId={booking.id} notificationTrace={notificationTrace} />

      <BookingOperationsAuditTraceSection bookingId={booking.id} operationsTrace={operationsTrace} />

      <BookingAttentionChecksSection attentionFlags={attentionFlags} attentionSummary={attentionSummary} />

      <BookingFinanceCommandCenterSection
        financeFlags={financeFlags}
        financeSummaryCards={financeSummaryCards}
      />

      <BookingPayoutBatchEligibilitySection payoutBatchEligibility={payoutBatchEligibility} />

      <BookingServicePricingSnapshotSection
        financeFlags={financeFlags}
        servicePricingSnapshotRows={servicePricingSnapshotRows}
      />

      <BookingActionStatusSections
        bookingId={booking.id}
        chatRepair={chatRepair}
        closeout={{
          canSubmit: canCloseoutCompletedBooking(booking),
          label: completedCloseoutLabel(booking),
          tone: completedCloseoutTone(booking),
        }}
        dispatchSteps={dispatchSteps}
        liveSignals={liveSignals}
        matchingExpiry={{ canSubmit: canExpireBooking(booking.status), status: booking.status }}
        noShow={{ canSubmit: canMarkNoShow(booking.status), status: booking.status }}
        notes={booking.notes}
        opsTaskCards={opsTaskCards}
      />

      <BookingRecordDetailSections
        cashFeeSettlementPath={cashFeeSettlementPath}
        chatMessages={messages}
        customerProfileId={booking.customerProfile?.id}
        customerRows={bookingRecordCustomerRows}
        finalPartnerId={finalPartnerSummary.selected ? finalPartnerSummary.id : null}
        financeRows={bookingRecordFinanceRows}
        hasLatestPartnerLocation={Boolean(latestLocation)}
        handoffRows={bookingRecordHandoffRows}
        locationTrailRows={locationTrailRows}
        participantLedger={participantLedger}
        paymentRows={bookingRecordPaymentRows}
        serviceRows={bookingRecordServiceRows}
        timelineStages={bookingDetailFlowStages(booking)}
      />

      <BookingActivityPanel records={bookingActivityRecords} summary={bookingActivitySummary} />
    </>
  );
}
