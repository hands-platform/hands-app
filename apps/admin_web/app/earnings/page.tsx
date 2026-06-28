import Link from 'next/link';
import { AdminEarning, AdminEarningSummary, AdminPayoutBatch, adminGet } from '../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { formatMoney } from '../../lib/admin-format';
import { dateRangeLabel, isInDateRange, readSearchParam } from '../../lib/date-range';
import { createProviderPayout, markEarningPaid } from './actions';
import {
  type EarningConfirmationAction,
  buildEarningActionConfirmation,
  readEarningConfirmationAction,
} from './earning-action-confirmation';
import { EarningsBatchStateFilterSection } from './earnings-batch-state-filter-section';
import { EarningsCashDebtQueueSection } from './earnings-cash-debt-queue-section';
import { EarningsFinanceQueueSection } from './earnings-finance-queue-section';
import { EarningsLedgerSection } from './earnings-ledger-section';
import { EarningsMoneyFlowSection } from './earnings-money-flow-section';
import {
  buildCashDebtQueue,
  buildCashDebtQueueItems,
  buildCashDebtTotals,
  buildEarningBatchStateCards,
  buildEarningFilters,
  buildEarningOperationsApiHrefs,
  buildEarningPayoutConfirmationRows,
  buildEarningsLedgerRows,
  buildEarningsMoneyFlowCards,
  buildEarningsMoneyFlowChecks,
  buildFinanceSignals,
  buildPartnerPayoutQueueGroups,
  buildProviderPayoutQueue,
  buildServiceEarningBridge,
  emptySummary,
  filterEarningsByBatchState,
  isCashDebt,
  sortEarnings,
  summarizeEarnings,
} from './earnings-page-model';
import { EarningsPartnerPayoutQueueSection } from './earnings-partner-payout-queue-section';
import { EarningsServiceBridgeSection } from './earnings-service-bridge-section';

type EarningsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EarningsPage({ searchParams }: EarningsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = buildEarningFilters(params);
  const apiHrefs = buildEarningOperationsApiHrefs(filters);
  const [apiSummary, earnings, payoutBatches] = await Promise.all([
    adminGet<AdminEarningSummary>('/admin/earnings/summary', emptySummary),
    adminGet<AdminEarning[]>(apiHrefs.earningsHref, []),
    adminGet<AdminPayoutBatch[]>(apiHrefs.payoutBatchesHref, []),
  ]);
  const currency = apiSummary.currency || earnings[0]?.currency || payoutBatches[0]?.currency || 'VND';
  const filteredEarnings = earnings.filter((earning) => isInDateRange(earning.createdAt, filters.range));
  const filteredPayoutBatches = payoutBatches.filter((batch) =>
    isInDateRange(batch.createdAt, filters.range),
  );
  const summary = filters.range === 'all' ? apiSummary : summarizeEarnings(filteredEarnings, currency);
  const sortedEarnings = sortEarnings(filteredEarnings);
  const ledgerEarnings = sortEarnings(filterEarningsByBatchState(filteredEarnings, filters.batchState));
  const payoutQueue = buildProviderPayoutQueue(sortedEarnings, filteredPayoutBatches);
  const cashDebtEarnings = sortedEarnings.filter((earning) => {
    return isCashDebt(earning);
  });
  const cashDebtQueue = buildCashDebtQueue(cashDebtEarnings);
  const cashDebtTotals = buildCashDebtTotals(cashDebtQueue);
  const cashDebtItems = buildCashDebtQueueItems(cashDebtQueue);
  const financeSignals = buildFinanceSignals(
    sortedEarnings,
    filteredPayoutBatches,
    payoutQueue,
    cashDebtQueue,
  );
  const serviceBridge = buildServiceEarningBridge(sortedEarnings);
  const moneyFlowCards = buildEarningsMoneyFlowCards(summary, serviceBridge, cashDebtTotals);
  const moneyFlowChecks = buildEarningsMoneyFlowChecks(summary, serviceBridge, cashDebtQueue);
  const partnerPayoutQueueGroups = buildPartnerPayoutQueueGroups(payoutQueue);
  const batchStateCards = buildEarningBatchStateCards(filteredEarnings, filters.range);
  const ledgerRows = buildEarningsLedgerRows(ledgerEarnings);
  const confirmation = buildEarningActionConfirmation(
    cashDebtQueue.map((item) => ({
      currency: item.earning.currency,
      debtAmount: item.debtAmount,
      earningId: item.earning.id,
      paymentMethod: item.paymentMethod,
      providerName: item.providerName,
      settlementReference: item.settlementReference,
    })),
    buildEarningPayoutConfirmationRows(payoutQueue, ledgerEarnings),
    {
      action: readEarningConfirmationAction(readSearchParam(params.confirm)),
      earningId: readSearchParam(params.earningId),
      providerProfileId: readSearchParam(params.providerProfileId),
      settlementMethod: readSearchParam(params.settlementMethod),
      settlementNotes: readSearchParam(params.settlementNotes),
      settlementRef: readSearchParam(params.settlementRef),
      transferRef: readSearchParam(params.transferRef),
    },
  );

  return (
    <AdminPageTemplate
      contentClassName="earnings-page"
      description="Partner earning ledger for service revenue, HANDS fee, tax withholding, cash debt, and payout batching."
      metrics={[
        {
          label: 'Gross',
          value: formatMoney(summary.grossAmount, summary.currency),
          helper: 'Customer charge represented by earning rows.',
        },
        {
          label: 'Platform fee',
          value: formatMoney(summary.platformFee, summary.currency),
          helper: 'HANDS fee before tax and closeout review.',
        },
        {
          label: 'Tax withheld',
          value: formatMoney(summary.withholdingAmount, summary.currency),
          helper: 'Tax amount captured from policy snapshots.',
        },
        {
          label: 'Partner net',
          value: formatMoney(summary.netAmount, summary.currency),
          helper: 'Net Partner earning after fees and tax.',
        },
        {
          label: 'Pending net',
          value: formatMoney(summary.pendingNetAmount, summary.currency),
          helper: 'Pending positive payout or cash debt.',
        },
        {
          label: 'Available net',
          value: formatMoney(summary.availableNetAmount, summary.currency),
          helper: 'Eligible for payout batching.',
        },
        {
          label: 'Paid net',
          value: formatMoney(summary.paidNetAmount, summary.currency),
          helper: 'Already settled earning total.',
        },
      ]}
      title="Partner Earnings"
    >
      {confirmation ? (
        <ConfirmDialog
          action={earningConfirmationAction(confirmation.action)}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmation.hiddenInputs}
          id={`earning-${confirmation.action}`}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <section className="card admin-mb-16">
        <AdminSectionHeader
          actions={
            <Link className="text-link" href="/finance-closeout">
              Open finance closeout
            </Link>
          }
          description={
            <>
              Range: {dateRangeLabel(filters.range)}. Earning rows, service bridge, cash debt, and payout
              batches on this page use record dates.
            </>
          }
          title="Earnings date range"
        />
        <div className="filter-row admin-mt-12">
          {[
            ['All dates', '/earnings?range=all'],
            ['Today', '/earnings?range=today'],
            ['Last 7 days', '/earnings?range=7d'],
            ['Last 30 days', '/earnings?range=30d'],
          ].map(([label, href]) => (
            <Link className="filter-pill" href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
      </section>

      <EarningsMoneyFlowSection cards={moneyFlowCards} checks={moneyFlowChecks} currency={summary.currency} />
      <EarningsFinanceQueueSection signals={financeSignals} />
      <EarningsServiceBridgeSection currency={summary.currency} items={serviceBridge} />
      <EarningsPartnerPayoutQueueSection groups={partnerPayoutQueueGroups} />
      <EarningsCashDebtQueueSection currency={summary.currency} items={cashDebtItems} totals={cashDebtTotals} />
      <EarningsBatchStateFilterSection
        activeState={filters.batchState}
        cards={batchStateCards}
        currency={summary.currency}
        ledgerCount={ledgerEarnings.length}
      />
      <EarningsLedgerSection rows={ledgerRows} />
    </AdminPageTemplate>
  );
}

function earningConfirmationAction(action: EarningConfirmationAction) {
  switch (action) {
    case 'create-payout':
      return createProviderPayout;
    case 'mark-paid':
      return markEarningPaid;
  }
}
