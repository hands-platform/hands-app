export function paymentUpdatedNotification(input: { paymentId: string; bookingId: string }) {
  return {
    type: 'payment.updated',
    title: 'Payment updated',
    body: 'Your booking payment status was updated.',
    data: { paymentId: input.paymentId, bookingId: input.bookingId },
  };
}
