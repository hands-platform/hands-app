import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
  bookingCustomerProtectionFactsFromBookings,
  terminalBookingsWithUnresolvedPayment,
} from './booking-payment-closeout-facts';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('booking payment closeout facts', () => {
  it('selects terminal bookings with unresolved payment outcomes', () => {
    const cancelled = booking({
      id: 'cancelled',
      payment: { status: 'AUTHORIZED' } as AdminBooking['payment'],
      status: 'CANCELLED',
    });
    const released = booking({
      id: 'released',
      payment: { status: 'RELEASED' } as AdminBooking['payment'],
      status: 'CANCELLED',
    });
    const expired = booking({
      id: 'expired',
      payment: { status: 'AUTHORIZED' } as AdminBooking['payment'],
      status: 'EXPIRED',
    });

    expect(
      terminalBookingsWithUnresolvedPayment([cancelled, released, expired], 'CANCELLED').map(
        (item) => item.id,
      ),
    ).toEqual(['cancelled']);
  });

  it('detects cash debt and completed closeout facts for customer protection', () => {
    const cancelled = booking({
      id: 'cancelled',
      payment: { status: 'AUTHORIZED' } as AdminBooking['payment'],
      status: 'CANCELLED',
    });
    const cashDebt = booking({
      earning: { netAmount: -1000, status: 'PENDING' } as AdminBooking['earning'],
      id: 'cash-debt',
      payment: { method: 'CASH' } as AdminBooking['payment'],
      status: 'COMPLETED',
    });
    const completedCloseout = booking({
      earning: null,
      id: 'completed-closeout',
      payment: { status: 'CAPTURED' } as AdminBooking['payment'],
      status: 'COMPLETED',
    });

    const facts = bookingCustomerProtectionFactsFromBookings([
      cancelled,
      cashDebt,
      completedCloseout,
    ]);

    expect(facts.cancelledUnresolved.map((item) => item.id)).toEqual(['cancelled']);
    expect(facts.cashDebt.map((item) => item.id)).toEqual(['cash-debt']);
    expect(facts.completedCloseout.map((item) => item.id)).toEqual([
      'cash-debt',
      'completed-closeout',
    ]);
    expect(bookingCashDebtNeedsOps(cashDebt)).toBe(true);
    expect(bookingCompletedCloseoutNeedsOps(completedCloseout)).toBe(true);
  });
});
