import type {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
} from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { adminCountLabel } from '../../lib/admin-copy';
import type { StartShiftFinanceReviewWorkloadLane } from '../start-shift-finance-review-workload';

type FinanceHandoffActionInput = {
  readonly payments: readonly AdminPayment[];
  readonly refunds: readonly AdminRefund[];
  readonly payouts: readonly AdminPayoutBatch[];
  readonly earnings: readonly AdminEarning[];
  readonly cashSummary: AdminCashSettlementSummary;
  readonly reviewWorkloads?: readonly StartShiftFinanceReviewWorkloadLane[];
};

const PAYMENT_REFERENCE_REQUIRED_STATUSES = new Set(['AUTHORIZED', 'PENDING']);
const CLOSED_PAYOUT_STATUSES = new Set(['PAID', 'CANCELLED']);
const PAYOUT_REFERENCE_REQUIRED_STATUSES = new Set(['PROCESSING', 'PAID']);
const EARNING_BATCH_REVIEW_STATUSES = new Set(['PENDING', 'AVAILABLE']);

export type FinanceHandoffActionRow = {
  readonly assignee?: string;
  readonly className: string;
  readonly count: number;
  readonly countLabel: string;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly nextAction: string;
  readonly oldestOpenAt: string | null;
  readonly owner: string;
  readonly status: string;
  readonly statusClass: string;
  readonly title: string;
};

export function buildFinanceHandoffActionMap(
  input: FinanceHandoffActionInput,
): FinanceHandoffActionRow[] {
  const facts = buildFinanceHandoffActionFacts(input);

  const rows: FinanceHandoffActionRow[] = [
    {
      assignee: undefined,
      id: 'finance-payment-state',
      owner: 'Finance',
      oldestOpenAt: null,
      title: 'Payment state review',
      detail: `${formatMoney(
        facts.totalOpenPaymentAmount,
        facts.currency,
      )} in visible open payment state for this range.`,
      href: '/payments?review=needs-action',
      count: facts.openPaymentRows.length,
      countLabel: adminCountLabel(facts.openPaymentRows.length, 'row'),
      status: facts.openPaymentRows.length ? 'Open' : 'Clear',
      nextAction: 'Capture, release, refund, or record cash collection evidence before closing the review.',
      className: facts.openPaymentRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: facts.openPaymentRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      assignee: undefined,
      id: 'finance-refund-state',
      owner: 'Finance',
      oldestOpenAt: null,
      title: 'Refund state review',
      detail: `${formatMoney(
        facts.totalOpenRefundAmount,
        facts.currency,
      )} in refund rows still needing final evidence.`,
      href: '/refunds?review=open',
      count: facts.openRefundRows.length,
      countLabel: adminCountLabel(facts.openRefundRows.length, 'row'),
      status: facts.openRefundRows.length ? 'Open' : 'Clear',
      nextAction: 'Keep refund state aligned with booking, payment ledger, and customer message history.',
      className: facts.openRefundRows.length ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: facts.openRefundRows.length ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      assignee: undefined,
      id: 'finance-cash-debt',
      owner: 'Finance',
      oldestOpenAt: input.cashSummary.oldestOpenAt ?? null,
      title: 'Cash wallet debt review',
      detail: `${formatMoney(input.cashSummary.totalDebtAmount, input.cashSummary.currency)} open HANDS fee debt from cash bookings.`,
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: adminCountLabel(input.cashSummary.providerCount, 'Partner'),
      status: input.cashSummary.providerCount ? 'Settle' : 'Clear',
      nextAction:
        'Record deposit reference or approved offset before final acceptance, service start, or payout release resumes.',
      className: input.cashSummary.providerCount ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: input.cashSummary.providerCount ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      assignee: undefined,
      id: 'finance-payout-release',
      owner: 'Finance',
      oldestOpenAt: null,
      title: 'Payout release review',
      detail: `${formatMoney(
        facts.totalOpenPayoutAmount,
        facts.currency,
      )} in open payout batch amount for the selected window.`,
      href: '/payouts',
      count: facts.openPayoutRows.length,
      countLabel: adminCountLabel(facts.openPayoutRows.length, 'batch', 'batches'),
      status: facts.openPayoutRows.length ? 'Review' : 'Clear',
      nextAction: 'Paid status needs bank reference, earning trace, tax logs, and no payout blocker.',
      className: facts.openPayoutRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: facts.openPayoutRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      assignee: undefined,
      id: 'finance-reference-trace',
      owner: 'Finance',
      oldestOpenAt: null,
      title: 'Reference and tax trace',
      detail: `${adminCountLabel(facts.missingReferenceCount, 'missing reference check')}, ${adminCountLabel(facts.earningsWithoutTaxLogs.length, 'earning row')} without tax log.`,
      href: '/finance-overview',
      count: facts.referenceTraceCount,
      countLabel: adminCountLabel(facts.referenceTraceCount, 'check'),
      status: facts.referenceTraceCount ? 'Check' : 'Ready',
      nextAction: 'Open Finance Overview and follow the payment, bank, or tax queue that owns the missing evidence.',
      className: facts.referenceTraceCount ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: facts.referenceTraceCount ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      assignee: undefined,
      id: 'finance-earning-release',
      owner: 'Finance',
      oldestOpenAt: null,
      title: 'Earning release review',
      detail: `${adminCountLabel(facts.pendingEarnings.length, 'earning row')} ${facts.pendingEarnings.length === 1 ? 'is' : 'are'} pending or available for batch review.`,
      href: '/earnings',
      count: facts.pendingEarnings.length,
      countLabel: adminCountLabel(facts.pendingEarnings.length, 'row'),
      status: facts.pendingEarnings.length ? 'Review' : 'Clear',
      nextAction: 'Use earnings as the source record before payout batch movement.',
      className: facts.pendingEarnings.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: facts.pendingEarnings.length ? 'pill pill-info' : 'pill pill-success',
    },
  ];

  rows.push(...(input.reviewWorkloads ?? []).map(financeReviewWorkloadRow));

  return rows.sort((a, b) => financeActionWeight(b) - financeActionWeight(a) || b.count - a.count);
}

function financeReviewWorkloadRow(lane: StartShiftFinanceReviewWorkloadLane) {
  const statusClass = financeReviewStatusClass(lane.tone);
  return {
    assignee: lane.assigneeLabel,
    className: `signal ${statusClass.replace('pill pill-', 'signal-')}`,
    count: lane.openCount,
    countLabel: lane.state === 'unavailable' ? 'Source unavailable' : `${lane.openCount} open`,
    detail: lane.isMonetary
      ? `${formatMoney(lane.openAmount, lane.currency)} across the current all-record review queue.`
      : `${adminCountLabel(lane.openCount, 'item')} in the current all-record review queue.`,
    href: lane.primaryHref,
    id: `finance-owner-${lane.key}`,
    nextAction: financeReviewNextAction(lane),
    oldestOpenAt: lane.oldestOccurredAt,
    owner: 'Finance operations',
    status: lane.status,
    statusClass,
    title: `${lane.label} ownership`,
  };
}

function financeReviewNextAction(lane: StartShiftFinanceReviewWorkloadLane) {
  if (lane.state === 'unavailable') return 'Refresh the queue source before treating this workload as clear.';
  if (lane.over48h.count > 0) return 'Open overdue work and resolve the oldest assigned or unassigned case first.';
  if (lane.unassigned.count > 0) return 'Assign an operator before evidence review and reconciliation continue.';
  if (lane.openCount > 0) return 'Continue the assigned review queue from the oldest open case.';
  return 'No owner review action is waiting.';
}

function financeReviewStatusClass(tone: StartShiftFinanceReviewWorkloadLane['tone']) {
  if (tone === 'danger') return 'pill pill-danger';
  if (tone === 'warn') return 'pill pill-warn';
  if (tone === 'info') return 'pill pill-info';
  return 'pill pill-success';
}

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
