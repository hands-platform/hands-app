export function bookingPrimaryCommandHref(status: string) {
  if (status === 'Address check') {
    return '/bookings?view=address';
  }
  if (status === 'Handoff repair') {
    return '/bookings?view=chat-repair';
  }
  if (status === 'Finance gate') {
    return '/bookings?view=cash-debt';
  }
  if (status === 'Customer choice') {
    return '/bookings?view=customer-choice';
  }
  if (status === 'Matching watch') {
    return '/bookings?view=matching';
  }
  if (status === 'Payment review') {
    return '/bookings?view=payment';
  }
  if (status === 'Closeout review') {
    return '/bookings?view=closeout';
  }
  return '/bookings?view=all';
}
