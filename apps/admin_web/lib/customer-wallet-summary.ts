type CustomerWalletBooking = {
  payment?: {
    status?: string | null;
    method?: string | null;
    amount?: number | string | null;
    refunds?: Array<{ amount?: number | string | null; [key: string]: unknown }> | null;
  } | null;
  refunds?: Array<{ amount?: number | string | null; [key: string]: unknown }> | null;
};

export function customerWalletSummary(bookings: CustomerWalletBooking[]) {
  const summary = bookings.reduce(
    (wallet, booking) => {
      const paymentAmount = readAmount(booking.payment?.amount);
      if (booking.payment?.status === 'CAPTURED') wallet.capturedSpend += paymentAmount;
      if (booking.payment && ['PENDING', 'AUTHORIZED'].includes(String(booking.payment.status))) {
        wallet.pendingPaymentAmount += paymentAmount;
      }
      if (booking.payment?.method === 'CASH') wallet.cashBookingAmount += paymentAmount;
      const refunds = [...(booking.payment?.refunds ?? []), ...(booking.refunds ?? [])];
      wallet.refundCount += refunds.length;
      wallet.refundAmount += refunds.reduce((sum, refund) => sum + readAmount(refund.amount), 0);
      return wallet;
    },
    {
      capturedSpend: 0,
      pendingPaymentAmount: 0,
      refundAmount: 0,
      refundCount: 0,
      cashBookingAmount: 0,
      customerBalance: 0,
      partnerCashFeeDebtAmount: 0,
      operatorNote:
        'Customers never carry partner cash-fee debt. Cash settlement belongs to the partner wallet only.',
    },
  );

  return summary;
}

function readAmount(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}
