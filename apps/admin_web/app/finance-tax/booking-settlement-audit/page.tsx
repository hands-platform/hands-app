import { AlertTriangle, CheckCircle2, ReceiptText, ShieldCheck } from 'lucide-react';

import type {
  AdminBookingSettlementSnapshot,
  AdminBookingSettlementSnapshotSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { ActionMenu } from '../../../components/action-menu';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass, StatusBadgeLink } from '../../../components/status-badge';
import { dateRangeLabel } from '../../../lib/date-range';
import { shortId } from '../../../lib/admin-format';
import { FinanceDataTable } from '../finance-data-table';
import { financePersonName } from '../finance-participant-label';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { financeTaxCloseoutStatusPill } from '../finance-status-badge-model';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
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
          <StatusBadgeLink
            download={`hands-booking-settlement-audit-${filters.range}-${filters.review}.csv`}
            href={csvHref}
            tone="success"
          >
            Export settlement CSV
          </StatusBadgeLink>
        </TaxFinanceWorkflowActions>
      }
      description="Immutable booking settlement snapshots for customer payment, Partner payout, VAT/PIT, payment fee, and company VAT audit."
      title="Booking Settlement Audit"
    >
      <FinanceListCommandBoard ariaLabel="Settlement audit command board">
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
          value={<MoneyText amount={summary.partnerWithholdingTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Open detail rows when payment fee, coupon, VAT/PIT, or journal evidence must be checked."
          href={summary.openTaxCount > 0 ? bookingSettlementAuditHref({ ...filters, page: 1, review: 'open' }) : '/finance-overview'}
          icon={ReceiptText}
          label="Audit queue"
          tone={summary.openTaxCount > 0 ? 'danger' : 'success'}
          value={summary.openTaxCount > 0 ? 'Needs review' : 'Clear'}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${reviewLabel(filters.review)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Settlement audit filters"
      >
        <FinanceListFilterLinks
          groups={[
            {
              className: 'admin-mt-12',
              id: 'range',
              links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                active: filters.range === range,
                activePillClassName: 'pill-info',
                href: bookingSettlementAuditHref({ ...filters, page: 1, range }),
                id: range,
                label,
              })),
            },
            {
              id: 'review',
              links: BOOKING_SETTLEMENT_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: bookingSettlementAuditHref({ ...filters, page: 1, review: item.review }),
                id: item.review,
                label: item.label,
              })),
            },
            {
              id: 'take',
              links: FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                active: filters.take === take,
                activePillClassName: 'pill-success',
                href: bookingSettlementAuditHref({ ...filters, page: 1, take }),
                id: take,
                label: `${take} rows`,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="Open the booking detail only when evidence is needed; the list stays intentionally compact."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Booking settlement snapshot rows"
      >
        <FinanceDataTable
            emptyMessage="No settlement snapshots match the current filters."
            headers={['Booking', 'Customer', 'Partner', 'Payment', 'Coupon evidence', 'Partner tax', 'HANDS fee', 'Status', 'Evidence']}
            rowCount={tableRows.length}
          >
            {tableRows.map((snapshot) => (
              <tr key={snapshot.id}>
                  <td>
                    <AdminTextLink href={`/bookings/${snapshot.bookingId}`}>
                      {shortId(snapshot.bookingId)}
                    </AdminTextLink>
                    <div>
                      <AdminTextLink href={bookingSettlementAuditDetailHref(snapshot.id)}>
                        Snapshot {shortId(snapshot.id)}
                      </AdminTextLink>
                    </div>
                    <div className="muted">
                      <DateTimeText value={snapshot.postedAt} />
                    </div>
                    <div className="muted">{snapshot.booking?.status ?? 'Unknown status'}</div>
                  </td>
                  <td>
                    <strong>{financePersonName(snapshot.customerProfile?.user, 'Unknown customer')}</strong>
                    {snapshot.customerProfile?.user?.phone ? (
                      <div className="muted">{snapshot.customerProfile.user.phone}</div>
                    ) : (
                      <AdminInlineFallback className="admin-mt-6">No customer phone</AdminInlineFallback>
                    )}
                  </td>
                  <td>
                    <AdminTextLink href={`/partners/${snapshot.providerProfileId}?section=full`}>
                      {snapshot.providerProfile?.displayName ??
                        financePersonName(snapshot.providerProfile?.user, 'Unknown partner')}
                    </AdminTextLink>
                    {snapshot.providerProfile?.user?.phone ? (
                      <div className="muted">{snapshot.providerProfile.user.phone}</div>
                    ) : (
                      <AdminInlineFallback className="admin-mt-6">No partner phone</AdminInlineFallback>
                    )}
                  </td>
                  <td>
                    <strong>{snapshot.paymentMethod}</strong>
                    <div className="muted">
                      Customer <MoneyText amount={snapshot.customerPaymentAmount} currency={snapshot.currency} />
                    </div>
                    <div className="muted">
                      Processing{' '}
                      <MoneyText amount={snapshot.paymentProcessingFee} currency={snapshot.currency} />
                    </div>
                  </td>
                  <td>
                    <AdminTextLink href={bookingSettlementAuditDetailHref(snapshot.id)}>
                      View coupon snapshot
                    </AdminTextLink>
                    <div className="muted">Discount, expense, and funding source are loaded on detail.</div>
                  </td>
                  <td>
                    <strong>
                      <MoneyText amount={snapshot.partnerWithholdingTotal} currency={snapshot.currency} />
                    </strong>
                    <div className="muted">
                      VAT <MoneyText amount={snapshot.partnerVatAmount} currency={snapshot.currency} />
                    </div>
                    <div className="muted">
                      PIT <MoneyText amount={snapshot.partnerPitAmount} currency={snapshot.currency} />
                    </div>
                  </td>
                  <td>
                    <strong>
                      <MoneyText amount={snapshot.platformFeeGross} currency={snapshot.currency} />
                    </strong>
                    <div className="muted">
                      Net <MoneyText amount={snapshot.platformFeeNetRevenue} currency={snapshot.currency} />
                    </div>
                    <div className="muted">
                      VAT <MoneyText amount={snapshot.companyOutputVat} currency={snapshot.currency} />
                    </div>
                  </td>
                  <td>
                    <StatusBadgeFromPillClass pillClass={financeTaxCloseoutStatusPill(snapshot.taxStatus)}>
                      {snapshot.taxStatus}
                    </StatusBadgeFromPillClass>
                    <div className="muted admin-mt-8">{snapshot.settlementStatus}</div>
                    <div className="muted">{snapshot.monthlyPeriod}</div>
                  </td>
                  <td>
                    <ActionMenu
                      actions={[
                        {
                          href: bookingSettlementAuditDetailHref(snapshot.id),
                          kind: 'link',
                          label: 'Open detail',
                          tone: 'info',
                        },
                      ]}
                      label={`Booking settlement evidence actions for ${snapshot.id}`}
                    />
                    <div className="muted">Snapshot {shortId(snapshot.id)}</div>
                    <div className="muted">
                      Posted <DateTimeText value={snapshot.postedAt} />
                    </div>
                  </td>
                </tr>
            ))}
          </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Booking settlement audit pages"
          hrefForPage={(page) => bookingSettlementAuditHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}
