import type { AdminBooking } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import type { MarketplaceBookingCoverageTone } from '../../lib/marketplace-booking-coverage';
import { bookingCashDebtNeedsOps } from './booking-payment-closeout-facts';

export type BookingMarketplaceWalletSignal = {
  readonly walletLabel: string;
  readonly walletTone: MarketplaceBookingCoverageTone;
};

export function bookingMarketplaceWalletSignal(
  booking: AdminBooking,
): BookingMarketplaceWalletSignal {
  if (bookingHasPartnerWalletDebtSignal(booking)) {
    return {
      walletLabel: `Cash fee debt ${formatMoney(
        Math.abs(booking.earning?.netAmount ?? 0),
        booking.earning?.currency,
      )}`,
      walletTone: 'pill-warn',
    };
  }
  if (booking.earning) {
    return {
      walletLabel: `Wallet ${formatMoney(booking.earning.netAmount ?? 0, booking.earning.currency)}`,
      walletTone: booking.earning.status === 'PAID' ? 'pill-success' : 'pill-info',
    };
  }
  if (booking.payment?.method === 'CASH') {
    return { walletLabel: 'Cash closeout pending', walletTone: 'pill-warn' };
  }
  return { walletLabel: 'Wallet pending', walletTone: 'pill-neutral' };
}

export function bookingHasPartnerWalletDebtSignal(booking: AdminBooking): boolean {
  return bookingCashDebtNeedsOps(booking);
}
