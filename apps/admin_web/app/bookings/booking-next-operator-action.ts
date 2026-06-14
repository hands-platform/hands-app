export type BookingNextOperatorActionInput = {
  readonly cashDebtNeedsOps: () => boolean;
  readonly completedCloseoutNeedsOps: () => boolean;
  readonly firstPickPending: () => boolean;
  readonly flagTitle?: string | null;
  readonly locationNeedsOps: () => boolean;
  readonly matchingChatReady: () => boolean;
  readonly paymentNeedsOps: () => boolean;
  readonly status?: string | null;
};

const cashDebtAction =
  'Confirm Partner wallet debt and request company fee settlement before final acceptance, service start, or payout release resumes.';
const closeoutAction =
  'Run closeout reconciliation so payment, earning, tax, fee, and wallet records match.';
const paymentAction =
  'Open the booking payment panel and decide capture, release, refund, cash debt, or missing reference handling.';
const noShowAction = 'Record Customer and Partner notes, then close payment and safety follow-up.';
const expiredAction = 'Release the hold, notify the customer, and confirm no Partner remains assigned.';
const firstPickAction =
  'Monitor the first-pick Partner response window and prepare marketplace Partner options.';
const openMatchingAction =
  'Check nearby Partner supply and notification delivery until the customer has options.';
const chatRepairAction = 'Create or repair chat handoff before the service moves forward.';
const locationAction =
  'Ask the Partner to refresh location once; use last-known location only, no live routing.';
const inServiceAction =
  'Monitor completion timing and prepare payment capture or cash fee ledger closeout.';
const defaultAction = 'Keep watching status, chat, and Partner handoff.';

export function bookingNextOperatorActionFromFacts(input: BookingNextOperatorActionInput) {
  const paymentActionCopy = bookingPaymentOperatorAction(input);
  if (paymentActionCopy) {
    return paymentActionCopy;
  }

  const statusActionCopy = bookingStatusOperatorAction(input);
  if (statusActionCopy) {
    return statusActionCopy;
  }

  if (input.locationNeedsOps()) {
    return locationAction;
  }

  if (input.status === 'IN_SERVICE') {
    return inServiceAction;
  }

  return input.flagTitle
    ? `Review ${input.flagTitle.toLowerCase()} and add an ops note before closing.`
    : defaultAction;
}

function bookingPaymentOperatorAction(input: BookingNextOperatorActionInput) {
  if (input.cashDebtNeedsOps()) {
    return cashDebtAction;
  }
  if (input.completedCloseoutNeedsOps()) {
    return closeoutAction;
  }
  if (input.paymentNeedsOps()) {
    return paymentAction;
  }
  return null;
}

function bookingStatusOperatorAction(input: BookingNextOperatorActionInput) {
  if (input.status === 'NO_SHOW') {
    return noShowAction;
  }
  if (input.status === 'EXPIRED') {
    return expiredAction;
  }
  if (input.status === 'OPEN_MATCHING' && input.firstPickPending()) {
    return firstPickAction;
  }
  if (input.status === 'OPEN_MATCHING') {
    return openMatchingAction;
  }
  if (input.status === 'MATCHED' && !input.matchingChatReady()) {
    return chatRepairAction;
  }
  return null;
}
