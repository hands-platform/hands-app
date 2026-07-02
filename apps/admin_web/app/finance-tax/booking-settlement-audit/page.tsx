import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ReceiptText, ShieldCheck } from 'lucide-react';

import type {
  AdminBookingSettlementSnapshot,
  AdminBookingSettlementSnapshotSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminRoundedPagination } from '../../../components/admin-rounded-pagination';
import { dateRangeLabel } from '../../../lib/date-range';
import { formatDateTime, formatMoney, shortId } from '../../../lib/admin-format';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import { FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import {
  BOOKING_SETTLEMENT_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  bookingSettlementAuditDetailHref,
  bookingSettlementAuditHref,
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotRowsCsvHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildTaxSettlementServerPagination,
  buildTaxFinanceWorkflowLinks,
  emptyBookingSettlementSummary,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
  reviewLabel,
} from '../tax-settlement-page-model';

type BookingSettlementAuditPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DATE_RANGE_LINKS = [
  ['Today', 'today'],
  ['Last 7 days', '7d'],
  ['Last 30 days', '30d'],
  ['All dates', 'all'],
] as const;

export default async function BookingSettlementAuditPage({ searchParams }: BookingSettlementAuditPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summary, snapshots] = await Promise.all([
    adminGet<AdminBookingSettlementSnapshotSummary>(
      buildBookingSettlementSnapshotSummaryApiHref(filters),
      emptyBookingSettlementSummary(),
    ),
    adminGet<AdminBookingSettlementSnapshot[]>(buildBookingSettlementSnapshotApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(snapshots, filters, summary.count);
  const tableRows = pagination.rows;
  const csvHref = buildBookingSettlementSnapshotRowsCsvHref(tableRows);
  const openTaxRatio = formatFinancePercent(summary.openTaxCount, summary.count);
  const paidTaxRatio = formatFinancePercent(summary.paidTaxCount, summary.count);

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'booking-settlement-audit',
            monthlyFilters,
            settlementFilters: filters,
            withholdingFilters,
          })}
        >
          <a
            className="pill pill-success"
            download={`hands-booking-settlement-audit-${filters.range}-${filters.review}.csv`}
            href={csvHref}
          >
            Export settlement CSV
          </a>
        </TaxFinanceWorkflowActions>
      }
      description="Immutable booking settlement snapshots for customer payment, Partner payout, VAT/PIT, payment fee, and company VAT audit."
      metrics={[
        { helper: 'Snapshot rows matching the current filters.', label: 'Snapshots', value: summary.count },
        { helper: 'Rows whose tax status still needs finance action.', label: 'Open tax', value: summary.openTaxCount },
        { helper: 'Rows already marked paid in tax closeout.', label: 'Paid tax', value: summary.paidTaxCount },
        {
          helper: 'Partner VAT/PIT withheld in these snapshots.',
          label: 'Withheld',
          value: formatMoney(summary.partnerWithholdingTotal, summary.currency),
        },
        {
          helper: 'Company output VAT from HANDS platform fee.',
          label: 'Company VAT',
          value: formatMoney(summary.companyOutputVat, summary.currency),
        },
        {
          helper: 'Payment processing fees recorded by settlement.',
          label: 'Payment fees',
          value: formatMoney(summary.paymentProcessingFee, summary.currency),
        },
      ]}
      title="Booking Settlement Audit"
    >
      <section className="finance-list-command-board admin-mb-16" aria-label="Settlement audit command board">
        <FinanceListCommandCard
          detail={`${summary.openTaxCount} snapshot row(s) still need declaration, payment, closeout, or reversal review.`}
          href={bookingSettlementAuditHref({ ...filters, page: 1, review: 'open' })}
          icon={AlertTriangle}
          label="Open tax ratio"
          tone={summary.openTaxCount > 0 ? 'warning' : 'success'}
          value={openTaxRatio}
        />
        <FinanceListCommandCard
          detail={`${summary.paidTaxCount} snapshot row(s) already marked paid or closed for the selected range.`}
          href={bookingSettlementAuditHref({ ...filters, page: 1, review: 'paid' })}
          icon={CheckCircle2}
          label="Paid tax ratio"
          tone={summary.paidTaxCount > 0 ? 'success' : 'neutral'}
          value={paidTaxRatio}
        />
        <FinanceListCommandCard
          detail="Partner VAT/PIT withheld by posted settlement snapshots in this audit scope."
          href={bookingSettlementAuditHref({ ...filters, page: 1, review: 'posted' })}
          icon={ShieldCheck}
          label="Withholding evidence"
          tone={summary.partnerWithholdingTotal > 0 ? 'primary' : 'neutral'}
          value={formatMoney(summary.partnerWithholdingTotal, summary.currency)}
        />
        <FinanceListCommandCard
          detail="Open detail rows when payment fee, coupon, VAT/PIT, or journal evidence must be checked."
          href={summary.openTaxCount > 0 ? bookingSettlementAuditHref({ ...filters, page: 1, review: 'open' }) : '/finance-overview'}
          icon={ReceiptText}
          label="Audit queue"
          tone={summary.openTaxCount > 0 ? 'danger' : 'success'}
          value={summary.openTaxCount > 0 ? 'Needs review' : 'Clear'}
        />
      </section>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${reviewLabel(filters.review)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Settlement audit filters"
      >
        <div className="participant-list admin-mt-12">
          {DATE_RANGE_LINKS.map(([label, range]) => (
            <Link
              className={`pill ${filters.range === range ? 'pill-info' : 'pill-neutral'}`}
              href={bookingSettlementAuditHref({ ...filters, page: 1, range })}
              key={range}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="participant-list admin-mt-10">
          {BOOKING_SETTLEMENT_REVIEW_LINKS.map((item) => (
            <Link
              className={`pill ${filters.review === item.review ? 'pill-warn' : 'pill-neutral'}`}
              href={bookingSettlementAuditHref({ ...filters, page: 1, review: item.review })}
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
              href={bookingSettlementAuditHref({ ...filters, page: 1, take })}
              key={take}
            >
              {take} rows
            </Link>
          ))}
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="Open the booking detail only when evidence is needed; the list stays intentionally compact."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Booking settlement snapshot rows"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No settlement snapshots match the current filters."
            headers={['Booking', 'Customer', 'Partner', 'Payment', 'Coupon evidence', 'Partner tax', 'HANDS fee', 'Status', 'Evidence']}
            rowCount={tableRows.length}
          >
            {tableRows.map((snapshot) => (
              <tr key={snapshot.id}>
                  <td>
                    <Link className="text-link" href={`/bookings/${snapshot.bookingId}`}>
                      {shortId(snapshot.bookingId)}
                    </Link>
                    <div>
                      <Link className="text-link" href={bookingSettlementAuditDetailHref(snapshot.id)}>
                        Snapshot {shortId(snapshot.id)}
                      </Link>
                    </div>
                    <div className="muted">{formatDateTime(snapshot.postedAt)}</div>
                    <div className="muted">{snapshot.booking?.status ?? 'Unknown status'}</div>
                  </td>
                  <td>
                    <strong>{personName(snapshot.customerProfile?.user, 'Unknown customer')}</strong>
                    <div className="muted">{snapshot.customerProfile?.user?.phone ?? '-'}</div>
                  </td>
                  <td>
                    <Link className="text-link" href={`/partners/${snapshot.providerProfileId}?section=full`}>
                      {snapshot.providerProfile?.displayName ??
                        personName(snapshot.providerProfile?.user, 'Unknown partner')}
                    </Link>
                    <div className="muted">{snapshot.providerProfile?.user?.phone ?? '-'}</div>
                  </td>
                  <td>
                    <strong>{snapshot.paymentMethod}</strong>
                    <div className="muted">
                      Customer {formatMoney(snapshot.customerPaymentAmount, snapshot.currency)}
                    </div>
                    <div className="muted">Processing {formatMoney(snapshot.paymentProcessingFee, snapshot.currency)}</div>
                  </td>
                  <td>
                    <Link className="text-link" href={bookingSettlementAuditDetailHref(snapshot.id)}>
                      View coupon snapshot
                    </Link>
                    <div className="muted">Discount, expense, and funding source are loaded on detail.</div>
                  </td>
                  <td>
                    <strong>{formatMoney(snapshot.partnerWithholdingTotal, snapshot.currency)}</strong>
                    <div className="muted">VAT {formatMoney(snapshot.partnerVatAmount, snapshot.currency)}</div>
                    <div className="muted">PIT {formatMoney(snapshot.partnerPitAmount, snapshot.currency)}</div>
                  </td>
                  <td>
                    <strong>{formatMoney(snapshot.platformFeeGross, snapshot.currency)}</strong>
                    <div className="muted">Net {formatMoney(snapshot.platformFeeNetRevenue, snapshot.currency)}</div>
                    <div className="muted">VAT {formatMoney(snapshot.companyOutputVat, snapshot.currency)}</div>
                  </td>
                  <td>
                    <span className={`pill ${taxStatusPill(snapshot.taxStatus)}`}>{snapshot.taxStatus}</span>
                    <div className="muted admin-mt-8">{snapshot.settlementStatus}</div>
                    <div className="muted">{snapshot.monthlyPeriod}</div>
                  </td>
                  <td>
                    <Link className="pill pill-info" href={bookingSettlementAuditDetailHref(snapshot.id)}>
                      Open detail
                    </Link>
                    <div className="muted">Snapshot {shortId(snapshot.id)}</div>
                    <div className="muted">Posted {formatDateTime(snapshot.postedAt)}</div>
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
            ariaLabel="Booking settlement audit pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) => bookingSettlementAuditHref({ ...filters, page })}
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

function taxStatusPill(status: string) {
  if (status === 'PAID' || status === 'CLOSED') {
    return 'pill-success';
  }
  if (status === 'DECLARED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}
