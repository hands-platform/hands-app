import type { AdminBooking } from '../../lib/admin-api';
import type {
  BookingManualDecisionOpsInput,
  BookingPaymentOpsInput,
  BookingRefundReviewOpsInput,
} from '../../lib/booking-payment-ops';

type BookingPaymentOpsBooking = Pick<AdminBooking, 'payment' | 'refunds' | 'status'>;

export type BookingPaymentOpsSignals = {
  readonly booking: BookingPaymentOpsBooking;
  readonly cashDebtNeedsOps: boolean;
  readonly completedCloseoutNeedsOps: boolean;
};

export function bookingPaymentNeedsOpsInput(input: BookingPaymentOpsSignals): BookingPaymentOpsInput {
  return {
    status: input.booking.status,
    payment: input.booking.payment,
    completedCloseoutNeedsOps: input.completedCloseoutNeedsOps,
    cashDebtNeedsOps: input.cashDebtNeedsOps,
  };
}

export function bookingManualDecisionNeedsOpsInput(
  input: BookingPaymentOpsSignals,
): BookingManualDecisionOpsInput {
  return {
    status: input.booking.status,
    completedCloseoutNeedsOps: input.completedCloseoutNeedsOps,
    cashDebtNeedsOps: input.cashDebtNeedsOps,
  };
}

export function bookingRefundReviewNeedsOpsInput(
  booking: BookingPaymentOpsBooking,
): BookingRefundReviewOpsInput {
  return {
    status: booking.status,
    payment: booking.payment,
    refundCount: booking.refunds?.length,
    paymentRefundCount: booking.payment?.refunds?.length,
  };
}
