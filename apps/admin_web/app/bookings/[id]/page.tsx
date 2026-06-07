import { notFound } from 'next/navigation';
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
import { bookingFinanceTrace } from './booking-finance-trace';
import { bookingAddressRadiusContract } from './booking-address-radius-contract';
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
  bookingBackupPartnerSupply,
  bookingDispatchPin,
} from './booking-marketplace-supply';
import { bookingMarketplaceWalletEvidence } from './booking-marketplace-wallet-evidence';
import { bookingDetailMatchingRuleSnapshot } from './booking-matching-rule-snapshot';
import { bookingParticipantLedger } from './booking-participant-ledger';
import {
  bookingPreferredProviderId,
  isCustomerSelectableParticipantForFinalChoice,
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
  AdminProviderPlatformFeeLog,
  AdminProviderTaxLog,
  AdminProviderWalletLedgerEntry,
  adminGet,
} from '../../../lib/admin-api';
import {
  attentionLevel,
  type AttentionFlag,
} from '../../../lib/admin-attention-flags';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { bookingAttentionFlags as buildBookingAttentionFlags } from '../../../lib/booking-attention-flags';
import { bookingChatEvidenceDecisionBoard as buildBookingChatEvidenceDecisionBoard } from '../../../lib/booking-chat-evidence-decision-board';
import {
  bookingChatRepairActionState as buildBookingChatRepairActionState,
  bookingChatRepairNeedsOps as buildBookingChatRepairNeedsOps,
} from '../../../lib/booking-chat-repair-action-state';
import { bookingChatLifecycle } from '../../../lib/booking-chat-lifecycle';
import { bookingClosureSummary } from '../../../lib/booking-closure-summary';
import { bookingDecisionEvidenceGuardrails as buildBookingDecisionEvidenceGuardrails } from '../../../lib/booking-decision-evidence-guardrails';
import { bookingDecisionNotePresets as buildBookingDecisionNotePresets } from '../../../lib/booking-decision-note-presets';
import { bookingEvidencePacket as buildBookingEvidencePacket } from '../../../lib/booking-evidence-packet';
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
  bookingRefundLedgerEvidence,
  bookingRefundRows,
  type BookingRefundLedgerRow,
} from '../../../lib/booking-refund-ledger';

type PageProps = {
  params: Promise<{ id: string }>;
};

const bookingDetailAuthoritySourceMarkers = [
  'MVP authority contract',
  'NestJS business authority',
  'BookingAddressSnapshot',
  'customer final partner choice',
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
  'All partner chats',
  'Service pricing snapshot',
] as const;

type BookingTimelineRefundRow =
  | NonNullable<AdminBookingDetail['refunds']>[number]
  | NonNullable<NonNullable<AdminBookingDetail['payment']>['refunds']>[number];

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
  const finalProvider = booking.selectedProvider ?? booking.preferredProvider;
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
  const refundLedgerRows = bookingRefundRows(booking);
  const operatorNoteLines = bookingOperatorNoteLines(booking.notes);
  const closureSummary = bookingClosureSummary(booking);
  const servicePricingSnapshotRows = [
    {
      label: 'Service option',
      value: financeTrace.serviceOption,
      helper: 'Booked service name, duration option, and quantity snapshot.',
    },
    {
      label: 'Customer price',
      value: financeTrace.customerPrice,
      helper: `Admin minimum ${financeTrace.adminMinimum}; partner price must follow the configured step.`,
    },
    {
      label: 'Payout rule',
      value: financeTrace.payoutRuleStatus,
      helper: financeTrace.payoutRuleLine,
    },
    {
      label: 'Partner payout',
      value: financeTrace.providerPayout,
      helper: financeTrace.providerNet,
    },
    {
      label: 'HANDS fee',
      value: financeTrace.platformFee,
      helper: `${financeTrace.feeCosts}; net ${financeTrace.netHandsFee}`,
    },
    {
      label: 'Tax and withholding',
      value: financeTrace.withholding,
      helper: `Company fee after tax: ${financeTrace.companyFeeAfterTax}`,
    },
    {
      label: 'Wallet impact',
      value: financeTrace.walletLedger,
      helper:
        financeTrace.paymentMethod === 'CASH'
          ? 'Cash bookings can create partner fee debt until settled.'
          : 'Non-cash bookings should create a payout credit after completion.',
    },
  ];
  const policySnapshot = bookingOperationalPolicySnapshot(booking, operationalPolicies);
  const backupSupply = bookingBackupPartnerSupply(booking, providers, operationalPolicies);
  const addressRadiusContract = bookingAddressRadiusContract(booking, backupSupply);
  const customerWaitPanel = bookingCustomerWaitPanel(booking, backupSupply, operationalPolicies);
  const mvpAuthorityContract = bookingMvpAuthorityContract({
    booking,
    operationalPolicies,
    backupSupply,
    messageCount: messages.length,
    financeTrace,
    walletDebt: bookingCashDebtNeedsSettlement(booking),
    terminal: TERMINAL_BOOKING_STATUSES.has(booking.status),
  });
  const stageSnapshot = bookingStageSnapshot(booking, customerWaitPanel, backupSupply);
  const notificationTrace = bookingNotificationTrace(booking, rawNotifications);
  const matchingRuleSnapshot = bookingDetailMatchingRuleSnapshot({
    booking,
    backupSupply,
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
    backupSupply,
    financeTrace,
    notificationTrace,
    walletDebt: bookingCashDebtNeedsSettlement(booking),
  });
  const participantLedger = bookingParticipantLedger(booking, backupSupply, notificationTrace);
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
  const payoutBatchEligibility = bookingPayoutBatchEligibility({
    booking,
    financeTrace,
    financeFlags,
    closeoutReadiness,
  });
  const operatingSnapshot = bookingOperatingSnapshot({
    booking,
    addressLine,
    addressPin,
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
      value: `${booking.participants?.length ?? 0}`,
      helper: 'Preferred, final, and marketplace shortlist.',
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
      value: booking.payment?.status ?? 'NONE',
      helper: money(booking.payment?.amount, booking.payment?.currency),
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
      status: finalProvider?.id ? 'Linked' : 'Not selected',
      evidence: finalProvider
        ? providerName(finalProvider)
        : `${booking.participants?.length ?? 0} marketplace participant(s)`,
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
      evidence: `${financeTrace.serviceOption} / customer ${financeTrace.customerPrice} / partner ${financeTrace.providerPayout}`,
      href: '#service',
    },
    {
      area: 'Payment',
      status: booking.payment?.status ?? 'NONE',
      evidence: `${booking.payment?.method ?? 'No method'} / ${money(
        booking.payment?.amount,
        booking.payment?.currency,
      )}`,
      href: '#payment',
    },
    {
      area: 'Refund',
      status: refundLedgerRows.length ? `${refundLedgerRows.length} refund record(s)` : 'No refund record',
      evidence: bookingRefundLedgerEvidence(booking),
      href: '#payment',
    },
    {
      area: 'Finance',
      status: financeFlags.length ? `${financeFlags.length} check(s)` : 'Trace ready',
      evidence: `${financeTrace.providerPayout} partner payout / ${financeTrace.platformFee} platform fee`,
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
      status: latestLocation ? 'Partner pin saved' : 'No partner pin',
      evidence: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}`
        : addressPin,
      href: '#location',
    },
    {
      area: 'Alerts',
      status: `${notificationTrace.rows.length} notification(s)`,
      evidence: `${notificationTrace.rows.filter((row) => row.isPartnerAlert).length} partner alert(s) / ${
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
    latestLocation ? `location ${formatDate(latestLocation.recordedAt)}` : 'no partner pin',
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
    refundEvidence: bookingRefundLedgerEvidence(booking),
    cashFeeDebtNeedsSettlement,
    cashDebtEvidenceLabel: cashFeeDebtNeedsSettlement
      ? `Debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`
      : `${booking.payment?.method ?? 'NONE'} / ${booking.payment?.status ?? 'NONE'}`,
    closeoutStatus: closeoutReadiness.status,
    closeoutTone: closeoutReadiness.tone,
    closeoutHelper: closeoutReadiness.helper,
    closeoutOpenItemLabels: closeoutReadiness.openItems.map((item) => item.label),
  });
  const decisionEvidenceGuardrails = buildBookingDecisionEvidenceGuardrails({
    bookingStatus: booking.status,
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    addressSnapshotLabel: bookingAddressSnapshotLabel(booking),
    addressPinLabel: booking.addressSnapshot
      ? coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)
      : 'No pin',
    hasSelectedPartner: Boolean(booking.selectedProvider),
    selectedPartnerLabel: providerName(booking.selectedProvider),
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
      label: 'Preferred partner',
      value: booking.preferredProvider?.id ? providerName(booking.preferredProvider) : 'Not selected',
      detail: 'First-pick partner record and booking gate state.',
      href: booking.preferredProvider?.id ? `/partners/${booking.preferredProvider.id}` : '#handoff',
      tone: booking.preferredProvider?.id ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Final partner',
      value: finalProvider?.id ? providerName(finalProvider) : 'Customer choice pending',
      detail: 'Final selected partner, location, payout, and service records.',
      href: finalProvider?.id ? `/partners/${finalProvider.id}` : '#participants',
      tone: finalProvider?.id ? 'pill-success' : 'pill-warn',
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
      value: booking.payment?.status ?? 'No payment',
      detail: `${booking.payment?.method ?? 'NONE'} / ${money(booking.payment?.amount, booking.payment?.currency)}`,
      href: booking.payment?.status === 'AUTHORIZED' ? '/payments?review=authorized' : '/payments',
      tone: booking.payment ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Refund queue',
      value: `${refundLedgerRows.length} refund row(s)`,
      detail: bookingRefundLedgerEvidence(booking),
      href: refundLedgerRows.length ? '/refunds?review=open' : '#payment',
      tone: refundLedgerRows.length ? 'pill-warn' : 'pill-neutral',
    },
    {
      label: 'Cash settlement',
      value: bookingCashDebtNeedsSettlement(booking) ? 'Settlement needed' : 'Clear',
      detail: financeTrace.walletLedger,
      href: bookingCashDebtNeedsSettlement(booking) ? '/cash-settlements' : '#finance',
      tone: bookingCashDebtNeedsSettlement(booking) ? 'pill-danger' : 'pill-success',
    },
  ];
  const bookingEvidenceBundleRows = buildBookingEvidenceBundleRows({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    financeTrace,
    refundLedgerRows,
    operatorNoteLines,
    bookingActivityRecords,
  });
  const bookingCloseoutChecklist = buildBookingCloseoutChecklist({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    financeTrace,
    refundLedgerRows,
    operatorNoteLines,
    closeoutReadiness,
    bookingActivityRecords,
  });
  const actionEvidenceGate = buildBookingActionEvidenceGate({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    refundLedgerRows,
    operatorNoteLines,
    closeoutReadiness,
  });
  const actionGateByAction = new Map(actionEvidenceGate.rows.map((row) => [row.action, row]));
  const finalGateReason = buildBookingFinalGateReason({
    booking,
    financeTrace,
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
      detail: 'Customer, partner, address, chat, payment, finance, location, alerts, and notes.',
    },
    {
      href: '#connected-operations-records',
      label: 'Linked records',
      value: `${connectedRecordLinks.length} links`,
      detail: 'Open customer, partner, chat archive, notifications, payment, refund, and settlement.',
    },
    {
      href: '#participants',
      label: 'Marketplace',
      value: `${booking.participants?.length ?? 0} participant row(s)`,
      detail: 'Only actual participant records are retained as booking participants.',
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
      value: booking.payment?.status ?? 'NONE',
      detail: `${booking.payment?.method ?? 'No method'} / ${money(
        booking.payment?.amount,
        booking.payment?.currency,
      )}`,
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
      detail: `${customerWaitPanel.signalStatus} / ${backupSupply.eligibleCount} marketplace partner(s) in policy.`,
    },
    {
      href: finalProvider?.id ? `/partners/${finalProvider.id}` : '#participants',
      label: 'Customer choice',
      value: finalProvider?.id ? providerName(finalProvider) : 'Pending',
      detail: finalProvider?.id
        ? 'Final partner exists; confirm chat handoff before service coordination.'
        : 'Customer must choose the final partner before matched chat opens.',
    },
    {
      href: '#participants',
      label: 'Marketplace participants',
      value: `${booking.participants?.length ?? 0} participant row(s)`,
      detail: 'Only actual partner participation rows are retained for this booking.',
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
      value: booking.payment?.status ?? 'No payment',
      detail:
        booking.payment?.method === 'CASH'
          ? `${financeTrace.walletLedger} / ${financeTrace.platformFee} HANDS fee.`
          : `${booking.payment?.method ?? 'NONE'} / ${money(
              booking.payment?.amount,
              booking.payment?.currency,
            )}.`,
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
    { label: 'Request opened', value: formatDate(booking.createdAt ?? booking.scheduledStartAt) },
    { label: 'Expires', value: formatDate(booking.expiresAt) },
  ];
  const bookingRecordServiceRows = [
    { label: 'Option', value: bookingServiceOptionLabel(booking) },
    { label: 'Name', value: service?.service?.name ?? 'Service pending' },
    { label: 'Duration', value: `${service?.service?.durationMin ?? '-'} min` },
    {
      label: 'Booking price',
      value: money(service?.price ?? booking.payment?.amount, booking.payment?.currency),
    },
    {
      label: 'Admin minimum',
      value: money(service?.service?.basePrice, booking.payment?.currency),
    },
    { label: 'Partner payout rule', value: bookingServicePayoutRuleLabel(booking) },
    { label: 'Notes', value: booking.notes ?? 'No notes' },
    { label: 'Created', value: formatDate(booking.createdAt) },
    { label: 'Updated', value: formatDate(booking.updatedAt) },
  ];
  const bookingRecordHandoffRows = [
    { label: 'Preferred', value: providerName(booking.preferredProvider) },
    { label: 'Final', value: providerName(finalProvider) },
    { label: 'Final phone', value: finalProvider?.user?.phone ?? 'No phone' },
    {
      label: 'Latest partner pin',
      value: latestLocation ? coordinateLabel(latestLocation.lat, latestLocation.lng) : 'No live pin yet',
    },
    {
      label: 'Latest pin time',
      value: latestLocation ? formatDate(latestLocation.recordedAt) : 'No location shared',
    },
    { label: 'Location freshness', value: providerLocationMetricHelper(booking) },
  ];
  const bookingRecordPaymentRows = [
    { label: 'Payment id', value: booking.payment?.id ?? 'No payment' },
    { label: 'Method', value: booking.payment?.method ?? 'NONE' },
    { label: 'Amount', value: money(booking.payment?.amount, booking.payment?.currency) },
    {
      label: 'Refund count',
      value: `${booking.refunds?.length ?? booking.payment?.refunds?.length ?? 0}`,
    },
    {
      label: 'Earning',
      value: booking.earning
        ? `${money(booking.earning.netAmount, booking.earning.currency)} / ${booking.earning.status}`
        : 'Not created',
    },
    ...(bookingCashDebtNeedsSettlement(booking)
      ? [
          {
            label: 'Cash fee debt',
            value: `${money(
              Math.abs(booking.earning?.netAmount ?? 0),
              booking.earning?.currency,
            )} / partner blocked`,
          },
        ]
      : []),
    { label: 'Service feedback', value: booking.review ? 'Submitted' : 'Not submitted' },
  ];
  const bookingRecordFinanceRows = [
    { label: 'Pricing source', value: financeTrace.pricingSource },
    { label: 'Service option', value: financeTrace.serviceOption },
    { label: 'Customer price', value: financeTrace.customerPrice },
    { label: 'Admin minimum', value: financeTrace.adminMinimum },
    { label: 'Payout rule', value: financeTrace.payoutRuleStatus },
    { label: 'Rule line', value: financeTrace.payoutRuleLine },
    { label: 'Partner payout', value: financeTrace.providerPayout },
    { label: 'Platform fee', value: financeTrace.platformFee },
    { label: 'VAT / other costs', value: financeTrace.feeCosts },
    { label: 'Net HANDS fee', value: financeTrace.netHandsFee },
    { label: 'Withholding', value: financeTrace.withholding },
    { label: 'Company fee after tax', value: financeTrace.companyFeeAfterTax },
    { label: 'Wallet ledger', value: financeTrace.walletLedger },
    { label: 'Partner net', value: financeTrace.providerNet },
  ];

  return (
    <>
      <span hidden>{bookingDetailAuthoritySourceMarkers.join(' | ')}</span>

      <BookingDetailToolbar
        bookingId={booking.id}
        chatRoomId={booking.chatRoom?.id}
        customerProfileId={booking.customerProfile?.id}
        finalPartnerId={finalProvider?.id}
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

      <BookingDispatchCandidateDecisionMatrixSection backupSupply={backupSupply} />

      <BookingMarketplaceSupplySection backupSupply={backupSupply} />

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
        finalPartnerId={finalProvider?.id}
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
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const partnerLabel = finalPartner ? providerName(finalPartner) : 'No final partner';
  const pendingTasks = bookingOpsTaskCards(booking).filter((task) => task.status !== 'DONE');

  return buildBookingOperatorCommandQueue({
    bookingStatus: booking.status,
    participantCount: booking.participants?.length ?? 0,
    partnerLabel,
    hasFinalPartner: Boolean(finalPartner),
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
    refundRowCount: bookingRefundRows(booking).length,
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
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const participantCount = booking.participants?.length ?? 0;
  const customerName = booking.customerProfile?.user?.fullName ?? 'Customer';
  const customerPhone = booking.customerProfile?.user?.phone ?? 'No phone';
  const partnerLabel = finalPartner ? providerName(finalPartner) : 'Not selected';
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
    hasFinalPartner: Boolean(finalPartner),
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
  return buildBookingEvidencePacket({
    chatReady: Boolean(booking.chatRoom),
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
    refundEvidence: bookingRefundLedgerEvidence(booking),
    activityRecordCount: bookingActivityRecords.length,
    latestActivityTitle: bookingActivityRecords[0]?.title ?? null,
    latestActivityAtLabel: bookingActivityRecords[0] ? formatDate(bookingActivityRecords[0].at) : null,
  });
}

function buildBookingEvidenceBundleRows({
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
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const customerChoiceCandidates =
    booking.participants?.filter(
      (participant) =>
        isCustomerSelectableParticipantForFinalChoice(participant, bookingPreferredProviderId(booking)) ||
        participant.status === 'SELECTED',
    )
      .length ?? 0;
  const failedAlerts = notificationTrace.rows.filter((row) => row.deliveryStatuses.includes('FAILED')).length;
  const latestActivity = bookingActivityRecords[0];
  const addressReady = Boolean(booking.addressSnapshot);
  const chatReady = Boolean(booking.chatRoom);
  const hasMoneyTrace = Boolean(booking.payment || booking.earning || refundLedgerRows.length);
  const hasLocationTrace = Boolean(latestLocation || locationTrail(booking).length);

  return [
    {
      lane: 'Customer',
      recordLabel: booking.customerProfile?.id ? shortId(booking.customerProfile.id) : 'Profile missing',
      status: booking.customerProfile?.id ? 'Linked' : 'Missing',
      tone: booking.customerProfile?.id ? 'pill-success' : 'pill-warn',
      evidence: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
        booking.customerProfile?.user?.phone ?? 'No phone'
      }`,
      operatorUse:
        'Open the customer record to review bookings, wallet, addresses, and retained chat history.',
      href: booking.customerProfile?.id ? `/customers/${booking.customerProfile.id}` : '#customer',
    },
    {
      lane: 'Address',
      recordLabel: addressReady ? 'BookingAddressSnapshot' : 'Snapshot missing',
      status: addressReady ? 'Locked' : 'Repair needed',
      tone: addressReady ? 'pill-success' : 'pill-danger',
      evidence: `${bookingAddressSnapshotLabel(booking)} / ${bookingDispatchPin(booking).source}`,
      operatorUse: 'Use this immutable address snapshot for partner radius checks and service evidence.',
      href: '#address-radius-contract',
    },
    {
      lane: 'Partner',
      recordLabel: finalPartner?.id ? shortId(finalPartner.id) : 'Selection pending',
      status: finalPartner?.id ? 'Selected' : `${customerChoiceCandidates} selectable`,
      tone: finalPartner?.id ? 'pill-success' : customerChoiceCandidates ? 'pill-warn' : 'pill-info',
      evidence: finalPartner
        ? `${providerName(finalPartner)} / ${providerLocationMetricValue(booking)}`
        : `${booking.participants?.length ?? 0} participant row(s), ${customerChoiceCandidates} customer-selectable row(s)`,
      operatorUse: 'Confirm the customer final partner selection and marketplace/payout settlement requirements.',
      href: finalPartner?.id ? `/partners/${finalPartner.id}` : '#participants',
    },
    {
      lane: 'Chat',
      recordLabel: booking.chatRoom ? shortId(booking.chatRoom.id) : 'No room',
      status: chatReady ? 'Archived' : 'Missing',
      tone: chatReady ? 'pill-success' : 'pill-warn',
      evidence: chatReady
        ? `${messages.length} retained message(s), latest ${
            messages[messages.length - 1]?.createdAt
              ? formatDate(messages[messages.length - 1].createdAt)
              : 'none'
          }`
        : bookingChatRepairNeedsOps(booking)
          ? 'Matched booking should have a retained chat archive.'
          : 'Chat opens after customer final partner selection.',
      operatorUse: 'Use the transcript for service handoff, cancellation, no-show, and refund context.',
      href: chatReady ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : '#chat',
    },
    {
      lane: 'Money',
      recordLabel: booking.payment?.id ? shortId(booking.payment.id) : 'No payment row',
      status: hasMoneyTrace
        ? (booking.payment?.status ?? booking.earning?.status ?? 'Trace loaded')
        : 'Missing',
      tone: hasMoneyTrace ? 'pill-info' : 'pill-warn',
      evidence: `${booking.payment?.method ?? 'NONE'} / customer ${financeTrace.customerPrice} / partner ${
        financeTrace.providerPayout
      } / wallet ${financeTrace.walletLedger}`,
      operatorUse: 'Check payment, earning, tax, fee, refund, payout, and cash settlement records together.',
      href: '#finance',
    },
    {
      lane: 'Location',
      recordLabel: latestLocation ? shortId(latestLocation.id) : 'No latest pin',
      status: hasLocationTrace ? providerLocationMetricValue(booking) : 'Missing',
      tone: hasLocationTrace ? 'pill-info' : 'pill-neutral',
      evidence: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}`
        : `Service address pin ${bookingDispatchPin(booking).label}`,
      operatorUse:
        'Use location rows only as operational history; routing and live tracking are not required for MVP.',
      href: '#location',
    },
    {
      lane: 'Alerts',
      recordLabel: `${notificationTrace.rows.length} notification row(s)`,
      status: failedAlerts ? `${failedAlerts} failed` : 'Loaded',
      tone: failedAlerts ? 'pill-warn' : notificationTrace.rows.length ? 'pill-info' : 'pill-neutral',
      evidence: `${notificationTrace.rows.filter((row) => row.isPartnerAlert).length} partner alert(s), ${
        notificationTrace.backupBatches.length
      } marketplace batch(es)`,
      operatorUse:
        'Check whether customer and partner app notifications were created, delivered, read, or retried.',
      href: `/notifications?booking=${encodeURIComponent(booking.id)}`,
    },
    {
      lane: 'Operator trail',
      recordLabel: `${bookingActivityRecords.length} event(s)`,
      status: operatorNoteLines.length || latestActivity ? 'Retained' : 'Empty',
      tone: operatorNoteLines.length || latestActivity ? 'pill-success' : 'pill-neutral',
      evidence: latestActivity
        ? `${latestActivity.title} / ${formatDate(latestActivity.at)}`
        : (operatorNoteLines[operatorNoteLines.length - 1] ?? 'No operator trail loaded'),
      operatorUse: 'Use notes and audit rows before manual closeout, no-show, refund, or settlement actions.',
      href: '#booking-activity',
    },
  ];
}

type BookingCloseoutChecklistItem = {
  title: string;
  status: string;
  detail: string;
  operatorRule: string;
  href: string;
  className: 'ops-task-done' | 'ops-task-warning' | 'ops-task-blocked';
  pillClass: 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';
};

function buildBookingCloseoutChecklist({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  financeTrace,
  refundLedgerRows,
  operatorNoteLines,
  closeoutReadiness,
  bookingActivityRecords,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
  bookingActivityRecords: BookingActivityRecord[];
}): BookingCloseoutChecklistItem[] {
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const customerChoiceCandidates =
    booking.participants?.filter(
      (participant) =>
        isCustomerSelectableParticipantForFinalChoice(participant, bookingPreferredProviderId(booking)) ||
        participant.status === 'SELECTED',
    )
      .length ?? 0;
  const addressReady = Boolean(booking.addressSnapshot);
  const chatNeeded = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
  const chatReady = Boolean(booking.chatRoom);
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const terminal = TERMINAL_BOOKING_STATUSES.has(booking.status);
  const taxRows = booking.taxLogs?.length ?? booking.earning?.taxLogs?.length ?? 0;
  const failedAlerts = notificationTrace.rows.filter((row) => row.deliveryStatuses.includes('FAILED')).length;
  const operatorTrailCount =
    operatorNoteLines.length + bookingActivityRecords.length + (booking.auditLogs?.length ?? 0);
  const latestMessage = messages[messages.length - 1];
  const closeoutPillClass = toChecklistPillClass(closeoutReadiness.tone);

  return [
    {
      title: 'Address snapshot',
      status: addressReady ? 'Ready' : 'Repair needed',
      detail: addressReady
        ? `${bookingAddressSnapshotLabel(booking)} is locked for partner distance and evidence review.`
        : 'BookingAddressSnapshot is required before distance matching and closeout review are reliable.',
      operatorRule:
        'Use the booking address, not the customer current location, for 10km partner participation.',
      href: '#address-radius-contract',
      className: addressReady ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: addressReady ? 'pill-success' : 'pill-danger',
    },
    {
      title: 'Customer final partner choice',
      status: finalPartner ? 'Selected' : customerChoiceCandidates ? 'Choice pending' : 'Waiting',
      detail: finalPartner
        ? `${providerName(finalPartner)} is linked as the selected partner for this booking.`
        : `${customerChoiceCandidates} participating/accepted partner(s) are available for the customer decision step.`,
      operatorRule: 'No automatic partner assignment; customer selection is the final matching authority.',
      href: finalPartner?.id ? `/partners/${finalPartner.id}` : '#participants',
      className: finalPartner
        ? 'ops-task-done'
        : customerChoiceCandidates
          ? 'ops-task-warning'
          : 'ops-task-blocked',
      pillClass: finalPartner ? 'pill-success' : customerChoiceCandidates ? 'pill-warn' : 'pill-info',
    },
    {
      title: 'Chat archive',
      status: chatReady ? 'Archived' : chatNeeded ? 'Repair needed' : 'Locked',
      detail: chatReady
        ? `Room ${shortId(booking.chatRoom?.id ?? '')} keeps ${messages.length} message(s); latest ${
            latestMessage?.createdAt ? formatDate(latestMessage.createdAt) : 'not sent yet'
          }.`
        : chatNeeded
          ? 'Matched or active booking has no retained chat room attached.'
          : 'Chat opens after the customer selects the final partner.',
      operatorRule: 'Mobile chat may hide after completion, but admin must retain the transcript.',
      href: chatReady
        ? `/chat-archive?q=${encodeURIComponent(booking.id)}`
        : chatNeeded
          ? '/chat-archive?status=missing-room'
          : '#chat',
      className: chatReady ? 'ops-task-done' : chatNeeded ? 'ops-task-blocked' : 'ops-task-warning',
      pillClass: chatReady ? 'pill-success' : chatNeeded ? 'pill-danger' : 'pill-info',
    },
    {
      title: 'Money and wallet gate',
      status: cashDebt ? 'Settlement needed' : (booking.payment?.status ?? 'No payment'),
      detail: cashDebt
        ? `${financeTrace.walletLedger}. Partner can view marketplace requests, but participation is held until settled or offset.`
        : `${booking.payment?.method ?? 'NONE'} payment / customer ${financeTrace.customerPrice} / partner ${financeTrace.providerPayout}.`,
      operatorRule:
        'Cash fee debt must be resolved before marketplace participation or payout batch release.',
      href: cashDebt ? '/cash-settlements' : '#finance',
      className: cashDebt ? 'ops-task-blocked' : booking.payment ? 'ops-task-done' : 'ops-task-warning',
      pillClass: cashDebt ? 'pill-danger' : booking.payment ? 'pill-success' : 'pill-warn',
    },
    {
      title: 'Manual outcome evidence',
      status: terminal ? 'Terminal review' : refundLedgerRows.length ? 'Refund evidence' : 'Open',
      detail: refundLedgerRows.length
        ? `${refundLedgerRows.length} refund row(s). ${bookingRefundLedgerEvidence(booking)}`
        : terminal
          ? `${booking.status} booking needs retained chat, location, payment, and operator trail before closeout.`
          : `Open booking with ${messages.length} chat message(s), ${notificationTrace.rows.length} alert(s), and ${failedAlerts} failed alert(s).`,
      operatorRule: 'Cancellation, no-show, refund, and release decisions are admin evidence decisions.',
      href: refundLedgerRows.length ? '/refunds?review=open' : '#manual-decision-readiness',
      className: refundLedgerRows.length || terminal ? 'ops-task-warning' : 'ops-task-done',
      pillClass: refundLedgerRows.length || terminal ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Finance closeout',
      status: closeoutReadiness.status,
      detail: closeoutReadiness.openItems.length
        ? `Open items: ${closeoutReadiness.openItems.map((item) => item.label).join(', ')}. Tax rows ${taxRows}.`
        : `${closeoutReadiness.helper} Tax rows ${taxRows}; operator trail ${operatorTrailCount}.`,
      operatorRule: 'Use this before weekly, monthly, or admin-selected settlement batch processing.',
      href: '#booking-closeout-readiness',
      className:
        closeoutPillClass === 'pill-danger'
          ? 'ops-task-blocked'
          : closeoutPillClass === 'pill-warn'
            ? 'ops-task-warning'
            : 'ops-task-done',
      pillClass: closeoutPillClass,
    },
    {
      title: 'Location and alert trail',
      status: latestLocation ? 'Movement saved' : notificationTrace.rows.length ? 'Alerts saved' : 'Sparse',
      detail: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}.`
        : `${notificationTrace.rows.length} alert row(s), ${failedAlerts} failed delivery row(s).`,
      operatorRule: 'Use saved pins and alert delivery only as factual operations history.',
      href: latestLocation ? '#location' : `/notifications?booking=${encodeURIComponent(booking.id)}`,
      className: latestLocation || notificationTrace.rows.length ? 'ops-task-done' : 'ops-task-warning',
      pillClass: latestLocation || notificationTrace.rows.length ? 'pill-info' : 'pill-neutral',
    },
  ];
}

function toChecklistPillClass(value: string): BookingCloseoutChecklistItem['pillClass'] {
  if (
    value === 'pill-success' ||
    value === 'pill-warn' ||
    value === 'pill-danger' ||
    value === 'pill-info' ||
    value === 'pill-neutral'
  ) {
    return value;
  }

  return 'pill-neutral';
}

type BookingPayoutBatchEligibilityRow = {
  label: string;
  status: string;
  detail: string;
  operatorRule: string;
  href: string;
  className: BookingCloseoutChecklistItem['className'];
  pillClass: BookingCloseoutChecklistItem['pillClass'];
};

function bookingPayoutBatchEligibility({
  booking,
  financeTrace,
  financeFlags,
  closeoutReadiness,
}: {
  booking: AdminBookingDetail;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  financeFlags: AttentionFlag[];
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
}) {
  const isCompleted = booking.status === 'COMPLETED';
  const paymentReady =
    booking.payment?.method === 'CASH' ||
    ['CAPTURED', 'PAID', 'SETTLED'].includes(booking.payment?.status ?? '');
  const hasEarning = Boolean(booking.earning);
  const hasTaxLog = (booking.earning?.taxLogs?.length ?? booking.taxLogs?.length ?? 0) > 0;
  const hasPlatformFeeLog =
    (booking.earning?.platformFeeLogs?.length ?? booking.platformFeeLogs?.length ?? 0) > 0;
  const hasWalletLedger =
    (booking.earning?.walletLedgerEntries?.length ?? booking.walletLedgerEntries?.length ?? 0) > 0;
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const hasBatch = Boolean(booking.earning?.payoutBatchId);
  const alreadyPaid = ['PAID', 'SETTLED'].includes(booking.earning?.status ?? '');
  const closeoutReady = closeoutReadiness.openItems.length === 0 && financeFlags.length === 0;
  const eligible = isCompleted && paymentReady && hasEarning && closeoutReady && !cashDebt;
  const blocked = !isCompleted || !paymentReady || !hasEarning || cashDebt;
  const status = alreadyPaid
    ? 'Already paid'
    : hasBatch
      ? 'In batch'
      : eligible
        ? 'Batch ready'
        : blocked
          ? 'Blocked'
          : 'Review';
  const tone = alreadyPaid || hasBatch || eligible ? 'pill-success' : blocked ? 'pill-danger' : 'pill-warn';
  const summary = alreadyPaid
    ? 'This booking earning has already been paid or settled. Keep it visible as audit evidence.'
    : hasBatch
      ? `This booking earning is linked to payout batch ${shortId(booking.earning?.payoutBatchId ?? '')}.`
      : eligible
        ? 'This booking can be included in the next configured payout batch once finance chooses the batch cycle.'
        : 'This booking should stay out of payout batches until the blocked or review items below are resolved.';

  const rows: BookingPayoutBatchEligibilityRow[] = [
    {
      label: 'Completed service',
      status: isCompleted ? 'Ready' : 'Not ready',
      detail: `Booking status is ${booking.status}.`,
      operatorRule: 'Only completed work enters partner payout batches.',
      href: '#flow',
      className: isCompleted ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: isCompleted ? 'pill-success' : 'pill-danger',
    },
    {
      label: 'Payment settlement',
      status: paymentReady ? 'Ready' : booking.payment?.status ?? 'Missing',
      detail: booking.payment
        ? `${booking.payment.method} / ${booking.payment.status} / ${financeTrace.customerPrice}`
        : 'No payment row is linked to this booking.',
      operatorRule: 'Non-cash bookings need captured payment; cash bookings use wallet debt controls.',
      href: '#payment',
      className: paymentReady ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: paymentReady ? 'pill-success' : 'pill-danger',
    },
    {
      label: 'Earning ledger',
      status: hasEarning ? (alreadyPaid ? 'Paid' : booking.earning?.status ?? 'Created') : 'Missing',
      detail: hasEarning
        ? `${money(booking.earning?.netAmount, booking.earning?.currency)} / payout batch ${
            booking.earning?.payoutBatchId ? shortId(booking.earning.payoutBatchId) : 'not assigned'
          }`
        : 'No partner earning exists for this completed booking.',
      operatorRule: 'The payout batch consumes the earning ledger, not the booking amount directly.',
      href: '/earnings',
      className: hasEarning ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: hasEarning ? 'pill-success' : 'pill-danger',
    },
    {
      label: 'Tax, fee, and wallet logs',
      status:
        hasTaxLog && hasPlatformFeeLog && hasWalletLedger
          ? 'Complete'
          : `${[hasTaxLog, hasPlatformFeeLog, hasWalletLedger].filter(Boolean).length}/3`,
      detail: `Tax ${hasTaxLog ? 'saved' : 'missing'} / platform fee ${
        hasPlatformFeeLog ? 'saved' : 'missing'
      } / wallet ${hasWalletLedger ? 'saved' : 'missing'}.`,
      operatorRule:
        'Batch release should preserve withholding, HANDS fee, and wallet evidence for audit review.',
      href: '#finance',
      className: hasTaxLog && hasPlatformFeeLog && hasWalletLedger ? 'ops-task-done' : 'ops-task-warning',
      pillClass: hasTaxLog && hasPlatformFeeLog && hasWalletLedger ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Cash fee debt',
      status: cashDebt ? 'Blocked' : 'Clear',
      detail: cashDebt
        ? `${financeTrace.walletLedger}. Settle company fee debt before batch release.`
        : `Wallet impact ${financeTrace.walletLedger}.`,
      operatorRule:
        'Negative wallet partners can see the marketplace list, but cannot participate in marketplace bookings or receive payout release until deposit or admin offset evidence clears the debt.',
      href: cashDebt ? '/cash-settlements' : '#finance',
      className: cashDebt ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebt ? 'pill-danger' : 'pill-success',
    },
    {
      label: 'Closeout readiness',
      status: closeoutReady ? 'Ready' : `${closeoutReadiness.openItems.length + financeFlags.length} item(s)`,
      detail: closeoutReady
        ? closeoutReadiness.helper
        : [
            ...closeoutReadiness.openItems.map((item) => item.label),
            ...financeFlags.map((flag) => flag.title),
          ].join(', '),
      operatorRule: 'Use retained booking evidence before including the earning in settlement batches.',
      href: '#booking-closeout-readiness',
      className: closeoutReady ? 'ops-task-done' : 'ops-task-warning',
      pillClass: closeoutReady ? 'pill-success' : 'pill-warn',
    },
  ];

  return { status, tone, summary, rows };
}

type BookingActionEvidenceGateRow = {
  action: string;
  status: string;
  evidence: string;
  operatorRule: string;
  href: string;
  className: BookingCloseoutChecklistItem['className'];
  pillClass: BookingCloseoutChecklistItem['pillClass'];
};

function buildBookingFinalGateReason({
  booking,
  financeTrace,
}: {
  booking: AdminBookingDetail;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
}): {
  title: string;
  detail: string;
  operatorRule: string;
  className: BookingCloseoutChecklistItem['className'];
  pillClass: BookingCloseoutChecklistItem['pillClass'];
} {
  const customerChoiceCandidates =
    booking.participants?.filter(
      (participant) =>
        isCustomerSelectableParticipantForFinalChoice(participant, bookingPreferredProviderId(booking)) ||
        participant.status === 'SELECTED',
    )
      .length ?? 0;
  const selected = Boolean(booking.selectedProvider);
  const marketplaceParticipants =
    booking.participants?.filter((participant) => participant.providerProfile?.id !== booking.preferredProvider?.id)
      .length ?? 0;

  if (bookingCashDebtNeedsSettlement(booking)) {
    return {
      title: 'Wallet debt gate',
      detail: `${financeTrace.walletLedger}. Partner can see marketplace requests, but marketplace participation and payout release wait for settlement or approved offset.`,
      operatorRule:
        'Collect the HANDS cash fee deposit or approve a documented offset before reopening marketplace participation or payout release.',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  if (!booking.addressSnapshot) {
    return {
      title: 'Address snapshot gate',
      detail:
        'BookingAddressSnapshot is missing. Marketplace radius and dispatch evidence should use the confirmed service address, not a moving customer GPS point.',
      operatorRule: 'Repair or verify the booking address snapshot before relying on distance-based dispatch decisions.',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  if (
    booking.status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    isPreferredAwaitingDecision(booking)
  ) {
    return {
      title: 'First-pick window',
      detail:
        'The preferred partner is still inside the first response window. Nearby marketplace partners can express intent, but the system must not auto-assign anyone.',
      operatorRule:
        'Watch partner alerts and response time; customer final choice remains the only final matching action.',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    };
  }

  if (booking.status === 'OPEN_MATCHING' && customerChoiceCandidates > 0 && !selected) {
    return {
      title: 'Customer final choice',
      detail: `${customerChoiceCandidates} partner(s) can be selected by the customer, including ${marketplaceParticipants} marketplace participant(s). Chat opens only after the customer chooses the final partner.`,
      operatorRule: 'Support the customer decision step; do not assign a partner automatically.',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    };
  }

  if (booking.status === 'OPEN_MATCHING') {
    return {
      title: 'Partner supply wait',
      detail:
        'No participating/accepted partner is selectable yet. Check 10km marketplace eligibility, partner app inbox, push delivery, and latest saved locations.',
      operatorRule: 'Use factual alert, location, and participant records before support follow-up.',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    };
  }

  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return {
      title: 'Chat handoff gate',
      detail:
        'Customer final partner is locked, but the chat room is missing. Service coordination should wait until chat is repaired.',
      operatorRule: 'Repair chat creation or open a support record before partner movement handoff.',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  if (booking.status === 'MATCHED') {
    return {
      title: 'Final partner locked',
      detail:
        'Customer final choice is complete. Continue monitoring chat, partner location handoff, and service progress.',
      operatorRule: 'Use the retained booking record as source of truth for operations follow-up.',
      className: 'ops-task-done',
      pillClass: 'pill-success',
    };
  }

  return {
    title: 'Gate clear',
    detail:
      'No marketplace or payout blocker is visible on this booking. Continue using factual payment, chat, location, and closeout records.',
    operatorRule: 'Keep manual outcomes evidence-based; do not introduce judgment labels or automatic partner assignment.',
    className: 'ops-task-done',
    pillClass: 'pill-success',
  };
}

function buildBookingActionEvidenceGate({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  refundLedgerRows,
  operatorNoteLines,
  closeoutReadiness,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
}) {
  const paymentStatus = booking.payment?.status ?? 'NONE';
  const paymentIsTerminal = isTerminalPayment(paymentStatus);
  const paymentActionAvailable = Boolean(booking.payment?.id) && !paymentIsTerminal;
  const paymentSyncAvailable = Boolean(booking.payment?.providerRef) && !paymentIsTerminal;
  const hasAddressSnapshot = Boolean(booking.addressSnapshot);
  const hasChatArchive = Boolean(booking.chatRoom);
  const hasDecisionEvidence = Boolean(
    messages.length ||
    latestLocation ||
    notificationTrace.rows.length ||
    operatorNoteLines.length ||
    booking.auditLogs?.length,
  );
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const closeoutAvailable = canCloseoutCompletedBooking(booking);
  const expireAvailable = canExpireBooking(booking.status);
  const noShowAvailable = canMarkNoShow(booking.status);
  const completedWorkEvidenceReady =
    booking.status === 'COMPLETED' && hasChatArchive && paymentStatus === 'AUTHORIZED';
  const manualOutcomeEvidenceLabel = [
    messages.length ? `${messages.length} chat message(s)` : null,
    latestLocation ? `location ${formatDate(latestLocation.recordedAt)}` : null,
    notificationTrace.rows.length ? `${notificationTrace.rows.length} alert row(s)` : null,
    operatorNoteLines.length ? `${operatorNoteLines.length} operator note(s)` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const rows: BookingActionEvidenceGateRow[] = [
    {
      action: 'Payment sync',
      status: paymentSyncAvailable ? 'Available' : 'Locked',
      evidence: booking.payment?.providerRef
        ? `${paymentStatus} / provider ref ${booking.payment.providerRef}`
        : `Payment status is ${paymentStatus}; no gateway reference is linked.`,
      operatorRule:
        'Sync only when a provider reference exists and the payment is not already captured, released, or refunded.',
      href: '#booking-ops',
      className: paymentSyncAvailable ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: paymentSyncAvailable ? 'pill-success' : 'pill-neutral',
    },
    {
      action: 'Payment capture',
      status: completedWorkEvidenceReady
        ? 'Evidence ready'
        : paymentStatus === 'AUTHORIZED'
          ? 'Review first'
          : 'Locked',
      evidence:
        paymentStatus === 'AUTHORIZED'
          ? `${booking.status} / ${hasChatArchive ? 'chat archived' : 'chat missing'} / ${closeoutReadiness.status}`
          : `Payment status is ${paymentStatus}. Capture is only relevant for active authorization.`,
      operatorRule:
        'Capture after completed service evidence is retained; do not capture from payment status alone.',
      href: '#booking-ops',
      className: completedWorkEvidenceReady
        ? 'ops-task-done'
        : paymentStatus === 'AUTHORIZED'
          ? 'ops-task-warning'
          : 'ops-task-blocked',
      pillClass: completedWorkEvidenceReady
        ? 'pill-success'
        : paymentStatus === 'AUTHORIZED'
          ? 'pill-warn'
          : 'pill-neutral',
    },
    {
      action: 'Release or refund',
      status: paymentActionAvailable ? (hasDecisionEvidence ? 'Evidence ready' : 'Needs evidence') : 'Locked',
      evidence: paymentActionAvailable
        ? `${paymentStatus} / ${refundLedgerRows.length} refund row(s) / ${
            manualOutcomeEvidenceLabel || 'no retained decision evidence yet'
          }`
        : `${paymentStatus} payment cannot be released or refunded from this state.`,
      operatorRule:
        'Use cancellation, expiry, no-show, chat, alert, location, note, and refund rows before money outcome changes.',
      href: '#booking-ops',
      className: paymentActionAvailable
        ? hasDecisionEvidence
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: paymentActionAvailable
        ? hasDecisionEvidence
          ? 'pill-success'
          : 'pill-warn'
        : 'pill-neutral',
    },
    {
      action: 'Cash fee settlement',
      status: cashDebt ? 'Evidence required' : booking.payment?.method === 'CASH' ? 'Clear' : 'Not cash',
      evidence: cashDebt
        ? 'Partner cash fee debt is active. Operator needs deposit or admin offset evidence before clearing.'
        : booking.payment?.method === 'CASH'
          ? 'Cash booking has no active negative wallet block.'
          : `${booking.payment?.method ?? 'NONE'} booking path.`,
      operatorRule:
        'Negative wallet partners can view marketplace requests, but participation and payout actions wait for settlement evidence.',
      href: cashDebt ? '/cash-settlements' : '#finance',
      className: cashDebt ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebt
        ? 'pill-danger'
        : booking.payment?.method === 'CASH'
          ? 'pill-success'
          : 'pill-neutral',
    },
    {
      action: 'Completed closeout',
      status: closeoutAvailable ? closeoutReadiness.status : completedCloseoutLabel(booking),
      evidence: closeoutReadiness.openItems.length
        ? closeoutReadiness.openItems.map((item) => item.label).join(', ')
        : closeoutReadiness.helper,
      operatorRule:
        'Run completed closeout only after payment, earning, tax, platform fee, wallet, and chat records align.',
      href: '#completed-closeout',
      className: closeoutAvailable
        ? closeoutReadiness.tone === 'pill-danger'
          ? 'ops-task-blocked'
          : 'ops-task-warning'
        : 'ops-task-done',
      pillClass: closeoutAvailable
        ? toChecklistPillClass(closeoutReadiness.tone)
        : completedCloseoutTone(booking),
    },
    {
      action: 'Expire matching',
      status: expireAvailable ? (hasAddressSnapshot ? 'Ready' : 'Needs address') : 'Locked',
      evidence: expireAvailable
        ? `${hasAddressSnapshot ? 'Address snapshot ready' : 'Address snapshot missing'} / expires ${formatDate(
            booking.expiresAt,
          )}`
        : `Current status is ${booking.status}.`,
      operatorRule:
        'Expire only when the customer should stop waiting and payment release/review path is understood.',
      href: '#matching-expiry',
      className: expireAvailable
        ? hasAddressSnapshot
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: expireAvailable ? (hasAddressSnapshot ? 'pill-success' : 'pill-warn') : 'pill-neutral',
    },
    {
      action: 'No-show handling',
      status: noShowAvailable ? (hasDecisionEvidence ? 'Evidence ready' : 'Needs evidence') : 'Locked',
      evidence: noShowAvailable
        ? manualOutcomeEvidenceLabel || 'No chat, alert, location, note, or audit evidence is loaded yet.'
        : `Current status is ${booking.status}.`,
      operatorRule:
        'No-show is an admin evidence decision. Record what happened with factual service context only.',
      href: '#no-show-handling',
      className: noShowAvailable
        ? hasDecisionEvidence
          ? 'ops-task-done'
          : 'ops-task-warning'
        : 'ops-task-blocked',
      pillClass: noShowAvailable ? (hasDecisionEvidence ? 'pill-success' : 'pill-warn') : 'pill-neutral',
    },
  ];

  const needsEvidence = rows.filter((row) => row.className === 'ops-task-warning').length;
  const blocked = rows.filter((row) => row.className === 'ops-task-blocked').length;

  return {
    status: needsEvidence
      ? `${needsEvidence} need evidence`
      : blocked
        ? `${blocked} locked`
        : 'Evidence ready',
    tone: needsEvidence ? 'pill-warn' : blocked ? 'pill-neutral' : 'pill-success',
    rows,
  };
}

function bookingChatRepairNeedsOps(booking: AdminBookingDetail) {
  return buildBookingChatRepairNeedsOps({
    status: booking.status,
    hasChatRoom: Boolean(booking.chatRoom),
  });
}

function bookingChatRepairActionState(booking: AdminBookingDetail) {
  return buildBookingChatRepairActionState({
    status: booking.status,
    hasChatRoom: Boolean(booking.chatRoom),
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    hasSelectedPartner: Boolean(booking.selectedProvider),
  });
}

function bookingHandoffChecklist(
  booking: AdminBookingDetail,
  messageCount: number,
  latestLocation?: AdminLocationSnapshot,
) {
  const participantCount = booking.participants?.length ?? 0;
  const selectableCount =
    booking.participants?.filter(
      (participant) =>
        isCustomerSelectableParticipantForFinalChoice(participant, bookingPreferredProviderId(booking)) ||
        participant.status === 'SELECTED',
    )
      .length ?? 0;
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status} / ${money(booking.payment.amount, booking.payment.currency)}`
    : 'No payment record';
  const cashDebtLabel = bookingCashDebtNeedsSettlement(booking)
    ? 'Cash fee debt must be settled before the partner participates in marketplace demand again or receives payout release.'
    : 'No cash fee debt block on this booking.';
  const chatDetail = booking.chatRoom
    ? `${messageCount} retained message(s). Admin keeps the archive even if mobile hides chat after completion.`
    : 'No chat room is linked yet. Matched or active bookings should create one.';
  const locationDetail = latestLocation
    ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(booking)}`
    : 'No partner service location has been shared yet.';

  return [
    {
      id: 'booking-request',
      label: 'Request',
      title: bookingServiceOptionLabel(booking),
      detail: `${booking.status} / opened ${formatDate(booking.createdAt ?? booking.scheduledStartAt)} / ${bookingAddressSnapshotLabel(booking)}`,
      status: 'Booking facts',
      href: '#customer',
    },
    {
      id: 'partner-response',
      label: 'Partner',
      title: finalPartner ? providerName(finalPartner) : 'Waiting for partner response',
      detail: `${participantCount} participant record(s) / ${selectableCount} customer-selectable. The customer remains the final decision maker.`,
      status: 'Customer shortlist',
      href: '#participants',
    },
    {
      id: 'customer-choice',
      label: 'Choice',
      title: booking.selectedProvider ? 'Final partner selected' : 'Customer choice pending',
      detail: booking.selectedProvider
        ? `${providerName(booking.selectedProvider)} is recorded as the final partner.`
        : 'Keep the customer waiting screen synced with participating/accepted partner options.',
      status: 'Customer screen',
      href: '#audit',
    },
    {
      id: 'chat-location',
      label: 'Chat',
      title: booking.chatRoom ? `Chat room ${shortId(booking.chatRoom.id)}` : 'Chat handoff pending',
      detail: `${chatDetail} ${locationDetail}`,
      status: 'Chat/location',
      href: '#structured-ops-status',
    },
    {
      id: 'finance-closeout',
      label: 'Finance',
      title: paymentLabel,
      detail: `${cashDebtLabel} ${booking.earning ? `Earning ledger: ${money(booking.earning.netAmount, booking.earning.currency)}.` : 'No earning ledger yet.'}`,
      status: 'Payment/wallet',
      href: '#finance',
    },
  ];
}

function bookingCloseoutReadiness({
  booking,
  financeFlags,
  latestLocation,
  messageCount,
  notificationCount,
}: {
  booking: AdminBookingDetail;
  financeFlags: AttentionFlag[];
  latestLocation?: AdminLocationSnapshot;
  messageCount: number;
  notificationCount: number;
}) {
  const terminalStatus = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(
    booking.status,
  );
  const activeStatus = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const hasAddress =
    Boolean(booking.addressSnapshot) || (booking.lat !== undefined && booking.lng !== undefined);
  const hasFinanceCloseout =
    booking.status !== 'COMPLETED' ||
    Boolean(
      booking.earning &&
      (booking.earning.taxLogs?.length ?? booking.taxLogs?.length ?? 0) > 0 &&
      (booking.earning.platformFeeLogs?.length ?? booking.platformFeeLogs?.length ?? 0) > 0 &&
      (booking.earning.walletLedgerEntries?.length ?? booking.walletLedgerEntries?.length ?? 0) > 0,
    );
  const paymentNeedsRelease = ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status);
  const paymentReady =
    !booking.payment ||
    (booking.status === 'COMPLETED'
      ? ['CAPTURED', 'PAID', 'SETTLED'].includes(booking.payment.status) || booking.payment.method === 'CASH'
      : paymentNeedsRelease
        ? ['RELEASED', 'REFUNDED', 'VOIDED', 'CANCELLED'].includes(booking.payment.status)
        : true);
  const cashDebtNeedsSettlement = bookingCashDebtNeedsSettlement(booking);
  const partnerChoiceReady =
    booking.status === 'CREATED' ||
    booking.status === 'OPEN_MATCHING' ||
    Boolean(booking.selectedProvider) ||
    ['CANCELLED', 'EXPIRED'].includes(booking.status);
  const chatReady = !activeStatus && !terminalStatus ? true : Boolean(booking.chatRoom);
  const locationReady = !activeStatus || Boolean(latestLocation);
  const auditReady = (booking.auditLogs?.length ?? 0) > 0 || (booking.opsTasks?.length ?? 0) > 0;

  const items = [
    {
      id: 'customer-record',
      label: 'Customer',
      status:
        booking.customerProfile?.id && hasAddress
          ? 'Customer and address linked'
          : 'Customer/address needs review',
      detail: `${booking.customerProfile?.user?.fullName ?? 'Customer'} / ${
        booking.customerProfile?.user?.phone ?? 'No phone'
      } / ${hasAddress ? bookingAddressSnapshotLabel(booking) : 'No service address snapshot'}`,
      owner: 'Support',
      href: '#customer',
      ready: Boolean(booking.customerProfile?.id && hasAddress),
    },
    {
      id: 'partner-choice',
      label: 'Partner',
      status: partnerChoiceReady ? 'Partner choice state explainable' : 'Final partner missing',
      detail: finalPartner
        ? `${providerName(finalPartner)} / ${booking.participants?.length ?? 0} participant(s)`
        : 'Customer has not selected a final partner yet.',
      owner: 'Dispatch',
      href: '#participants',
      ready: partnerChoiceReady,
    },
    {
      id: 'chat-archive',
      label: 'Chat',
      status: chatReady ? 'Chat archive state valid' : 'Chat room missing',
      detail: booking.chatRoom
        ? `${messageCount} retained message(s). Admin archive remains after mobile chat is hidden.`
        : 'Matched, active, or closed service records should keep the admin transcript.',
      owner: 'Support',
      href: '#chat',
      ready: chatReady,
    },
    {
      id: 'payment-state',
      label: 'Payment',
      status: paymentReady ? 'Payment path aligned' : 'Payment closeout pending',
      detail: booking.payment
        ? `${booking.payment.method} / ${booking.payment.status} / ${money(
            booking.payment.amount,
            booking.payment.currency,
          )}`
        : 'No payment record is linked.',
      owner: 'Finance',
      href: '#payment',
      ready: paymentReady,
    },
    {
      id: 'finance-ledger',
      label: 'Finance',
      status: hasFinanceCloseout && financeFlags.length === 0 ? 'Ledger complete' : 'Ledger needs review',
      detail:
        booking.status === 'COMPLETED'
          ? `Earning ${booking.earning?.status ?? 'missing'} / ${financeFlags.length} finance check(s).`
          : 'Finance ledger becomes mandatory after completion.',
      owner: 'Finance',
      href: '#finance',
      ready: hasFinanceCloseout && financeFlags.length === 0,
    },
    {
      id: 'cash-settlement',
      label: 'Cash',
      status: cashDebtNeedsSettlement ? 'Cash fee settlement required' : 'No cash fee block',
      detail: cashDebtNeedsSettlement
        ? 'Partner cash collection created company-fee debt; settle before marketplace participation or payout release.'
        : 'No negative cash-fee wallet block is active for this booking.',
      owner: 'Finance',
      href: '#finance',
      ready: !cashDebtNeedsSettlement,
    },
    {
      id: 'location-signal',
      label: 'Location',
      status: locationReady ? 'Location state valid' : 'Partner location missing',
      detail: latestLocation
        ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(booking)}`
        : 'No partner service pin is saved for this active booking.',
      owner: 'Dispatch',
      href: '#location',
      ready: locationReady,
    },
    {
      id: 'alerts-audit',
      label: 'Audit',
      status: auditReady ? 'Operator trail available' : 'No operator trail yet',
      detail: `${notificationCount} notification(s), ${booking.auditLogs?.length ?? 0} audit row(s), ${
        booking.opsTasks?.length ?? 0
      } structured task(s).`,
      owner: 'Operations',
      href: '#booking-activity',
      ready: auditReady,
    },
  ];

  const openItems = items.filter((item) => !item.ready);
  const status =
    openItems.length === 0
      ? 'Ready'
      : terminalStatus || booking.status === 'COMPLETED'
        ? `${openItems.length} closeout item(s)`
        : `${openItems.length} monitor item(s)`;
  const tone =
    openItems.length === 0
      ? 'pill-success'
      : openItems.some((item) => ['Payment', 'Finance', 'Cash'].includes(item.label))
        ? 'pill-warn'
        : 'pill-info';

  return {
    status,
    tone,
    helper:
      openItems.length === 0
        ? 'All factual records needed for this booking stage are aligned.'
        : `${openItems.map((item) => item.label).join(', ')} should be checked before the next handoff or closeout.`,
    items,
    openItems,
  };
}

type BookingOperatingTimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  at?: string | null;
  status: string;
};

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
  const items: BookingOperatingTimelineItem[] = [];
  const pendingItems: BookingOperatingTimelineItem[] = [];
  const seenItemIds = new Set<string>();
  const paymentCurrency = booking.payment?.currency ?? booking.earning?.currency ?? 'VND';

  const addItem = (item: BookingOperatingTimelineItem) => {
    if (seenItemIds.has(item.id)) {
      return;
    }
    seenItemIds.add(item.id);
    if (item.at) {
      items.push(item);
      return;
    }
    pendingItems.push(item);
  };

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
        ? `First-pick partner: ${providerName(booking.preferredProvider)}.`
        : 'No first-pick partner is attached to this booking.',
      at: booking.openedAt ?? booking.createdAt,
      status: 'Open',
    });
  }

  if (booking.expiresAt) {
    addItem({
      id: `expires-${booking.id}`,
      type: 'TTL',
      title: 'Auto-close timer set',
      detail: 'If no final partner is selected before this time, operations should close or follow up.',
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
      title: 'Customer final partner selected',
      detail: `${providerName(booking.selectedProvider)} is the final customer-selected partner.`,
      at: booking.updatedAt,
      status: 'Selected',
    });
  } else if (booking.status === 'OPEN_MATCHING') {
    addItem({
      id: `selection-pending-${booking.id}`,
      type: 'SELECT',
      title: 'Customer final choice pending',
      detail: 'Customer still needs to select one final partner before chat handoff.',
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
      title: 'Latest partner location shared',
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
      detail: 'Active service state has no linked partner location snapshot.',
      status: 'Pending',
    });
  }

  if (booking.payment) {
    addItem({
      id: `payment-${booking.payment.id ?? booking.id}`,
      type: 'PAY',
      title: `Payment ${booking.payment.status}`,
      detail: `${booking.payment.method} / ${money(booking.payment.amount, paymentCurrency)} / ${
        booking.payment.providerRef ?? 'no provider ref'
      }`,
      at: booking.updatedAt ?? booking.createdAt,
      status: booking.payment.status,
    });
  }

  if (booking.earning) {
    addItem({
      id: `earning-${booking.earning.id}`,
      type: 'EARN',
      title: `Partner earning ${booking.earning.status}`,
      detail: `${money(booking.earning.netAmount, booking.earning.currency)} net / ${money(
        booking.earning.platformFee,
        booking.earning.currency,
      )} platform fee.`,
      at: booking.earning.createdAt,
      status: booking.earning.status,
    });
  }

  const refundRows = new Map<string, BookingTimelineRefundRow>();
  for (const refund of [...(booking.refunds ?? []), ...(booking.payment?.refunds ?? [])]) {
    refundRows.set(refund.id, refund);
  }
  for (const refund of refundRows.values()) {
    const refundReason = 'reason' in refund ? refund.reason : null;

    addItem({
      id: `refund-${refund.id}`,
      type: 'REFUND',
      title: `Refund ${refund.status}`,
      detail: `${money(refund.amount, paymentCurrency)} / ${refundReason ?? 'No reason note'}`,
      at: refund.createdAt,
      status: refund.status,
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    addItem({
      id: `cash-debt-${booking.earning?.id ?? booking.id}`,
      type: 'CASH',
      title: 'Cash fee debt blocks marketplace participation',
      detail:
        'Partner collected customer cash. Company fee must be deposited or admin-offset before marketplace participation and payout release.',
      at: booking.earning?.createdAt ?? booking.updatedAt ?? booking.createdAt,
      status: 'Settlement needed',
    });
  }

  const taxLogs = new Map<string, AdminProviderTaxLog>();
  for (const taxLog of [...(booking.taxLogs ?? []), ...(booking.earning?.taxLogs ?? [])]) {
    taxLogs.set(taxLog.id, taxLog);
  }
  for (const taxLog of taxLogs.values()) {
    addItem({
      id: `tax-${taxLog.id}`,
      type: 'TAX',
      title: 'Tax withholding logged',
      detail: `${money(taxLog.withholdingAmount, taxLog.currency)} withheld from ${money(
        taxLog.taxableAmount,
        taxLog.currency,
      )} taxable amount.`,
      at: taxLog.createdAt,
      status: 'Logged',
    });
  }

  const feeLogs = new Map<string, AdminProviderPlatformFeeLog>();
  for (const feeLog of [...(booking.platformFeeLogs ?? []), ...(booking.earning?.platformFeeLogs ?? [])]) {
    feeLogs.set(feeLog.id, feeLog);
  }
  for (const feeLog of feeLogs.values()) {
    addItem({
      id: `fee-${feeLog.id}`,
      type: 'FEE',
      title: 'Platform fee logged',
      detail: `${money(feeLog.platformFeeAmount, feeLog.currency)} company fee from ${money(
        feeLog.grossAmount,
        feeLog.currency,
      )} gross.`,
      at: feeLog.createdAt,
      status: 'Logged',
    });
  }

  const walletEntries = new Map<string, AdminProviderWalletLedgerEntry>();
  for (const walletEntry of [
    ...(booking.walletLedgerEntries ?? []),
    ...(booking.earning?.walletLedgerEntries ?? []),
  ]) {
    walletEntries.set(walletEntry.id, walletEntry);
  }
  for (const walletEntry of walletEntries.values()) {
    addItem({
      id: `wallet-${walletEntry.id}`,
      type: 'WALLET',
      title: `Wallet ${walletEntry.type}`,
      detail: `${money(walletEntry.amount, walletEntry.currency)} / ${walletEntry.notes ?? walletEntry.sourceKey}`,
      at: walletEntry.createdAt,
      status: walletEntry.type,
    });
  }

  if (booking.review) {
    addItem({
      id: `review-${booking.review.id}`,
      type: 'REVIEW',
      title: 'Customer service feedback submitted',
      detail: `Saved numeric input ${booking.review.rating}/5.`,
      at: booking.review.createdAt,
      status: 'Feedback',
    });
  }

  const relatedNotifications = notifications
    .filter((notification) => notificationDataBookingId(notification) === booking.id)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt))
    .slice(0, 4);
  for (const notification of relatedNotifications) {
    addItem({
      id: `notification-${notification.id}`,
      type: 'ALERT',
      title: marketplaceDisplayText(notification.title),
      detail: `${humanizeNotificationType(notification.type)} / ${marketplaceDisplayText(
        compactActivityText(notification.body, 90),
      )}`,
      at: notification.createdAt,
      status: 'Alert',
    });
  }

  for (const task of booking.opsTasks ?? []) {
    addItem({
      id: `ops-task-${task.id}`,
      type: 'OPS',
      title: `${humanizeAuditAction(task.type)} / ${task.status}`,
      detail: task.note ?? 'Operator checklist task updated.',
      at: task.updatedAt,
      status: task.status,
    });
  }

  for (const log of (booking.auditLogs ?? []).slice(0, 6)) {
    addItem({
      id: `audit-${log.id}`,
      type: 'AUDIT',
      title: humanizeAuditAction(log.action),
      detail: auditMetadataSummary(log.metadata) || log.target,
      at: log.createdAt,
      status: 'Audit',
    });
  }

  const sorted = items.sort((left, right) => safeTime(right.at) - safeTime(left.at));
  return [...sorted.slice(0, 18), ...pendingItems].slice(0, 22);
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
              nextAction: 'Ask partner to share current location',
              nextDetail: 'The booking is active but no partner location snapshot is linked yet.',
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
          : 'No customer or partner message yet.',
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
            ? 'No partner movement snapshot yet.'
            : `${providerLocationMetricHelper(booking)} / ${coordinateLabel(latestLocation?.lat, latestLocation?.lng)}`,
      },
      {
        label: 'Movement rows',
        value: `${locationRows.length}`,
        helper: locationRows.length
          ? 'Saved partner location snapshots linked to this booking.'
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

function bookingOperatingSnapshot({
  booking,
  addressLine,
  addressPin,
  messageCount,
  notificationCount,
}: {
  booking: AdminBookingDetail;
  addressLine: string;
  addressPin: string;
  messageCount: number;
  notificationCount: number;
}) {
  const participants = booking.participants ?? [];
  const customerChoiceCandidates = participants.filter(
    (participant) =>
      isCustomerSelectableParticipantForFinalChoice(participant, bookingPreferredProviderId(booking)) ||
      participant.status === 'SELECTED',
  );
  const preferredState = preferredParticipantState(booking);
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status}`
    : 'No payment';
  const walletLabel = bookingCashDebtNeedsSettlement(booking)
    ? `Debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`
    : booking.earning
      ? `Ledger ${money(booking.earning.netAmount, booking.earning.currency)}`
      : 'No earning yet';
  const finalPartnerLabel = booking.selectedProvider
    ? providerName(booking.selectedProvider)
    : booking.status === 'MATCHED'
      ? providerName(booking.preferredProvider)
      : 'Customer selection pending';
  const addressSource = booking.addressSnapshot
    ? `${booking.addressSnapshot.source ?? 'booking_confirmation'} / ${formatDate(booking.addressSnapshot.createdAt)}`
    : 'Stored booking address';
  const next = bookingOperatingNextAction(booking);
  const checks = bookingAttentionFlags(booking);
  const tone = checks.some((check) => check.severity === 'high')
    ? 'pill-danger'
    : checks.length
      ? 'pill-warn'
      : booking.status === 'COMPLETED'
        ? 'pill-success'
        : 'pill-info';

  return {
    status: booking.status,
    tone,
    noteClassName: checks.some((check) => check.severity === 'high')
      ? 'ops-task-danger'
      : checks.length
        ? 'ops-task-warning'
        : 'ops-task-info',
    nextAction: next.title,
    nextDetail: next.detail,
    href: next.href,
    hrefLabel: next.hrefLabel,
    facts: [
      {
        label: 'Confirmed address',
        value: compactActivityText(addressLine, 42),
        helper: `${addressPin} / ${addressSource}`,
      },
      {
        label: 'Customer final choice',
        value: compactActivityText(finalPartnerLabel, 34),
        helper: booking.selectedProvider
          ? 'Customer-selected final partner is recorded.'
          : 'Customer choice remains the source of truth.',
      },
      {
        label: 'Preferred partner',
        value: compactActivityText(providerName(booking.preferredProvider), 34),
        helper: preferredState
          ? `${preferredState.status} / ${distanceLabel(preferredState.distanceMeters)}`
          : booking.preferredProvider
            ? 'Waiting for first partner response.'
            : 'No first-pick partner on this booking.',
      },
      {
        label: 'Marketplace supply',
        value: `${participants.length} participant record(s) / ${customerChoiceCandidates.length} selectable`,
        helper: 'Partners can participate while the customer waits.',
      },
      {
        label: 'Chat and alerts',
        value: booking.chatRoom ? `${messageCount} message(s)` : 'Chat not ready',
        helper: `${notificationCount} notification record(s) linked to this booking.`,
      },
      {
        label: 'Payment and wallet',
        value: paymentLabel,
        helper: walletLabel,
      },
    ],
  };
}

function bookingOperatingNextAction(booking: AdminBookingDetail) {
  if (bookingCashDebtNeedsSettlement(booking)) {
    return {
      title: 'Settle cash fee debt',
      detail:
        'Partner collected cash. Confirm company fee deposit or admin offset before marketplace participation or payout release resumes.',
      href: '#finance',
      hrefLabel: 'Open finance',
    };
  }
  if (booking.status === 'OPEN_MATCHING') {
    return {
      title: booking.participants?.length
        ? 'Monitor customer final selection'
        : 'Monitor partner participation',
      detail: booking.participants?.length
        ? 'Participating or accepted partners should be visible to the customer so the customer can choose the final partner.'
        : 'Keep the first-pick window and marketplace participation visible until a partner participates or the booking expires.',
      href: '#alerts',
      hrefLabel: 'Open matching',
    };
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return {
      title: 'Create or recover chat room',
      detail: 'A matched booking must have chat before partner handoff and service coordination.',
      href: '#chat',
      hrefLabel: 'Open chat',
    };
  }
  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    return {
      title: 'Track handoff and service progress',
      detail: 'Confirm chat, partner location record, arrival state, and service lifecycle events.',
      href: '#location',
      hrefLabel: 'Open location',
    };
  }
  if (booking.status === 'COMPLETED') {
    return {
      title: 'Reconcile completed booking',
      detail: 'Confirm payment capture, wallet ledger, tax/fee logs, review state, and closeout notes.',
      href: '#finance',
      hrefLabel: 'Open finance',
    };
  }
  if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) {
    return {
      title: 'Close customer and finance loop',
      detail: 'Confirm refund/release, customer communication, partner communication, and audit note.',
      href: '#payment',
      hrefLabel: 'Open payment',
    };
  }
  return {
    title: 'Continue normal monitoring',
    detail: 'No immediate operator action is required beyond timeline and communication review.',
    href: '#booking-activity',
    hrefLabel: 'Open timeline',
  };
}

function bookingAttentionFlags(booking: AdminBookingDetail): AttentionFlag[] {
  const paymentStatus = booking.payment?.status;
  const status = booking.status;
  const participantCount = booking.participants?.length ?? 0;
  const messages = booking.chatRoom?.messages ?? [];
  const openedAge = minutesSince(booking.openedAt ?? booking.createdAt);
  const expired = booking.expiresAt ? new Date(booking.expiresAt).getTime() < Date.now() : false;
  const activeWithLocationNeed = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status);

  return buildBookingAttentionFlags({
    bookingStatus: status,
    hasPayment: Boolean(booking.payment),
    paymentStatus,
    paymentProviderRef: booking.payment?.providerRef ?? null,
    cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    cashDebtPartnerLabel: providerName(booking.selectedProvider ?? booking.preferredProvider),
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
  const providerPin = latest ? coordinateLabel(latest.lat, latest.lng) : 'No partner pin';
  const distanceMeters = latest
    ? approximateDistanceMeters(
        booking.addressSnapshot?.latitude ?? booking.lat,
        booking.addressSnapshot?.longitude ?? booking.lng,
        latest.lat,
        latest.lng,
      )
    : null;
  const provider = booking.selectedProvider ?? booking.preferredProvider;

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
        : 'Ask partner to share current location from chat.',
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
      helper: 'Calculated from the service address pin and latest partner pin. It is not a route or ETA.',
      tone: distanceMeters === null ? 'pill-info' : distanceMeters > 5000 ? 'pill-warn' : 'pill-success',
    },
    {
      label: 'Service contact',
      value: provider?.user?.phone ?? 'No partner phone',
      helper: provider
        ? `${providerName(provider)} is the current handoff partner.`
        : 'No partner assigned yet.',
      tone: provider ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} message(s)` : 'Not ready',
      helper: booking.chatRoom
        ? `Room ${booking.chatRoom.id}`
        : 'Chat opens after partner selection/service start.',
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
  return buildBookingFlowStages({
    createdAtLabel: formatDate(booking.createdAt),
    openedAtLabel: booking.openedAt ? formatDate(booking.openedAt) : null,
    hasOpened: Boolean(booking.openedAt),
    hasPreferredPartner: Boolean(booking.preferredProvider),
    partnerDecisionLabel: bookingPartnerDecisionLabel(booking, bookingPreferredProviderId(booking)),
    partnerHint: bookingPartnerHint(booking),
    participantCount: booking.participants?.length ?? 0,
    bookingStatus: booking.status,
    selectedPartnerLabel: providerName(booking.selectedProvider),
    hasSelectedPartner: Boolean(booking.selectedProvider),
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
  return buildBookingFinanceFlags({
    bookingStatus: booking.status,
    paymentAmount,
    servicePrice,
    hasEarning: Boolean(booking.earning),
    earningNetAmount: booking.earning?.netAmount ?? null,
    partnerLabel: providerName(booking.selectedProvider ?? booking.preferredProvider),
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
