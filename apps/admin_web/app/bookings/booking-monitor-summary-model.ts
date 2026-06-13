import type { AdminBooking } from '../../lib/admin-api';
import { bookingChatRepairNeedsOps, bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingMatchingPolicySnapshot } from './booking-matching-policy-snapshot';
import { bookingMarketplaceParticipantCount } from './booking-marketplace-count-facts';
import { bookingMonitorCheckFlags } from './booking-monitor-check-flags-model';
import { buildBookingMonitorListStage } from './booking-monitor-list-stage-model';
import {
  bookingMonitorAddressNeedsOps,
  bookingMonitorChatEvidenceNeedsOps,
  bookingMonitorDecisionEvidenceMissing,
  bookingMonitorLocationNeedsOps,
  bookingMonitorPaymentNeedsOps,
  bookingMonitorRefundReviewNeedsOps,
} from './booking-monitor-ops-state-model';
import { bookingMonitorPricingPolicyNeedsOps } from './booking-monitor-pricing-policy-model';
import { bookingMonitorSummaryFactFromInputs } from './booking-monitor-summary-inputs';
import { bookingCompletedCloseoutNeedsOps } from './booking-payment-closeout-facts';
import {
  bookingIsBackupSelected,
  bookingPreferredAwaitingDecision as bookingFirstPickPending,
} from './booking-preferred-provider-state';

export function buildBookingMonitorSummaryFact(booking: AdminBooking, nowMs: number) {
  return bookingMonitorSummaryFactFromInputs({
    addressNeedsOps: bookingMonitorAddressNeedsOps(booking),
    backupSelected: bookingIsBackupSelected(booking),
    checkSeverities: bookingMonitorCheckFlags(booking, nowMs).map((flag) => flag.severity),
    chatEvidenceNeedsOps: bookingMonitorChatEvidenceNeedsOps(booking, nowMs),
    chatRepairNeedsOps: bookingChatRepairNeedsOps(booking),
    closeoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    decisionEvidenceMissing: bookingMonitorDecisionEvidenceMissing(booking, nowMs),
    firstPickPending: bookingFirstPickPending(booking),
    locationNeedsOps: bookingMonitorLocationNeedsOps(booking, nowMs),
    marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    matchingChatReady: bookingMatchingChatReady(booking),
    participantCount: booking.participants?.length ?? 0,
    paymentNeedsOps: bookingMonitorPaymentNeedsOps(booking),
    policySnapshotPresent: Boolean(bookingMatchingPolicySnapshot(booking)),
    pricingPolicyNeedsOps: bookingMonitorPricingPolicyNeedsOps(booking),
    refundReviewNeedsOps: bookingMonitorRefundReviewNeedsOps(booking),
    stageKey: buildBookingMonitorListStage(booking, nowMs).key,
    status: booking.status,
  });
}
