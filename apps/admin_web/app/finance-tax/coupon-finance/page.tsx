import type {
  AdminBookingSettlementSnapshot,
  AdminCouponFinanceSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeLink } from '../../../components/status-badge';
import { dateRangeLabel } from '../../../lib/date-range';
import { shortId } from '../../../lib/admin-format';
import { FinanceDataTable } from '../finance-data-table';
import { financePersonName } from '../finance-participant-label';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import {
  BOOKING_SETTLEMENT_REVIEW_LINKS,
  buildBookingSettlementSnapshotRowsCsvHref,
  buildCouponFinanceApiHref,
  buildCouponFinanceSummaryApiHref,
  buildTaxSettlementServerPagination,
  buildTaxFinanceWorkflowLinks,
  couponFinanceHref,
  emptyCouponFinanceSummary,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
  reviewLabel,
} from '../tax-settlement-page-model';

type CouponFinancePageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CouponFinancePage({ searchParams }: CouponFinancePageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summary, snapshots] = await Promise.all([
    adminGet<AdminCouponFinanceSummary>(
      buildCouponFinanceSummaryApiHref(filters),
      emptyCouponFinanceSummary(),
    ),
    adminGet<AdminBookingSettlementSnapshot[]>(buildCouponFinanceApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(snapshots, filters, summary.couponSettlementCount);
  const tableRows = pagination.rows;
  const csvHref = buildBookingSettlementSnapshotRowsCsvHref(tableRows);

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'coupon-finance',
            monthlyFilters,
            settlementFilters: filters,
            withholdingFilters,
          })}
        >
          <StatusBadgeLink
            download={`hands-coupon-finance-${filters.range}-${filters.review}.csv`}
            href={csvHref}
            tone="success"
          >
            Export visible CSV
          </StatusBadgeLink>
        </TaxFinanceWorkflowActions>
      }
      description="Company-funded coupon expense and coupon settlement policy snapshots from immutable booking settlements."
      metrics={[
        {
          helper: 'Coupon discount amount applied to customer payment in the current bounded queue.',
          label: 'Coupon gross discount',
          value: <MoneyText amount={summary.couponDiscountAmount} currency={summary.currency} />,
        },
        {
          helper: 'Customer-paid amount after coupon discount. This is clearing, not company revenue.',
          label: 'Customer paid',
          value: <MoneyText amount={summary.customerPaidAmount} currency={summary.currency} />,
        },
        {
          helper: 'Pre-coupon service base used for Partner tax, payout, and platform fee unless policy says otherwise.',
          label: 'Settlement base',
          value: <MoneyText amount={summary.settlementBaseAmount || summary.bookingServiceAmount} currency={summary.currency} />,
        },
        {
          helper: 'Company-funded coupon amount. This is marketing expense, not reduced platform revenue.',
          label: 'Company coupon expense',
          value: <MoneyText amount={summary.companyCouponExpense} currency={summary.currency} />,
        },
        {
          helper: 'Partner-funded coupon amount from settlement metadata.',
          label: 'Partner-funded coupon',
          value: <MoneyText amount={summary.partnerFundedCouponAmount} currency={summary.currency} />,
        },
        {
          helper: 'Coupons explicitly treated as platform-fee discount.',
          label: 'Platform fee discount',
          value: <MoneyText amount={summary.platformFeeDiscountAmount} currency={summary.currency} />,
        },
        {
          helper: 'Completed settlement rows with coupon metadata.',
          label: 'Coupon used bookings',
          value: summary.couponSettlementCount,
        },
        {
          helper: 'Coupon rows that require finance review before closing.',
          label: 'Pending review',
          value: summary.couponReviewFlagCount,
        },
        {
          helper: 'Coupon discount already reversed through refund or settlement reversal metadata.',
          label: 'Reversed coupon',
          value: <MoneyText amount={summary.reversedCouponDiscountAmount} currency={summary.currency} />,
        },
      ]}
      title="Coupon Finance"
    >
      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(
          filters.range,
        )}. Queue: ${reviewLabel(filters.review)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Coupon finance filters"
      >
        <FinanceListFilterLinks
          groups={[
            {
              className: 'participant-list admin-mt-12',
              id: 'range',
              links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                active: filters.range === range,
                activePillClassName: 'pill-info',
                href: couponFinanceHref({ ...filters, page: 1, range }),
                id: range,
                label,
              })),
            },
            {
              id: 'review',
              links: BOOKING_SETTLEMENT_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: couponFinanceHref({ ...filters, page: 1, review: item.review }),
                id: item.review,
                label: item.label,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="Coupon policy values are historical settlement snapshots. Changing coupon settings later must not rewrite these rows."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Coupon settlement rows"
      >
        <FinanceDataTable
            emptyMessage="No coupon settlement rows match the current filters."
            headers={[
              'Booking',
              'Completed',
              'Customer',
              'Partner',
              'Payment',
              'Coupon policy',
              'Amounts',
              'Review',
            ]}
            rowCount={tableRows.length}
          >
            {tableRows.map((snapshot) => {
              const coupon = couponSettlementInfo(snapshot);

              return (
                <tr key={snapshot.id}>
                  <td>
                    <AdminTextLink href={`/bookings/${snapshot.bookingId}`}>
                      {shortId(snapshot.bookingId)}
                    </AdminTextLink>
                    <div className="muted">{snapshot.monthlyPeriod}</div>
                  </td>
                  <td>
                    <strong>
                      <DateTimeText value={snapshot.closedAt ?? snapshot.booking?.closedAt ?? snapshot.postedAt} />
                    </strong>
                    <div className="muted">
                      Posted <DateTimeText value={snapshot.postedAt} />
                    </div>
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
                      Customer paid <MoneyText amount={coupon.customerPaid} currency={snapshot.currency} />
                    </div>
                  </td>
                  <td>
                    <strong>{coupon.code}</strong>
                    <div className="muted">{coupon.fundingSource}</div>
                    <div className="muted">{coupon.accountingTreatment}</div>
                    <div className="muted">Base {coupon.settlementBasePolicy}</div>
                  </td>
                  <td>
                    <strong>
                      Discount <MoneyText amount={coupon.discountAmount} currency={snapshot.currency} />
                    </strong>
                    <div className="muted">
                      Service <MoneyText amount={coupon.bookingServiceAmount} currency={snapshot.currency} />
                    </div>
                    <div className="muted">
                      Settlement <MoneyText amount={coupon.settlementBaseAmount} currency={snapshot.currency} />
                    </div>
                    <div className="muted">
                      Company expense <MoneyText amount={coupon.companyExpense} currency={snapshot.currency} />
                    </div>
                  </td>
                  <td>
                    <StatusBadge tone={coupon.reviewFlag ? 'warning' : 'success'}>
                      {coupon.reviewFlag ?? 'Snapshot OK'}
                    </StatusBadge>
                    <div className="muted admin-mt-8">{snapshot.settlementStatus}</div>
                    <div className="muted">{snapshot.taxStatus}</div>
                  </td>
                </tr>
              );
            })}
          </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Coupon finance settlement pages"
          hrefForPage={(page) => couponFinanceHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function couponSettlementInfo(snapshot: AdminBookingSettlementSnapshot) {
  const metadata = jsonRecord(snapshot.metadata);
  const discountAmount = numberValue(metadata?.couponDiscountAmount);
  const bookingServiceAmount =
    numberValue(metadata?.bookingServiceAmount) || snapshot.partnerTaxableRevenue || snapshot.customerPaymentAmount + discountAmount;
  return {
    accountingTreatment: stringValue(metadata?.couponAccountingTreatmentSnapshot) ?? 'MANUAL_REVIEW',
    bookingServiceAmount,
    code: stringValue(metadata?.couponCodeSnapshot) ?? stringValue(metadata?.couponId) ?? '-',
    companyExpense: numberValue(metadata?.companyCouponExpense),
    customerPaid: numberValue(metadata?.customerPaidAmount) || snapshot.customerPaymentAmount,
    discountAmount,
    fundingSource: stringValue(metadata?.couponFundingSourceSnapshot) ?? 'MANUAL_REVIEW',
    reviewFlag: stringValue(metadata?.couponReviewFlag),
    settlementBaseAmount: numberValue(metadata?.settlementBaseAmount) || bookingServiceAmount,
    settlementBasePolicy: stringValue(metadata?.settlementBasePolicySnapshot) ?? 'MANUAL_REVIEW',
  };
}


function jsonRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
