import type { BookingChecklistClassName, BookingChecklistPillClass } from './booking-closeout-checklist-rows';

export type BookingPayoutBatchEligibilityInput = {
  bookingStatus: string;
  paymentExists: boolean;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  customerPriceLabel: string;
  earningExists: boolean;
  earningStatus?: string | null;
  earningNetAmountLabel: string;
  payoutBatchShortId?: string | null;
  hasTaxLog: boolean;
  hasPlatformFeeLog: boolean;
  hasWalletLedger: boolean;
  cashDebt: boolean;
  walletLedgerLabel: string;
  closeoutOpenItemLabels: string[];
  financeFlagTitles: string[];
  closeoutHelper: string;
};

export type BookingPayoutBatchEligibilityRow = {
  label: string;
  status: string;
  detail: string;
  operatorRule: string;
  href: string;
  className: BookingChecklistClassName;
  pillClass: BookingChecklistPillClass;
};

export type BookingPayoutBatchEligibility = {
  status: string;
  tone: BookingChecklistPillClass;
  summary: string;
  rows: BookingPayoutBatchEligibilityRow[];
};

export function bookingPayoutBatchEligibility(
  input: BookingPayoutBatchEligibilityInput,
): BookingPayoutBatchEligibility {
  const isCompleted = input.bookingStatus === 'COMPLETED';
  const paymentReady =
    input.paymentMethod === 'CASH' || ['CAPTURED', 'PAID', 'SETTLED'].includes(input.paymentStatus ?? '');
  const hasBatch = Boolean(input.payoutBatchShortId);
  const alreadyPaid = ['PAID', 'SETTLED'].includes(input.earningStatus ?? '');
  const closeoutReady = input.closeoutOpenItemLabels.length === 0 && input.financeFlagTitles.length === 0;
  const eligible = isCompleted && paymentReady && input.earningExists && closeoutReady && !input.cashDebt;
  const blocked = !isCompleted || !paymentReady || !input.earningExists || input.cashDebt;
  const status = alreadyPaid
    ? 'Already paid'
    : hasBatch
      ? 'In batch'
      : eligible
        ? 'Batch ready'
        : blocked
          ? 'Blocked'
          : 'Review';
  const tone: BookingChecklistPillClass =
    alreadyPaid || hasBatch || eligible ? 'pill-success' : blocked ? 'pill-danger' : 'pill-warn';
  const summary = alreadyPaid
    ? 'This booking earning has already been paid or settled. Keep it visible as audit evidence.'
    : hasBatch
      ? `This booking earning is linked to payout batch ${input.payoutBatchShortId}.`
      : eligible
        ? 'This booking can be included in the next configured payout batch once finance chooses the batch cycle.'
        : 'This booking should stay out of payout batches until the blocked or review items below are resolved.';

  const logCount = [input.hasTaxLog, input.hasPlatformFeeLog, input.hasWalletLedger].filter(Boolean).length;
  const allLogsSaved = input.hasTaxLog && input.hasPlatformFeeLog && input.hasWalletLedger;

  return {
    status,
    tone,
    summary,
    rows: [
      {
        label: 'Completed service',
        status: isCompleted ? 'Ready' : 'Not ready',
        detail: `Booking status is ${input.bookingStatus}.`,
        operatorRule: 'Only completed work enters Partner payout batches.',
        href: '#flow',
        className: isCompleted ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: isCompleted ? 'pill-success' : 'pill-danger',
      },
      {
        label: 'Payment settlement',
        status: paymentReady ? 'Ready' : input.paymentStatus ?? 'Missing',
        detail: input.paymentExists
          ? `${input.paymentMethod ?? 'NONE'} / ${input.paymentStatus ?? 'Missing'} / ${input.customerPriceLabel}`
          : 'No payment row is linked to this booking.',
        operatorRule: 'Non-cash bookings need captured payment; cash bookings use wallet debt controls.',
        href: '#payment',
        className: paymentReady ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: paymentReady ? 'pill-success' : 'pill-danger',
      },
      {
        label: 'Earning ledger',
        status: input.earningExists ? (alreadyPaid ? 'Paid' : input.earningStatus ?? 'Created') : 'Missing',
        detail: input.earningExists
          ? `${input.earningNetAmountLabel} / payout batch ${input.payoutBatchShortId ?? 'not assigned'}`
          : 'No Partner earning exists for this completed booking.',
        operatorRule: 'The payout batch consumes the earning ledger, not the booking amount directly.',
        href: '/earnings',
        className: input.earningExists ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: input.earningExists ? 'pill-success' : 'pill-danger',
      },
      {
        label: 'Tax, fee, and wallet logs',
        status: allLogsSaved ? 'Complete' : `${logCount}/3`,
        detail: `Tax ${input.hasTaxLog ? 'saved' : 'missing'} / platform fee ${
          input.hasPlatformFeeLog ? 'saved' : 'missing'
        } / wallet ${input.hasWalletLedger ? 'saved' : 'missing'}.`,
        operatorRule:
          'Batch release should preserve withholding, HANDS fee, and wallet evidence for audit review.',
        href: '#finance',
        className: allLogsSaved ? 'ops-task-done' : 'ops-task-warning',
        pillClass: allLogsSaved ? 'pill-success' : 'pill-warn',
      },
      {
        label: 'Cash fee debt',
        status: input.cashDebt ? 'Blocked' : 'Clear',
        detail: input.cashDebt
          ? `${input.walletLedgerLabel}. Settle company fee debt before batch release.`
          : `Wallet impact ${input.walletLedgerLabel}.`,
        operatorRule:
          'Negative wallet Partners can see the marketplace list, but cannot participate in marketplace bookings or receive payout release until deposit or admin offset evidence clears the debt.',
        href: input.cashDebt ? '/cash-settlements' : '#finance',
        className: input.cashDebt ? 'ops-task-blocked' : 'ops-task-done',
        pillClass: input.cashDebt ? 'pill-danger' : 'pill-success',
      },
      {
        label: 'Closeout status',
        status: closeoutReady
          ? 'Ready'
          : `${input.closeoutOpenItemLabels.length + input.financeFlagTitles.length} item(s)`,
        detail: closeoutReady
          ? input.closeoutHelper
          : [...input.closeoutOpenItemLabels, ...input.financeFlagTitles].join(', '),
        operatorRule: 'Use retained booking evidence before including the earning in settlement batches.',
        href: '#booking-closeout-readiness',
        className: closeoutReady ? 'ops-task-done' : 'ops-task-warning',
        pillClass: closeoutReady ? 'pill-success' : 'pill-warn',
      },
    ],
  };
}
