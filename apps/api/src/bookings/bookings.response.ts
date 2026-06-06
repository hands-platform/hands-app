type ClientPaymentInput =
  | {
      amount: number;
      method: unknown;
      status: unknown;
      currency?: string | null;
      [key: string]: unknown;
    }
  | null
  | undefined;

export function clientBookingPayment(payment: ClientPaymentInput) {
  if (!payment) {
    return null;
  }

  return {
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    currency: payment.currency ?? 'VND',
  };
}

export function clientBookingResponse<T extends { payment?: ClientPaymentInput }>(booking: T) {
  return {
    ...booking,
    payment: clientBookingPayment(booking.payment),
  };
}

export function clientBookingResponses<T extends { payment?: ClientPaymentInput }>(bookings: T[]) {
  return bookings.map((booking) => clientBookingResponse(booking));
}
