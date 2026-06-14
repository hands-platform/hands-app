import { formatMoney } from '../../lib/admin-format';
import {
  type AdminLiveOperationsPolicy,
  formatPolicyDistance,
  humanizePolicyValue,
} from '../../lib/operations-policy';
import type { AppliedCashSettlementPolicyCard, CashSettlementSummary, CommandCard } from './cash-settlement-page-types';

export function buildCashSettlementRuleCards(summary: CashSettlementSummary): CommandCard[] {
  const hasDebt = summary.rowCount > 0;

  return [
    {
      action: 'Keep booking, payment, earning, and wallet references aligned before clearing debt.',
      className: hasDebt ? 'ops-task-pending' : 'ops-task-done',
      detail: hasDebt
        ? `Cash bookings created ${formatMoney(
            summary.debtAmount,
            summary.currency,
          )} of unpaid HANDS fee or withholding debt.`
        : 'There is no open cash fee debt in the current queue.',
      pillClass: hasDebt ? 'pill-warn' : 'pill-success',
      status: hasDebt ? `${summary.rowCount} debt row(s)` : 'Clear',
      title: 'Why the wallet is negative',
    },
    {
      action: 'The Partner app should guide the Partner to settle the fee before final acceptance, service start, or payout release.',
      className: hasDebt ? 'ops-task-blocked' : 'ops-task-done',
      detail: hasDebt
        ? 'Negative-wallet Partners can see marketplace requests, but final acceptance, service start, and payout release wait for settlement.'
        : 'No negative-wallet marketplace finalization gate is active from the visible cash settlement queue.',
      pillClass: hasDebt ? 'pill-danger' : 'pill-success',
      status: hasDebt ? 'Finalization blocked' : 'Finalization open',
      title: 'Marketplace gate',
    },
    {
      action: 'Do not create customer labels or negative wallet balances for this settlement flow.',
      className: 'ops-task-done',
      detail: 'Customers do not carry Partner cash-fee debt. Customer browsing, booking, and chat history stay factual.',
      pillClass: 'pill-success',
      status: 'Never negative',
      title: 'Customer wallet rule',
    },
    {
      action: 'Use a bank deposit reference or approved admin offset memo; do not clear debt from a verbal promise.',
      className: summary.missingPaymentEvidenceCount ? 'ops-task-pending' : 'ops-task-done',
      detail: summary.missingPaymentEvidenceCount
        ? 'Some rows need payment evidence review before finance should clear the Partner wallet.'
        : 'Visible rows have enough linked payment evidence for finance review.',
      pillClass: summary.missingPaymentEvidenceCount ? 'pill-warn' : 'pill-success',
      status: summary.missingPaymentEvidenceCount ? `${summary.missingPaymentEvidenceCount} check` : 'Evidence ready',
      title: 'Clearance evidence',
    },
  ];
}

export function buildAppliedCashSettlementPolicyCards(
  policy: AdminLiveOperationsPolicy,
): AppliedCashSettlementPolicyCard[] {
  return [
    {
      helper: 'Partner cash-fee debt clears only with deposit evidence or an approved admin offset.',
      label: 'Cash clearance',
      value: humanizePolicyValue(policy.cashSettlementClearance),
    },
    {
      helper: 'Negative Partner wallet blocks final acceptance, service start, and payout release until settlement is posted.',
      label: 'Wallet gate',
      value: humanizePolicyValue(policy.walletNegativeGate),
    },
    {
      helper: 'Positive earnings return to weekly, monthly, or admin-selected payout batches after clearance.',
      label: 'Payout batch cycle',
      value: humanizePolicyValue(policy.payoutBatchCycle),
    },
    {
      helper: 'Reopened Partners can participate in eligible marketplace bookings inside the booking-address radius.',
      label: 'Marketplace radius',
      value: formatPolicyDistance(policy.marketplaceRadiusMeters),
    },
  ];
}
