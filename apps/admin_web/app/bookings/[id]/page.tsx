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
import { type OperatorCommand } from './booking-operator-actions';
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
import { bookingChatLifecycle } from '../../../lib/booking-chat-lifecycle';
import { bookingClosureSummary } from '../../../lib/booking-closure-summary';
import { bookingFinanceFlags as buildBookingFinanceFlags } from '../../../lib/booking-finance-flags';
import {
  canCloseoutCompletedBooking,
  completedCloseoutLabel,
  completedCloseoutTone,
} from '../../../lib/booking-closeout-policy';
import { bookingOpsBadges } from '../../../lib/booking-ops-badges';
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
  const operatorNoteLines = bookingOperatorNoteLines(booking);
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
  const chatEvidenceDecisionBoard = bookingChatEvidenceDecisionBoard({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    operatorNoteLines,
  });
  const manualDecisionReadiness = bookingManualDecisionReadiness({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    refundLedgerRows,
    operatorNoteLines,
    closeoutReadiness,
  });
  const decisionEvidenceGuardrails = bookingDecisionEvidenceGuardrails({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    financeTrace,
    refundLedgerRows,
    operatorNoteLines,
    closeoutReadiness,
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
  const decisionNotePresets = bookingDecisionNotePresets({
    booking,
    messages,
    latestLocation,
    notificationTrace,
    refundLedgerRows,
    operatorNoteLines,
    closeoutReadiness,
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
  const commands: OperatorCommand[] = [];
  const add = (command: OperatorCommand) => commands.push(command);
  const activeStatus = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  const finalPartner = booking.selectedProvider ?? booking.preferredProvider;
  const partnerLabel = finalPartner ? providerName(finalPartner) : 'No final partner';

  if (booking.status === 'OPEN_MATCHING') {
    add({
      id: 'matching-watch',
      label: 'MATCH',
      title: 'Monitor customer choice',
      detail: `${booking.participants?.length ?? 0} partner(s) are in the customer choice list. Customer still chooses the final partner.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#participants', label: 'Open shortlist' },
    });
  }

  if (booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0) {
    add({
      id: 'partner-supply',
      label: 'SUPPLY',
      title: 'Check nearby partner supply',
      detail:
        'No partner participation is recorded yet. Review marketplace-ready partners and notification delivery before widening operations policy.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#backup-supply', label: 'Open supply' },
    });
  }

  if (activeStatus && !booking.chatRoom) {
    add({
      id: 'chat-repair',
      label: 'CHAT',
      title: 'Repair chat handoff',
      detail:
        'A matched or active booking should have a retained chat room for customer support and admin review.',
      owner: 'Support operator',
      tone: 'pill-danger',
      action: { type: 'link', href: '/bookings?view=chat-repair', label: 'Open queue' },
    });
  } else if (booking.chatRoom && activeStatus && messages.length === 0) {
    add({
      id: 'chat-first-contact',
      label: 'CHAT',
      title: 'Monitor first chat contact',
      detail:
        'Chat is ready but no message has been sent yet. Add a note if either side reports uncertainty.',
      owner: 'Support operator',
      tone: 'pill-info',
      action: {
        type: 'note',
        label: 'Log watch',
        preset: 'Chat is ready but quiet; support is monitoring first customer/partner contact.',
      },
    });
  }

  if (activeStatus && !latestLocation) {
    add({
      id: 'location-request',
      label: 'LOC',
      title: 'Ask partner to share location',
      detail: `${partnerLabel} has not shared a saved current service pin for this active booking.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'task', taskType: 'LOCATION_CHECKED', taskStatus: 'BLOCKED', label: 'Flag location' },
    });
  } else if (latestLocation && latestProviderLocationFreshness(booking) !== 'recent') {
    add({
      id: 'location-stale',
      label: 'LOC',
      title: 'Refresh stale partner location',
      detail: providerLocationMetricHelper(booking),
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'task', taskType: 'LOCATION_CHECKED', taskStatus: 'PENDING', label: 'Reset check' },
    });
  }

  if (booking.payment?.status === 'AUTHORIZED' && booking.status === 'COMPLETED') {
    add({
      id: 'capture-payment',
      label: 'PAY',
      title: 'Capture completed service payment',
      detail: 'Service is completed but payment is still authorized. Review capture before payout closeout.',
      owner: 'Payments operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#payment', label: 'Open payment' },
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    add({
      id: 'cash-debt',
      label: 'CASH',
      title: 'Settle partner cash fee debt',
      detail: 'Cash service fee debt blocks future partner acceptance until the company fee is settled.',
      owner: 'Finance operator',
      tone: 'pill-danger',
      action: { type: 'link', href: '#finance', label: 'Open finance' },
    });
  }

  if (canCloseoutCompletedBooking(booking)) {
    add({
      id: 'completed-closeout',
      label: 'CLOSE',
      title: 'Reconcile completed booking',
      detail:
        'Ensure capture, earning, tax, platform fee, and wallet ledger records exist before leaving the booking.',
      owner: 'Finance operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#completed-closeout', label: 'Open closeout' },
    });
  }

  if (canExpireBooking(booking.status)) {
    add({
      id: 'expire-matching',
      label: 'TTL',
      title: 'Expire if matching window is over',
      detail: 'Use this only when the customer should stop waiting and payment hold needs release.',
      owner: 'Dispatch operator',
      tone: 'pill-info',
      action: { type: 'link', href: '#matching-expiry', label: 'Open expiry' },
    });
  }

  if (canMarkNoShow(booking.status)) {
    add({
      id: 'no-show-option',
      label: 'NO-SHOW',
      title: 'No-show action available',
      detail:
        'Use only after confirming the customer or partner did not proceed and communication is retained.',
      owner: 'Support operator',
      tone: 'pill-neutral',
      action: { type: 'link', href: '#no-show-handling', label: 'Open action' },
    });
  }

  const pendingTasks = bookingOpsTaskCards(booking).filter((task) => task.status !== 'DONE');
  if (pendingTasks.length > 0) {
    add({
      id: 'ops-task-next',
      label: 'TASK',
      title: `Finish ${pendingTasks[0].label.toLowerCase()}`,
      detail: pendingTasks[0].helper,
      owner: 'Operations',
      tone: pendingTasks[0].status === 'BLOCKED' ? 'pill-danger' : 'pill-info',
      action: {
        type: 'task',
        taskType: pendingTasks[0].type,
        taskStatus: pendingTasks[0].status === 'BLOCKED' ? 'PENDING' : 'DONE',
        label: pendingTasks[0].status === 'BLOCKED' ? 'Reopen' : 'Mark done',
      },
    });
  }

  if (commands.length === 0) {
    add({
      id: 'normal-monitoring',
      label: 'OK',
      title: 'Normal monitoring',
      detail:
        'No immediate operator action is active. Keep the record visible until the next booking transition.',
      owner: 'Operations',
      tone: 'pill-success',
      action: {
        type: 'note',
        label: 'Log check',
        preset: 'Booking reviewed; no immediate operator action needed at this time.',
      },
    });
  }

  const urgentCount = commands.filter(
    (command) => command.tone === 'pill-danger' || command.tone === 'pill-warn',
  ).length;
  const labels = [
    {
      label: 'Active commands',
      value: String(commands.length),
      helper: urgentCount ? `${urgentCount} need same-shift attention.` : 'No urgent handling step.',
    },
    {
      label: 'Partner',
      value: partnerLabel,
      helper: finalPartner ? 'Preferred/final partner context.' : 'No partner is selected yet.',
    },
    {
      label: 'Chat',
      value: booking.chatRoom ? 'Retained' : 'Missing',
      helper: `${messages.length} message(s) in admin archive.`,
    },
    {
      label: 'Attention flags',
      value: String(attentionFlags.length),
      helper: 'Factual handling checks only.',
    },
  ];

  return {
    status: urgentCount ? `${urgentCount} action(s)` : 'Monitor',
    tone: urgentCount ? 'pill-warn' : 'pill-success',
    labels,
    commands: commands.slice(0, 8),
  };
}

function bookingOperatorActionMatrix(booking: AdminBookingDetail) {
  const paymentStatus = booking.payment?.status ?? 'NONE';
  const paymentIsTerminal = isTerminalPayment(paymentStatus);
  const paymentActionAvailable = Boolean(booking.payment?.id) && !paymentIsTerminal;
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const closeoutAvailable = canCloseoutCompletedBooking(booking);
  const expireAvailable = canExpireBooking(booking.status);
  const noShowAvailable = canMarkNoShow(booking.status);
  const refundRows = bookingRefundRows(booking);

  return [
    {
      action: 'Payment sync',
      available: Boolean(booking.payment?.providerRef) && !paymentIsTerminal,
      status: Boolean(booking.payment?.providerRef) && !paymentIsTerminal ? 'Available' : 'Locked',
      tone: Boolean(booking.payment?.providerRef) && !paymentIsTerminal ? 'pill-info' : 'pill-neutral',
      evidence: booking.payment?.providerRef
        ? `${paymentStatus} / provider ref ${booking.payment.providerRef}`
        : 'No payment provider reference to sync.',
      operatorRule:
        'Use for provider-gateway reconciliation only. Do not change customer outcome from sync alone.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Capture payment',
      available: paymentActionAvailable && paymentStatus === 'AUTHORIZED',
      status: paymentActionAvailable && paymentStatus === 'AUTHORIZED' ? 'Available' : 'Locked',
      tone: paymentActionAvailable && paymentStatus === 'AUTHORIZED' ? 'pill-warn' : 'pill-neutral',
      evidence:
        paymentStatus === 'AUTHORIZED'
          ? `${booking.status} / ${money(booking.payment?.amount, booking.payment?.currency)} authorized`
          : `Payment status is ${paymentStatus}.`,
      operatorRule:
        'Capture only after service completion is confirmed by retained booking, chat, and closeout evidence.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Release or refund',
      available: paymentActionAvailable,
      status: paymentActionAvailable ? 'Available' : 'Locked',
      tone: paymentActionAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: refundRows.length
        ? `${refundRows.length} refund row(s) already recorded.`
        : `${booking.status} / payment ${paymentStatus}.`,
      operatorRule:
        'Release or refund only after cancellation, expiry, or no-show evidence has been reviewed.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Settle cash fee debt',
      available: cashDebt,
      status: cashDebt ? 'Available' : 'Locked',
      tone: cashDebt ? 'pill-danger' : 'pill-neutral',
      evidence: cashDebt
        ? `${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)} keeps marketplace participation and payout release blocked.`
        : booking.payment?.method === 'CASH'
          ? 'Cash booking has no active negative wallet block.'
          : `${booking.payment?.method ?? 'No method'} booking.`,
      operatorRule:
        'Settle only when company fee deposit or admin offset evidence is available for this cash booking.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Reconcile completed booking',
      available: closeoutAvailable,
      status: closeoutAvailable ? 'Available' : 'Locked',
      tone: closeoutAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: completedCloseoutLabel(booking),
      operatorRule:
        'Run after payment, earning, tax, platform fee, wallet, and chat archive records are aligned.',
      href: '#completed-closeout',
      hrefLabel: 'Open closeout',
    },
    {
      action: 'Expire matching',
      available: expireAvailable,
      status: expireAvailable ? 'Available' : 'Locked',
      tone: expireAvailable ? 'pill-info' : 'pill-neutral',
      evidence: expireAvailable
        ? `Open matching can be expired. Timer ${formatDate(booking.expiresAt)}.`
        : `Current status is ${booking.status}.`,
      operatorRule:
        'Expire only when the customer should stop waiting and the payment hold can be released or reviewed.',
      href: '#matching-expiry',
      hrefLabel: 'Open expiry',
    },
    {
      action: 'Mark no-show',
      available: noShowAvailable,
      status: noShowAvailable ? 'Available' : 'Locked',
      tone: noShowAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: noShowAvailable
        ? 'Use after communication and service movement are reviewed.'
        : `Current status is ${booking.status}.`,
      operatorRule:
        'Mark no-show only from factual chat, alert, location, and operator-note evidence. Keep the record descriptive.',
      href: '#no-show-handling',
      hrefLabel: 'Open no-show',
    },
    {
      action: 'Add operator note',
      available: true,
      status: 'Available',
      tone: 'pill-info',
      evidence: `${bookingOperatorNoteLines(booking).length} note line(s) currently retained.`,
      operatorRule:
        'Use notes to record what happened, who was contacted, and what evidence supports the next decision.',
      href: '#operator-notes',
      hrefLabel: 'Open notes',
    },
  ];
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
  const closeoutLabel =
    closeoutReadiness.openItems.length > 0
      ? `${closeoutReadiness.openItems.length} item(s)`
      : closeoutReadiness.status;

  return {
    status: primaryCommand.tone === 'pill-success' ? 'Monitoring' : 'Action first',
    tone: primaryCommand.tone,
    rows: [
      {
        label: 'First action',
        value: primaryCommand.title,
        helper: `${primaryCommand.owner}: ${primaryCommand.detail}`,
      },
      {
        label: 'Next operator step',
        value: nextAction.title,
        helper: nextAction.detail,
      },
      {
        label: 'Customer',
        value: customerName,
        helper: `${customerPhone} / ${bookingAddressSnapshotLabel(booking)}`,
      },
      {
        label: 'Partner state',
        value: partnerLabel,
        helper: `${participantCount} participant record(s) / ${bookingPartnerHint(booking)}`,
      },
      {
        label: 'Chat archive',
        value: booking.chatRoom ? 'Ready' : 'Missing',
        helper: `${messageCount} retained message(s). Admin keeps chat history after service closeout.`,
      },
      {
        label: 'Location record',
        value: locationLabel,
        helper: latestLocation
          ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${providerLocationMetricHelper(booking)}`
          : providerLocationMetricHelper(booking),
      },
      {
        label: 'Payment',
        value: paymentLabel,
        helper: bookingPaymentHint(booking, {
          cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
        }),
      },
      {
        label: 'Closeout',
        value: closeoutLabel,
        helper:
          financeFlags.length > 0
            ? `${financeFlags.length} finance check(s): ${financeFlags.map((flag) => flag.title).join(', ')}`
            : closeoutReadiness.helper,
      },
    ],
    steps: [
      {
        id: 'priority-command',
        label: '1',
        title: primaryCommand.title,
        detail: primaryCommand.detail,
        href: '#operator-command-queue',
        linkLabel: 'Open queue',
      },
      {
        id: 'priority-handoff',
        label: '2',
        title: finalPartner ? 'Confirm partner handoff' : 'Keep partner choice visible',
        detail: finalPartner
          ? `${providerName(finalPartner)} is linked. Confirm chat, service pin, and payment handoff are visible.`
          : 'Customer choice is still pending. Keep the shortlist, partner alerts, and marketplace window easy to audit.',
        href: '#booking-handoff-checklist',
        linkLabel: 'Open handoff',
      },
      {
        id: 'priority-closeout',
        label: '3',
        title: closeoutReadiness.status,
        detail: closeoutReadiness.helper,
        href: '#booking-closeout-readiness',
        linkLabel: 'Open closeout',
      },
    ],
  };
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
  const chatReady = Boolean(booking.chatRoom);
  const trail = locationTrail(booking);
  const failedAlerts = notificationTrace.rows.filter((row) => row.deliveryStatuses.includes('FAILED')).length;
  const evidenceCount =
    messages.length +
    trail.length +
    notificationTrace.rows.length +
    refundLedgerRows.length +
    operatorNoteLines.length +
    (booking.auditLogs?.length ?? 0);
  const hasDecisionEvidence =
    messages.length > 0 ||
    trail.length > 0 ||
    notificationTrace.rows.length > 0 ||
    operatorNoteLines.length > 0;
  const status = hasDecisionEvidence ? 'Evidence ready' : 'Needs evidence';
  const tone = hasDecisionEvidence ? 'pill-success' : 'pill-warn';
  const summary = hasDecisionEvidence
    ? `Admin can review ${evidenceCount} retained evidence item(s) before changing booking outcome.`
    : 'No chat, alert, location, or operator note evidence is attached yet; add a note before manual outcome changes.';

  return {
    status,
    tone,
    summary,
    metrics: [
      {
        label: 'Chat evidence',
        value: chatReady ? `${messages.length} message(s)` : 'No room',
        helper: chatReady
          ? 'Matched booking chat is retained in admin even after mobile closeout.'
          : 'Matched bookings should create a retained chat room before service handoff.',
      },
      {
        label: 'Location evidence',
        value: latestLocation ? formatDate(latestLocation.recordedAt) : `${trail.length} row(s)`,
        helper: latestLocation
          ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} latest partner pin.`
          : 'No partner pin is saved for this booking yet.',
      },
      {
        label: 'Payment evidence',
        value: booking.payment?.status ?? 'NONE',
        helper: `${booking.payment?.method ?? 'No method'} / ${money(
          booking.payment?.amount,
          booking.payment?.currency,
        )}`,
      },
      {
        label: 'Refund evidence',
        value: `${refundLedgerRows.length} refund row(s)`,
        helper: refundLedgerRows.length
          ? refundLedgerRows
              .map((row) => `${row.status} ${money(row.amount, row.payment?.currency ?? undefined)}`)
              .join(', ')
          : 'No refund row is attached to this booking.',
      },
      {
        label: 'Alert evidence',
        value: `${notificationTrace.rows.length} alert(s)`,
        helper: `${failedAlerts} failed delivery row(s), ${notificationTrace.backupBatches.length} marketplace batch(es).`,
      },
      {
        label: 'Operator note evidence',
        value: `${operatorNoteLines.length} note(s)`,
        helper:
          operatorNoteLines[operatorNoteLines.length - 1] ??
          'No internal note has been added for manual decision context.',
      },
    ],
    records: [
      {
        id: 'address-evidence',
        label: 'Address',
        title: 'Address evidence',
        detail: booking.addressSnapshot
          ? `Locked address snapshot: ${bookingAddressSnapshotLabel(booking)}.`
          : 'No immutable address snapshot is attached yet.',
        evidence: booking.addressSnapshot
          ? `Pin ${coordinateLabel(booking.addressSnapshot.latitude, booking.addressSnapshot.longitude)}`
          : 'Stored-address fallback or missing booking address needs operator review.',
        href: '#address-radius-contract',
      },
      {
        id: 'chat-evidence',
        label: 'Chat',
        title: 'Chat evidence',
        detail: chatReady
          ? `Room ${shortId(booking.chatRoom?.id ?? 'missing')} keeps ${messages.length} retained message(s).`
          : 'No retained chat room is attached.',
        evidence:
          messages.length > 0
            ? `Latest message: ${formatDate(messages[messages.length - 1]?.createdAt)}`
            : 'No chat message evidence.',
        href: '#chat',
      },
      {
        id: 'location-evidence',
        label: 'Location',
        title: 'Location evidence',
        detail: latestLocation
          ? `Latest partner pin is ${coordinateLabel(latestLocation.lat, latestLocation.lng)}.`
          : 'No partner location pin has been retained.',
        evidence: latestLocation
          ? `Recorded ${formatDate(latestLocation.recordedAt)}`
          : 'No location timestamp.',
        href: '#location',
      },
      {
        id: 'payment-evidence',
        label: 'Payment',
        title: 'Payment evidence',
        detail: `${booking.payment?.method ?? 'No method'} payment is ${booking.payment?.status ?? 'NONE'}.`,
        evidence: `${financeTrace.customerPrice} customer price / ${financeTrace.walletLedger} wallet impact.`,
        href: '#payment',
      },
      {
        id: 'refund-evidence',
        label: 'Refund',
        title: 'Refund evidence',
        detail: refundLedgerRows.length
          ? `${refundLedgerRows.length} refund row(s) are attached to this booking.`
          : 'No refund row is attached to this booking.',
        evidence: bookingRefundLedgerEvidence(booking),
        href: '#payment',
      },
      {
        id: 'alert-evidence',
        label: 'Alerts',
        title: 'Alert evidence',
        detail: `${notificationTrace.rows.length} notification row(s) and ${notificationTrace.backupBatches.length} marketplace batch(es).`,
        evidence: failedAlerts
          ? `${failedAlerts} failed delivery row(s)`
          : 'No failed delivery row in this packet.',
        href: '#alerts',
      },
      {
        id: 'note-evidence',
        label: 'Notes',
        title: 'Operator note evidence',
        detail: operatorNoteLines.length
          ? 'Internal support notes are attached to this booking.'
          : 'No internal support note has been added yet.',
        evidence:
          operatorNoteLines[operatorNoteLines.length - 1] ??
          'Use operator notes before manual cancellation, no-show, or refund decisions.',
        href: '#operator-notes',
      },
      {
        id: 'ops-evidence',
        label: 'Ops',
        title: 'Operations evidence',
        detail: `${booking.opsTasks?.length ?? 0} task row(s), ${booking.auditLogs?.length ?? 0} audit row(s).`,
        evidence:
          operatorNoteLines[operatorNoteLines.length - 1] ??
          'Use structured ops status and audit rows before manual outcome changes.',
        href: '#structured-ops-status',
      },
      {
        id: 'audit-evidence',
        label: 'Audit',
        title: 'Audit evidence',
        detail: `${booking.auditLogs?.length ?? 0} audit row(s), ${bookingActivityRecords.length} timeline event(s).`,
        evidence: bookingActivityRecords[0]
          ? `Latest event: ${bookingActivityRecords[0].title} / ${formatDate(bookingActivityRecords[0].at)}`
          : 'No timeline event retained.',
        href: '#booking-activity',
      },
    ],
  };
}

function bookingDecisionEvidenceGuardrails({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  financeTrace,
  refundLedgerRows,
  operatorNoteLines,
  closeoutReadiness,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  financeTrace: ReturnType<typeof bookingFinanceTrace>;
  refundLedgerRows: BookingRefundLedgerRow[];
  operatorNoteLines: string[];
  closeoutReadiness: ReturnType<typeof bookingCloseoutReadiness>;
}) {
  const chatRequired = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
  const hasAddress = Boolean(booking.addressSnapshot);
  const hasFinalPartner = Boolean(booking.selectedProvider);
  const hasChatRoom = Boolean(booking.chatRoom);
  const hasChatContext = messages.length > 0;
  const hasMovementContext = Boolean(latestLocation);
  const hasAlertContext = notificationTrace.rows.length > 0;
  const hasNoteContext = operatorNoteLines.length > 0;
  const hasOpsTrail = (booking.opsTasks?.length ?? 0) > 0 || (booking.auditLogs?.length ?? 0) > 0;
  const hasPayment = Boolean(booking.payment);
  const hasCloseoutBlockers = closeoutReadiness.openItems.length > 0;
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const financeRows =
    (booking.platformFeeLogs?.length ?? 0) +
    (booking.taxLogs?.length ?? 0) +
    (booking.walletLedgerEntries?.length ?? 0) +
    (booking.earning?.platformFeeLogs?.length ?? 0) +
    (booking.earning?.taxLogs?.length ?? 0) +
    (booking.earning?.walletLedgerEntries?.length ?? 0);

  return [
    {
      id: 'required-address',
      title: 'Required: address snapshot',
      scope: 'Booking address is the source of truth for marketplace distance and support review.',
      status: hasAddress ? 'Ready' : 'Needs repair',
      tone: hasAddress ? 'pill-success' : 'pill-danger',
      evidence: hasAddress
        ? `${bookingAddressSnapshotLabel(booking)} / ${coordinateLabel(
            booking.addressSnapshot?.latitude,
            booking.addressSnapshot?.longitude,
          )}`
        : 'No BookingAddressSnapshot is attached.',
      nextStep: hasAddress
        ? 'Use this address for partner radius, support, and settlement review.'
        : 'Repair or attach address evidence before relying on distance or closeout decisions.',
      href: '#address-radius-contract',
    },
    {
      id: 'required-final-partner',
      title: 'Required: customer final partner choice',
      scope: 'HANDS does not auto-assign; customer choice creates the final handoff.',
      status: hasFinalPartner ? 'Final partner saved' : 'Customer choice pending',
      tone: hasFinalPartner ? 'pill-success' : booking.status === 'OPEN_MATCHING' ? 'pill-info' : 'pill-warn',
      evidence: hasFinalPartner
        ? providerName(booking.selectedProvider)
        : `${booking.participants?.length ?? 0} marketplace participant(s) / preferred ${providerName(
            booking.preferredProvider,
          )}`,
      nextStep: hasFinalPartner
        ? 'Confirm chat, location, and payment handoff.'
        : 'Keep the customer selection state visible; do not auto-select a partner.',
      href: '#participants',
    },
    {
      id: 'required-chat',
      title: 'Required after match: retained chat',
      scope: 'Matched bookings need customer-partner chat; admin keeps the archive after mobile closeout.',
      status: hasChatRoom ? 'Archived' : chatRequired ? 'Repair needed' : 'Locked until match',
      tone: hasChatRoom ? 'pill-success' : chatRequired ? 'pill-danger' : 'pill-info',
      evidence: hasChatRoom
        ? `Room ${shortId(booking.chatRoom?.id ?? '')} / ${messages.length} message(s)`
        : chatRequired
          ? 'Matched or service-stage booking has no retained room.'
          : 'Chat opens only after final partner selection.',
      nextStep: hasChatRoom
        ? 'Use the retained transcript for support and outcome review.'
        : chatRequired
          ? 'Repair the chat handoff before service coordination or money actions.'
          : 'Wait for customer final partner selection.',
      href: '#chat',
    },
    {
      id: 'supporting-context',
      title: 'Supporting: communication and movement context',
      scope:
        'Chat messages, partner pin, alerts, and notes explain what happened without judging either side.',
      status:
        hasChatContext || hasMovementContext || hasAlertContext || hasNoteContext
          ? 'Context loaded'
          : 'Needs factual note',
      tone:
        hasChatContext || hasMovementContext || hasAlertContext || hasNoteContext
          ? 'pill-success'
          : 'pill-warn',
      evidence: [
        `${messages.length} message(s)`,
        latestLocation ? `location ${formatDate(latestLocation.recordedAt)}` : 'no partner pin',
        `${notificationTrace.rows.length} alert row(s)`,
        `${operatorNoteLines.length} note(s)`,
      ].join(' / '),
      nextStep:
        hasChatContext || hasMovementContext || hasAlertContext || hasNoteContext
          ? 'Review the factual context before outcome changes.'
          : 'Add a factual operator note before no-show, refund, or closure handling.',
      href: '#booking-chat-evidence-decision-board',
    },
    {
      id: 'finance-payment',
      title: 'Finance: payment and refund path',
      scope: 'Payment, refund, release, and capture actions must match the booking outcome state.',
      status: hasPayment ? (booking.payment?.status ?? 'Payment row') : 'No payment row',
      tone: hasPayment ? 'pill-info' : 'pill-warn',
      evidence: hasPayment
        ? `${booking.payment?.method ?? 'UNKNOWN'} / ${money(booking.payment?.amount, booking.payment?.currency)} / ${
            refundLedgerRows.length
          } refund row(s)`
        : 'No payment record is attached.',
      nextStep: hasPayment
        ? 'Use payment status with chat, notes, and closeout state before money actions.'
        : 'Create or inspect payment state before finance closeout.',
      href: '#payment',
    },
    {
      id: 'finance-cash-debt',
      title: 'Finance: cash fee debt gate',
      scope:
        'Cash bookings can create partner fee debt; negative wallet blocks marketplace participation and payout release.',
      status: cashDebt
        ? 'Settlement required'
        : booking.payment?.method === 'CASH'
          ? 'Cash clear'
          : 'Not cash',
      tone: cashDebt ? 'pill-danger' : booking.payment?.method === 'CASH' ? 'pill-success' : 'pill-neutral',
      evidence:
        booking.payment?.method === 'CASH'
          ? `${financeTrace.platformFee} HANDS fee / ${financeTrace.withholding} withholding / ${financeTrace.walletLedger}`
          : `${booking.payment?.method ?? 'No method'} payment path`,
      nextStep: cashDebt
        ? 'Record verified company deposit or approved admin offset before clearing the block.'
        : 'No cash-fee settlement action is needed from this booking state.',
      href: cashDebt ? '/cash-settlements' : '#finance',
    },
    {
      id: 'finance-closeout',
      title: 'Finance: completion closeout ledger',
      scope: 'Completed service closeout should align earning, fee, tax, wallet, and payment rows.',
      status: hasCloseoutBlockers ? `${closeoutReadiness.openItems.length} item(s) open` : 'Aligned',
      tone: hasCloseoutBlockers ? 'pill-warn' : 'pill-success',
      evidence: hasCloseoutBlockers
        ? closeoutReadiness.openItems.map((item) => item.label).join(', ')
        : `${financeRows} finance ledger row(s) / ${financeTrace.providerPayout} partner payout`,
      nextStep: hasCloseoutBlockers
        ? 'Clear the listed records before completed-service closeout.'
        : 'Finance records are aligned for this booking stage.',
      href: '#completed-closeout',
    },
    {
      id: 'ops-trail',
      title: 'Operations: task and audit trail',
      scope: 'Structured tasks and audit rows preserve who changed what and why.',
      status: hasOpsTrail ? 'Trail retained' : 'No ops trail',
      tone: hasOpsTrail ? 'pill-success' : 'pill-warn',
      evidence: `${booking.opsTasks?.length ?? 0} task row(s) / ${booking.auditLogs?.length ?? 0} audit row(s)`,
      nextStep: hasOpsTrail
        ? 'Use the trail to explain the current booking state.'
        : 'Add a task or note before manual outcome handling.',
      href: '#booking-activity',
    },
  ];
}

function bookingChatEvidenceDecisionBoard({
  booking,
  messages,
  latestLocation,
  notificationTrace,
  operatorNoteLines,
}: {
  booking: AdminBookingDetail;
  messages: AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  operatorNoteLines: string[];
}) {
  const chatRequired = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
  const chatRoomReady = Boolean(booking.chatRoom);
  const latestMessage = messages[messages.length - 1];
  const alertCount = notificationTrace.rows.length;
  const noteCount = operatorNoteLines.length;
  const hasContextEvidence =
    messages.length > 0 || Boolean(latestLocation) || alertCount > 0 || noteCount > 0;
  const mobileHidden = TERMINAL_BOOKING_STATUSES.has(booking.status) && chatRoomReady;
  const status = chatRoomReady
    ? hasContextEvidence
      ? 'Chat evidence ready'
      : 'Chat room quiet'
    : chatRequired
      ? 'Chat repair needed'
      : 'Chat locked until match';
  const tone = chatRoomReady
    ? hasContextEvidence
      ? 'pill-success'
      : 'pill-warn'
    : chatRequired
      ? 'pill-danger'
      : 'pill-info';
  const summary = chatRoomReady
    ? mobileHidden
      ? 'This booking can hide chat in mobile after closeout, but admin keeps the retained transcript for operations review.'
      : 'This booking has an admin-retained chat room for service handoff and operations review.'
    : chatRequired
      ? 'A final partner exists or service stage has started, but no retained chat room is attached yet.'
      : 'Customer and partner chat opens only after the customer final partner selection.';

  return {
    status,
    tone,
    summary,
    metrics: [
      {
        label: 'Chat room',
        value: chatRoomReady ? shortId(booking.chatRoom?.id ?? '') : 'No room',
        helper: chatRoomReady
          ? `${messages.length} retained message(s) in admin archive.`
          : chatRequired
            ? 'Matched or active booking should have a retained chat room.'
            : 'Chat is not expected before final partner selection.',
      },
      {
        label: 'Latest message',
        value: latestMessage ? formatDate(latestMessage.createdAt) : 'No message',
        helper: latestMessage
          ? `${messageSenderLabel(latestMessage)}: ${compactActivityText(latestMessage.body, 90)}`
          : 'No customer or partner message has been retained yet.',
      },
      {
        label: 'Location handoff',
        value: latestLocation ? formatDate(latestLocation.recordedAt) : 'No pin',
        helper: latestLocation
          ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} latest partner pin.`
          : 'No partner location record is attached to this booking.',
      },
      {
        label: 'Alerts and notes',
        value: `${alertCount} alert(s) / ${noteCount} note(s)`,
        helper:
          operatorNoteLines[operatorNoteLines.length - 1] ??
          'Use alerts and operator notes to add context around chat silence or service issues.',
      },
    ],
    rows: [
      {
        lane: 'Chat room creation',
        scope: 'Final partner selection should create a retained customer-partner room.',
        state: chatRoomReady ? 'Archived' : chatRequired ? 'Repair needed' : 'Waiting for final choice',
        tone: chatRoomReady ? 'pill-success' : chatRequired ? 'pill-danger' : 'pill-info',
        record: chatRoomReady
          ? `Room ${shortId(booking.chatRoom?.id ?? '')} / ${messages.length} message(s).`
          : chatRequired
            ? 'No retained room attached to a matched or service-stage booking.'
            : 'No room expected before matching.',
        operatorUse: 'Repair a missing room before service coordination, refund review, or no-show decision.',
        href: chatRoomReady ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : '#chat',
      },
      {
        lane: 'Conversation evidence',
        scope: 'Messages explain what customer and partner actually communicated.',
        state: messages.length ? 'Messages retained' : chatRoomReady ? 'No messages yet' : 'No room',
        tone: messages.length ? 'pill-success' : chatRoomReady ? 'pill-warn' : 'pill-neutral',
        record: latestMessage
          ? `${messageSenderLabel(latestMessage)} / ${formatDate(latestMessage.createdAt)} / ${compactActivityText(
              latestMessage.body,
              100,
            )}`
          : 'No message body retained.',
        operatorUse:
          'Use the transcript before cancellation, no-show, payment, refund, or support messaging.',
        href: chatRoomReady ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : '#chat',
      },
      {
        lane: 'Movement evidence',
        scope: 'Partner location can support arrival, delay, or no-show context.',
        state: latestLocation ? 'Location retained' : 'No location',
        tone: latestLocation ? 'pill-info' : 'pill-warn',
        record: latestLocation
          ? `${coordinateLabel(latestLocation.lat, latestLocation.lng)} / ${formatDate(latestLocation.recordedAt)}`
          : 'No partner movement row is attached.',
        operatorUse:
          'Use movement context with chat and alerts; do not judge either side from one signal alone.',
        href: '#location',
      },
      {
        lane: 'Admin retained context',
        scope: 'Alerts, audit rows, and operator notes preserve support context after mobile chat closes.',
        state: hasContextEvidence ? 'Context loaded' : 'Needs operator note',
        tone: hasContextEvidence ? 'pill-success' : 'pill-warn',
        record: `${alertCount} notification row(s), ${booking.auditLogs?.length ?? 0} audit row(s), ${noteCount} note(s).`,
        operatorUse: 'Add a factual note when chat is quiet, missing, or insufficient for an outcome change.',
        href: '#operator-notes',
      },
    ],
  };
}

function bookingManualDecisionReadiness({
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
  const chatEvidence = messages.length > 0;
  const alertEvidence = notificationTrace.rows.length > 0;
  const noteEvidence = operatorNoteLines.length > 0;
  const movementEvidence = Boolean(latestLocation);
  const evidenceSummary = [
    chatEvidence ? `${messages.length} chat message(s)` : 'no chat messages',
    movementEvidence ? `location ${formatDate(latestLocation?.recordedAt)}` : 'no partner pin',
    alertEvidence ? `${notificationTrace.rows.length} alert row(s)` : 'no alert rows',
    noteEvidence ? `${operatorNoteLines.length} operator note(s)` : 'no operator notes',
  ].join(' / ');
  const decisionEvidenceReady = chatEvidence || movementEvidence || alertEvidence || noteEvidence;
  const paymentStatus = booking.payment?.status ?? 'NONE';
  const canReviewRefund =
    Boolean(booking.payment) && !['REFUNDED', 'RELEASED', 'FAILED', 'CANCELLED'].includes(paymentStatus);
  const cashDebt = bookingCashDebtNeedsSettlement(booking);
  const terminal = TERMINAL_BOOKING_STATUSES.has(booking.status);
  const closureTone = terminal
    ? booking.status === 'NO_SHOW'
      ? 'pill-danger'
      : 'pill-info'
    : 'pill-neutral';

  return [
    {
      lane: 'Customer cancellation or closure',
      scope: 'After direct matching, customer outcome changes are handled by operations evidence review.',
      status: terminal
        ? bookingClosureSummary(booking).status
        : decisionEvidenceReady
          ? 'Evidence ready'
          : 'Needs note',
      tone: terminal ? closureTone : decisionEvidenceReady ? 'pill-success' : 'pill-warn',
      evidence: evidenceSummary,
      operatorUse:
        'Use retained chat, alerts, location, and operator notes before changing customer-facing booking outcome.',
      href: '#booking-evidence-packet',
    },
    {
      lane: 'No-show decision',
      scope: 'No-show is an admin decision based on communication and service movement context.',
      status:
        booking.status === 'NO_SHOW'
          ? 'Marked no-show'
          : canMarkNoShow(booking.status)
            ? decisionEvidenceReady
              ? 'Ready to review'
              : 'Needs evidence'
            : 'Locked',
      tone:
        booking.status === 'NO_SHOW'
          ? 'pill-danger'
          : canMarkNoShow(booking.status)
            ? decisionEvidenceReady
              ? 'pill-info'
              : 'pill-warn'
            : 'pill-neutral',
      evidence: evidenceSummary,
      operatorUse: 'Check chat, alert delivery, partner location, and notes before using the no-show action.',
      href: '#no-show-handling',
    },
    {
      lane: 'Refund or payment release',
      scope: 'Payment outcome must match booking closure and customer communication.',
      status: refundLedgerRows.length
        ? `${refundLedgerRows.length} refund row(s)`
        : canReviewRefund
          ? 'Review payment'
          : 'No payment action',
      tone: refundLedgerRows.length ? 'pill-warn' : canReviewRefund ? 'pill-info' : 'pill-neutral',
      evidence: `${paymentStatus} / ${bookingRefundLedgerEvidence(booking)} / ${evidenceSummary}`,
      operatorUse:
        'Use payment status, refund rows, and evidence packet before release, refund, or capture decisions.',
      href: '#payment-actions',
    },
    {
      lane: 'Cash fee settlement',
      scope: 'Cash bookings can create partner fee debt; debt blocks marketplace participation and payout release until settled.',
      status: cashDebt
        ? 'Settlement required'
        : booking.payment?.method === 'CASH'
          ? 'Cash ledger clear'
          : 'Not cash',
      tone: cashDebt ? 'pill-danger' : booking.payment?.method === 'CASH' ? 'pill-success' : 'pill-neutral',
      evidence: bookingCashDebtNeedsSettlement(booking)
        ? `Debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`
        : `${booking.payment?.method ?? 'NONE'} / ${booking.payment?.status ?? 'NONE'}`,
      operatorUse:
        'If debt exists, confirm company fee deposit or admin offset before marketplace participation or payout release resumes.',
      href: '#finance',
    },
    {
      lane: 'Completed work closeout',
      scope: 'Completed bookings need payment, earning, tax, platform fee, and wallet records aligned.',
      status: closeoutReadiness.status,
      tone: closeoutReadiness.tone,
      evidence: closeoutReadiness.openItems.length
        ? closeoutReadiness.openItems.map((item) => item.label).join(', ')
        : closeoutReadiness.helper,
      operatorUse: 'Use this before weekly/monthly/admin-date settlement batches and payout reporting.',
      href: '#booking-closeout-readiness',
    },
  ];
}

function bookingDecisionNotePresets({
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
  const presets: Array<{
    id: string;
    label: string;
    title: string;
    detail: string;
    preset: string;
  }> = [];
  const activeOrTerminal = [
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
    'NO_SHOW',
  ].includes(booking.status);
  const moneyReviewNeeded =
    Boolean(booking.payment) &&
    (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status) ||
      refundLedgerRows.length > 0 ||
      booking.payment?.status === 'AUTHORIZED');

  if (activeOrTerminal && messages.length === 0) {
    presets.push({
      id: 'chat-empty-note',
      label: 'Chat',
      title: 'Chat evidence is empty',
      detail: 'Use when a manual outcome is being reviewed but no customer/partner messages are loaded.',
      preset:
        'Manual decision evidence note: chat archive is present/checked but has no retained customer or partner messages for this booking.',
    });
  }

  if (
    ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED', 'NO_SHOW'].includes(booking.status) &&
    !latestLocation
  ) {
    presets.push({
      id: 'location-empty-note',
      label: 'Location',
      title: 'Partner location is not retained',
      detail:
        'Use before arrival, no-show, service completion, or refund review when no partner pin is loaded.',
      preset:
        'Manual decision evidence note: no partner location snapshot is retained for this booking at the time of operator review.',
    });
  }

  if (activeOrTerminal && notificationTrace.rows.length === 0) {
    presets.push({
      id: 'alert-empty-note',
      label: 'Alerts',
      title: 'Notification trail is empty',
      detail: 'Use when partner/customer alert records are not available for this booking.',
      preset:
        'Manual decision evidence note: no customer or partner notification delivery rows are loaded for this booking.',
    });
  }

  if (operatorNoteLines.length === 0) {
    presets.push({
      id: 'operator-note-needed',
      label: 'Note',
      title: 'Operator context not recorded yet',
      detail: 'Use when support has reviewed the booking and needs to leave a factual handling note.',
      preset:
        'Operator context note: booking reviewed for current status, customer/partner handoff, chat, payment, and closeout readiness.',
    });
  }

  if (moneyReviewNeeded) {
    presets.push({
      id: 'payment-review-note',
      label: 'Money',
      title: 'Payment or refund review',
      detail: `${booking.payment?.method ?? 'NONE'} / ${booking.payment?.status ?? 'NONE'} / ${refundLedgerRows.length} refund row(s).`,
      preset: `Payment review note: booking ${booking.status}, payment ${
        booking.payment?.status ?? 'NONE'
      }, method ${booking.payment?.method ?? 'NONE'}, refund rows ${refundLedgerRows.length}.`,
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    presets.push({
      id: 'cash-debt-note',
      label: 'Cash',
      title: 'Cash fee settlement needed',
      detail:
        'Use when cash collection created a partner wallet debt that should be cleared by deposit or offset.',
      preset:
        'Cash settlement note: partner cash-fee debt remains open; marketplace participation and payout release should stay blocked until company deposit or admin offset is verified.',
    });
  }

  if (closeoutReadiness.openItems.length > 0) {
    presets.push({
      id: 'closeout-open-items-note',
      label: 'Closeout',
      title: 'Closeout has open items',
      detail: closeoutReadiness.openItems.map((item) => item.label).join(', '),
      preset: `Closeout readiness note: open factual items - ${closeoutReadiness.openItems
        .map((item) => item.label)
        .join(', ')}.`,
    });
  }

  if (presets.length === 0) {
    presets.push({
      id: 'evidence-reviewed-note',
      label: 'Clear',
      title: 'Evidence reviewed',
      detail: 'Use when the operator checked the factual evidence bundle and no immediate gap is visible.',
      preset:
        'Manual decision evidence note: chat, alerts, location, payment, and closeout records reviewed; no immediate evidence gap visible for current booking stage.',
    });
  }

  return presets;
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
  return (
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status) &&
    !booking.chatRoom
  );
}

function bookingChatRepairActionState(booking: AdminBookingDetail) {
  if (booking.chatRoom) {
    return {
      canSubmit: false,
      status: 'Chat ready',
      tone: 'pill-success',
      helper: `Room ${shortId(booking.chatRoom.id)} is retained for admin evidence.`,
    };
  }

  if (!bookingChatRepairNeedsOps(booking)) {
    return {
      canSubmit: false,
      status: 'Not required',
      tone: 'pill-neutral',
      helper: 'Chat opens after customer final partner selection.',
    };
  }

  if (!booking.selectedProvider) {
    return {
      canSubmit: false,
      status: 'Final partner missing',
      tone: 'pill-warn',
      helper: 'Repair is locked until the customer final partner selection is recorded.',
    };
  }

  return {
    canSubmit: true,
    status: 'Repair available',
    tone: 'pill-danger',
    helper: 'Final partner is recorded, but the retained chat room is missing.',
  };
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

type DispatchStep = {
  priority: 'Now' | 'Monitor' | 'Done';
  title: string;
  detail: string;
  owner: string;
  tone: string;
  actionHref?: string;
  actionLabel?: string;
};

function bookingAttentionFlags(booking: AdminBookingDetail): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  const paymentStatus = booking.payment?.status;
  const status = booking.status;
  const participantCount = booking.participants?.length ?? 0;
  const messages = booking.chatRoom?.messages ?? [];
  const openedAge = minutesSince(booking.openedAt ?? booking.createdAt);
  const expired = booking.expiresAt ? new Date(booking.expiresAt).getTime() < Date.now() : false;
  const activeWithLocationNeed = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status);

  if (status === 'CANCELLED' && booking.payment && !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')) {
    flags.push({
      severity: 'high',
      title: 'Cancelled payment unresolved',
      detail: `Booking is cancelled but payment is still ${paymentStatus}.`,
      action: 'Release the authorization or refund before closing the ticket.',
    });
  }

  if (status === 'EXPIRED' && booking.payment && !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')) {
    flags.push({
      severity: 'high',
      title: 'Expired payment unresolved',
      detail: `Booking is expired but payment is still ${paymentStatus}.`,
      action: 'Release the authorization or refund before closing the ticket.',
    });
  }

  if (status === 'NO_SHOW' && booking.payment && !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')) {
    flags.push({
      severity: 'high',
      title: 'No-show payment unresolved',
      detail: `Booking is no-show but payment is still ${paymentStatus}.`,
      action: 'Decide whether to release, refund, or keep the fee according to the active operating policy.',
    });
  }

  if (status === 'COMPLETED' && paymentStatus === 'AUTHORIZED') {
    flags.push({
      severity: 'high',
      title: 'Completed service still on hold',
      detail: 'The customer payment is authorized but not captured after completion.',
      action: 'Capture payment, or refund if there is an active dispute.',
    });
  }

  if (bookingCashDebtNeedsSettlement(booking)) {
    flags.push({
      severity: 'high',
      title: 'Cash fee debt blocks partner',
      detail: `${providerName(booking.selectedProvider ?? booking.preferredProvider)} collected cash and still owes ${money(
        Math.abs(booking.earning?.netAmount ?? 0),
        booking.earning?.currency,
      )}.`,
      action: 'Confirm the partner deposit or admin offset before marketplace participation or payout release resumes.',
    });
  }

  if (status === 'OPEN_MATCHING' && expired) {
    flags.push({
      severity: 'high',
      title: 'Matching window expired',
      detail: `The request expired at ${formatDate(booking.expiresAt)} but is still open.`,
      action: 'Expire the booking and release or refund the payment hold.',
    });
  }

  if (
    status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    participantCount === 0 &&
    openedAge !== null &&
    openedAge >= 10
  ) {
    flags.push({
      severity: 'medium',
      title: 'Preferred partner slow',
      detail: `${providerName(booking.preferredProvider)} has not responded after ${openedAge} minute(s).`,
      action: 'Encourage marketplace supply or contact the partner.',
    });
  }

  if (status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({
      severity: 'medium',
      title: 'No partner supply',
      detail: 'No partner participation is recorded for the request yet.',
      action: 'Check nearby online partners and consider operational outreach.',
    });
  }

  if (status === 'MATCHED' && !booking.chatRoom) {
    flags.push({
      severity: 'high',
      title: 'Matched without chat',
      detail: 'A partner is selected but no chat room exists.',
      action: 'Retry chat room creation before the service starts.',
    });
  }

  if (activeWithLocationNeed && !latestProviderLocation(booking)) {
    flags.push({
      severity: 'medium',
      title: 'No partner location record',
      detail: `Booking is ${status}, but the partner has not shared a live pin.`,
      action: 'Ask the partner to share current location from the Partner app.',
    });
  }

  if (
    activeWithLocationNeed &&
    latestProviderLocation(booking) &&
    latestProviderLocationFreshness(booking) !== 'recent'
  ) {
    flags.push({
      severity: 'medium',
      title: 'Partner location is stale',
      detail: `The latest partner pin is ${providerLocationMetricHelper(booking).toLowerCase()}.`,
      action: 'Ask the partner to share location again from the Partner app.',
    });
  }

  if (
    booking.chatRoom &&
    messages.length === 0 &&
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status)
  ) {
    flags.push({
      severity: 'low',
      title: 'Chat quiet',
      detail: 'Chat is ready but no messages have been exchanged.',
      action: 'Monitor for first contact if the customer reports uncertainty.',
    });
  }

  if (paymentStatus === 'AUTHORIZED' && !booking.payment?.providerRef) {
    flags.push({
      severity: 'medium',
      title: 'Payment reference missing',
      detail: 'The payment is authorized but has no gateway reference for reconciliation.',
      action: 'Sync payment before capture, release, or refund.',
    });
  }

  if ((booking.refunds?.length ?? 0) > 0 && paymentStatus && paymentStatus !== 'REFUNDED') {
    flags.push({
      severity: 'medium',
      title: 'Refund/payment mismatch',
      detail: `Refund records exist while payment status is ${paymentStatus}.`,
      action: 'Review gateway status and keep refund timeline aligned.',
    });
  }

  return flags;
}

function dispatchChecklist(booking: AdminBookingDetail): DispatchStep[] {
  const steps: DispatchStep[] = [];
  const flags = bookingAttentionFlags(booking);
  const provider = booking.selectedProvider ?? booking.preferredProvider;
  const providerPhone = provider?.user?.phone;
  const paymentHref = booking.payment?.id ? `/payments#payment-${booking.payment.id}` : undefined;
  const activeWithLocationNeed = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);

  if (
    booking.status === 'CANCELLED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(booking.payment.status)
  ) {
    steps.push({
      priority: 'Now',
      title: 'Resolve cancelled payment',
      detail: `Booking is cancelled but payment is still ${booking.payment.status}. Release the hold or refund before closing.`,
      owner: 'Payments operator',
      tone: 'pill-danger',
      actionHref: paymentHref,
      actionLabel: 'Open payment',
    });
  }

  if (booking.status === 'COMPLETED' && booking.payment?.status === 'AUTHORIZED') {
    steps.push({
      priority: 'Now',
      title: 'Capture completed service',
      detail: 'Service is complete while payment is still authorized. Capture it unless a dispute is active.',
      owner: 'Payments operator',
      tone: 'pill-danger',
      actionHref: paymentHref,
      actionLabel: 'Capture payment',
    });
  }

  if (
    booking.status === 'OPEN_MATCHING' &&
    booking.preferredProvider &&
    isPreferredAwaitingDecision(booking)
  ) {
    steps.push({
      priority: 'Now',
      title: 'Preferred partner response',
      detail: `${providerName(booking.preferredProvider)} has the first response window. Contact them if the customer is waiting too long.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call partner',
    });
  }

  if (booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0) {
    steps.push({
      priority: 'Monitor',
      title: 'Supply monitor',
      detail: 'No partner participation is recorded yet. Keep partner availability and notification delivery visible.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: '/partners',
      actionLabel: 'Open partners',
    });
  }

  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    steps.push({
      priority: 'Now',
      title: 'Recover chat room',
      detail: 'Partner is selected but no chat room exists. This can block service coordination.',
      owner: 'Support operator',
      tone: 'pill-danger',
    });
  }

  if (activeWithLocationNeed && !latestProviderLocation(booking)) {
    steps.push({
      priority: 'Now',
      title: 'Request partner location',
      detail: 'The partner has not shared a saved service pin for this active booking.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call partner',
    });
  }

  if (
    activeWithLocationNeed &&
    latestProviderLocation(booking) &&
    latestProviderLocationFreshness(booking) !== 'recent'
  ) {
    steps.push({
      priority: 'Monitor',
      title: 'Refresh stale location',
      detail: `${providerLocationMetricHelper(booking)}. Ask the partner to share current location again if the customer asks.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call partner',
    });
  }

  if (
    booking.chatRoom &&
    (booking.chatRoom.messages?.length ?? 0) === 0 &&
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)
  ) {
    steps.push({
      priority: 'Monitor',
      title: 'First chat contact',
      detail: 'Chat is ready but quiet. Monitor for first contact if the customer reports uncertainty.',
      owner: 'Customer support',
      tone: 'pill-info',
    });
  }

  if (booking.selectedProvider) {
    steps.push({
      priority: 'Done',
      title: 'Partner handoff locked',
      detail: `${providerName(booking.selectedProvider)} is the current final partner for this booking.`,
      owner: 'Dispatch operator',
      tone: 'pill-success',
      actionHref: providerPhone ? `tel:${providerPhone}` : undefined,
      actionLabel: 'Call partner',
    });
  }

  if (booking.chatRoom) {
    steps.push({
      priority: 'Done',
      title: 'Chat room ready',
      detail: `Room ${booking.chatRoom.id} has ${booking.chatRoom.messages?.length ?? 0} message(s).`,
      owner: 'Customer support',
      tone: 'pill-success',
    });
  }

  if (booking.payment) {
    steps.push({
      priority: isTerminalPayment(booking.payment.status) ? 'Done' : 'Monitor',
      title: 'Payment state',
      detail: bookingPaymentHint(booking, {
        cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
      }),
      owner: 'Payments operator',
      tone: isTerminalPayment(booking.payment.status) ? 'pill-success' : 'pill-info',
      actionHref: paymentHref,
      actionLabel: 'Open payment',
    });
  }

  if (steps.length === 0 || (flags.length === 0 && steps.every((step) => step.priority === 'Done'))) {
    steps.push({
      priority: 'Done',
      title: 'Normal monitoring',
      detail:
        'No same-shift operator action is active. Keep this booking visible until the next status transition.',
      owner: 'Operations',
      tone: 'pill-success',
    });
  }

  return steps;
}

function bookingOpsTaskCards(booking: AdminBookingDetail) {
  const taskByType = new Map((booking.opsTasks ?? []).map((task) => [task.type, task]));
  const definitions = [
    {
      type: 'CUSTOMER_CONTACTED',
      label: 'Customer contacted',
      helper:
        'Confirm the guest has been updated when waiting, switching partner, cancelling, or resolving payment.',
    },
    {
      type: 'PROVIDER_CONTACTED',
      label: 'Partner contacted',
      helper: 'Confirm the partner has been reached for response, location, arrival, or service progress.',
    },
    {
      type: 'LOCATION_CHECKED',
      label: 'Location checked',
      helper: 'Confirm saved customer/partner pins are reasonable. No route or continuous tracking is used.',
    },
    {
      type: 'PAYMENT_REVIEWED',
      label: 'Payment reviewed',
      helper: 'Confirm authorization, capture, release, cash fallback, or refund path before closing.',
    },
  ];

  return definitions.map((definition) => {
    const task = taskByType.get(definition.type);
    return {
      ...definition,
      status: task?.status ?? 'PENDING',
      note: task?.note?.trim() ? task.note.trim() : null,
      updatedBy: task
        ? `Updated ${formatDate(task.updatedAt)} by ${task.actor?.fullName ?? task.actor?.phone ?? 'Admin'}`
        : 'Not checked yet',
    };
  });
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
  return [
    {
      label: 'Created',
      value: formatDate(booking.createdAt),
      hint: 'Customer selected service and address.',
      done: true,
    },
    {
      label: 'Opened',
      value: booking.openedAt ? formatDate(booking.openedAt) : 'Not opened',
      hint: booking.preferredProvider
        ? 'Direct request sent to preferred partner.'
        : 'Open matching started.',
      done: Boolean(booking.openedAt),
    },
    {
      label: 'Partner reply',
      value: bookingPartnerDecisionLabel(booking, bookingPreferredProviderId(booking)),
      hint: bookingPartnerHint(booking),
      done:
        (booking.participants?.length ?? 0) > 0 ||
        ['MATCHED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status),
    },
    {
      label: 'Matched',
      value: providerName(booking.selectedProvider),
      hint: booking.chatRoom ? 'Chat room is ready.' : 'Waiting for final partner selection.',
      done: Boolean(booking.selectedProvider),
    },
    {
      label: 'Payment',
      value: booking.payment?.status ?? 'NONE',
      hint: bookingPaymentHint(booking, {
        cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
      }),
      done: ['CAPTURED', 'RELEASED', 'REFUNDED'].includes(booking.payment?.status ?? ''),
    },
  ];
}

function bookingOperatorNoteLines(booking: AdminBookingDetail) {
  return (booking.notes ?? '')
    .split('\n')
    .map((note) => note.trim())
    .filter(Boolean);
}

function canMarkNoShow(status: string) {
  return ['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED'].includes(status);
}

function canExpireBooking(status: string) {
  return status === 'OPEN_MATCHING';
}

function bookingFinanceSummaryCards(financeTrace: ReturnType<typeof bookingFinanceTrace>) {
  const walletHelper =
    financeTrace.paymentMethod === 'CASH'
      ? financeTrace.walletTotalAmount < 0
        ? 'Cash fee debt gates marketplace participation and payout release.'
        : 'Cash settlement ledger is not negative.'
      : 'Non-cash booking should create payout credit after completion.';

  return [
    {
      label: 'Customer charge',
      value: money(financeTrace.customerPriceAmount, financeTrace.currency),
      helper: financeTrace.serviceOption,
    },
    {
      label: 'Partner payout',
      value: money(financeTrace.providerPayoutAmount, financeTrace.currency),
      helper: financeTrace.earningStatus
        ? `Earning ${financeTrace.earningStatus}`
        : 'Projected from payout rule.',
    },
    {
      label: 'HANDS fee',
      value: money(financeTrace.platformFeeAmount, financeTrace.currency),
      helper: `${financeTrace.netHandsFee} before withholding impact.`,
    },
    {
      label: 'Tax withheld',
      value: money(financeTrace.withholdingAmount, financeTrace.currency),
      helper: financeTrace.withholding,
    },
    {
      label: 'Company net',
      value: money(financeTrace.companyFeeAfterTaxAmount, financeTrace.currency),
      helper: 'HANDS fee after VAT, other costs, and withholding.',
    },
    {
      label: 'Wallet impact',
      value: money(financeTrace.walletTotalAmount, financeTrace.currency),
      helper: walletHelper,
    },
  ];
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
  if (!booking.preferredProvider) {
    return false;
  }

  const participant = preferredParticipantState(booking);
  if (!participant) {
    return true;
  }

  return !['ACCEPTED', 'SELECTED', 'REJECTED'].includes(participant.status);
}

function providerLocationMetricValue(booking: AdminBookingDetail) {
  return bookingProviderLocationMetricValue(latestProviderLocationFreshness(booking));
}

function providerLocationMetricHelper(booking: AdminBookingDetail) {
  return bookingProviderLocationMetricHelper(latestProviderLocation(booking)?.recordedAt);
}

function locationTrail(booking: AdminBookingDetail) {
  const explicit = booking.snapshots ?? [];
  if (explicit.length > 0) {
    return explicit;
  }

  const latest = latestProviderLocation(booking);
  return latest ? [latest] : [];
}
