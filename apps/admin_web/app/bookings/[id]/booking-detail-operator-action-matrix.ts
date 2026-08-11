import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  canCloseoutCompletedBooking,
  completedCloseoutLabel,
} from '../../../lib/booking-closeout-policy';
import { bookingOperatorActionMatrix as buildBookingOperatorActionMatrix } from '../../../lib/booking-operator-action-matrix';
import {
  bookingOperatorNoteLines,
  canMarkNoShow,
} from '../../../lib/booking-operator-action-rules';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { isTerminalPayment, formatDate, money } from './booking-formatters';
import { bookingPaymentEvidence } from './booking-payment-evidence';
import { bookingDetailExpiryEligibility } from './booking-participant-rules';

export function bookingDetailOperatorActionMatrix(booking: AdminBookingDetail) {
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
    expireAvailable: bookingDetailExpiryEligibility(booking).allowed,
    expiresAtLabel: formatDate(booking.expiresAt),
    noShowAvailable: canMarkNoShow(booking.status),
    refundRowCount: paymentEvidence.refundCount,
    noteLineCount: bookingOperatorNoteLines(booking.notes).length,
  });
}
