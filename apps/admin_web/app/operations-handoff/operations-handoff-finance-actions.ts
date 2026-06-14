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

export function buildFinanceHandoffActionMap(input: FinanceHandoffActionInput) {
  const openPaymentRows = input.payments.filter(
    (payment) =>
      payment.status === 'AUTHORIZED' || (payment.method === 'CASH' && payment.status === 'PENDING'),
  );
  const missingPaymentRefs = input.payments.filter(
    (payment) =>
      ['AUTHORIZED', 'PENDING'].includes(payment.status) && payment.method !== 'CASH' && !payment.providerRef,
  );
  const openRefundRows = input.refunds.filter((refund) => refund.status !== 'COMPLETED');
  const openPayoutRows = input.payouts.filter((payout) => !['PAID', 'CANCELLED'].includes(payout.status));
  const payoutMissingRefs = input.payouts.filter(
    (payout) => ['PROCESSING', 'PAID'].includes(payout.status) && !payout.transferRef,
  );
  const earningsWithoutTaxLogs = input.earnings.filter((earning) => (earning.taxLogs?.length ?? 0) === 0);
  const pendingEarnings = input.earnings.filter(
    (earning) => earning.status === 'PENDING' || earning.status === 'AVAILABLE',
  );
  const totalOpenPaymentAmount = openPaymentRows.reduce((sum, payment) => sum + payment.amount, 0);
  const totalOpenRefundAmount = openRefundRows.reduce((sum, refund) => sum + refund.amount, 0);
  const totalOpenPayoutAmount = openPayoutRows.reduce((sum, payout) => sum + payout.totalNetAmount, 0);
  const currency =
    input.cashSummary.currency ||
    input.payments[0]?.currency ||
    input.refunds[0]?.payment?.currency ||
    input.payouts[0]?.currency ||
    'VND';

  const rows = [
    {
      id: 'finance-payment-state',
      owner: 'Finance',
      title: 'Payment state handoff',
      detail: `${formatMoney(totalOpenPaymentAmount, currency)} in visible open payment state for this range.`,
      href: '/payments?review=needs-action',
      count: openPaymentRows.length,
      countLabel: `${openPaymentRows.length} row(s)`,
      status: openPaymentRows.length ? 'Open' : 'Clear',
      nextAction: 'Capture, release, refund, or record cash collection evidence before handoff closes.',
      className: openPaymentRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: openPaymentRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'finance-refund-state',
      owner: 'Finance',
      title: 'Refund state handoff',
      detail: `${formatMoney(totalOpenRefundAmount, currency)} in refund rows still needing final evidence.`,
      href: '/refunds?review=open',
      count: openRefundRows.length,
      countLabel: `${openRefundRows.length} row(s)`,
      status: openRefundRows.length ? 'Open' : 'Clear',
      nextAction: 'Keep refund state aligned with booking, payment ledger, and customer message history.',
      className: openRefundRows.length ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: openRefundRows.length ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'finance-cash-debt',
      owner: 'Finance',
      title: 'Cash wallet debt handoff',
      detail: `${formatMoney(input.cashSummary.totalDebtAmount, input.cashSummary.currency)} open HANDS fee debt from cash bookings.`,
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: `${input.cashSummary.providerCount} Partner(s)`,
      status: input.cashSummary.providerCount ? 'Settle' : 'Clear',
      nextAction:
        'Record deposit reference or approved offset before marketplace alerts, participation, or payout release reopens.',
      className: input.cashSummary.providerCount ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: input.cashSummary.providerCount ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'finance-payout-release',
      owner: 'Finance',
      title: 'Payout release handoff',
      detail: `${formatMoney(totalOpenPayoutAmount, currency)} in open payout batch amount for the selected window.`,
      href: '/payouts',
      count: openPayoutRows.length,
      countLabel: `${openPayoutRows.length} batch(es)`,
      status: openPayoutRows.length ? 'Review' : 'Clear',
      nextAction: 'Paid status needs bank reference, earning trace, tax logs, and no payout blocker.',
      className: openPayoutRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: openPayoutRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'finance-reference-trace',
      owner: 'Finance',
      title: 'Reference and tax trace',
      detail: `${missingPaymentRefs.length + payoutMissingRefs.length} missing reference check(s), ${earningsWithoutTaxLogs.length} earning row(s) without tax log.`,
      href: '/finance-closeout',
      count: missingPaymentRefs.length + payoutMissingRefs.length + earningsWithoutTaxLogs.length,
      countLabel: `${missingPaymentRefs.length + payoutMissingRefs.length + earningsWithoutTaxLogs.length} check(s)`,
      status:
        missingPaymentRefs.length || payoutMissingRefs.length || earningsWithoutTaxLogs.length
          ? 'Check'
          : 'Ready',
      nextAction: 'Open Finance Closeout and keep historical payment, bank, and tax snapshots stable.',
      className:
        missingPaymentRefs.length || payoutMissingRefs.length || earningsWithoutTaxLogs.length
          ? 'signal signal-warn'
          : 'signal signal-ok',
      statusClass:
        missingPaymentRefs.length || payoutMissingRefs.length || earningsWithoutTaxLogs.length
          ? 'pill pill-warn'
          : 'pill pill-success',
    },
    {
      id: 'finance-earning-release',
      owner: 'Finance',
      title: 'Earning release handoff',
      detail: `${pendingEarnings.length} earning row(s) are pending or available for batch review.`,
      href: '/earnings',
      count: pendingEarnings.length,
      countLabel: `${pendingEarnings.length} row(s)`,
      status: pendingEarnings.length ? 'Review' : 'Clear',
      nextAction: 'Use earnings as the source record before payout batch movement.',
      className: pendingEarnings.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: pendingEarnings.length ? 'pill pill-info' : 'pill pill-success',
    },
  ];

  return rows.sort((a, b) => financeActionWeight(b) - financeActionWeight(a) || b.count - a.count);
}

function financeActionWeight(item: { readonly statusClass: string }) {
  if (item.statusClass.includes('danger')) return 4;
  if (item.statusClass.includes('warn')) return 3;
  if (item.statusClass.includes('info')) return 2;
  return 1;
}
