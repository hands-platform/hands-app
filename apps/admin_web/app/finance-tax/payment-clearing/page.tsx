import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock3 } from 'lucide-react';

import type { AdminBookingPaymentClearingEntry, AdminBookingPaymentClearingSummary } from '../../../lib/admin-api';
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
  PAYMENT_CLEARING_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  buildBookingPaymentClearingApiHref,
  buildBookingPaymentClearingSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyBookingPaymentClearingSummary,
  financeAccountingReviewLabel,
  paymentClearingDetailHref,
  paymentClearingHref,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type PaymentClearingPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentClearingPage({ searchParams }: PaymentClearingPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readFinanceAccountingFilters(params, 'open');
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summary, entries] = await Promise.all([
    adminGet<AdminBookingPaymentClearingSummary>(
      buildBookingPaymentClearingSummaryApiHref(filters),
      emptyBookingPaymentClearingSummary(),
    ),
    adminGet<AdminBookingPaymentClearingEntry[]>(buildBookingPaymentClearingApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(entries, filters, summary.count);
  const openRatio = formatFinancePercent(summary.openCount, summary.count);
  const clearedRatio = formatFinancePercent(summary.clearedCount, summary.count);

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            accountingFilters: filters,
            current: 'payment-clearing',
            monthlyFilters,
            settlementFilters,
            withholdingFilters,
          })}
        />
      }
      description="Payment clearing entries connect customer capture, booking settlement posting, refunds, payment fees, and coupon offsets without loading full booking details."
      metrics={[
        { helper: 'Clearing rows matching the current filters.', label: 'Entries', value: summary.count },
        { helper: 'Rows still waiting for clearing or reconciliation.', label: 'Open', value: summary.openCount },
        { helper: 'Rows cleared against finance evidence.', label: 'Cleared', value: summary.clearedCount },
        { helper: 'Total amount in the selected clearing scope.', label: 'Amount', value: formatMoney(summary.amount, summary.currency) },
      ]}
      title="Booking Payment Clearing"
    >
      <section className="finance-list-command-board admin-mb-16" aria-label="Clearing command board">
        <FinanceListCommandCard
          detail={`${summary.openCount} row(s) still need payment, settlement, refund, fee, coupon, or bank evidence.`}
          href={paymentClearingHref({ ...filters, page: 1, review: 'open' })}
          icon={Clock3}
          label="Open ratio"
          tone={summary.openCount > 0 ? 'warning' : 'success'}
          value={openRatio}
        />
        <FinanceListCommandCard
          detail={`${summary.clearedCount} row(s) already cleared against finance evidence in this scope.`}
          href={paymentClearingHref({ ...filters, page: 1, review: 'cleared' })}
          icon={CheckCircle2}
          label="Cleared ratio"
          tone={summary.clearedCount === summary.count && summary.count > 0 ? 'success' : 'info'}
          value={clearedRatio}
        />
        <FinanceListCommandCard
          detail="Total money value represented by the current payment clearing queue."
          href={paymentClearingHref({ ...filters, page: 1 })}
          icon={CircleDollarSign}
          label="Evidence amount"
          tone={summary.amount > 0 ? 'primary' : 'neutral'}
          value={formatMoney(summary.amount, summary.currency)}
        />
        <FinanceListCommandCard
          detail="Open detail from the table when source, payment, settlement, or bank evidence needs review."
          href={summary.openCount > 0 ? paymentClearingHref({ ...filters, page: 1, review: 'open' }) : '/finance-overview'}
          icon={AlertTriangle}
          label="Review queue"
          tone={summary.openCount > 0 ? 'danger' : 'success'}
          value={summary.openCount > 0 ? 'Needs evidence' : 'Clear'}
        />
      </section>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${financeAccountingReviewLabel(filters.review, PAYMENT_CLEARING_REVIEW_LINKS)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Payment clearing filters"
      >
        <FinanceListFilterLinks
          groups={[
            {
              id: 'range',
              links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                active: filters.range === range,
                activePillClassName: 'pill-info',
                href: paymentClearingHref({ ...filters, page: 1, range }),
                id: range,
                label,
              })),
            },
            {
              id: 'review',
              links: PAYMENT_CLEARING_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: paymentClearingHref({ ...filters, page: 1, review: item.review }),
                id: item.review,
                label: item.label,
              })),
            },
            {
              id: 'take',
              links: FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                active: filters.take === take,
                activePillClassName: 'pill-success',
                href: paymentClearingHref({ ...filters, page: 1, take }),
                id: take,
                label: `${take} rows`,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="Use this queue to compare captured customer money, settlement postings, refunds, payment fees, and coupon offsets before closeout."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Payment clearing rows"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No payment clearing rows match the current filters."
            headers={['Booking', 'Payment', 'Clearing type', 'Amount', 'Occurred', 'Status', 'Evidence']}
            rowCount={pagination.rows.length}
          >
            {pagination.rows.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <Link className="text-link" href={`/bookings/${entry.bookingId}`}>
                    {shortId(entry.bookingId)}
                  </Link>
                  <div className="muted">{entry.booking?.status ?? 'Unknown booking'}</div>
                </td>
                <td>
                  <strong>{entry.payment?.method ?? '-'}</strong>
                  <div className="muted">{entry.payment?.status ?? 'No payment row'}</div>
                  {entry.paymentId ? <div className="muted">{shortId(entry.paymentId)}</div> : null}
                </td>
                <td>
                  <Link className="text-link" href={paymentClearingDetailHref(entry.id)}>
                    <strong>{entry.type}</strong>
                  </Link>
                  <div className="muted">{shortId(entry.sourceKey)}</div>
                </td>
                <td>
                  <strong>{formatMoney(entry.amount, entry.currency)}</strong>
                  {entry.payment ? (
                    <div className="muted">Payment {formatMoney(entry.payment.amount, entry.payment.currency)}</div>
                  ) : null}
                </td>
                <td>
                  <strong>{formatDateTime(entry.occurredAt)}</strong>
                  {entry.clearedAt ? <div className="muted">Cleared {formatDateTime(entry.clearedAt)}</div> : null}
                </td>
                <td>
                  <span className={`pill ${statusPill(entry.status)}`}>{entry.status}</span>
                </td>
                <td>
                  <Link className="pill pill-info" href={paymentClearingDetailHref(entry.id)}>
                    Open detail
                  </Link>
                  <div className="muted">Bank matches {entry._count?.bankReconciliationMatches ?? 0}</div>
                  <div className="muted">{shortId(entry.id)}</div>
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
            ariaLabel="Payment clearing pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) => paymentClearingHref({ ...filters, page })}
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={pagination.totalPages}
          />
        </div>
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}

function statusPill(status: string) {
  if (status === 'CLEARED') {
    return 'pill-success';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  if (status === 'PARTIALLY_CLEARED') {
    return 'pill-info';
  }
  return 'pill-warn';
}
