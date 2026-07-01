import Link from 'next/link';

import type { AdminBookingPaymentClearingEntry, AdminBookingPaymentClearingSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminRoundedPagination } from '../../../components/admin-rounded-pagination';
import { formatDateTime, formatMoney, shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
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

const DATE_RANGE_LINKS = [
  ['Today', 'today'],
  ['Last 7 days', '7d'],
  ['Last 30 days', '30d'],
  ['All dates', 'all'],
] as const;

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
      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${financeAccountingReviewLabel(filters.review, PAYMENT_CLEARING_REVIEW_LINKS)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Payment clearing filters"
      >
        <div className="participant-list">
          {DATE_RANGE_LINKS.map(([label, range]) => (
            <Link
              className={`pill ${filters.range === range ? 'pill-info' : 'pill-neutral'}`}
              href={paymentClearingHref({ ...filters, page: 1, range })}
              key={range}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="participant-list admin-mt-10">
          {PAYMENT_CLEARING_REVIEW_LINKS.map((item) => (
            <Link
              className={`pill ${filters.review === item.review ? 'pill-warn' : 'pill-neutral'}`}
              href={paymentClearingHref({ ...filters, page: 1, review: item.review })}
              key={item.review}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="participant-list admin-mt-10">
          {FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => (
            <Link
              className={`pill ${filters.take === take ? 'pill-success' : 'pill-neutral'}`}
              href={paymentClearingHref({ ...filters, page: 1, take })}
              key={take}
            >
              {take} rows
            </Link>
          ))}
        </div>
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
