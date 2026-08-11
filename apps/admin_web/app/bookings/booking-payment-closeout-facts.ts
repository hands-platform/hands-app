import type { AdminBooking } from '../../lib/admin-api';
import { bookingCashDebtNeedsSettlement } from '../../lib/booking-finance-flags';
import {
  bookingCompletedCloseoutNeedsOpsFromFacts,
  bookingPaymentOutcomeNeedsReview,
} from '../../lib/booking-payment-ops';
import type { BookingCustomerProtectionFacts } from './booking-customer-protection-board';

type TerminalPaymentBooking = {
  readonly payment?: { readonly status?: string | null } | null;
  readonly status: string;
};

export function bookingCustomerProtectionFactsFromBookings(
  bookings: readonly AdminBooking[],
): BookingCustomerProtectionFacts<AdminBooking> {
  return {
    cancelledUnresolved: terminalBookingsWithUnresolvedPayment(bookings, 'CANCELLED'),
    cashDebt: bookings.filter((booking) => bookingCashDebtNeedsOps(booking)),
    completedCloseout: bookings.filter((booking) => bookingCompletedCloseoutNeedsOps(booking)),
    expiredUnresolved: terminalBookingsWithUnresolvedPayment(bookings, 'EXPIRED'),
    noShowUnresolved: terminalBookingsWithUnresolvedPayment(bookings, 'NO_SHOW'),
  };
}

export function terminalBookingsWithUnresolvedPayment<TBooking extends TerminalPaymentBooking>(
  bookings: readonly TBooking[],
  status: string,
): TBooking[] {
  return bookings.filter(
    (booking) =>
      booking.status === status &&
      Boolean(booking.payment) &&
      bookingPaymentOutcomeNeedsReview(booking.payment?.status),
  );
}

export function bookingCompletedCloseoutNeedsOps(booking: AdminBooking): boolean {
  return bookingCompletedCloseoutNeedsOpsFromFacts(booking);
}

export function bookingCashDebtNeedsOps(booking: AdminBooking): boolean {
  return bookingCashDebtNeedsSettlement({
    paymentMethod: booking.payment?.method,
    hasEarning: Boolean(booking.earning),
    earningNetAmount: booking.earning?.netAmount,
    earningStatus: booking.earning?.status,
  });
}

export function bookingPaymentExceptionFacts(booking: AdminBooking) {
  const payment = booking.payment;
  const refundCount = (booking.refunds?.length ?? 0) + (payment?.refunds?.length ?? 0);
  const isCash = payment?.method === 'CASH';

  return {
    authorizationPending: !isCash && payment?.status === 'AUTHORIZED',
    cashCommissionDue: bookingCashDebtNeedsOps(booking),
    cashStatusPending: isCash && payment?.status === 'PENDING',
    gatewayRefMissing: !isCash && payment?.status === 'AUTHORIZED' && !payment.providerRef,
    paymentMissing: !payment,
    paymentReleasePending:
      booking.status === 'EXPIRED' && Boolean(payment) && !['RELEASED', 'REFUNDED'].includes(payment?.status ?? ''),
    refundMismatch: refundCount > 0 && payment?.status !== 'REFUNDED',
  };
}
