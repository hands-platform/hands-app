import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingHasPartnerWalletDebtSignal,
  bookingMarketplaceWalletSignal,
} from './booking-marketplace-wallet-signal';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('booking marketplace wallet signal', () => {
  it('prioritizes cash fee debt before ordinary wallet state', () => {
    const item = booking({
      earning: {
        currency: 'VND',
        netAmount: -250000,
        status: 'PENDING',
      } as AdminBooking['earning'],
      payment: { method: 'CASH' } as AdminBooking['payment'],
    });

    expect(bookingHasPartnerWalletDebtSignal(item)).toBe(true);
    expect(bookingMarketplaceWalletSignal(item)).toEqual({
      walletLabel: 'Cash fee debt 250.000 VND',
      walletTone: 'pill-warn',
    });
  });

  it('labels paid and pending wallet entries', () => {
    expect(
      bookingMarketplaceWalletSignal(
        booking({
          earning: {
            currency: 'VND',
            netAmount: 180000,
            status: 'PAID',
          } as AdminBooking['earning'],
        }),
      ),
    ).toEqual({
      walletLabel: 'Wallet 180.000 VND',
      walletTone: 'pill-success',
    });

    expect(
      bookingMarketplaceWalletSignal(
        booking({
          earning: {
            currency: 'VND',
            netAmount: 180000,
            status: 'PENDING',
          } as AdminBooking['earning'],
        }),
      ),
    ).toEqual({
      walletLabel: 'Wallet 180.000 VND',
      walletTone: 'pill-info',
    });
  });

  it('labels cash closeout and missing wallet states', () => {
    expect(
      bookingMarketplaceWalletSignal(booking({ payment: { method: 'CASH' } as AdminBooking['payment'] })),
    ).toEqual({
      walletLabel: 'Cash closeout pending',
      walletTone: 'pill-warn',
    });

    expect(bookingMarketplaceWalletSignal(booking({}))).toEqual({
      walletLabel: 'Wallet pending',
      walletTone: 'pill-neutral',
    });
  });
});
