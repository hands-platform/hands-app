import Link from 'next/link';
import {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
  adminGet,
} from '../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { formatMoney } from '../../lib/admin-format';
import { isInDateRange } from '../../lib/date-range';
import {
  buildCloseoutTasks,
  buildFinanceCloseoutEvidenceChecklist,
  buildFinanceCloseoutFilters,
  buildHandoffRows,
  buildReconciliation,
  buildShiftCloseActionMap,
  summarizeEarnings,
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
  const [payments, refunds, earningsSummary, earnings, payouts, cashSummary] = await Promise.all([
    adminGet<AdminPayment[]>('/admin/payments', []),
    adminGet<AdminRefund[]>('/admin/refunds', []),
    adminGet<AdminEarningSummary>('/admin/earnings/summary', {
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
    adminGet<AdminEarning[]>('/admin/earnings', []),
    adminGet<AdminPayoutBatch[]>('/admin/payout-batches', []),
    adminGet<AdminCashSettlementSummary | null>('/admin/cash-settlement-summary', null),
  ]);

  const currency = earningsSummary.currency || payments[0]?.currency || cashSummary?.currency || 'VND';
  const filteredRefunds = refunds.filter((refund) => isInDateRange(refund.createdAt, filters.range));
  const filteredEarnings = earnings.filter((earning) => isInDateRange(earning.createdAt, filters.range));
  const filteredPayouts = payouts.filter((batch) => isInDateRange(batch.createdAt, filters.range));
  const filteredEarningsSummary = summarizeEarnings(filteredEarnings, currency);
  const reconciliation = buildReconciliation({
    payments,
    refunds: filteredRefunds,
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
        { label: 'Cash debt', value: formatMoney(reconciliation.cashDebtAmount, currency), helper: 'Partner cash-fee debt needing settlement evidence.' },
        { label: 'Available payout', value: formatMoney(filteredEarningsSummary.availableNetAmount, currency), helper: 'Partner net available for payout batching.' },
        { label: 'Open payout batches', value: reconciliation.openPayoutCount, helper: 'Payout batches not yet paid or cancelled.' },
        { label: 'Missing refs', value: reconciliation.missingReferenceCount, helper: 'Payment or payout references to complete.' },
      ]}
      title="Finance Closeout"
    >

      <section className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <AdminSectionHeader
          actions={
            <Link className="text-link" href="/audit-log?bucket=Finance%2FCloseout">
              Open finance audit
            </Link>
          }
          description={
            <>
              Range: {filters.label}. Refunds, earnings, payout batches, and local cash debt use record dates.
              Payment hold rows remain all-time until payment timestamps are exposed by the API.
            </>
          }
          title="Finance date range"
        />
        <div className="filter-row" style={{ marginTop: 12 }}>
          {[
            ['All records', '/finance-closeout'],
            ['Today', '/finance-closeout?range=today'],
            ['Last 7 days', '/finance-closeout?range=7d'],
            ['Last 30 days', '/finance-closeout?range=30d'],
          ].map(([label, href]) => (
            <Link className="filter-pill" href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>

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

