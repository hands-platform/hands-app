import Link from 'next/link';
import { AdminEarning, AdminEarningSummary, AdminPayoutBatch, adminGet } from '../../lib/admin-api';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeLink } from '../../components/status-badge';
import { dateRangeLabel, readSearchParam } from '../../lib/date-range';
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
  buildEarningServerPagination,
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
    adminGet<AdminEarningSummary>(apiHrefs.earningsSummaryHref, emptySummary),
    adminGet<AdminEarning[]>(apiHrefs.earningsHref, []),
    adminGet<AdminPayoutBatch[]>(apiHrefs.payoutBatchesHref, []),
  ]);
  const filteredEarnings = earnings;
  const filteredPayoutBatches = payoutBatches;
  const summary = apiSummary;
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
  const ledgerPagination = buildEarningServerPagination(
    ledgerRows,
    filters,
    filters.batchState === 'all' ? summary.count : ledgerRows.length,
  );
  const confirmation = buildEarningActionConfirmation(
    cashDebtItems.map((item) => ({
      accountingPreview: item.cashAccountingPreviewText,
      currency: item.currency,
      debtAmount: item.debtAmount,
      earningId: item.earningId,
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
          value: <MoneyText amount={summary.grossAmount} currency={summary.currency} />,
          helper: 'Customer charge represented by earning rows.',
        },
        {
          label: 'Platform fee',
          value: <MoneyText amount={summary.platformFee} currency={summary.currency} />,
          helper: 'HANDS fee before tax and closeout review.',
        },
        {
          label: 'Tax withheld',
          value: <MoneyText amount={summary.withholdingAmount} currency={summary.currency} />,
          helper: 'Tax amount captured from policy snapshots.',
        },
        {
          label: 'Partner net',
          value: <MoneyText amount={summary.netAmount} currency={summary.currency} />,
          helper: 'Net Partner earning after fees and tax.',
        },
        {
          label: 'Pending net',
          value: <MoneyText amount={summary.pendingNetAmount} currency={summary.currency} />,
          helper: 'Pending positive payout or cash debt.',
        },
        {
          label: 'Available net',
          value: <MoneyText amount={summary.availableNetAmount} currency={summary.currency} />,
          helper: 'Eligible for payout batching.',
        },
        {
          label: 'Paid net',
          value: <MoneyText amount={summary.paidNetAmount} currency={summary.currency} />,
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

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Range: ${dateRangeLabel(filters.range)}. Earning rows, service bridge, cash debt, and payout batches on this page use record dates.`}
        resultLabel={`${summary.count} row(s)`}
        resultTone={summary.count > 0 ? 'info' : 'warning'}
        title="Earnings date range"
      >
        <div className="participant-list admin-mb-12">
          <Link className="text-link" href="/finance-closeout">
            Open finance closeout
          </Link>
        </div>
        <AdminFilterChipGroup ariaLabel="Earnings date range" className="admin-mt-12">
          {[
            { href: '/earnings?range=all', label: 'All dates', range: 'all' },
            { href: '/earnings?range=today', label: 'Today', range: 'today' },
            { href: '/earnings?range=7d', label: 'Last 7 days', range: '7d' },
            { href: '/earnings?range=30d', label: 'Last 30 days', range: '30d' },
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
      </AdminFilterPanel>

      <EarningsMoneyFlowSection cards={moneyFlowCards} checks={moneyFlowChecks} currency={summary.currency} />
      <EarningsFinanceQueueSection signals={financeSignals} />
      <EarningsServiceBridgeSection currency={summary.currency} items={serviceBridge} />
      <EarningsPartnerPayoutQueueSection groups={partnerPayoutQueueGroups} />
      <EarningsCashDebtQueueSection
        currency={summary.currency}
        items={cashDebtItems}
        totals={cashDebtTotals}
      />
      <EarningsBatchStateFilterSection
        activeState={filters.batchState}
        cards={batchStateCards}
        currency={summary.currency}
        ledgerCount={ledgerEarnings.length}
      />
      <EarningsLedgerSection pagination={ledgerPagination} />
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
