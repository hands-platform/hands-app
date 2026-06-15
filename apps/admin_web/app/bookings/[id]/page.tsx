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
import { BookingCloseoutSections, type BookingCloseoutSectionsProps } from './booking-closeout-sections';
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
  type BookingAlertTraceSectionProps,
  BookingAttentionChecksSection,
  BookingFinanceCommandCenterSection,
  type BookingFinanceCommandCenterSectionProps,
  BookingOperationsAuditTraceSection,
  type BookingOperationsAuditTraceSectionProps,
  BookingPayoutBatchEligibilitySection,
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
  BookingCloseoutReadinessSection,
  BookingCommunicationMovementHandoffSection,
  BookingHandoffChecklistSection,
  BookingMarketplaceWalletEvidenceSection,
  BookingOperatingLedgerSection,
  BookingOperatingSnapshotSection,
  BookingOperatingTimelineSection,
} from './booking-operating-sections';
import {
  BookingRecordDetailSections,
  type BookingRecordDetailSectionsProps,
} from './booking-record-detail-sections';
import { bookingRecordFinanceRows as buildBookingRecordFinanceRows } from './booking-record-finance-rows';
import { bookingRecordPaymentRows as buildBookingRecordPaymentRows } from './booking-record-info-rows';
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
} from './booking-communication-movement-handoff';
import {
  bookingAddressSnapshotLabel,
  money,
  coordinateLabel,
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
import { bookingDetailOperatorFirstRead } from './booking-detail-operator-first-read';
import { bookingFinanceTrace } from './booking-finance-trace';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingAddressRadiusContract } from './booking-address-radius-contract';
import { bookingChatReady } from './booking-chat-evidence';
import {
  bookingChatRepairActionState,
} from './booking-chat-repair-state';
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
import { bookingDetailOperatorPriorityBriefing } from './booking-detail-operator-priority-briefing';
import { bookingDetailOpsCommandCenter } from './booking-detail-ops-command-center';
import { bookingDetailToolbarProps } from './booking-detail-toolbar-props';
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
import { attentionLevel } from '../../../lib/admin-attention-flags';
import { bookingChatLifecycle } from '../../../lib/booking-chat-lifecycle';
import { bookingCommandDecisionStrip } from '../../../lib/booking-command-decision-strip';
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

type PageProps = {
  params: Promise<{ id: string }>;
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
  'BookingAddressSnapshot',
  'customer fallback partner choice',
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
  const { booking, operationalPolicies, providers, rawNotifications } = await loadBookingDetailPageData(id);

  if (!booking) {
    notFound();
  }

  const messages = [...(booking.chatRoom?.messages ?? [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const messageCount = messages.length;
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
  const mvpAuthorityContract = bookingMvpAuthorityContract({
    booking,
    operationalPolicies,
    marketplaceSupply,
    messageCount,
    financeTrace,
    walletDebt: cashFeeDebtNeedsSettlement,
    terminal: TERMINAL_BOOKING_STATUSES.has(booking.status),
  });
  const stageSnapshot = bookingStageSnapshot(booking, customerWaitPanel, marketplaceSupply);
  const notificationTrace = bookingNotificationTrace(booking, rawNotifications);
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
  const bookingActivityCsvHref = buildBookingActivityCsvHref(booking, bookingActivityRecords);
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
  const activityRecordCount = bookingActivityRecords.length;
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
  const operatorPriorityBriefing = bookingDetailOperatorPriorityBriefing({
    booking,
    operatorCommandQueue,
    closeoutReadiness,
    financeFlags,
    latestLocation,
    messageCount,
  });
  const commandDecisionStrip = bookingCommandDecisionStrip({
    bookingStatus: booking.status,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressLabel: addressLine,
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidateCount: customerChoiceCandidates,
    marketplaceEligibleCount: marketplaceSupply.eligibleCount,
    hasFinalPartner: finalPartnerSummary.selected,
    hasChatRoom: Boolean(booking.chatRoom),
    messageCount,
    paymentMethod: booking.payment?.method ?? 'NONE',
    paymentStatus: booking.payment?.status ?? 'NONE',
    cashDebtNeedsSettlement: cashFeeDebtNeedsSettlement,
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
  };
  const bookingOperationsQuickRail = bookingDetailOperationsQuickRail({
    booking,
    operatorPriorityStatus: operatorPriorityBriefing.status,
    matchingRuleStatus: matchingRuleSnapshot.status,
    evidenceLaneCount: bookingEvidenceBundleRows.length,
    connectedRecordCount: connectedRecordLinks.length,
    participantCounts,
    messageCount,
    paymentEvidence,
    financeTrace,
    addressLine,
    addressPin,
    operatorQueue: operatorCommandQueue,
    activityRecordCount,
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
    messageCount,
    paymentEvidence,
    financeTrace,
  });
  const bookingMetricCards = bookingDetailMetricCards({
    booking,
    closureSummary,
    messageCount,
    attentionSummary,
  });
  const locationTrailRows = bookingDetailLocationTrailRows(locationTrailSnapshots);
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
    records: bookingActivityRecords,
    summary: bookingActivitySummary,
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
    notificationTrace,
  };
  const operationsAuditTraceProps: BookingOperationsAuditTraceSectionProps = {
    bookingId: booking.id,
    operationsTrace,
  };

  return (
    <>
      <span hidden>{bookingDetailAuthoritySourceMarkers.join(' | ')}</span>

      <BookingDetailToolbar {...toolbarProps} />

      <BookingOperatorFirstReadSection rows={bookingOperatorFirstRead} />

      <BookingMetricGridSection metrics={bookingMetricCards} />

      <BookingOperationsQuickRailSection rows={bookingOperationsQuickRail} />

      <BookingMatchingRuleSnapshotSection matchingRuleSnapshot={matchingRuleSnapshot} />

      <BookingMvpAuthorityContractSection rows={mvpAuthorityContract} />

      <BookingRecentOperationsTimelineSection operatingTimeline={operatingTimeline} />

      <BookingCommandDecisionStripSection commandDecisionStrip={commandDecisionStrip} />

      <BookingPriorityBriefingSection operatorPriorityBriefing={operatorPriorityBriefing} />

      <BookingEvidenceSections {...evidenceSectionsProps} />

      <BookingCloseoutSections {...closeoutSectionsProps} />

      <BookingOperatorQueueSections {...operatorQueueSectionsProps} />

      <BookingHandoffChecklistSection handoffChecklist={handoffChecklist} />

      <BookingFullRecordIndex {...fullRecordIndexProps} />

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

      <BookingChatLifecycleSection chatLifecycle={chatLifecycle} messageCount={messageCount} />

      <BookingOpsCommandCenter {...opsCommandCenterProps} />

      <BookingStageSnapshotSection stageSnapshot={stageSnapshot} />

      <BookingCustomerWaitPanelSection customerWaitPanel={customerWaitPanel} />

      <BookingAppliedPolicySection policySnapshot={policySnapshot} />

      <BookingAddressRadiusContractSection addressRadiusContract={addressRadiusContract} />

      <BookingDispatchCandidateDecisionMatrixSection marketplaceSupply={marketplaceSupply} />

      <BookingMarketplaceSupplySection marketplaceSupply={marketplaceSupply} />

      <BookingAlertTraceSection {...alertTraceProps} />

      <BookingOperationsAuditTraceSection {...operationsAuditTraceProps} />

      <BookingAttentionChecksSection attentionFlags={attentionFlags} attentionSummary={attentionSummary} />

      <BookingFinanceCommandCenterSection {...financeCommandCenterProps} />

      <BookingPayoutBatchEligibilitySection payoutBatchEligibility={payoutBatchEligibility} />

      <BookingServicePricingSnapshotSection {...servicePricingSnapshotProps} />

      <BookingActionStatusSections {...actionStatusSectionsProps} />

      <BookingRecordDetailSections {...recordDetailSectionsProps} />

      <BookingActivityPanel {...activityPanelProps} />
    </>
  );
}

async function loadBookingDetailPageData(id: string): Promise<BookingDetailPageData> {
  const [booking, operationalPolicies, rawNotifications, providers] = await Promise.all([
    adminGet<AdminBookingDetail | null>(`/admin/bookings/${id}`, null),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
    adminGet<AdminNotification[]>('/admin/notifications', []),
    adminGet<AdminProvider[]>('/admin/partners?view=list', []),
  ]);

  return {
    booking,
    operationalPolicies,
    providers,
    rawNotifications,
  };
}
