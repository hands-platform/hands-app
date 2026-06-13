import type { AdminBooking } from '../../lib/admin-api';
import { bookingMatchesMonitorEvidenceFilter } from './booking-monitor-evidence-match';
import { bookingMonitorEvidenceMatchReadersFromBooking } from './booking-monitor-evidence-match-readers';
import type { BookingEvidenceFilter } from './booking-page-params';
import { bookingMonitorAlertEvidenceNeedsOps } from './booking-monitor-alert-evidence-model';
import {
  bookingMonitorAddressNeedsOps,
  bookingMonitorLocationNeedsOps,
  bookingMonitorPaymentNeedsOps,
} from './booking-monitor-ops-state-model';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
} from './booking-payment-closeout-facts';

export function bookingMonitorMatchesEvidenceFilter(
  booking: AdminBooking,
  evidenceFilter: BookingEvidenceFilter,
  nowMs: number,
) {
  return bookingMatchesMonitorEvidenceFilter(
    evidenceFilter,
    bookingMonitorEvidenceMatchReadersFromBooking(booking, {
      addressNeedsOps: () => bookingMonitorAddressNeedsOps(booking),
      alertEvidenceNeedsOps: () => bookingMonitorAlertEvidenceNeedsOps(booking, nowMs),
      cashDebtNeedsOps: () => bookingCashDebtNeedsOps(booking),
      closeoutNeedsOps: () => bookingCompletedCloseoutNeedsOps(booking),
      locationNeedsOps: () => bookingMonitorLocationNeedsOps(booking, nowMs),
      paymentNeedsOps: () => bookingMonitorPaymentNeedsOps(booking),
    }),
  );
}
