import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingCommandCenterFromFacts,
  type BookingCommandCenterFacts,
} from './booking-command-center-board';
import {
  bookingChatRepairNeedsOps,
  bookingHasQuietHandoffChat,
  bookingMatchingChatReady,
} from './booking-chat-handoff-state';
import { bookingMatchingWindowExpired } from './booking-matching-window';
import { activeBookingStatuses } from './booking-monitor-summary';
import {
  bookingMonitorChatEvidenceNeedsOps,
  bookingMonitorDecisionEvidenceMissing,
  bookingMonitorLocationNeedsOps,
  bookingMonitorPaymentNeedsOps,
  bookingMonitorRefundReviewNeedsOps,
} from './booking-monitor-ops-state-model';
import { bookingMonitorPricingPolicyNeedsOps } from './booking-monitor-pricing-policy-model';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
} from './booking-payment-closeout-facts';
import {
  bookingIsBackupSelected,
  bookingPreferredAwaitingDecision as bookingFirstPickPending,
} from './booking-preferred-provider-state';

export function buildBookingMonitorCommandCenter(bookings: readonly AdminBooking[], nowMs: number) {
  return bookingCommandCenterFromFacts(buildBookingMonitorCommandCenterFacts(bookings, nowMs));
}

export function buildBookingMonitorCommandCenterFacts(
  bookings: readonly AdminBooking[],
  nowMs: number,
): BookingCommandCenterFacts {
  const active = bookings.filter((booking) => activeBookingStatuses.has(booking.status));
  const open = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');

  return {
    active,
    backupSelected: bookings.filter((booking) => bookingIsBackupSelected(booking)),
    cashDebt: bookings.filter((booking) => bookingCashDebtNeedsOps(booking)),
    chatEvidence: bookings.filter((booking) => bookingMonitorChatEvidenceNeedsOps(booking, nowMs)),
    chatReady: bookings.filter((booking) => bookingMatchingChatReady(booking)),
    closeoutChecks: bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking)),
    evidenceMissing: bookings.filter((booking) => bookingMonitorDecisionEvidenceMissing(booking, nowMs)),
    expiredMatching: open.filter((booking) => bookingMatchingWindowExpired(booking, nowMs)),
    locationChecks: bookings.filter((booking) => bookingMonitorLocationNeedsOps(booking, nowMs)),
    matchedWithoutChat: bookings.filter((booking) => bookingChatRepairNeedsOps(booking)),
    missingAuthorizedPaymentRefs: bookings.filter(
      (booking) => booking.payment?.status === 'AUTHORIZED' && !booking.payment.providerRef,
    ),
    noShow: bookings.filter((booking) => booking.status === 'NO_SHOW'),
    noSupply: open.filter((booking) => (booking.participants?.length ?? 0) === 0),
    open,
    paymentChecks: bookings.filter((booking) => bookingMonitorPaymentNeedsOps(booking)),
    preferredPending: open.filter((booking) => bookingFirstPickPending(booking)),
    pricingChecks: bookings.filter((booking) => bookingMonitorPricingPolicyNeedsOps(booking)),
    quietChat: bookings.filter((booking) => bookingHasQuietHandoffChat(booking)),
    refundReview: bookings.filter((booking) => bookingMonitorRefundReviewNeedsOps(booking)),
  };
}
