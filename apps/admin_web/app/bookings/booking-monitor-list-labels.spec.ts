import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMonitorListCashDebtAmountLabel,
  bookingMonitorListFirstPickPhoneLabel,
} from './booking-monitor-list-labels';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('booking monitor list labels', () => {
  it('formats cash debt amount only when the booking needs cash debt ops', () => {
    const cashDebtBooking = booking({
      earning: {
        currency: 'VND',
        netAmount: -250000,
      } as AdminBooking['earning'],
    });

    expect(bookingMonitorListCashDebtAmountLabel(cashDebtBooking, false)).toBeNull();
    expect(bookingMonitorListCashDebtAmountLabel(cashDebtBooking, true)).toBe('250.000 VND');
  });

  it('describes the first-pick Partner phone state', () => {
    expect(
      bookingMonitorListFirstPickPhoneLabel(
        booking({
          preferredProvider: {
            user: { phone: '+84901234567' },
          } as AdminBooking['preferredProvider'],
        }),
      ),
    ).toBe('First-pick phone +84901234567');

    expect(bookingMonitorListFirstPickPhoneLabel(booking({}))).toBe('First-pick Partner not set');
  });
});
