export function customerWalletPaymentSourceKey(bookingId: string) {
  return `customer-wallet-payment:${bookingId}:settlement`;
}

export function customerWalletPaymentReleaseSourceKey(bookingId: string) {
  return `customer-wallet-payment:${bookingId}:release`;
}

export function customerWalletPaymentRefundSourceKey(bookingId: string) {
  return `customer-wallet-payment:${bookingId}:refund`;
}

export function customerWalletBookingLockKey(customerProfileId: string) {
  return `customer-wallet-booking:${customerProfileId}`;
}
