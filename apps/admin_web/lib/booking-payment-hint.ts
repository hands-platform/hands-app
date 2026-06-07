export type BookingPaymentHintInput = {
  status?: string | null;
  payment?: {
    status?: string | null;
    method?: string | null;
  } | null;
};

export type BookingPaymentHintOptions = {
  cashDebtNeedsSettlement?: boolean;
};

export function bookingPaymentHint(
  booking: BookingPaymentHintInput,
  options: BookingPaymentHintOptions = {},
) {
  if (!booking.payment) {
    return 'No payment record created.';
  }
  if (booking.status === 'EXPIRED' && !['RELEASED', 'REFUNDED'].includes(booking.payment.status ?? '')) {
    return 'Expired booking requires payment release/refund before closing.';
  }
  if (booking.status === 'NO_SHOW' && !['RELEASED', 'REFUNDED'].includes(booking.payment.status ?? '')) {
    return 'No-show requires payment decision before closing.';
  }
  if (options.cashDebtNeedsSettlement) {
    return 'Cash fee debt is still unsettled; marketplace participation and payout release are blocked.';
  }
  if (booking.payment.status === 'AUTHORIZED') {
    return 'Hold is active; capture after service completion.';
  }
  if (booking.payment.status === 'RELEASED') {
    return 'Hold released without capture.';
  }
  if (booking.payment.status === 'CAPTURED') {
    return 'Payment captured.';
  }
  if (booking.payment.status === 'REFUNDED') {
    return 'Refund path is active.';
  }
  return `${booking.payment.method ?? 'Unknown'} payment is being monitored.`;
}
