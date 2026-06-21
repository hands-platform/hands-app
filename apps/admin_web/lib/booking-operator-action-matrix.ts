export type BookingOperatorActionTone = 'pill-danger' | 'pill-info' | 'pill-neutral' | 'pill-warn';

export type BookingOperatorActionMatrixInput = {
  bookingStatus: string;
  paymentStatus: string;
  hasPayment: boolean;
  paymentIsTerminal: boolean;
  paymentProviderRef?: string | null;
  paymentAmountLabel: string;
  paymentMethod?: string | null;
  cashDebtNeedsSettlement: boolean;
  cashDebtAmountLabel: string;
  closeoutAvailable: boolean;
  closeoutLabel: string;
  expireAvailable: boolean;
  expiresAtLabel: string;
  noShowAvailable: boolean;
  refundRowCount: number;
  noteLineCount: number;
};

export type BookingOperatorActionMatrixRow = {
  action: string;
  available: boolean;
  status: string;
  tone: BookingOperatorActionTone;
  evidence: string;
  operatorRule: string;
  href: string;
  hrefLabel: string;
};

export function bookingOperatorActionMatrix(
  input: BookingOperatorActionMatrixInput,
): BookingOperatorActionMatrixRow[] {
  const paymentActionAvailable = input.hasPayment && !input.paymentIsTerminal;
  const paymentSyncAvailable = Boolean(input.paymentProviderRef) && !input.paymentIsTerminal;
  const captureAvailable = paymentActionAvailable && input.paymentStatus === 'AUTHORIZED';

  return [
    {
      action: 'Payment sync',
      available: paymentSyncAvailable,
      status: paymentSyncAvailable ? 'Available' : 'Locked',
      tone: paymentSyncAvailable ? 'pill-info' : 'pill-neutral',
      evidence: input.paymentProviderRef
        ? `${input.paymentStatus} / gateway ref ${input.paymentProviderRef}`
        : 'No payment gateway reference to sync.',
      operatorRule:
        'Use for gateway reconciliation only. Do not change customer outcome from sync alone.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Capture payment',
      available: captureAvailable,
      status: captureAvailable ? 'Available' : 'Locked',
      tone: captureAvailable ? 'pill-warn' : 'pill-neutral',
      evidence:
        input.paymentStatus === 'AUTHORIZED'
          ? `${input.bookingStatus} / ${input.paymentAmountLabel} authorized`
          : `Payment status is ${input.paymentStatus}.`,
      operatorRule:
        'Capture only after service completion is confirmed by retained booking, chat, and closeout evidence.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Release or refund',
      available: paymentActionAvailable,
      status: paymentActionAvailable ? 'Available' : 'Locked',
      tone: paymentActionAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: input.refundRowCount
        ? `${input.refundRowCount} refund row(s) already recorded.`
        : `${input.bookingStatus} / payment ${input.paymentStatus}.`,
      operatorRule:
        'Release or refund only after cancellation, expiry, or no-show evidence has been reviewed.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Settle cash fee debt',
      available: input.cashDebtNeedsSettlement,
      status: input.cashDebtNeedsSettlement ? 'Available' : 'Locked',
      tone: input.cashDebtNeedsSettlement ? 'pill-danger' : 'pill-neutral',
      evidence: input.cashDebtNeedsSettlement
        ? `${input.cashDebtAmountLabel} keeps final acceptance, service start, and payout release blocked.`
        : input.paymentMethod === 'CASH'
          ? 'Cash booking has no active negative wallet block.'
          : `${input.paymentMethod ?? 'No method'} booking.`,
      operatorRule:
        'Settle only when company fee deposit or admin offset evidence is available for this cash booking.',
      href: '#booking-ops',
      hrefLabel: 'Open action forms',
    },
    {
      action: 'Reconcile completed booking',
      available: input.closeoutAvailable,
      status: input.closeoutAvailable ? 'Available' : 'Locked',
      tone: input.closeoutAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: input.closeoutLabel,
      operatorRule:
        'Run after payment, earning, tax, platform fee, wallet, and chat archive records are aligned.',
      href: '#completed-closeout',
      hrefLabel: 'Open closeout',
    },
    {
      action: 'Expire matching',
      available: input.expireAvailable,
      status: input.expireAvailable ? 'Available' : 'Locked',
      tone: input.expireAvailable ? 'pill-info' : 'pill-neutral',
      evidence: input.expireAvailable
        ? `Open matching can be expired. Timer ${input.expiresAtLabel}.`
        : `Expire unavailable for ${input.bookingStatus}.`,
      operatorRule:
        'Expire only when the customer should stop waiting and the payment hold can be released or reviewed.',
      href: '#matching-expiry',
      hrefLabel: 'Open expiry',
    },
    {
      action: 'Mark no-show',
      available: input.noShowAvailable,
      status: input.noShowAvailable ? 'Available' : 'Locked',
      tone: input.noShowAvailable ? 'pill-warn' : 'pill-neutral',
      evidence: input.noShowAvailable
        ? 'Use after communication and service movement are reviewed.'
        : `No-show unavailable for ${input.bookingStatus}.`,
      operatorRule:
        'Mark no-show only from factual chat, alert, location, and operator-note evidence. Keep the record descriptive.',
      href: '#no-show-handling',
      hrefLabel: 'Open no-show',
    },
    {
      action: 'Add operator note',
      available: true,
      status: 'Available',
      tone: 'pill-info',
      evidence: `${input.noteLineCount} note line(s) currently retained.`,
      operatorRule:
        'Use notes to record what happened, who was contacted, and what evidence supports the next decision.',
      href: '#operator-notes',
      hrefLabel: 'Open notes',
    },
  ];
}
