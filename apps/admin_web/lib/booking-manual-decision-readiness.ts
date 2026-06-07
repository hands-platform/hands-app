type ManualDecisionTone = string;

export type BookingManualDecisionReadinessInput = {
  bookingStatus: string;
  closureStatus: string;
  canMarkNoShow: boolean;
  decisionEvidenceReady: boolean;
  evidenceSummary: string;
  paymentExists: boolean;
  paymentStatus: string;
  paymentMethod: string;
  refundRowCount: number;
  refundEvidence: string;
  cashFeeDebtNeedsSettlement: boolean;
  cashDebtEvidenceLabel: string;
  closeoutStatus: string;
  closeoutTone: ManualDecisionTone;
  closeoutHelper: string;
  closeoutOpenItemLabels: string[];
};

export type BookingManualDecisionReadinessRow = {
  lane: string;
  scope: string;
  status: string;
  tone: ManualDecisionTone;
  evidence: string;
  operatorUse: string;
  href: string;
};

const TERMINAL_BOOKING_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

export function bookingManualDecisionReadiness(
  input: BookingManualDecisionReadinessInput,
): BookingManualDecisionReadinessRow[] {
  const canReviewRefund =
    input.paymentExists && !['REFUNDED', 'RELEASED', 'FAILED', 'CANCELLED'].includes(input.paymentStatus);
  const terminal = TERMINAL_BOOKING_STATUSES.has(input.bookingStatus);
  const closureTone: ManualDecisionTone = terminal
    ? input.bookingStatus === 'NO_SHOW'
      ? 'pill-danger'
      : 'pill-info'
    : 'pill-neutral';

  return [
    {
      lane: 'Customer cancellation or closure',
      scope: 'After direct matching, customer outcome changes are handled by operations evidence review.',
      status: terminal
        ? input.closureStatus
        : input.decisionEvidenceReady
          ? 'Evidence ready'
          : 'Needs note',
      tone: terminal ? closureTone : input.decisionEvidenceReady ? 'pill-success' : 'pill-warn',
      evidence: input.evidenceSummary,
      operatorUse:
        'Use retained chat, alerts, location, and operator notes before changing customer-facing booking outcome.',
      href: '#booking-evidence-packet',
    },
    {
      lane: 'No-show decision',
      scope: 'No-show is an admin decision based on communication and service movement context.',
      status:
        input.bookingStatus === 'NO_SHOW'
          ? 'Marked no-show'
          : input.canMarkNoShow
            ? input.decisionEvidenceReady
              ? 'Ready to review'
              : 'Needs evidence'
            : 'Locked',
      tone:
        input.bookingStatus === 'NO_SHOW'
          ? 'pill-danger'
          : input.canMarkNoShow
            ? input.decisionEvidenceReady
              ? 'pill-info'
              : 'pill-warn'
            : 'pill-neutral',
      evidence: input.evidenceSummary,
      operatorUse: 'Check chat, alert delivery, partner location, and notes before using the no-show action.',
      href: '#no-show-handling',
    },
    {
      lane: 'Refund or payment release',
      scope: 'Payment outcome must match booking closure and customer communication.',
      status: input.refundRowCount
        ? `${input.refundRowCount} refund row(s)`
        : canReviewRefund
          ? 'Review payment'
          : 'No payment action',
      tone: input.refundRowCount ? 'pill-warn' : canReviewRefund ? 'pill-info' : 'pill-neutral',
      evidence: `${input.paymentStatus} / ${input.refundEvidence} / ${input.evidenceSummary}`,
      operatorUse:
        'Use payment status, refund rows, and evidence packet before release, refund, or capture decisions.',
      href: '#payment-actions',
    },
    {
      lane: 'Cash fee settlement',
      scope: 'Cash bookings can create partner fee debt; debt blocks marketplace participation and payout release until settled.',
      status: input.cashFeeDebtNeedsSettlement
        ? 'Settlement required'
        : input.paymentMethod === 'CASH'
          ? 'Cash ledger clear'
          : 'Not cash',
      tone: input.cashFeeDebtNeedsSettlement
        ? 'pill-danger'
        : input.paymentMethod === 'CASH'
          ? 'pill-success'
          : 'pill-neutral',
      evidence: input.cashDebtEvidenceLabel,
      operatorUse:
        'If debt exists, confirm company fee deposit or admin offset before marketplace participation or payout release resumes.',
      href: '#finance',
    },
    {
      lane: 'Completed work closeout',
      scope: 'Completed bookings need payment, earning, tax, platform fee, and wallet records aligned.',
      status: input.closeoutStatus,
      tone: input.closeoutTone,
      evidence: input.closeoutOpenItemLabels.length
        ? input.closeoutOpenItemLabels.join(', ')
        : input.closeoutHelper,
      operatorUse: 'Use this before weekly/monthly/admin-date settlement batches and payout reporting.',
      href: '#booking-closeout-readiness',
    },
  ];
}
