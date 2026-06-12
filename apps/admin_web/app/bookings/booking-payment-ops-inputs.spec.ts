import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingManualDecisionNeedsOpsInput,
  bookingPaymentNeedsOpsInput,
  bookingRefundReviewNeedsOpsInput,
} from './booking-payment-ops-inputs';

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'MATCHED',
    ...overrides,
  } as AdminBooking;
}

describe('booking payment ops inputs', () => {
  it('maps shared booking payment signals to payment ops inputs', () => {
    const item = booking({ payment: { status: 'AUTHORIZED' } as AdminBooking['payment'] });

    expect(
      bookingPaymentNeedsOpsInput({
        booking: item,
        cashDebtNeedsOps: true,
        completedCloseoutNeedsOps: false,
      }),
    ).toEqual({
      status: 'MATCHED',
      payment: item.payment,
      completedCloseoutNeedsOps: false,
      cashDebtNeedsOps: true,
    });
  });

  it('maps shared booking payment signals to manual decision inputs', () => {
    const item = booking({ status: 'NO_SHOW' });

    expect(
      bookingManualDecisionNeedsOpsInput({
        booking: item,
        cashDebtNeedsOps: false,
        completedCloseoutNeedsOps: true,
      }),
    ).toEqual({
      status: 'NO_SHOW',
      completedCloseoutNeedsOps: true,
      cashDebtNeedsOps: false,
    });
  });

  it('maps refund review counts from booking and payment refunds', () => {
    const item = booking({
      payment: {
        refunds: [{ id: 'payment-refund-1' }],
        status: 'AUTHORIZED',
      } as AdminBooking['payment'],
      refunds: [{ id: 'refund-1' }],
      status: 'CANCELLED',
    } as Partial<AdminBooking>);

    expect(bookingRefundReviewNeedsOpsInput(item)).toEqual({
      status: 'CANCELLED',
      payment: item.payment,
      refundCount: 1,
      paymentRefundCount: 1,
    });
  });
});
