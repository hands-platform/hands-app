import { bookingPaymentOutcomeNeedsReview } from '../../lib/booking-payment-ops';

export type BookingOpsSignalTone = 'info' | 'ok' | 'warn';

export type BookingOpsSignalState = {
  readonly label: string;
  readonly tone: BookingOpsSignalTone;
};

export type BookingOpsSignalStateInput = {
  readonly backupSelected: () => boolean;
  readonly cashDebtNeedsOps: () => boolean;
  readonly firstPickPending: () => boolean;
  readonly marketplaceParticipantCount: number;
  readonly matchingChatReady: () => boolean;
  readonly payment?: { readonly status?: string | null } | null;
  readonly status?: string | null;
};

export function bookingOpsSignalState(input: BookingOpsSignalStateInput): BookingOpsSignalState {
  const status = input.status ?? '';

  if (status === 'NO_SHOW') {
    return input.payment && bookingPaymentOutcomeNeedsReview(input.payment.status)
      ? opsSignalState('warn', 'No-show, check payment')
      : opsSignalState('ok', 'No-show closed');
  }
  if (status === 'EXPIRED') {
    return input.payment?.status === 'RELEASED'
      ? opsSignalState('ok', 'Expired and released')
      : opsSignalState('warn', 'Expired, check payment');
  }
  if (status === 'CANCELLED') {
    return input.payment?.status === 'RELEASED'
      ? opsSignalState('ok', 'Cancelled and released')
      : opsSignalState('warn', 'Cancelled, check payment');
  }
  if (status === 'REFUNDED') {
    return opsSignalState('warn', 'Refunded');
  }
  if (input.cashDebtNeedsOps()) {
    return opsSignalState('warn', 'Cash fee debt');
  }
  if (status === 'OPEN_MATCHING' && input.firstPickPending()) {
    return opsSignalState('warn', 'First-pick Partner pending');
  }
  if (status === 'OPEN_MATCHING' && input.marketplaceParticipantCount === 0) {
    return opsSignalState('warn', 'No marketplace Partners yet');
  }
  if (status === 'OPEN_MATCHING' && input.marketplaceParticipantCount > 0) {
    return opsSignalState('info', 'Marketplace options ready');
  }
  if (status === 'MATCHED' && input.backupSelected()) {
    return opsSignalState('info', 'Marketplace Partner selected');
  }
  if (status === 'MATCHED' && !input.matchingChatReady()) {
    return opsSignalState('warn', 'Chat missing');
  }
  return opsSignalState('ok', 'Normal');
}

function opsSignalState(tone: BookingOpsSignalTone, label: string): BookingOpsSignalState {
  return { label, tone };
}
