export type BookingCloseoutPolicyInput = {
  status?: string | null;
  payment?: { status?: string | null } | null;
  earning?: {
    taxLogs?: unknown[] | null;
    platformFeeLogs?: unknown[] | null;
    walletLedgerEntries?: unknown[] | null;
  } | null;
};

export type BookingCloseoutTone = 'pill-neutral' | 'pill-warn' | 'pill-success';

export function canCloseoutCompletedBooking(booking: BookingCloseoutPolicyInput) {
  if (booking.status !== 'COMPLETED') {
    return false;
  }
  if (!booking.payment || booking.payment.status !== 'CAPTURED') {
    return true;
  }
  if (!booking.earning) {
    return true;
  }
  const hasTaxLog = (booking.earning.taxLogs?.length ?? 0) > 0;
  const hasPlatformFeeLog = (booking.earning.platformFeeLogs?.length ?? 0) > 0;
  const hasWalletLedger = (booking.earning.walletLedgerEntries?.length ?? 0) > 0;
  return !hasTaxLog || !hasPlatformFeeLog || !hasWalletLedger;
}

export function completedCloseoutLabel(booking: BookingCloseoutPolicyInput) {
  if (booking.status !== 'COMPLETED') {
    return 'Closeout available after completion';
  }
  if (!canCloseoutCompletedBooking(booking)) {
    return 'Completed closeout healthy';
  }
  return 'Completed closeout needs reconciliation';
}

export function completedCloseoutTone(booking: BookingCloseoutPolicyInput): BookingCloseoutTone {
  if (booking.status !== 'COMPLETED') {
    return 'pill-neutral';
  }
  return canCloseoutCompletedBooking(booking) ? 'pill-warn' : 'pill-success';
}
