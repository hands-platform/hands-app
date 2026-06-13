import type { AdminBooking } from '../../lib/admin-api';
import { bookingRequestOpenedAt } from '../../lib/admin-booking-time';
import { bookingCheckLevel } from '../../lib/booking-check-level';
import { matchingPolicySummaryLabel } from '../../lib/booking-matching-rule-snapshot';
import {
  bookingRecencyLabel as recencyLabel,
  formatBookingDate as formatDate,
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
import { bookingCashDebtNeedsOps } from './booking-payment-closeout-facts';
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
import { bookingMonitorNextActionLabel } from './booking-monitor-next-action-label';
import { partnerDisplayName } from './booking-monitor-labels';
import { buildBookingMonitorFinalGateReason } from './booking-monitor-final-gate-model';
import { buildBookingMonitorMatchingRuleSnapshot } from './booking-monitor-matching-rule-model';
import { bookingMonitorOpsSignal } from './booking-monitor-ops-signal';
import { buildBookingMonitorPricingPolicySignal } from './booking-monitor-pricing-policy-model';

export function buildBookingMonitorListRow(
  booking: AdminBooking,
  currentTimeMs: number,
  nowMs: number | null,
): BookingMonitorListRow {
  const flags = bookingMonitorCheckFlags(booking, currentTimeMs);
  const matchingPolicy = bookingMatchingPolicySnapshot(booking);
  const marketplaceParticipantRows = bookingMarketplaceParticipants(booking);
  const cashDebtNeedsOps = bookingCashDebtNeedsOps(booking);

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
    location: buildBookingMonitorListLocation(booking, currentTimeMs),
    matchingPolicySummaryLabel: matchingPolicySummaryLabel(matchingPolicy),
    matchingRuleSnapshot: buildBookingMonitorMatchingRuleSnapshot(booking, currentTimeMs),
    marketplaceParticipantOverflowCount:
      bookingMonitorListMarketplaceParticipantOverflowCount(marketplaceParticipantRows),
    marketplaceParticipants: bookingMonitorListMarketplaceParticipants(marketplaceParticipantRows),
    nextActionLabel: bookingMonitorNextActionLabel(booking),
    openedDateLabel: formatDate(bookingRequestOpenedAt(booking)),
    opsSignal: bookingMonitorOpsSignal(booking),
    preferredPartnerLabel: partnerDisplayName(booking.preferredProvider, 'none'),
    preferredProviderStateLabel: booking.preferredProvider
      ? bookingPreferredProviderStateLabel(booking)
      : null,
    pricingPolicy: buildBookingMonitorPricingPolicySignal(booking),
    recencyLabel: recencyLabel(booking, nowMs),
    selectedFinalPartnerPillLabel: bookingMonitorListSelectedFinalPartnerPillLabel(booking),
    selection: bookingMonitorSelectionCopy(booking),
    serviceOptionLabel: bookingServiceOptionLabel(booking),
    servicePayoutLabel: bookingServicePayoutRuleLabel(booking) ?? null,
    servicePriceLabel: bookingServicePriceLabel(booking),
    stage: buildBookingMonitorListStage(booking, currentTimeMs),
  };
}
