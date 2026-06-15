import { notFound } from 'next/navigation';
import { bookingRequestOpenedAt } from '../../../lib/admin-booking-time';
import {
  BookingActivityPanel,
  BookingFullRecordIndex,
  type BookingRecordIndexCard,
} from './booking-activity-panel';
import {
  buildBookingActivityCsvHref,
  buildBookingActivityRecords,
  buildBookingActivitySummary,
  type BookingActivityRecord,
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
  addressLabel,
  approximateDistanceMeters,
  bookingAddressSnapshotLabel,
  bookingServiceOptionLabel,
  bookingServicePayoutRuleLabel,
  coordinateLabel,
  distanceLabel,
  formatDate,
  isTerminalPayment,
  minutesSince,
  money,
  compactActivityText,
  providerName,
  readNullableAmount,
  safeTime,
  shortId,
} from './booking-formatters';
import { BookingEvidenceSections } from './booking-evidence-sections';
import {
  bookingCashDebtNeedsSettlement,
  bookingCashFeeSettlementPath,
} from './booking-cash-wallet-gate';
import { bookingOperatingActivityTimelineItems } from './booking-operating-activity-timeline-items';
import { bookingFinanceTrace } from './booking-finance-trace';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingAddressRadiusContract } from './booking-address-radius-contract';
import { bookingChatReady } from './booking-chat-evidence';
import {
  bookingChatRepairActionState,
  bookingChatRepairNeedsOps,
} from './booking-chat-repair-state';
import { bookingHandoffChecklist } from './booking-handoff-checklist';
import { bookingCloseoutReadiness } from './booking-closeout-readiness';
import { bookingOperatingNextAction } from './booking-operating-next-action';
import { bookingOperatingSnapshot } from './booking-operating-snapshot';
import { bookingOperatingFinanceTimelineItems } from './booking-operating-finance-timeline-items';
import {
  createBookingOperatingTimelineCollector,
} from './booking-operating-timeline-items';
import { bookingCustomerWaitPanel } from './booking-customer-wait-panel';
import { bookingMvpAuthorityContract } from './booking-mvp-authority-contract';
import {
  bookingNotificationTrace,
  bookingNotificationTraceRow,
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
  bookingDispatchPin,
} from './booking-marketplace-supply';
import { bookingMarketplaceWalletEvidence } from './booking-marketplace-wallet-evidence';
import { bookingDetailMatchingRuleSnapshot } from './booking-matching-rule-snapshot';
import { bookingPaymentEvidence } from './booking-payment-evidence';
import { bookingServicePricingSnapshotRows } from './booking-service-pricing-snapshot-rows';
import { bookingParticipantLedger } from './booking-participant-ledger';
import { bookingParticipantCounts } from './booking-participant-counts';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
  bookingPreferredProviderId,
} from './booking-participant-rules';
import { bookingStageSnapshot } from './booking-stage-snapshot';
import {
  bookingStatusHint,
  latestProviderLocation,
  latestProviderLocationFreshness,
  preferredParticipantState,
} from './booking-status-location';
import {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
  AdminNotification,
  AdminOperationalPolicySetting,
  AdminProvider,
  adminGet,
} from '../../../lib/admin-api';
import {
  attentionLevel,
  type AttentionFlag,
} from '../../../lib/admin-attention-flags';
import { bookingAttentionFlags as buildBookingAttentionFlags } from '../../../lib/booking-attention-flags';
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
import { bookingEvidenceBundleRows as buildBookingEvidenceBundleRowsFromFacts } from '../../../lib/booking-evidence-bundle-rows';
import { bookingEvidencePacket as buildBookingEvidencePacket } from '../../../lib/booking-evidence-packet';
import { bookingFinalGateReason as buildBookingFinalGateReasonFromFacts } from '../../../lib/booking-final-gate-reason';
import {
  bookingLocationTrail,
  isPreferredAwaitingDecision as isPreferredAwaitingDecisionFromStatus,
} from '../../../lib/booking-status-location-helpers';
import {
  bookingDispatchChecklist,
  type DispatchStep,
} from '../../../lib/booking-dispatch-checklist';
import { bookingFinanceFlags as buildBookingFinanceFlags } from '../../../lib/booking-finance-flags';
import { bookingFlowStages as buildBookingFlowStages } from '../../../lib/booking-flow-stages';
import { bookingFinanceSummaryCards as buildBookingFinanceSummaryCards } from '../../../lib/booking-finance-summary-cards';
import { bookingManualDecisionReadiness as buildBookingManualDecisionReadiness } from '../../../lib/booking-manual-decision-readiness';
import { bookingPayoutBatchEligibility as buildBookingPayoutBatchEligibilityFromFacts } from '../../../lib/booking-payout-batch-eligibility';
import {
  canCloseoutCompletedBooking,
  completedCloseoutLabel,
  completedCloseoutTone,
} from '../../../lib/booking-closeout-policy';
import { bookingOpsBadges } from '../../../lib/booking-ops-badges';
import { bookingOpsTaskCards as buildBookingOpsTaskCards } from '../../../lib/booking-ops-task-cards';
import {
  bookingOperatorNoteLines,
  canExpireBooking,
  canMarkNoShow,
} from '../../../lib/booking-operator-action-rules';
import { bookingOperatorActionMatrix as buildBookingOperatorActionMatrix } from '../../../lib/booking-operator-action-matrix';
import { bookingOperatorCommandQueue as buildBookingOperatorCommandQueue } from '../../../lib/booking-operator-command-queue';
import { bookingOperatorPriorityBriefing as buildBookingOperatorPriorityBriefing } from '../../../lib/booking-operator-priority-briefing';
import {
  bookingPartnerDecisionLabel,
  bookingPartnerHint,
} from '../../../lib/booking-partner-decision-copy';
import { bookingPaymentHint } from '../../../lib/booking-payment-hint';
import {
  bookingProviderLocationMetricHelper,
  bookingProviderLocationMetricValue,
} from '../../../lib/booking-provider-location-copy';
import { primaryBookingOpsInstruction } from '../../../lib/booking-primary-ops-instruction';
import {
  type BookingRefundLedgerRow,
} from '../../../lib/booking-refund-ledger';

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
  const addressLine = bookingAddressSnapshotLabel(booking);
  const addressPin = booking.addressSnapshot
    ? coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)
    : coordinateLabel(booking.lat, booking.lng);
  const attentionFlags = bookingAttentionFlags(booking);
  const attentionSummary = attentionLevel(attentionFlags);
  const liveSignals = liveServiceSignals(booking);
  const dispatchSteps = dispatchChecklist(booking);
  const opsTaskCards = bookingOpsTaskCards(booking);
  const financeTrace = bookingFinanceTrace(booking);
  const financeSummaryCards = bookingFinanceSummaryCards(financeTrace);
  const financeFlags = bookingFinanceFlags(booking, financeTrace);
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
    locationSnapshots: locationTrail(booking),
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
  const bookingRecordIndexCards: BookingRecordIndexCard[] = [
    {
      href: '#customer',
      label: 'Customer',
      value: booking.customerProfile?.user?.phone ?? 'No phone',
      helper: booking.customerProfile?.user?.fullName ?? 'Customer profile',
    },
    {
      href: '#participants',
      label: 'Partners',
      value: `${participantCounts.total}`,
      helper: `${participantCounts.marketplace} marketplace / ${participantCounts.firstPick} first-pick row(s).`,
    },
    {
      href: '#chat',
      label: 'Chat archive',
      value: `${messages.length}`,
      helper: booking.chatRoom ? `Room ${shortId(booking.chatRoom.id)}` : 'No chat room yet',
    },
    {
      href: '#payment',
      label: 'Payment and wallet',
      value: paymentEvidence.paymentStatus,
      helper: paymentEvidence.paymentAmountLabel,
    },
    {
      href: '#finance',
      label: 'Finance trace',
      value: financeTrace.providerPayout,
      helper: `${financeTrace.platformFee} HANDS fee`,
    },
    {
      href: booking.earning?.id ? `/earnings#earning-${booking.earning.id}` : '/earnings',
      label: 'Earnings ledger',
      value: booking.earning?.status ?? 'No earning row yet',
      helper: booking.earning?.id ? shortId(booking.earning.id) : 'Open finance ledger',
    },
    {
      href: '/cash-settlements',
      label: 'Cash settlement desk',
      value: bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'Clear or non-cash',
      helper: booking.payment?.method === 'CASH' ? financeTrace.walletLedger : 'No cash wallet debt',
    },
    {
      href: '/tax-policy',
      label: 'Tax policy',
      value: financeTrace.withholding,
      helper: 'Versioned rules, no hardcoded rates.',
    },
    {
      href: '#service-pricing-snapshot',
      label: 'Service and pricing',
      value: financeTrace.payoutRuleStatus,
      helper: financeTrace.serviceOption,
    },
    {
      href: '#location',
      label: 'Location trail',
      value: providerLocationMetricValue(booking),
      helper: providerLocationMetricHelper(booking),
    },
    {
      href: '#communication-movement-handoff',
      label: 'Communication and movement',
      value: communicationMovementHandoff.status,
      helper: `${messages.length} message(s), ${locationTrail(booking).length} location row(s).`,
    },
    {
      href: '#alerts',
      label: 'Alerts',
      value: `${notificationTrace.rows.length}`,
      helper: `${notificationTrace.backupBatches.length} marketplace alert batch(es).`,
    },
    {
      href: '#operator-notes',
      label: 'Operator notes',
      value: `${operatorNoteLines.length}`,
      helper: 'Internal handling notes retained on this booking.',
    },
    {
      href: '#booking-activity',
      label: 'Activity timeline',
      value: `${bookingActivityRecords.length}`,
      helper: 'Date-ordered operational history.',
    },
  ];
  const operatingLedger = [
    {
      area: 'Customer',
      status: booking.customerProfile?.id ? 'Linked' : 'Missing profile',
      evidence: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
        booking.customerProfile?.user?.phone ?? 'No phone'
      }`,
      href: '#customer',
    },
    {
      area: 'Partner',
      status: finalPartnerSummary.selected ? 'Linked' : 'Not selected',
      evidence: finalPartnerSummary.selected
        ? finalPartnerSummary.label
        : `${participantCounts.marketplace} marketplace / ${participantCounts.total} total participant row(s)`,
      href: '#handoff',
    },
    {
      area: 'Chat',
      status: booking.chatRoom ? 'Archived' : 'Missing',
      evidence: booking.chatRoom
        ? `Room ${shortId(booking.chatRoom.id)} / ${messages.length} message(s)`
        : 'Matched bookings should create a retained chat room.',
      href: '#chat',
    },
    {
      area: 'Service/Pricing',
      status: financeTrace.payoutRuleStatus,
      evidence: `${financeTrace.serviceOption} / customer ${financeTrace.customerPrice} / Partner ${financeTrace.providerPayout}`,
      href: '#service',
    },
    {
      area: 'Payment',
      status: paymentEvidence.paymentStatus,
      evidence: paymentEvidence.readablePaymentMethodAmountLabel,
      href: '#payment',
    },
    {
      area: 'Refund',
      status: paymentEvidence.refundRecordStatus,
      evidence: paymentEvidence.refundEvidence,
      href: '#payment',
    },
    {
      area: 'Finance',
      status: financeFlags.length ? `${financeFlags.length} check(s)` : 'Trace ready',
      evidence: `${financeTrace.providerPayout} Partner payout / ${financeTrace.platformFee} platform fee`,
      href: '#finance',
    },
    {
      area: 'Tax',
      status: (booking.taxLogs?.length ?? booking.earning?.taxLogs?.length ?? 0) ? 'Logged' : 'Not logged',
      evidence: financeTrace.withholding,
      href: '#finance',
    },
    {
      area: 'Wallet',
      status: bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'No cash debt block',
      evidence: financeTrace.walletLedger,
      href: '#finance',
    },
    {
      area: 'Cash settlement',
      status: bookingCashDebtNeedsSettlement(booking)
        ? 'Partner blocked until settled'
        : booking.payment?.method === 'CASH'
          ? 'Cash ledger clear'
          : 'Not a cash booking',
      evidence:
        booking.payment?.method === 'CASH'
          ? `${financeTrace.platformFee} HANDS fee / ${financeTrace.withholding} withholding`
          : `${booking.payment?.method ?? 'No method'} payment path`,
      href: '#payment',
    },
    {
      area: 'Location',
      status: latestLocation ? 'Partner pin saved' : 'No Partner pin',
      evidence: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}`
        : addressPin,
      href: '#location',
    },
    {
      area: 'Alerts',
      status: `${notificationTrace.rows.length} notification(s)`,
      evidence: `${notificationTrace.rows.filter((row) => row.isPartnerAlert).length} Partner alert(s) / ${
        notificationTrace.backupBatches.length
      } marketplace alert batch(es)`,
      href: '#alerts',
    },
    {
      area: 'Audit',
      status: `${bookingActivityRecords.length} event(s)`,
      evidence: `${booking.auditLogs?.length ?? 0} audit row(s) / ${booking.opsTasks?.length ?? 0} task row(s)`,
      href: '#booking-activity',
    },
    {
      area: 'Operator notes',
      status: operatorNoteLines.length ? `${operatorNoteLines.length} note line(s)` : 'No notes',
      evidence:
        operatorNoteLines[operatorNoteLines.length - 1] ?? 'No internal handling note has been added.',
      href: '#operator-notes',
    },
    {
      area: 'Closure',
      status: closureSummary.status,
      evidence: closureSummary.detail,
      href: '#booking-activity',
    },
  ];
  const operatorCommandQueue = bookingOperatorCommandQueue({
    booking,
    attentionFlags,
    messages,
    latestLocation,
  });
  const operatorActionMatrix = bookingOperatorActionMatrix(booking);
  const operatorPriorityBriefing = bookingOperatorPriorityBriefing({
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
  const evidencePacket = bookingEvidencePacket({
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
  const connectedRecordLinks = [
    {
      label: 'Customer record',
      value: booking.customerProfile?.id ? 'Linked' : 'Profile missing',
      detail: booking.customerProfile?.user?.phone ?? 'Open the in-page customer evidence block.',
      href: booking.customerProfile?.id ? `/customers/${booking.customerProfile.id}` : '#customer',
      tone: booking.customerProfile?.id ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Preferred Partner',
      value: booking.preferredProvider?.id ? providerName(booking.preferredProvider) : 'Not selected',
      detail: 'First-pick Partner record and booking gate state.',
      href: booking.preferredProvider?.id ? `/partners/${booking.preferredProvider.id}` : '#handoff',
      tone: booking.preferredProvider?.id ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Final Partner',
      value: finalPartnerSummary.selected ? finalPartnerSummary.label : 'Customer choice pending',
      detail: 'Final selected Partner, location, payout, and service records.',
      href: finalPartnerSummary.href,
      tone: finalPartnerSummary.selected ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Chat archive',
      value: booking.chatRoom ? `${messages.length} message(s)` : 'No room',
      detail: 'Admin-retained transcript for completion, cancellation, and no-show context.',
      href: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : '#chat',
      tone: booking.chatRoom ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Notification trace',
      value: `${notificationTrace.rows.length} alert(s)`,
      detail: 'Partner alerts, customer updates, delivery status, and retry context.',
      href: `/notifications?booking=${encodeURIComponent(booking.id)}`,
      tone: notificationTrace.rows.length ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Payment queue',
      value: paymentEvidence.paymentQueueValue,
      detail: paymentEvidence.paymentMethodAmountLabel,
      href: paymentEvidence.paymentQueueHref,
      tone: paymentEvidence.paymentTone,
    },
    {
      label: 'Refund queue',
      value: paymentEvidence.refundCountLabel,
      detail: paymentEvidence.refundEvidence,
      href: paymentEvidence.refundHref,
      tone: paymentEvidence.refundTone,
    },
    {
      label: 'Cash settlement',
      value: bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'Clear',
      detail: financeTrace.walletLedger,
      href: bookingCashDebtNeedsSettlement(booking) ? '/cash-settlements' : '#finance',
      tone: bookingCashDebtNeedsSettlement(booking) ? 'pill-danger' : 'pill-success',
    },
  ];
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking).length;
  const failedAlertCount = notificationTrace.rows.filter((row) =>
    row.deliveryStatuses.includes('FAILED'),
  ).length;
  const latestActivity = bookingActivityRecords[0];
  const dispatchPin = bookingDispatchPin(booking);
  const bookingEvidenceBundleRows = buildBookingEvidenceBundleRowsFromFacts({
    bookingId: booking.id,
    customerProfileId: booking.customerProfile?.id ?? null,
    customerRecordLabel: booking.customerProfile?.id
      ? shortId(booking.customerProfile.id)
      : 'Profile missing',
    customerEvidenceLabel: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
      booking.customerProfile?.user?.phone ?? 'No phone'
    }`,
    addressReady: Boolean(booking.addressSnapshot),
    addressLabel: bookingAddressSnapshotLabel(booking),
    addressSourceLabel: dispatchPin.source,
    finalPartnerId: finalPartnerSummary.selected ? finalPartnerSummary.id : null,
    finalPartnerRecordLabel: finalPartnerSummary.id ? shortId(finalPartnerSummary.id) : 'Selection pending',
    finalPartnerEvidenceLabel: finalPartnerSummary.selected
      ? `${finalPartnerSummary.label} / ${providerLocationMetricValue(booking)}`
      : null,
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidates,
    chatReady,
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    chatMessageCount: messages.length,
    latestChatMessageAtLabel: messages[messages.length - 1]?.createdAt
      ? formatDate(messages[messages.length - 1].createdAt)
      : null,
    chatRepairNeeded: bookingChatRepairNeedsOps(booking),
    hasMoneyTrace: Boolean(booking.payment || booking.earning || refundLedgerRows.length),
    paymentShortId: booking.payment?.id ? shortId(booking.payment.id) : null,
    moneyStatus: booking.payment?.status ?? booking.earning?.status ?? 'Trace loaded',
    paymentMethod: booking.payment?.method ?? 'NONE',
    customerPriceLabel: financeTrace.customerPrice,
    partnerPayoutLabel: financeTrace.providerPayout,
    walletLedgerLabel: financeTrace.walletLedger,
    hasLocationTrace: Boolean(latestLocation || locationTrail(booking).length),
    latestLocationShortId: latestLocation ? shortId(latestLocation.id) : null,
    locationStatusLabel: providerLocationMetricValue(booking),
    latestLocationEvidenceLabel: latestLocation
      ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}`
      : null,
    serviceAddressPinLabel: dispatchPin.label,
    notificationCount: notificationTrace.rows.length,
    failedAlertCount,
    partnerAlertCount: notificationTrace.rows.filter((row) => row.isPartnerAlert).length,
    marketplaceBatchCount: notificationTrace.backupBatches.length,
    activityRecordCount: bookingActivityRecords.length,
    latestActivityEvidenceLabel: latestActivity
      ? `${latestActivity.title} / ${formatDate(latestActivity.at)}`
      : null,
    latestOperatorNote: operatorNoteLines[operatorNoteLines.length - 1] ?? null,
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
    preferredAwaitingDecision: isPreferredAwaitingDecision(booking),
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
  const bookingOperationsQuickRail = [
    {
      href: '#booking-priority-briefing',
      label: 'Priority',
      value: operatorPriorityBriefing.status,
      detail: 'First-screen booking state for handoff, chat, location, payment, and closeout.',
    },
    {
      href: '#matching-rule-snapshot',
      label: 'Matching rules',
      value: matchingRuleSnapshot.status,
      detail: 'First-pick, booking-address marketplace radius, customer choice, and wallet gate.',
    },
    {
      href: '#booking-full-evidence-bundle',
      label: 'Evidence bundle',
      value: `${bookingEvidenceBundleRows.length} lanes`,
      detail: 'Customer, Partner, address, chat, payment, finance, location, alerts, and notes.',
    },
    {
      href: '#connected-operations-records',
      label: 'Linked records',
      value: `${connectedRecordLinks.length} links`,
      detail: 'Open customer, Partner, chat archive, notifications, payment, refund, and settlement.',
    },
    {
      href: '#participants',
      label: 'Marketplace',
      value: `${participantCounts.marketplace} marketplace row(s)`,
      detail: `${participantCounts.total} total participant row(s). First-pick and marketplace rows are separated for operator review.`,
    },
    {
      href: '#chat',
      label: 'Chat',
      value: booking.chatRoom ? `${messages.length} messages` : 'Missing room',
      detail: 'Matched-booking transcript retained for admin even after mobile hides completed chats.',
    },
    {
      href: '#payment',
      label: 'Payment',
      value: paymentEvidence.paymentStatus,
      detail: paymentEvidence.readablePaymentMethodAmountLabel,
    },
    {
      href: '#finance',
      label: 'Fees and tax',
      value: financeTrace.platformFee,
      detail: `${financeTrace.withholding} withholding / ${financeTrace.netHandsFee} net HANDS fee.`,
    },
    {
      href: '#address-radius-contract',
      label: 'Address',
      value: addressPin,
      detail: addressLine,
    },
    {
      href: '#location',
      label: 'Location',
      value: providerLocationMetricValue(booking),
      detail: providerLocationMetricHelper(booking),
    },
    {
      href: '#operator-command-queue',
      label: 'Operator queue',
      value: operatorCommandQueue.status,
      detail: `${operatorCommandQueue.commands.length} same-shift command(s).`,
    },
    {
      href: '#booking-activity',
      label: 'Activity',
      value: `${bookingActivityRecords.length}`,
      detail: 'Date-ordered booking, chat, payment, alert, location, and audit events.',
    },
  ];
  const bookingOperatorFirstRead = [
    {
      href: '#address-radius-contract',
      label: 'Service address',
      value: addressPin,
      detail: addressLine,
    },
    {
      href: '#matching-rule-snapshot',
      label: 'Matching state',
      value: matchingRuleSnapshot.status,
      detail: `${customerWaitPanel.signalStatus} / ${marketplaceSupply.eligibleCount} marketplace Partner(s) in policy.`,
    },
    {
      href: finalPartnerSummary.href,
      label: 'Customer choice',
      value: finalPartnerSummary.selected ? finalPartnerSummary.label : 'Pending',
      detail: finalPartnerSummary.selected
        ? 'Final Partner exists; confirm chat handoff before service coordination.'
        : 'Customer must choose the final Partner before matched chat opens.',
    },
    {
      href: '#participants',
      label: 'Marketplace participants',
      value: `${participantCounts.marketplace} marketplace row(s)`,
      detail: `${participantCounts.total} total participant row(s). Only actual Partner participation rows are retained for this booking.`,
    },
    {
      href: '#chat',
      label: 'Chat evidence',
      value: booking.chatRoom ? `${messages.length} messages` : 'Missing room',
      detail: booking.chatRoom
        ? `Room ${shortId(booking.chatRoom.id)} is retained for admin review.`
        : 'Matched bookings should create a retained chat room.',
    },
    {
      href: bookingCashDebtNeedsSettlement(booking) ? '/cash-settlements' : '#payment',
      label: 'Money path',
      value: paymentEvidence.paymentQueueValue,
      detail:
        booking.payment?.method === 'CASH'
          ? `${financeTrace.walletLedger} / ${financeTrace.platformFee} HANDS fee.`
          : `${paymentEvidence.paymentMethodAmountLabel}.`,
    },
  ];
  const bookingMetricCards = [
    { label: 'Status', value: booking.status, helper: bookingStatusHint(booking.status) },
    { label: 'Closure', value: closureSummary.status, helper: closureSummary.detail },
    {
      label: 'Payment',
      value: booking.payment?.status ?? 'NONE',
      helper: bookingPaymentHint(booking, {
        cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
      }),
    },
    {
      label: 'Partners',
      value: `${booking.participants?.length ?? 0} participant row(s)`,
      helper: bookingPartnerHint(booking),
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? 'Ready' : 'Not ready',
      helper: `${messages.length} message(s)`,
    },
    {
      label: 'Location',
      value: providerLocationMetricValue(booking),
      helper: providerLocationMetricHelper(booking),
    },
    {
      label: 'Attention checks',
      value: attentionSummary.label,
      helper: attentionSummary.helper,
    },
  ];
  const locationTrailRows = locationTrail(booking).map((snapshot) => ({
    id: snapshot.id,
    coordinate: coordinateLabel(snapshot.lat, snapshot.lng),
    recordedAt: formatDate(snapshot.recordedAt),
  }));
  const bookingRecordCustomerRows = [
    { label: 'Name', value: booking.customerProfile?.user?.fullName ?? 'Customer' },
    { label: 'Phone', value: booking.customerProfile?.user?.phone ?? 'No phone' },
    { label: 'Address', value: addressLine },
    { label: 'Pin', value: addressPin },
    { label: 'Request opened', value: formatDate(bookingRequestOpenedAt(booking)) },
    { label: 'Expires', value: formatDate(booking.expiresAt) },
  ];
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
  const bookingRecordHandoffRows = [
    { label: 'Preferred', value: providerName(booking.preferredProvider) },
    { label: 'Final', value: finalPartnerSummary.selected ? finalPartnerSummary.label : 'Not selected' },
    { label: 'Final phone', value: booking.selectedProvider?.user?.phone ?? 'No phone' },
    {
      label: 'Latest Partner pin',
      value: latestLocation ? coordinateLabel(latestLocation.lat, latestLocation.lng) : 'No live pin yet',
    },
    {
      label: 'Latest pin time',
      value: latestLocation ? formatDate(latestLocation.recordedAt) : 'No location shared',
    },
    { label: 'Location freshness', value: providerLocationMetricHelper(booking) },
  ];
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
          attentionFlags: bookingAttentionFlags(booking),
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
        timelineStages={flowStages(booking)}
      />

      <BookingActivityPanel records={bookingActivityRecords} summary={bookingActivitySummary} />
    </>
  );
}

function bookingOperatorCommandQueue({
  booking,
  attentionFlags,
  messages,
  latestLocation,
}: {
  booking: AdminBookingDetail;
  attentionFlags: AttentionFlag[];
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot;
}) {
  const finalPartner = bookingFinalPartnerSummary(booking);
  const partnerLabel = finalPartner.selected ? finalPartner.label : 'No final Partner';
  const pendingTasks = bookingOpsTaskCards(booking).filter((task) => task.status !== 'DONE');

  return buildBookingOperatorCommandQueue({
    bookingStatus: booking.status,
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidateCount: bookingCustomerSelectableParticipantsForFinalChoice(booking).length,
    partnerLabel,
    hasFinalPartner: finalPartner.selected,
    hasChatRoom: Boolean(booking.chatRoom),
    messageCount: messages.length,
    hasLatestLocation: Boolean(latestLocation),
    latestLocationFreshness: latestProviderLocationFreshness(booking),
    providerLocationHelper: providerLocationMetricHelper(booking),
    paymentStatus: booking.payment?.status ?? 'NONE',
    cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    closeoutAvailable: canCloseoutCompletedBooking(booking),
    canExpire: canExpireBooking(booking.status),
    canMarkNoShow: canMarkNoShow(booking.status),
    attentionFlagCount: attentionFlags.length,
    pendingTask: pendingTasks[0] ?? null,
  });
}

function bookingOperatorActionMatrix(booking: AdminBookingDetail) {
  const paymentStatus = booking.payment?.status ?? 'NONE';
  const paymentIsTerminal = isTerminalPayment(paymentStatus);
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const paymentEvidence = bookingPaymentEvidence(booking);
  return buildBookingOperatorActionMatrix({
    bookingStatus: booking.status,
    paymentStatus,
    hasPayment: Boolean(booking.payment?.id),
    paymentIsTerminal,
    paymentProviderRef: booking.payment?.providerRef ?? null,
    paymentAmountLabel: money(booking.payment?.amount, booking.payment?.currency),
    paymentMethod: booking.payment?.method ?? null,
    cashDebtNeedsSettlement: cashDebt,
    cashDebtAmountLabel: money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency),
    closeoutAvailable: canCloseoutCompletedBooking(booking),
    closeoutLabel: completedCloseoutLabel(booking),
    expireAvailable: canExpireBooking(booking.status),
    expiresAtLabel: formatDate(booking.expiresAt),
    noShowAvailable: canMarkNoShow(booking.status),
    refundRowCount: paymentEvidence.refundCount,
    noteLineCount: bookingOperatorNoteLines(booking.notes).length,
  });
}

function bookingOperatorPriorityBriefing({
  booking,
  operatorCommandQueue,
  closeoutReadiness,
  financeFlags,
  latestLocation,
  messageCount,
}: {
  booking: AdminBookingDetail;
  operatorCommandQueue: ReturnType<typeof bookingOperatorCommandQueue>;
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
  financeFlags: AttentionFlag[];
  latestLocation?: AdminLocationSnapshot;
  messageCount: number;
}) {
  const primaryCommand = operatorCommandQueue.commands[0];
  const nextAction = bookingOperatingNextAction(booking);
  const finalPartner = bookingFinalPartnerSummary(booking);
  const participantCount = booking.participants?.length ?? 0;
  const customerName = booking.customerProfile?.user?.fullName ?? 'Customer';
  const customerPhone = booking.customerProfile?.user?.phone ?? 'No phone';
  const partnerLabel = finalPartner.selected ? finalPartner.label : 'Not selected';
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status}`
    : 'No payment';
  const locationLabel = latestLocation
    ? providerLocationMetricValue(booking)
    : ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)
      ? 'Missing'
      : 'Not required yet';

  return buildBookingOperatorPriorityBriefing({
    primaryCommand,
    nextAction,
    customerName,
    customerPhone,
    addressSnapshotLabel: bookingAddressSnapshotLabel(booking),
    partnerLabel,
    hasFinalPartner: finalPartner.selected,
    participantCount,
    partnerHint: bookingPartnerHint(booking),
    hasChatRoom: Boolean(booking.chatRoom),
    messageCount,
    locationLabel,
    locationHelper: latestLocation
      ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(booking)}`
      : providerLocationMetricHelper(booking),
    paymentLabel,
    paymentHint: bookingPaymentHint(booking, {
      cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    }),
    closeoutStatus: closeoutReadiness.status,
    closeoutHelper: closeoutReadiness.helper,
    closeoutOpenItemCount: closeoutReadiness.openItems.length,
    financeFlagTitles: financeFlags.map((flag) => flag.title),
  });
}

function bookingEvidencePacket({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  financeTrace,
  refundLedgerRows,
  operatorNoteLines,
  bookingActivityRecords,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  bookingActivityRecords: BookingActivityRecord[];
}) {
  const trail = locationTrail(booking);
  const paymentEvidence = bookingPaymentEvidence(booking);
  return buildBookingEvidencePacket({
    chatReady: bookingChatReady(booking),
    messageCount: messages.length,
    latestMessageAtLabel: messages.length > 0 ? formatDate(messages[messages.length - 1]?.createdAt) : null,
    locationTrailCount: trail.length,
    latestLocationAtLabel: latestLocation ? formatDate(latestLocation.recordedAt) : null,
    latestLocationCoordinateLabel: latestLocation ? coordinateLabel(latestLocation.lat, latestLocation.lng) : null,
    paymentStatus: booking.payment?.status ?? 'NONE',
    paymentMethod: booking.payment?.method ?? 'No method',
    paymentAmountLabel: money(booking.payment?.amount, booking.payment?.currency),
    refundRows: refundLedgerRows.map((row) => ({
      status: row.status,
      amountLabel: money(row.amount, row.payment?.currency ?? undefined),
    })),
    alertCount: notificationTrace.rows.length,
    failedAlertCount: notificationTrace.rows.filter((row) => row.deliveryStatuses.includes('FAILED')).length,
    marketplaceBatchCount: notificationTrace.backupBatches.length,
    operatorNoteLines,
    auditLogCount: booking.auditLogs?.length ?? 0,
    opsTaskCount: booking.opsTasks?.length ?? 0,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressSnapshotLabel: bookingAddressSnapshotLabel(booking),
    addressPinLabel: booking.addressSnapshot
      ? coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)
      : null,
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    customerPriceLabel: financeTrace.customerPrice,
    walletLedgerLabel: financeTrace.walletLedger,
    refundEvidence: paymentEvidence.refundEvidence,
    activityRecordCount: bookingActivityRecords.length,
    latestActivityTitle: bookingActivityRecords[0]?.title ?? null,
    latestActivityAtLabel: bookingActivityRecords[0] ? formatDate(bookingActivityRecords[0].at) : null,
  });
}

function bookingOperatingTimeline({
  booking,
  addressLine,
  addressPin,
  latestLocation,
  messages,
  notifications,
}: {
  booking: AdminBookingDetail;
  addressLine: string;
  addressPin: string;
  latestLocation?: AdminLocationSnapshot;
  messages: AdminChatMessage[];
  notifications: AdminNotification[];
}) {
  const timelineItems = createBookingOperatingTimelineCollector();
  const addItem = timelineItems.addItem;

  addItem({
    id: `created-${booking.id}`,
    type: 'BOOK',
    title: 'Booking created',
    detail: `${booking.customerProfile?.user?.phone ?? 'Customer'} requested ${bookingServiceOptionLabel(booking)}.`,
    at: booking.createdAt,
    status: 'Recorded',
  });

  addItem({
    id: `address-${booking.addressSnapshot?.id ?? booking.id}`,
    type: 'ADDR',
    title: booking.addressSnapshot ? 'Address snapshot locked' : 'Address snapshot missing',
    detail: booking.addressSnapshot
      ? `${compactActivityText(addressLine, 84)} / pin ${addressPin}`
      : 'This booking is still using older address data. Confirm before dispatch.',
    at: booking.addressSnapshot?.createdAt,
    status: booking.addressSnapshot ? 'Locked' : 'Pending',
  });

  if (booking.openedAt || booking.status !== 'CREATED') {
    addItem({
      id: `matching-opened-${booking.id}`,
      type: 'MATCH',
      title: 'Matching window opened',
      detail: booking.preferredProvider
        ? `First-pick Partner: ${providerName(booking.preferredProvider)}.`
        : 'No first-pick Partner is attached to this booking.',
      at: booking.openedAt ?? booking.createdAt,
      status: 'Open',
    });
  }

  if (booking.expiresAt) {
    addItem({
      id: `expires-${booking.id}`,
      type: 'TTL',
      title: 'Auto-close timer set',
      detail: 'If no final Partner is selected before this time, operations should close or follow up.',
      at: booking.expiresAt,
      status: 'Timer',
    });
  }

  if (booking.closedAt) {
    addItem({
      id: `closed-${booking.id}`,
      type: 'CLOSE',
      title: 'Booking closure recorded',
      detail: bookingClosureSummary(booking).detail,
      at: booking.closedAt,
      status: booking.closedReason ?? booking.closedByRole ?? 'Closed',
    });
  }

  for (const participant of booking.participants ?? []) {
    const partnerName = providerName(participant.providerProfile);
    addItem({
      id: `participant-joined-${participant.id}`,
      type: 'JOIN',
      title: `${partnerName} entered marketplace shortlist`,
      detail: `${participant.status} / ${distanceLabel(participant.distanceMeters)} / ${
        participant.providerStatusAtJoin ?? 'status unknown'
      }`,
      at: participant.joinedAt,
      status: 'Participating',
    });
    if (participant.respondedAt) {
      addItem({
        id: `participant-responded-${participant.id}`,
        type: 'REPLY',
        title: `${partnerName} responded`,
        detail: `Partner response recorded as ${participant.status}.`,
        at: participant.respondedAt,
        status: participant.status,
      });
    }
  }

  if (booking.selectedProvider) {
    addItem({
      id: `selected-${booking.selectedProvider.id ?? booking.id}`,
      type: 'SELECT',
      title: 'Customer final Partner selected',
      detail: `${providerName(booking.selectedProvider)} is the final customer-selected Partner.`,
      at: booking.updatedAt,
      status: 'Selected',
    });
  } else if (booking.status === 'OPEN_MATCHING') {
    addItem({
      id: `selection-pending-${booking.id}`,
      type: 'SELECT',
      title: 'Customer final choice pending',
      detail: 'Customer still needs to select one final Partner before chat handoff.',
      status: 'Pending',
    });
  }

  if (booking.chatRoom) {
    addItem({
      id: `chat-ready-${booking.chatRoom.id}`,
      type: 'CHAT',
      title: 'Chat room ready',
      detail: `${messages.length} message(s) are retained for admin support.`,
      at: messages[0]?.createdAt ?? booking.updatedAt,
      status: 'Ready',
    });
  } else if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    addItem({
      id: `chat-missing-${booking.id}`,
      type: 'CHAT',
      title: 'Chat handoff missing',
      detail: 'Matched or active booking has no chat room linked yet.',
      status: 'Repair',
    });
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage) {
    addItem({
      id: `chat-last-${lastMessage.id}`,
      type: 'MSG',
      title: 'Latest chat message',
      detail: `${lastMessage.sender?.fullName ?? lastMessage.sender?.phone ?? 'Sender'}: ${compactActivityText(
        lastMessage.body,
        90,
      )}`,
      at: lastMessage.createdAt,
      status: 'Message',
    });
  }

  if (latestLocation) {
    addItem({
      id: `location-${latestLocation.id}`,
      type: 'LOC',
      title: 'Latest Partner location shared',
      detail: `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(
        booking,
      )}`,
      at: latestLocation.recordedAt,
      status: 'Location',
    });
  } else if (['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    addItem({
      id: `location-missing-${booking.id}`,
      type: 'LOC',
      title: 'Partner location not shared',
      detail: 'Active service state has no linked Partner location snapshot.',
      status: 'Pending',
    });
  }

  for (const item of bookingOperatingFinanceTimelineItems(booking)) {
    addItem(item);
  }

  for (const item of bookingOperatingActivityTimelineItems({ booking, notifications })) {
    addItem(item);
  }

  return timelineItems.build();
}

type CommunicationMovementEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  at: string;
};

function bookingCommunicationMovementHandoff({
  booking,
  latestLocation,
  messages,
  notifications,
}: {
  booking: AdminBookingDetail;
  latestLocation?: AdminLocationSnapshot;
  messages: AdminChatMessage[];
  notifications: AdminNotification[];
}) {
  const relatedNotifications = notifications
    .filter((notification) => notificationDataBookingId(notification) === booking.id)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt));
  const deliveries = relatedNotifications.flatMap((notification) => notification.deliveries ?? []);
  const failedDeliveries = deliveries.filter((delivery) => delivery.status === 'FAILED').length;
  const pendingDeliveries =
    deliveries.filter((delivery) => delivery.status === 'SKIPPED').length +
    relatedNotifications.filter((notification) => (notification.deliveries ?? []).length === 0).length;
  const disabledDevices = deliveries.filter((delivery) => delivery.pushDevice?.enabled === false).length;
  const lastMessage = messages[messages.length - 1];
  const latestAlert = relatedNotifications[0];
  const movementFreshness = latestProviderLocationFreshness(booking);
  const locationRows = locationTrail(booking);
  const activeNeedsLocation = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  const chatShouldExist = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
  const note =
    !booking.chatRoom && chatShouldExist
      ? {
          status: 'Chat repair needed',
          tone: 'pill-warn',
          noteClassName: 'ops-task-warning',
          nextAction: 'Repair booking chat handoff',
          nextDetail: 'Matched or active booking has no retained chat room attached.',
          href: '#chat',
          hrefLabel: 'Open chat section',
        }
      : failedDeliveries || disabledDevices
        ? {
            status: 'Alert delivery check',
            tone: 'pill-warn',
            noteClassName: 'ops-task-warning',
            nextAction: 'Review notification delivery',
            nextDetail: 'One or more booking alerts failed or targeted a disabled device.',
            href: '#alerts',
            hrefLabel: 'Open alert trace',
          }
        : activeNeedsLocation && !latestLocation
          ? {
              status: 'Location check',
              tone: 'pill-info',
              noteClassName: 'ops-task-info',
              nextAction: 'Ask Partner to share current location',
              nextDetail: 'The booking is active but no Partner location snapshot is linked yet.',
              href: '#location',
              hrefLabel: 'Open location trail',
            }
          : {
              status: 'Handoff visible',
              tone: 'pill-success',
              noteClassName: 'ops-task-success',
              nextAction: 'Continue normal monitoring',
              nextDetail: 'Chat, alert, and movement evidence can be reviewed from this record.',
              href: '#booking-activity',
              hrefLabel: 'Open full activity',
            };

  const events: CommunicationMovementEvent[] = [
    ...messages.slice(-5).map((message) => ({
      id: `message-${message.id}`,
      type: 'CHAT',
      title: messageSenderLabel(message),
      detail: compactActivityText(message.body, 120),
      at: message.createdAt,
    })),
    ...relatedNotifications.slice(0, 5).map((notification) => {
      const row = bookingNotificationTraceRow(notification);
      return {
        id: `notification-${notification.id}`,
        type: 'ALERT',
        title: row.signal,
        detail: `${row.title} / ${compactActivityText(row.detail, 110)}`,
        at: notification.createdAt,
      };
    }),
    ...locationRows.slice(-4).map((snapshot) => ({
      id: `location-${snapshot.id}`,
      type: 'LOC',
      title: 'Partner location snapshot',
      detail: `${coordinateLabel(snapshot.lat, snapshot.lng)} / ${providerLocationMetricHelper(booking)}`,
      at: snapshot.recordedAt,
    })),
  ]
    .filter((event) => Boolean(event.at))
    .sort((left, right) => safeTime(right.at) - safeTime(left.at))
    .slice(0, 10);

  return {
    ...note,
    metrics: [
      {
        label: 'Chat room',
        value: booking.chatRoom ? 'Retained' : 'Missing',
        helper: booking.chatRoom
          ? `${messages.length} message(s) kept in admin archive.`
          : 'Chat should be created once the booking is matched.',
      },
      {
        label: 'Latest message',
        value: lastMessage ? formatDate(lastMessage.createdAt) : 'No message',
        helper: lastMessage
          ? `${messageSenderLabel(lastMessage)} / ${compactActivityText(lastMessage.body, 72)}`
          : 'No Customer or Partner message yet.',
      },
      {
        label: 'Booking alerts',
        value: `${relatedNotifications.length}`,
        helper: latestAlert
          ? `Latest ${humanizeNotificationType(latestAlert.type)} at ${formatDate(latestAlert.createdAt)}.`
          : 'No booking notification row linked yet.',
      },
      {
        label: 'Delivery checks',
        value: `${failedDeliveries} failed / ${pendingDeliveries} pending`,
        helper: disabledDevices
          ? `${disabledDevices} disabled device(s) also found.`
          : 'No disabled device in linked alerts.',
      },
      {
        label: 'Partner location',
        value: providerLocationMetricValue(booking),
        helper:
          movementFreshness === 'missing'
            ? 'No Partner movement snapshot yet.'
            : `${providerLocationMetricHelper(booking)} / ${coordinateLabel(latestLocation?.lat, latestLocation?.lng)}`,
      },
      {
        label: 'Movement rows',
        value: `${locationRows.length}`,
        helper: locationRows.length
          ? 'Saved Partner location snapshots linked to this booking.'
          : 'No movement row linked yet.',
      },
    ],
    events,
  };
}

function messageSenderLabel(message: AdminChatMessage) {
  if (message.sender?.roles?.includes('PROVIDER')) {
    return `Partner: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  if (message.sender?.roles?.includes('CUSTOMER')) {
    return `Customer: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  if (message.sender?.roles?.includes('ADMIN')) {
    return `Admin: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  return message.sender?.fullName ?? message.sender?.phone ?? 'Unknown sender';
}

function bookingAttentionFlags(booking: AdminBookingDetail): AttentionFlag[] {
  const paymentStatus = booking.payment?.status;
  const status = booking.status;
  const participantCount = booking.participants?.length ?? 0;
  const messages = booking.chatRoom?.messages ?? [];
  const openedAge = minutesSince(booking.openedAt ?? booking.createdAt);
  const expired = booking.expiresAt ? new Date(booking.expiresAt).getTime() < Date.now() : false;
  const activeWithLocationNeed = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status);
  const finalPartner = bookingFinalPartnerSummary(booking);

  return buildBookingAttentionFlags({
    bookingStatus: status,
    hasPayment: Boolean(booking.payment),
    paymentStatus,
    paymentProviderRef: booking.payment?.providerRef ?? null,
    cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    cashDebtPartnerLabel: finalPartner.selected ? finalPartner.label : providerName(booking.preferredProvider),
    cashDebtAmount: Math.abs(booking.earning?.netAmount ?? 0),
    cashDebtCurrency: booking.earning?.currency ?? 'VND',
    matchingWindowExpired: expired,
    expiresAtLabel: formatDate(booking.expiresAt),
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredPartnerLabel: providerName(booking.preferredProvider),
    participantCount,
    openedAgeMinutes: openedAge,
    hasChatRoom: Boolean(booking.chatRoom),
    activeWithLocationNeed,
    hasLatestProviderLocation: Boolean(latestProviderLocation(booking)),
    latestProviderLocationFreshness: latestProviderLocationFreshness(booking),
    providerLocationAgeLabel: providerLocationMetricHelper(booking),
    messageCount: messages.length,
    refundCount: booking.refunds?.length ?? 0,
    formatMoney: money,
  });
}

function dispatchChecklist(booking: AdminBookingDetail): DispatchStep[] {
  const flags = bookingAttentionFlags(booking);
  const paymentHref = booking.payment?.id ? `/payments#payment-${booking.payment.id}` : undefined;
  const activeWithLocationNeed = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  return bookingDispatchChecklist({
    bookingStatus: booking.status,
    attentionFlagCount: flags.length,
    payment: booking.payment
      ? {
          id: booking.payment.id,
          status: booking.payment.status,
          href: paymentHref,
          hint: bookingPaymentHint(booking, {
            cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
          }),
          terminal: isTerminalPayment(booking.payment.status),
        }
      : null,
    selectedPartner: booking.selectedProvider
      ? { label: providerName(booking.selectedProvider), phone: booking.selectedProvider.user?.phone }
      : null,
    preferredPartner: booking.preferredProvider
      ? { label: providerName(booking.preferredProvider), phone: booking.preferredProvider.user?.phone }
      : null,
    isPreferredAwaitingDecision: isPreferredAwaitingDecision(booking),
    participantCount: booking.participants?.length ?? 0,
    hasChatRoom: Boolean(booking.chatRoom),
    chatRoomId: booking.chatRoom?.id ?? null,
    messageCount: booking.chatRoom?.messages?.length ?? 0,
    activeWithLocationNeed,
    hasLatestProviderLocation: Boolean(latestProviderLocation(booking)),
    latestProviderLocationFreshness: latestProviderLocationFreshness(booking),
    providerLocationAgeLabel: providerLocationMetricHelper(booking),
  });
}

function bookingOpsTaskCards(booking: AdminBookingDetail) {
  return buildBookingOpsTaskCards(booking.opsTasks, { formatDate });
}

function liveServiceSignals(booking: AdminBookingDetail) {
  const latest = latestProviderLocation(booking);
  const freshness = latestProviderLocationFreshness(booking);
  const serviceAddressPin = booking.addressSnapshot
    ? coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)
    : coordinateLabel(booking.lat, booking.lng);
  const providerPin = latest ? coordinateLabel(latest.lat, latest.lng) : 'No Partner pin';
  const distanceMeters = latest
    ? approximateDistanceMeters(
        booking.addressSnapshot?.latitude ?? booking.lat,
        booking.addressSnapshot?.longitude ?? booking.lng,
        latest.lat,
        latest.lng,
      )
    : null;
  const finalPartner = bookingFinalPartnerSummary(booking);

  return [
    {
      label: 'Service address pin',
      value: serviceAddressPin,
      helper: booking.addressSnapshot
        ? bookingAddressSnapshotLabel(booking)
        : addressLabel(booking.address),
      tone: booking.addressSnapshot || (booking.lat && booking.lng) ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Partner pin',
      value: providerPin,
      helper: latest
        ? providerLocationMetricHelper(booking)
        : 'Ask Partner to share current location from chat.',
      tone:
        freshness === 'recent'
          ? 'pill-success'
          : freshness === 'stale'
            ? 'pill-warn'
            : freshness === 'expired'
              ? 'pill-info'
              : 'pill-danger',
    },
    {
      label: 'Approx. gap',
      value: distanceMeters === null ? 'Unknown' : distanceLabel(Math.round(distanceMeters / 100) * 100),
      helper: 'Calculated from the service address pin and latest Partner pin. It is not a route or ETA.',
      tone: distanceMeters === null ? 'pill-info' : distanceMeters > 5000 ? 'pill-warn' : 'pill-success',
    },
    {
      label: 'Service contact',
      value: booking.selectedProvider?.user?.phone ?? 'No Partner phone',
      helper: finalPartner.selected
        ? `${finalPartner.label} is the current handoff Partner.`
        : 'No Partner assigned yet.',
      tone: finalPartner.selected ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} message(s)` : 'Not ready',
      helper: booking.chatRoom
        ? `Room ${booking.chatRoom.id}`
        : 'Chat opens after Partner selection/service start.',
      tone: booking.chatRoom ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Payment',
      value: booking.payment?.status ?? 'NONE',
      helper: bookingPaymentHint(booking, {
        cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
      }),
      tone:
        booking.payment?.status === 'AUTHORIZED'
          ? 'pill-warn'
          : isTerminalPayment(booking.payment?.status)
            ? 'pill-success'
            : 'pill-info',
    },
  ];
}

function flowStages(booking: AdminBookingDetail) {
  const finalPartner = bookingFinalPartnerSummary(booking);
  return buildBookingFlowStages({
    createdAtLabel: formatDate(booking.createdAt),
    openedAtLabel: booking.openedAt ? formatDate(booking.openedAt) : null,
    hasOpened: Boolean(booking.openedAt),
    hasPreferredPartner: Boolean(booking.preferredProvider),
    partnerDecisionLabel: bookingPartnerDecisionLabel(booking, bookingPreferredProviderId(booking)),
    partnerHint: bookingPartnerHint(booking),
    participantCount: booking.participants?.length ?? 0,
    bookingStatus: booking.status,
    selectedPartnerLabel: finalPartner.label,
    hasSelectedPartner: finalPartner.selected,
    hasChatRoom: Boolean(booking.chatRoom),
    paymentStatus: booking.payment?.status ?? 'NONE',
    paymentHint: bookingPaymentHint(booking, {
      cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    }),
  });
}

function bookingFinanceSummaryCards(financeTrace: ReturnType<typeof bookingFinanceTrace>) {
  return buildBookingFinanceSummaryCards(financeTrace, { money });
}

function bookingFinanceFlags(
  booking: AdminBookingDetail,
  financeTrace: ReturnType<typeof bookingFinanceTrace>,
): AttentionFlag[] {
  const bookedService = booking.services?.[0];
  const paymentAmount = readNullableAmount(booking.payment?.amount);
  const servicePrice = readNullableAmount(bookedService?.price);
  const finalPartner = bookingFinalPartnerSummary(booking);
  return buildBookingFinanceFlags({
    bookingStatus: booking.status,
    paymentAmount,
    servicePrice,
    hasEarning: Boolean(booking.earning),
    earningNetAmount: booking.earning?.netAmount ?? null,
    partnerLabel: finalPartner.selected ? finalPartner.label : providerName(booking.preferredProvider),
    cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    financeTrace: {
      currency: financeTrace.currency,
      customerPriceAmount: financeTrace.customerPriceAmount,
      providerPayoutAmount: financeTrace.providerPayoutAmount,
      payoutRuleMissing: financeTrace.payoutRuleMissing,
      paymentMethod: financeTrace.paymentMethod,
      walletTotalAmount: financeTrace.walletTotalAmount,
    },
    formatMoney: money,
  });
}

function isPreferredAwaitingDecision(booking: AdminBookingDetail) {
  const participant = preferredParticipantState(booking);
  return isPreferredAwaitingDecisionFromStatus({
    finalSelection: booking.matchingEvidence?.finalSelection,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredParticipantStatus: participant?.status ?? null,
  });
}

function providerLocationMetricValue(booking: AdminBookingDetail) {
  return bookingProviderLocationMetricValue(latestProviderLocationFreshness(booking));
}

function providerLocationMetricHelper(booking: AdminBookingDetail) {
  return bookingProviderLocationMetricHelper(latestProviderLocation(booking)?.recordedAt);
}

function locationTrail(booking: AdminBookingDetail) {
  return bookingLocationTrail(booking.snapshots, latestProviderLocation(booking));
}
