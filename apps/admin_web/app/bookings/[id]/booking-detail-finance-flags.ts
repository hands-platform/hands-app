import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingFinanceFlags as buildBookingFinanceFlags } from '../../../lib/booking-finance-flags';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { money, providerName, readNullableAmount } from './booking-formatters';
import type { bookingFinanceTrace } from './booking-finance-trace';

export function bookingDetailFinanceFlags(
  booking: AdminBookingDetail,
  financeTrace: ReturnType<typeof bookingFinanceTrace>,
) {
  const bookedService = booking.services?.[0];
  const paymentAmount = readNullableAmount(booking.payment?.amount);
  const servicePrice = readNullableAmount(bookedService?.price);
  const finalPartner = bookingFinalPartnerSummary(booking);

  return buildBookingFinanceFlags({
    bookingStatus: booking.status,
    paymentAmount,
    servicePrice,
    hasEarning: Boolean(booking.earning),
    earningNetAmount: booking.earning?.netAmount ?? null,
    partnerLabel: finalPartner.selected ? finalPartner.label : providerName(booking.preferredProvider),
    cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    financeTrace: {
      currency: financeTrace.currency,
      customerPriceAmount: financeTrace.customerPriceAmount,
      providerPayoutAmount: financeTrace.providerPayoutAmount,
      payoutRuleMissing: financeTrace.payoutRuleMissing,
      paymentMethod: financeTrace.paymentMethod,
      walletTotalAmount: financeTrace.walletTotalAmount,
    },
    formatMoney: money,
  });
}
