import type { AdminBooking } from '../../lib/admin-api';
import { bookingLocationNeedsOpsFromFacts } from '../../lib/booking-status-location-helpers';
import {
  bookingManualDecisionNeedsOpsFromFacts,
  bookingPaymentNeedsOpsFromFacts,
  bookingRefundReviewNeedsOpsFromFacts,
} from '../../lib/booking-payment-ops';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import {
  bookingChatQuietNeedsOps,
  bookingChatRepairNeedsOps,
  bookingMatchingChatReady,
} from './booking-chat-handoff-state';
import {
  bookingChatEvidenceNeedsOpsFromReaders,
  bookingDecisionEvidenceMissingFromReaders,
} from './booking-chat-evidence-ops-state';
import {
  bookingHasProviderLocation,
  bookingLocationNeedsOpsInput,
} from './booking-location-ops-inputs';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
} from './booking-payment-closeout-facts';
import {
  bookingManualDecisionNeedsOpsInput,
  bookingPaymentNeedsOpsInput,
  bookingRefundReviewNeedsOpsInput,
} from './booking-payment-ops-inputs';

export function bookingMonitorAddressNeedsOps(booking: AdminBooking) {
  return !booking.addressSnapshot;
}

export function bookingMonitorPaymentNeedsOps(booking: AdminBooking) {
  return bookingPaymentNeedsOpsFromFacts(
    bookingPaymentNeedsOpsInput({
      booking,
      completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
      cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    }),
  );
}

export function bookingMonitorManualDecisionNeedsOps(booking: AdminBooking) {
  return bookingManualDecisionNeedsOpsFromFacts(
    bookingManualDecisionNeedsOpsInput({
      booking,
      cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
      completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
    }),
  );
}

export function bookingMonitorChatEvidenceNeedsOps(booking: AdminBooking, nowMs: number) {
  return bookingChatEvidenceNeedsOpsFromReaders({
    chatReady: bookingMatchingChatReady(booking),
    chatRepairNeedsOps: () => bookingChatRepairNeedsOps(booking),
    chatQuietNeedsOps: () => bookingChatQuietNeedsOps(booking),
    decisionEvidenceMissing: () => bookingMonitorDecisionEvidenceMissing(booking, nowMs),
    manualDecisionNeedsOps: () => bookingMonitorManualDecisionNeedsOps(booking),
    refundReviewNeedsOps: () => bookingMonitorRefundReviewNeedsOps(booking),
  });
}

export function bookingMonitorDecisionEvidenceMissing(booking: AdminBooking, nowMs: number) {
  return bookingDecisionEvidenceMissingFromReaders({
    chatRepairNeedsOps: () => bookingChatRepairNeedsOps(booking),
    hasAlertTrace: () => bookingBackupAlertTraceSummary(booking, nowMs).totalNotified > 0,
    hasChatMessage: () => (booking.chatRoom?.messages?.length ?? 0) > 0,
    hasProviderLocation: () => bookingHasProviderLocation(booking),
    manualDecisionNeedsOps: () => bookingMonitorManualDecisionNeedsOps(booking),
  });
}

export function bookingMonitorRefundReviewNeedsOps(booking: AdminBooking) {
  return bookingRefundReviewNeedsOpsFromFacts(bookingRefundReviewNeedsOpsInput(booking));
}

export function bookingMonitorLocationNeedsOps(booking: AdminBooking, nowMs: number) {
  return bookingLocationNeedsOpsFromFacts(bookingLocationNeedsOpsInput(booking, nowMs));
}
