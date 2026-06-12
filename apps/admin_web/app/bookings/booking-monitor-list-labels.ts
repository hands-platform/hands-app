import type { AdminBooking } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';

export function bookingMonitorListCashDebtAmountLabel(
  booking: AdminBooking,
  cashDebtNeedsOps: boolean,
): string | null {
  if (!cashDebtNeedsOps) {
    return null;
  }
  return formatMoney(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency);
}

export function bookingMonitorListFirstPickPhoneLabel(booking: AdminBooking): string {
  return booking.preferredProvider?.user?.phone
    ? `First-pick phone ${booking.preferredProvider.user.phone}`
    : 'First-pick partner not set';
}
