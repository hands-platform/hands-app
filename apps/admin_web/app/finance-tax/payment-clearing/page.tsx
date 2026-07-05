import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock3 } from 'lucide-react';

import type { AdminBookingPaymentClearingEntry, AdminBookingPaymentClearingSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { ActionMenu } from '../../../components/action-menu';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { financePaymentClearingStatusPill } from '../finance-status-badge-model';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
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
        {
          helper: 'Total amount in the selected clearing scope.',
          label: 'Amount',
          value: <MoneyText amount={summary.amount} currency={summary.currency} />,
        },
      ]}
      title="Booking Payment Clearing"
    >
      <FinanceListCommandBoard ariaLabel="Clearing command board">
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
          value={<MoneyText amount={summary.amount} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Open detail from the table when source, payment, settlement, or bank evidence needs review."
          href={summary.openCount > 0 ? paymentClearingHref({ ...filters, page: 1, review: 'open' }) : '/finance-overview'}
          icon={AlertTriangle}
          label="Review queue"
          tone={summary.openCount > 0 ? 'danger' : 'success'}
          value={summary.openCount > 0 ? 'Needs evidence' : 'Clear'}
        />
      </FinanceListCommandBoard>

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

      <FinanceTablePanel
        grouped
        description="Use this queue to compare captured customer money, settlement postings, refunds, payment fees, and coupon offsets before closeout."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Payment clearing rows"
      >
        <FinanceDataTable
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
                <div>
                  <AdminInlineFallback>{entry.booking?.status ?? 'Unknown booking'}</AdminInlineFallback>
                </div>
              </td>
              <td>
                {entry.payment?.method ? (
                  <strong>{entry.payment.method}</strong>
                ) : (
                  <AdminInlineFallback>No payment method</AdminInlineFallback>
                )}
                <div>
                  <AdminInlineFallback>{entry.payment?.status ?? 'No payment row'}</AdminInlineFallback>
                </div>
                {entry.paymentId ? <div className="muted">{shortId(entry.paymentId)}</div> : null}
              </td>
              <td>
                <Link className="text-link" href={paymentClearingDetailHref(entry.id)}>
                  <strong>{entry.type}</strong>
                </Link>
                <div className="muted">{shortId(entry.sourceKey)}</div>
              </td>
              <td>
                <strong>
                  <MoneyText amount={entry.amount} currency={entry.currency} />
                </strong>
                {entry.payment ? (
                  <div className="muted">
                    Payment <MoneyText amount={entry.payment.amount} currency={entry.payment.currency} />
                  </div>
                ) : null}
              </td>
              <td>
                <strong>
                  <DateTimeText value={entry.occurredAt} />
                </strong>
                {entry.clearedAt ? (
                  <div className="muted">
                    Cleared <DateTimeText value={entry.clearedAt} />
                  </div>
                ) : null}
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(financePaymentClearingStatusPill(entry.status))}>
                  {entry.status}
                </StatusBadge>
              </td>
              <td>
                <ActionMenu
                  actions={[{ href: paymentClearingDetailHref(entry.id), kind: 'link', label: 'Open detail', tone: 'info' }]}
                  label={`Payment clearing evidence actions for ${entry.id}`}
                />
                <div className="muted">Bank matches {entry._count?.bankReconciliationMatches ?? 0}</div>
                <div className="muted">{shortId(entry.id)}</div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Payment clearing pages"
          hrefForPage={(page) => paymentClearingHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}
