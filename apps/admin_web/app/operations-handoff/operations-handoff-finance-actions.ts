import type {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
} from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';

type FinanceHandoffActionInput = {
  readonly payments: readonly AdminPayment[];
  readonly refunds: readonly AdminRefund[];
  readonly payouts: readonly AdminPayoutBatch[];
  readonly earnings: readonly AdminEarning[];
  readonly cashSummary: AdminCashSettlementSummary;
};

const PAYMENT_REFERENCE_REQUIRED_STATUSES = new Set(['AUTHORIZED', 'PENDING']);
const CLOSED_PAYOUT_STATUSES = new Set(['PAID', 'CANCELLED']);
const PAYOUT_REFERENCE_REQUIRED_STATUSES = new Set(['PROCESSING', 'PAID']);
const EARNING_BATCH_REVIEW_STATUSES = new Set(['PENDING', 'AVAILABLE']);

export function buildFinanceHandoffActionMap(input: FinanceHandoffActionInput) {
  const facts = buildFinanceHandoffActionFacts(input);

  const rows = [
    {
      id: 'finance-payment-state',
      owner: 'Finance',
      title: 'Payment state review',
      detail: `${formatMoney(
        facts.totalOpenPaymentAmount,
        facts.currency,
      )} in visible open payment state for this range.`,
      href: '/payments?review=needs-action',
      count: facts.openPaymentRows.length,
      countLabel: `${facts.openPaymentRows.length} row(s)`,
      status: facts.openPaymentRows.length ? 'Open' : 'Clear',
      nextAction: 'Capture, release, refund, or record cash collection evidence before closing the review.',
      className: facts.openPaymentRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: facts.openPaymentRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'finance-refund-state',
      owner: 'Finance',
      title: 'Refund state review',
      detail: `${formatMoney(
        facts.totalOpenRefundAmount,
        facts.currency,
      )} in refund rows still needing final evidence.`,
      href: '/refunds?review=open',
      count: facts.openRefundRows.length,
      countLabel: `${facts.openRefundRows.length} row(s)`,
      status: facts.openRefundRows.length ? 'Open' : 'Clear',
      nextAction: 'Keep refund state aligned with booking, payment ledger, and customer message history.',
      className: facts.openRefundRows.length ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: facts.openRefundRows.length ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'finance-cash-debt',
      owner: 'Finance',
      title: 'Cash wallet debt review',
      detail: `${formatMoney(input.cashSummary.totalDebtAmount, input.cashSummary.currency)} open HANDS fee debt from cash bookings.`,
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: `${input.cashSummary.providerCount} Partner(s)`,
      status: input.cashSummary.providerCount ? 'Settle' : 'Clear',
      nextAction:
        'Record deposit reference or approved offset before final acceptance, service start, or payout release resumes.',
      className: input.cashSummary.providerCount ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: input.cashSummary.providerCount ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'finance-payout-release',
      owner: 'Finance',
      title: 'Payout release review',
      detail: `${formatMoney(
        facts.totalOpenPayoutAmount,
        facts.currency,
      )} in open payout batch amount for the selected window.`,
      href: '/payouts',
      count: facts.openPayoutRows.length,
      countLabel: `${facts.openPayoutRows.length} batch(es)`,
      status: facts.openPayoutRows.length ? 'Review' : 'Clear',
      nextAction: 'Paid status needs bank reference, earning trace, tax logs, and no payout blocker.',
      className: facts.openPayoutRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: facts.openPayoutRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'finance-reference-trace',
      owner: 'Finance',
      title: 'Reference and tax trace',
      detail: `${facts.missingReferenceCount} missing reference check(s), ${facts.earningsWithoutTaxLogs.length} earning row(s) without tax log.`,
      href: '/finance-closeout',
      count: facts.referenceTraceCount,
      countLabel: `${facts.referenceTraceCount} check(s)`,
      status: facts.referenceTraceCount ? 'Check' : 'Ready',
      nextAction: 'Open Finance Closeout and keep historical payment, bank, and tax snapshots stable.',
      className: facts.referenceTraceCount ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: facts.referenceTraceCount ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'finance-earning-release',
      owner: 'Finance',
      title: 'Earning release review',
      detail: `${facts.pendingEarnings.length} earning row(s) are pending or available for batch review.`,
      href: '/earnings',
      count: facts.pendingEarnings.length,
      countLabel: `${facts.pendingEarnings.length} row(s)`,
      status: facts.pendingEarnings.length ? 'Review' : 'Clear',
      nextAction: 'Use earnings as the source record before payout batch movement.',
      className: facts.pendingEarnings.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: facts.pendingEarnings.length ? 'pill pill-info' : 'pill pill-success',
    },
  ];

  return rows.sort((a, b) => financeActionWeight(b) - financeActionWeight(a) || b.count - a.count);
}

export type FinanceHandoffActionRow = ReturnType<typeof buildFinanceHandoffActionMap>[number];

function buildFinanceHandoffActionFacts(input: FinanceHandoffActionInput) {
  const openPaymentRows = input.payments.filter(paymentNeedsHandoff);
  const missingPaymentRefs = input.payments.filter(paymentNeedsReference);
  const openRefundRows = input.refunds.filter(refundNeedsHandoff);
  const openPayoutRows = input.payouts.filter(payoutNeedsHandoff);
  const payoutMissingRefs = input.payouts.filter(payoutNeedsReference);
  const earningsWithoutTaxLogs = input.earnings.filter(earningNeedsTaxLog);
  const pendingEarnings = input.earnings.filter(earningNeedsBatchReview);
  const missingReferenceCount = missingPaymentRefs.length + payoutMissingRefs.length;

  return {
    currency: handoffCurrency(input),
    earningsWithoutTaxLogs,
    missingReferenceCount,
    openPaymentRows,
    openPayoutRows,
    openRefundRows,
    pendingEarnings,
    referenceTraceCount: missingReferenceCount + earningsWithoutTaxLogs.length,
    totalOpenPaymentAmount: sumPayments(openPaymentRows),
    totalOpenPayoutAmount: sumPayouts(openPayoutRows),
    totalOpenRefundAmount: sumRefunds(openRefundRows),
  };
}

function paymentNeedsHandoff(payment: AdminPayment) {
  return payment.status === 'AUTHORIZED' || (payment.method === 'CASH' && payment.status === 'PENDING');
}

function paymentNeedsReference(payment: AdminPayment) {
  return (
    PAYMENT_REFERENCE_REQUIRED_STATUSES.has(payment.status) &&
    payment.method !== 'CASH' &&
    !payment.providerRef
  );
}

function refundNeedsHandoff(refund: AdminRefund) {
  return refund.status !== 'COMPLETED';
}

function payoutNeedsHandoff(payout: AdminPayoutBatch) {
  return !CLOSED_PAYOUT_STATUSES.has(payout.status);
}

function payoutNeedsReference(payout: AdminPayoutBatch) {
  return PAYOUT_REFERENCE_REQUIRED_STATUSES.has(payout.status) && !payout.transferRef;
}

function earningNeedsTaxLog(earning: AdminEarning) {
  return (earning.taxLogs?.length ?? 0) === 0;
}

function earningNeedsBatchReview(earning: AdminEarning) {
  return EARNING_BATCH_REVIEW_STATUSES.has(earning.status);
}

function handoffCurrency(input: FinanceHandoffActionInput) {
  return (
    input.cashSummary.currency ||
    input.payments[0]?.currency ||
    input.refunds[0]?.payment?.currency ||
    input.payouts[0]?.currency ||
    'VND'
  );
}

function sumPayments(payments: readonly AdminPayment[]) {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function sumRefunds(refunds: readonly AdminRefund[]) {
  return refunds.reduce((sum, refund) => sum + refund.amount, 0);
}

function sumPayouts(payouts: readonly AdminPayoutBatch[]) {
  return payouts.reduce((sum, payout) => sum + payout.totalNetAmount, 0);
}

function financeActionWeight(item: { readonly statusClass: string }) {
  if (item.statusClass.includes('danger')) return 4;
  if (item.statusClass.includes('warn')) return 3;
  if (item.statusClass.includes('info')) return 2;
  return 1;
}
