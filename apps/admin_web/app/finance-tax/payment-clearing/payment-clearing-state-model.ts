import type { AdminBookingPaymentClearingStatus } from '../../../lib/admin-api';

const OPEN_PAYMENT_CLEARING_STATUSES = new Set<AdminBookingPaymentClearingStatus>([
  'OPEN',
  'PARTIALLY_CLEARED',
]);

export function paymentClearingStateModel(
  status: AdminBookingPaymentClearingStatus,
  remainingAmount: number,
) {
  const isOpen = OPEN_PAYMENT_CLEARING_STATUSES.has(status);
  const isTerminal = !isOpen;
  const isMatchable = isOpen && remainingAmount > 0;

  return {
    closedAtLabel: status === 'REVERSED' ? 'Closed at' : 'Cleared at',
    closeoutLabel:
      status === 'REVERSED'
        ? 'Reversed evidence retained'
        : status === 'CLEARED'
          ? 'Cleared evidence retained'
          : isMatchable
            ? 'Needs bank match'
            : 'No remaining amount',
    isMatchable,
    isOpen,
    isTerminal,
    resultLabel:
      status === 'REVERSED'
        ? 'Reversed'
        : status === 'CLEARED'
          ? 'Fully matched'
          : isMatchable
            ? 'Needs match'
            : 'No remaining amount',
  } as const;
}
