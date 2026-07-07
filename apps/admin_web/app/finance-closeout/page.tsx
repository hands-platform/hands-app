import {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminPayment,
  AdminPaymentSummary,
  AdminPayoutBatch,
  AdminRefund,
  AdminRefundSummary,
  adminGet,
} from '../../lib/admin-api';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeLink } from '../../components/status-badge';
import {
  buildCloseoutTasks,
  buildFinanceCloseoutApiHrefs,
  buildFinanceCloseoutEvidenceChecklist,
  buildFinanceCloseoutFilters,
  buildHandoffRows,
  buildReconciliation,
  buildShiftCloseActionMap,
} from '../../lib/finance-closeout';
import { FinanceCloseoutEvidenceChecklistSection } from './finance-closeout-evidence-checklist-section';
import { FinanceCloseoutCashDebtHandoffSection } from './finance-closeout-cash-debt-handoff-section';
import { FinanceCloseoutPaymentEarningSection } from './finance-closeout-payment-earning-section';
import { FinanceCloseoutPayoutReleaseChecksSection } from './finance-closeout-payout-release-checks-section';
import { FinanceCloseoutShiftActionMapSection } from './finance-closeout-shift-action-map-section';
import { FinanceCloseoutTaskBoardSection } from './finance-closeout-task-board-section';

type FinanceCloseoutPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceCloseoutPage({ searchParams }: FinanceCloseoutPageProps) {
  const filters = buildFinanceCloseoutFilters(searchParams ? await searchParams : {});
  const apiHrefs = buildFinanceCloseoutApiHrefs(filters);
  const [payments, paymentSummary, refunds, refundSummary, earningsSummary, earnings, payouts, cashSummary] =
    await Promise.all([
    adminGet<AdminPayment[]>(apiHrefs.paymentsHref, []),
    adminGet<AdminPaymentSummary | null>(apiHrefs.paymentSummaryHref, null),
    adminGet<AdminRefund[]>(apiHrefs.refundsHref, []),
    adminGet<AdminRefundSummary | null>(apiHrefs.refundSummaryHref, null),
    adminGet<AdminEarningSummary>(apiHrefs.earningsSummaryHref, {
      count: 0,
      grossAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
      netAmount: 0,
      pendingNetAmount: 0,
      availableNetAmount: 0,
      paidNetAmount: 0,
      currency: 'VND',
    }),
    adminGet<AdminEarning[]>(apiHrefs.earningsHref, []),
    adminGet<AdminPayoutBatch[]>(apiHrefs.payoutBatchesHref, []),
    adminGet<AdminCashSettlementSummary | null>(apiHrefs.cashSettlementSummaryHref, null),
  ]);

  const currency = earningsSummary.currency || payments[0]?.currency || cashSummary?.currency || 'VND';
  const filteredRefunds = refunds;
  const filteredEarnings = earnings;
  const filteredPayouts = payouts;
  const filteredEarningsSummary = { ...earningsSummary, currency };
  const reconciliation = buildReconciliation({
    payments,
    paymentSummary,
    refunds: filteredRefunds,
    refundSummary,
    earningsSummary: filteredEarningsSummary,
    earnings: filteredEarnings,
    payouts: filteredPayouts,
    cashSummary,
    currency,
    range: filters.range,
  });
  const closeoutTasks = buildCloseoutTasks(reconciliation);
  const evidenceChecklist = buildFinanceCloseoutEvidenceChecklist(reconciliation);
  const shiftCloseActionMap = buildShiftCloseActionMap(reconciliation);
  const handoffRows = buildHandoffRows(reconciliation);

  return (
    <AdminPageTemplate
      description="End-of-shift reconciliation board for payment holds, refunds, earnings, cash wallet debt, and payout releases."
      metrics={[
        { label: 'Open payment items', value: reconciliation.openPaymentCount, helper: 'Authorization holds and pending cash rows.' },
        { label: 'Refund items', value: reconciliation.openRefundCount, helper: 'Refund cases still open in this range.' },
        {
          label: 'Cash debt',
          value: <MoneyText amount={reconciliation.cashDebtAmount} currency={currency} />,
          helper: 'Partner cash-fee debt needing settlement evidence.',
        },
        {
          label: 'Available payout',
          value: <MoneyText amount={filteredEarningsSummary.availableNetAmount} currency={currency} />,
          helper: 'Partner net available for payout batching.',
        },
        { label: 'Open payout batches', value: reconciliation.openPayoutCount, helper: 'Payout batches not yet paid or cancelled.' },
        { label: 'Missing refs', value: reconciliation.missingReferenceCount, helper: 'Payment or payout references to complete.' },
      ]}
      title="Finance Closeout"
    >

      <AdminSection
        actions={
          <AdminTextLink href="/audit-log?bucket=Finance%2FCloseout">
            Open finance audit
          </AdminTextLink>
        }
        className="admin-mt-16 admin-mb-16"
        description={
          <>
            Range: {filters.label}. Refunds, earnings, payout batches, and local cash debt use record dates.
            Payment hold rows remain all-time until payment timestamps are exposed by the API.
          </>
        }
        title="Finance date range"
      >
        <AdminFilterChipGroup ariaLabel="Finance closeout date range">
          {[
            { href: '/finance-closeout?range=all', label: 'All records', range: 'all' },
            { href: '/finance-closeout?range=today', label: 'Today', range: 'today' },
            { href: '/finance-closeout?range=7d', label: 'Last 7 days', range: '7d' },
            { href: '/finance-closeout?range=30d', label: 'Last 30 days', range: '30d' },
          ].map((option) => (
            <StatusBadgeLink
              ariaCurrent={option.range === filters.range ? 'page' : undefined}
              href={option.href}
              key={option.range}
              tone={option.range === filters.range ? 'info' : 'neutral'}
            >
              {option.label}
            </StatusBadgeLink>
          ))}
        </AdminFilterChipGroup>
      </AdminSection>

      <FinanceCloseoutTaskBoardSection tasks={closeoutTasks} />

      <FinanceCloseoutPaymentEarningSection currency={currency} summary={filteredEarningsSummary} />

      <FinanceCloseoutCashDebtHandoffSection
        cashDebtAmount={reconciliation.cashDebtAmount}
        currency={currency}
        oldestOpenAt={cashSummary?.oldestOpenAt}
        providerCount={cashSummary?.providerCount ?? 0}
        rowCount={cashSummary?.rowCount ?? 0}
      />

      <FinanceCloseoutEvidenceChecklistSection items={evidenceChecklist} />

      <FinanceCloseoutShiftActionMapSection items={shiftCloseActionMap} />

      <FinanceCloseoutPayoutReleaseChecksSection rows={handoffRows} />
    </AdminPageTemplate>
  );
}
