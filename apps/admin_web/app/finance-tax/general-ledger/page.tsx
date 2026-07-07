import { AlertTriangle, CheckCircle2, ReceiptText, Scale } from 'lucide-react';

import type { AdminAccountingJournalBatch, AdminAccountingJournalBatchSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { ActionMenu } from '../../../components/action-menu';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { financePersonName } from '../finance-participant-label';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { financeJournalBatchStatusPill } from '../finance-status-badge-model';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  GENERAL_LEDGER_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  buildAccountingJournalBatchApiHref,
  buildAccountingJournalBatchSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyAccountingJournalBatchSummary,
  financeAccountingReviewLabel,
  generalLedgerDetailHref,
  generalLedgerHref,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type GeneralLedgerPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GeneralLedgerPage({ searchParams }: GeneralLedgerPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readFinanceAccountingFilters(params, 'posted');
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summary, batches] = await Promise.all([
    adminGet<AdminAccountingJournalBatchSummary>(
      buildAccountingJournalBatchSummaryApiHref(filters),
      emptyAccountingJournalBatchSummary(),
    ),
    adminGet<AdminAccountingJournalBatch[]>(buildAccountingJournalBatchApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(batches, filters, summary.count);
  const debitCreditDelta = summary.totalDebit - summary.totalCredit;
  const isBalanced = debitCreditDelta === 0;

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            accountingFilters: filters,
            current: 'general-ledger',
            monthlyFilters,
            settlementFilters,
            withholdingFilters,
          })}
        />
      }
      description="Bounded journal batch lookup for booking settlement, reversal, manual adjustment, refund, payout, and bank reconciliation evidence."
      title="General Ledger"
    >
      <FinanceListCommandBoard ariaLabel="Ledger command board">
        <FinanceListCommandCard
          detail={
            <>
              Debit <MoneyText amount={summary.totalDebit} currency={summary.currency} /> / credit{' '}
              <MoneyText amount={summary.totalCredit} currency={summary.currency} />.
            </>
          }
          href={generalLedgerHref({ ...filters, page: 1 })}
          icon={Scale}
          label="Debit/Credit delta"
          tone={isBalanced ? 'success' : 'danger'}
          value={
            isBalanced ? (
              'Balanced'
            ) : (
              <MoneyText amount={Math.abs(debitCreditDelta)} currency={summary.currency} />
            )
          }
        />
        <FinanceListCommandCard
          detail={`${summary.postedCount} posted batch(es) in the selected range.`}
          href={generalLedgerHref({ ...filters, page: 1, review: 'posted' })}
          icon={CheckCircle2}
          label="Posted ratio"
          tone={summary.postedCount > 0 ? 'success' : 'neutral'}
          value={formatFinancePercent(summary.postedCount, summary.count)}
        />
        <FinanceListCommandCard
          detail={`${summary.reversedCount} reversed batch(es) requiring source/reversal trace review.`}
          href={generalLedgerHref({ ...filters, page: 1, review: 'reversed' })}
          icon={AlertTriangle}
          label="Reversal queue"
          tone={summary.reversedCount > 0 ? 'warning' : 'success'}
          value={String(summary.reversedCount)}
        />
        <FinanceListCommandCard
          detail="Open detail only when debit/credit entries or source evidence are needed."
          href={generalLedgerHref({ ...filters, page: 1 })}
          icon={ReceiptText}
          label="Journal evidence"
          tone={summary.count > 0 ? 'info' : 'neutral'}
          value={`${summary.count} batch(es)`}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${financeAccountingReviewLabel(filters.review, GENERAL_LEDGER_REVIEW_LINKS)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="General ledger filters"
      >
        <FinanceListFilterLinks
          groups={[
            {
              id: 'range',
              links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                active: filters.range === range,
                activePillClassName: 'pill-info',
                href: generalLedgerHref({ ...filters, page: 1, range }),
                id: range,
                label,
              })),
            },
            {
              id: 'review',
              links: GENERAL_LEDGER_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: generalLedgerHref({ ...filters, page: 1, review: item.review }),
                id: item.review,
                label: item.label,
              })),
            },
            {
              id: 'take',
              links: FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                active: filters.take === take,
                activePillClassName: 'pill-success',
                href: generalLedgerHref({ ...filters, page: 1, take }),
                id: take,
                label: `${take} rows`,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="This list intentionally shows journal batches and entry counts only. Open source records when entry-level evidence is required."
        resultLabel={`${pagination.totalRows} batch(es)`}
        resultTone="info"
        title="Journal batches"
      >
        <FinanceDataTable
          emptyMessage="No journal batches match the current filters."
          headers={['Source', 'Booking', 'Customer', 'Partner', 'Period', 'Debit / Credit', 'Status', 'Evidence']}
          rowCount={pagination.rows.length}
        >
          {pagination.rows.map((batch) => (
            <tr key={batch.id}>
              <td>
                <AdminTextLink href={generalLedgerDetailHref(batch.id)}>
                  <strong>{batch.sourceType}</strong>
                </AdminTextLink>
                <div className="muted">{shortId(batch.sourceId)}</div>
                <div className="muted">{batch._count?.entries ?? 0} entries</div>
              </td>
              <td>
                {batch.bookingId ? (
                  <AdminTextLink href={`/bookings/${batch.bookingId}`}>
                    {shortId(batch.bookingId)}
                  </AdminTextLink>
                ) : (
                  <AdminInlineFallback>No booking link</AdminInlineFallback>
                )}
                <div>
                  <AdminInlineFallback>{batch.booking?.status ?? 'No booking'}</AdminInlineFallback>
                </div>
              </td>
              <td>
                {batch.customerProfileId ? (
                  <AdminTextLink href={`/customers/${batch.customerProfileId}`}>
                    {financePersonName(batch.customerProfile?.user, 'Unknown customer')}
                  </AdminTextLink>
                ) : (
                  <strong>{financePersonName(batch.customerProfile?.user, 'Unknown customer')}</strong>
                )}
                {batch.customerProfile?.user?.phone ? (
                  <div className="muted">{batch.customerProfile.user.phone}</div>
                ) : (
                  <AdminInlineFallback className="admin-mt-6">No customer phone</AdminInlineFallback>
                )}
              </td>
              <td>
                {batch.providerProfileId ? (
                  <AdminTextLink href={`/partners/${batch.providerProfileId}?section=full`}>
                    {batch.providerProfile?.displayName ?? financePersonName(batch.providerProfile?.user, 'Unknown partner')}
                  </AdminTextLink>
                ) : (
                  <AdminInlineFallback>No partner link</AdminInlineFallback>
                )}
                {batch.providerProfile?.user?.phone ? (
                  <div className="muted">{batch.providerProfile.user.phone}</div>
                ) : (
                  <AdminInlineFallback className="admin-mt-6">No partner phone</AdminInlineFallback>
                )}
              </td>
              <td>
                {batch.monthlyPeriod ? (
                  <strong>{batch.monthlyPeriod}</strong>
                ) : (
                  <AdminInlineFallback>No monthly period</AdminInlineFallback>
                )}
                <div className="muted">
                  <DateTimeText value={batch.postedAt} />
                </div>
              </td>
              <td>
                <strong>
                  <MoneyText amount={batch.totalDebit} currency={batch.currency} />
                </strong>
                <div className="muted">
                  Credit <MoneyText amount={batch.totalCredit} currency={batch.currency} />
                </div>
                <div className="muted">
                  Delta{' '}
                  <MoneyText
                    amount={Math.abs(batch.totalDebit - batch.totalCredit)}
                    currency={batch.currency}
                  />
                </div>
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={financeJournalBatchStatusPill(batch.status)}>
                  {batch.status}
                </StatusBadgeFromPillClass>
                {batch.reversedAt ? (
                  <div className="muted admin-mt-8">
                    <DateTimeText value={batch.reversedAt} />
                  </div>
                ) : null}
              </td>
              <td>
                <ActionMenu
                  actions={[{ href: generalLedgerDetailHref(batch.id), kind: 'link', label: 'Open detail', tone: 'info' }]}
                  label={`General ledger evidence actions for ${batch.id}`}
                />
                <div className="muted">{batch._count?.entries ?? 0} entries</div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="General ledger pages"
          hrefForPage={(page) => generalLedgerHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}
