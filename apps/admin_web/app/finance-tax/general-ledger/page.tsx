import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ReceiptText, Scale } from 'lucide-react';

import type { AdminAccountingJournalBatch, AdminAccountingJournalBatchSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminRoundedPagination } from '../../../components/admin-rounded-pagination';
import { formatDateTime, formatMoney, shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
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
      metrics={[
        { helper: 'Journal batches matching the current filters.', label: 'Batches', value: summary.count },
        { helper: 'Posted journal batches.', label: 'Posted', value: summary.postedCount },
        { helper: 'Reversed journal batches.', label: 'Reversed', value: summary.reversedCount },
        { helper: 'Total debits in the selected scope.', label: 'Debits', value: formatMoney(summary.totalDebit, summary.currency) },
        { helper: 'Total credits in the selected scope.', label: 'Credits', value: formatMoney(summary.totalCredit, summary.currency) },
      ]}
      title="General Ledger"
    >
      <section className="finance-list-command-board admin-mb-16" aria-label="Ledger command board">
        <FinanceListCommandCard
          detail={`Debit ${formatMoney(summary.totalDebit, summary.currency)} / credit ${formatMoney(
            summary.totalCredit,
            summary.currency,
          )}.`}
          href={generalLedgerHref({ ...filters, page: 1 })}
          icon={Scale}
          label="Debit/Credit delta"
          tone={isBalanced ? 'success' : 'danger'}
          value={isBalanced ? 'Balanced' : formatMoney(Math.abs(debitCreditDelta), summary.currency)}
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
      </section>

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

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="This list intentionally shows journal batches and entry counts only. Open source records when entry-level evidence is required."
        resultLabel={`${pagination.totalRows} batch(es)`}
        resultTone="info"
        title="Journal batches"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No journal batches match the current filters."
            headers={['Source', 'Booking', 'Customer', 'Partner', 'Period', 'Debit / Credit', 'Status', 'Evidence']}
            rowCount={pagination.rows.length}
          >
            {pagination.rows.map((batch) => (
              <tr key={batch.id}>
                <td>
                  <Link className="text-link" href={generalLedgerDetailHref(batch.id)}>
                    <strong>{batch.sourceType}</strong>
                  </Link>
                  <div className="muted">{shortId(batch.sourceId)}</div>
                  <div className="muted">{batch._count?.entries ?? 0} entries</div>
                </td>
                <td>
                  {batch.bookingId ? (
                    <Link className="text-link" href={`/bookings/${batch.bookingId}`}>
                      {shortId(batch.bookingId)}
                    </Link>
                  ) : (
                    <span className="muted">-</span>
                  )}
                  <div className="muted">{batch.booking?.status ?? 'No booking'}</div>
                </td>
                <td>
                  {batch.customerProfileId ? (
                    <Link className="text-link" href={`/customers/${batch.customerProfileId}`}>
                      {personName(batch.customerProfile?.user, 'Unknown customer')}
                    </Link>
                  ) : (
                    <strong>{personName(batch.customerProfile?.user, 'Unknown customer')}</strong>
                  )}
                  <div className="muted">{batch.customerProfile?.user?.phone ?? '-'}</div>
                </td>
                <td>
                  {batch.providerProfileId ? (
                    <Link className="text-link" href={`/partners/${batch.providerProfileId}?section=full`}>
                      {batch.providerProfile?.displayName ?? personName(batch.providerProfile?.user, 'Unknown partner')}
                    </Link>
                  ) : (
                    <span className="muted">-</span>
                  )}
                  <div className="muted">{batch.providerProfile?.user?.phone ?? '-'}</div>
                </td>
                <td>
                  <strong>{batch.monthlyPeriod ?? '-'}</strong>
                  <div className="muted">{formatDateTime(batch.postedAt)}</div>
                </td>
                <td>
                  <strong>{formatMoney(batch.totalDebit, batch.currency)}</strong>
                  <div className="muted">Credit {formatMoney(batch.totalCredit, batch.currency)}</div>
                  <div className="muted">
                    Delta {formatMoney(Math.abs(batch.totalDebit - batch.totalCredit), batch.currency)}
                  </div>
                </td>
                <td>
                  <span className={`pill ${statusPill(batch.status)}`}>{batch.status}</span>
                  {batch.reversedAt ? <div className="muted admin-mt-8">{formatDateTime(batch.reversedAt)}</div> : null}
                </td>
                <td>
                  <Link className="pill pill-info" href={generalLedgerDetailHref(batch.id)}>
                    Open detail
                  </Link>
                  <div className="muted">{batch._count?.entries ?? 0} entries</div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <div className="vuexy-booking-table-footer">
          <span>
            Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
          </span>
          <AdminRoundedPagination
            activePage={pagination.page}
            ariaLabel="General ledger pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) => generalLedgerHref({ ...filters, page })}
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={pagination.totalPages}
          />
        </div>
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}

function personName(user: { fullName?: string | null; phone?: string | null } | null | undefined, fallback: string) {
  return user?.fullName ?? user?.phone ?? fallback;
}

function statusPill(status: string) {
  if (status === 'POSTED') {
    return 'pill-success';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}
