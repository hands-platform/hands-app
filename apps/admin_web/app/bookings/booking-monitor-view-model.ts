import type { AdminBooking } from '../../lib/admin-api';
import { bookingMatchesMonitorView } from './booking-monitor-view-match';
import { bookingMonitorViewMatchReadersFromBooking } from './booking-monitor-view-match-readers';
import type { BookingPageView } from './booking-page-params';
import { bookingMatchingEscalationNeedsOps } from './booking-matching-escalation-needs-ops';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingMatchingWindowExpired } from './booking-matching-window';
import { bookingCashDebtNeedsOps, bookingCompletedCloseoutNeedsOps } from './booking-payment-closeout-facts';
import { bookingMonitorCheckFlags } from './booking-monitor-check-flags-model';
import { buildBookingMonitorListStage } from './booking-monitor-list-stage-model';
import {
  bookingMonitorAddressNeedsOps,
  bookingMonitorChatEvidenceNeedsOps,
  bookingMonitorDecisionEvidenceMissing,
  bookingMonitorLocationNeedsOps,
  bookingMonitorManualDecisionNeedsOps,
  bookingMonitorPaymentNeedsOps,
  bookingMonitorRefundReviewNeedsOps,
} from './booking-monitor-ops-state-model';
import { bookingMonitorPricingPolicyNeedsOps } from './booking-monitor-pricing-policy-model';

export function bookingMonitorMatchesView(
  booking: AdminBooking,
  view: BookingPageView,
  nowMs: number,
) {
  return bookingMatchesMonitorView(
    view,
    bookingMonitorViewMatchReadersFromBooking(booking, {
      addressNeedsOps: () => bookingMonitorAddressNeedsOps(booking),
      cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
      chatEvidenceNeedsOps: () => bookingMonitorChatEvidenceNeedsOps(booking, nowMs),
      closeoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
      decisionEvidenceMissing: () => bookingMonitorDecisionEvidenceMissing(booking, nowMs),
      highPriorityCheck: () =>
        bookingMonitorCheckFlags(booking, nowMs).some((flag) => flag.severity === 'high'),
      locationNeedsOps: () => bookingMonitorLocationNeedsOps(booking, nowMs),
      manualDecisionNeedsOps: () => bookingMonitorManualDecisionNeedsOps(booking),
      matchingEscalationNeedsOps: () =>
        bookingMatchingEscalationNeedsOps(booking, {
          hasChatRoom: bookingMatchingChatReady(booking),
          responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
        }),
      paymentNeedsOps: () => bookingMonitorPaymentNeedsOps(booking),
      pricingPolicyNeedsOps: () => bookingMonitorPricingPolicyNeedsOps(booking),
      refundReviewNeedsOps: () => bookingMonitorRefundReviewNeedsOps(booking),
      stageKey: () => buildBookingMonitorListStage(booking, nowMs).key,
    }),
  );
}
