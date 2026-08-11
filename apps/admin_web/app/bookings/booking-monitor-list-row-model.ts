import type { AdminBooking } from '../../lib/admin-api';
import { bookingRequestOpenedAt } from '../../lib/admin-booking-time';
import { bookingCheckLevel } from '../../lib/booking-check-level';
import { matchingPolicySummaryLabel } from '../../lib/booking-matching-rule-snapshot';
import {
  bookingStatusEvent,
  formatBookingDate as formatDate,
  relativeTimeLabel,
} from './booking-list-time';
import { bookingMatchingPolicySnapshot } from './booking-matching-policy-snapshot';
import {
  bookingServiceOptionLabel,
  bookingServicePayoutRuleLabel,
  bookingServicePriceLabel,
} from './booking-service-labels';
import { bookingClosureListSignal } from './booking-closure-list-signal';
import { bookingMarketplaceParticipants } from './booking-marketplace-count-facts';
import { bookingMonitorSelectionCopy } from './booking-monitor-selection-model';
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
import { bookingPreferredProviderStateLabel } from './booking-preferred-provider-state';
import {
  bookingCashDebtNeedsOps,
  bookingPaymentExceptionFacts,
} from './booking-payment-closeout-facts';
import { bookingListActionChips } from './booking-list-action-chip-inputs';
import type { BookingMonitorListRow } from './booking-monitor-list-section';
import {
  buildBookingMonitorAddressState,
  buildBookingMonitorChatState,
  buildBookingMonitorListLocation,
} from './booking-monitor-list-state-model';
import { buildBookingMonitorCustomerVisibleStateLabel } from './booking-monitor-customer-visible-model';
import { bookingMonitorCheckFlags } from './booking-monitor-check-flags-model';
import { buildBookingMonitorCommandDecisionStrip } from './booking-monitor-command-decision-model';
import { buildBookingMonitorListStage } from './booking-monitor-list-stage-model';
import { bookingMonitorNextAction } from './booking-monitor-next-action-label';
import { partnerDisplayName } from './booking-monitor-labels';
import { buildBookingMonitorFinalGateReason } from './booking-monitor-final-gate-model';
import { buildBookingMonitorMatchingRuleSnapshot } from './booking-monitor-matching-rule-model';
import { bookingMonitorOpsSignal } from './booking-monitor-ops-signal';
import { buildBookingMonitorPricingPolicySignal } from './booking-monitor-pricing-policy-model';
import type { BookingPageView } from './booking-page-params';

export function buildBookingMonitorListRow(
  booking: AdminBooking,
  currentTimeMs: number,
  nowMs: number | null,
  view?: BookingPageView,
): BookingMonitorListRow {
  const flags = bookingMonitorCheckFlags(booking, currentTimeMs);
  const matchingPolicy = bookingMatchingPolicySnapshot(booking);
  const marketplaceParticipantRows = bookingMarketplaceParticipants(booking);
  const cashDebtNeedsOps = bookingCashDebtNeedsOps(booking);
  const statusEvent = bookingStatusEvent(booking);
  const nextAction = bookingMonitorNextAction(booking, currentTimeMs, view);
  const pricingPolicy = buildBookingMonitorPricingPolicySignal(booking);

  return {
    actionChips: bookingListActionChips(booking, currentTimeMs),
    addressState: buildBookingMonitorAddressState(booking),
    backupAlert: bookingMonitorListBackupAlert(booking, currentTimeMs),
    booking,
    cashDebtAmountLabel: bookingMonitorListCashDebtAmountLabel(booking, cashDebtNeedsOps),
    cashDebtNeedsOps,
    chatState: buildBookingMonitorChatState(booking),
    checkSignal: bookingCheckLevel(flags),
    closureState: bookingClosureListSignal(booking, { formatDate }),
    commandDecisionStrip: buildBookingMonitorCommandDecisionStrip(booking),
    customerVisibleStateLabel: buildBookingMonitorCustomerVisibleStateLabel(booking),
    expiresAtLabel: booking.expiresAt ? formatDate(booking.expiresAt) : null,
    finalGateReason: buildBookingMonitorFinalGateReason(booking),
    finalPartnerLabel: booking.selectedProvider ? partnerDisplayName(booking.selectedProvider) : null,
    firstCheckTitle: flags[0]?.title ?? null,
    firstPickPhoneLabel: bookingMonitorListFirstPickPhoneLabel(booking),
    hasMatchingPolicySnapshot: Boolean(matchingPolicy),
    issueChips: bookingQueueIssueChips(booking, view, pricingPolicy),
    location: buildBookingMonitorListLocation(booking, currentTimeMs),
    matchingPolicySummaryLabel: matchingPolicySummaryLabel(matchingPolicy),
    matchingRuleSnapshot: buildBookingMonitorMatchingRuleSnapshot(booking, currentTimeMs),
    marketplaceParticipantOverflowCount:
      bookingMonitorListMarketplaceParticipantOverflowCount(marketplaceParticipantRows),
    marketplaceParticipants: bookingMonitorListMarketplaceParticipants(marketplaceParticipantRows),
    nextActionHelper: nextAction.helper,
    nextActionLabel: nextAction.label,
    openedDateLabel: formatDate(bookingRequestOpenedAt(booking)),
    opsSignal: bookingMonitorOpsSignal(booking),
    preferredPartnerLabel: partnerDisplayName(booking.preferredProvider, 'none'),
    preferredProviderStateLabel: booking.preferredProvider
      ? bookingPreferredProviderStateLabel(booking)
      : null,
    pricingPolicy,
    statusEvent: {
      clockLabel: statusEvent.clockLabel,
      dateLabel: statusEvent.dateLabel,
      label: statusEvent.label,
      relativeLabel: statusEvent.relativeLabel(nowMs),
    },
    terminalWaitingLabel: bookingTerminalWaitingLabel(statusEvent.timestamp, currentTimeMs),
    selectedFinalPartnerPillLabel: bookingMonitorListSelectedFinalPartnerPillLabel(booking),
    selection: bookingMonitorSelectionCopy(booking),
    serviceOptionLabel: bookingServiceOptionLabel(booking),
    servicePayoutLabel: bookingServicePayoutRuleLabel(booking) ?? null,
    servicePriceLabel: bookingServicePriceLabel(booking),
    stage: buildBookingMonitorListStage(booking, currentTimeMs),
  };
}

function bookingQueueIssueChips(
  booking: AdminBooking,
  view: BookingPageView | undefined,
  pricingPolicy: { readonly label: string; readonly status: string; readonly tone: string },
) {
  const payment = booking.payment;
  const earning = booking.earning;
  const refundCount = (booking.refunds?.length ?? 0) + (payment?.refunds?.length ?? 0);
  const issues: Array<{ label: string; tone: string }> = [];
  const add = (label: string, tone = 'pill-warn') => issues.push({ label, tone });

  if (view === 'payment') {
    const facts = bookingPaymentExceptionFacts(booking);
    if (facts.paymentMissing) add('Payment missing', 'pill-danger');
    if (facts.gatewayRefMissing) add('Gateway ref missing', 'pill-danger');
    else if (facts.authorizationPending) add('Payment authorized');
    if (facts.cashStatusPending) add('Cash status pending');
    if (facts.refundMismatch) add('Refund mismatch', 'pill-danger');
    if (facts.cashCommissionDue) add('Cash commission due', 'pill-danger');
    if (facts.paymentReleasePending) add('Payment release pending');
    if (issues.length === 0) add('Payment exception');
  } else if (view === 'closeout') {
    if (!earning) add('Earning missing', 'pill-danger');
    if (earning && !earning.platformFeeLogs?.length) add('Platform fee missing');
    if (earning && !earning.taxLogs?.length) add('Tax missing');
    if (earning && !earning.walletLedgerEntries?.length) add('Wallet entry missing');
  } else if (view === 'pricing') {
    add(
      pricingPolicy.label === 'Active payout rule missing' ? 'Payout rule missing' : pricingPolicy.label,
      pricingPolicy.tone,
    );
  } else if (view === 'refund-review') {
    add(refundCount > 0 && payment?.status !== 'REFUNDED' ? 'Refund mismatch' : 'Refund review');
  } else if (view === 'expired') {
    add('Expired record', 'pill-neutral');
  } else if (view === 'cash-debt') {
    add('Cash commission due', 'pill-danger');
  } else {
    add(booking.status === 'COMPLETED' ? 'Completed service' : booking.status, 'pill-neutral');
  }

  return issues.slice(0, 3);
}

function bookingTerminalWaitingLabel(timestamp: string | null | undefined, nowMs: number) {
  if (!timestamp) return 'waiting time unavailable';
  return `waiting ${relativeTimeLabel(timestamp, nowMs).replace(/ ago$/u, '')}`;
}
