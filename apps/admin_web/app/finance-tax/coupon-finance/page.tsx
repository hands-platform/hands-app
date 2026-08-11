import { AlertTriangle, BadgeDollarSign, ReceiptText, RotateCcw } from 'lucide-react';

import type {
  AdminBookingSettlementSnapshot,
  AdminCouponFinanceSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSection } from '../../../components/admin-surface';
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
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { FinanceStageList } from '../finance-stage-list';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import {
  COUPON_FINANCE_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  buildCouponFinanceApiHref,
  buildCouponFinanceExportHref,
  buildCouponFinanceSummaryApiHref,
  buildTaxSettlementServerPagination,
  buildTaxFinanceWorkflowLinks,
  couponFinanceHref,
  emptyCouponFinanceSummary,
  readCouponFinanceFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type CouponFinancePageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CouponFinancePage({ searchParams }: CouponFinancePageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readCouponFinanceFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const overviewFilters = { ...filters, page: 1, review: 'all' as const };
  const currentSummaryPromise = adminGet<AdminCouponFinanceSummary>(
    buildCouponFinanceSummaryApiHref(filters),
    emptyCouponFinanceSummary(),
  );
  const [summary, overviewSummary, snapshots] = await Promise.all([
    currentSummaryPromise,
    filters.review === 'all'
      ? currentSummaryPromise
      : adminGet<AdminCouponFinanceSummary>(
          buildCouponFinanceSummaryApiHref(overviewFilters),
          emptyCouponFinanceSummary(),
        ),
    adminGet<AdminBookingSettlementSnapshot[]>(buildCouponFinanceApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(snapshots, filters, summary.couponSettlementCount);
  const tableRows = pagination.rows;
  const csvHref = buildCouponFinanceExportHref(filters);
  const couponRangeScope = dateRangeLabel(filters.range);
  const selectedReviewLabel =
    COUPON_FINANCE_REVIEW_LINKS.find((item) => item.review === filters.review)?.label ?? 'All records';
  const allRecordsHref = `${couponFinanceHref(overviewFilters)}#coupon-finance-records`;
  const totalsHref = `${couponFinanceHref(overviewFilters)}#coupon-finance-period-totals`;

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
      description="Company-funded coupon expense and coupon settlement policy records from posted booking settlements."
      title="Coupon Finance"
    >
      <FinanceListCommandBoard ariaLabel="Coupon finance command board">
        <FinanceListCommandCard
          detail="Settlement rows with an explicit coupon policy or accounting review flag."
          href={couponFinanceHref({ ...overviewFilters, review: 'coupon-review' })}
          icon={AlertTriangle}
          label="Coupon review flags"
          scope={overviewSummary.couponReviewFlagCount > 0 ? 'Needs action' : couponRangeScope}
          tone={overviewSummary.couponReviewFlagCount > 0 ? 'danger' : 'success'}
          value={overviewSummary.couponReviewFlagCount}
        />
        <FinanceListCommandCard
          detail="Company-funded coupon amount recorded as marketing expense, outside platform revenue."
          href={totalsHref}
          icon={BadgeDollarSign}
          label="Company coupon expense"
          scope={couponRangeScope}
          tone="info"
          value={<MoneyText amount={overviewSummary.companyCouponExpense} currency={overviewSummary.currency} />}
        />
        <FinanceListCommandCard
          detail="Coupon value explicitly deducted from platform fee. Review the retained policy before monthly close."
          href={totalsHref}
          icon={RotateCcw}
          label="Platform fee discount"
          scope={overviewSummary.platformFeeDiscountAmount > 0 ? 'Needs review' : couponRangeScope}
          tone={overviewSummary.platformFeeDiscountAmount > 0 ? 'warning' : 'success'}
          value={<MoneyText amount={overviewSummary.platformFeeDiscountAmount} currency={overviewSummary.currency} />}
        />
        <FinanceListCommandCard
          detail="Posted settlement records containing coupon code, discount, or funding metadata."
          href={allRecordsHref}
          icon={ReceiptText}
          label="Coupon records"
          scope={couponRangeScope}
          tone="neutral"
          value={overviewSummary.couponSettlementCount}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(
          filters.range,
        )}. Queue: ${selectedReviewLabel}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Coupon finance filters"
      >
        <FinanceListFilterLinks
          groups={[
            {
              className: 'admin-mt-12',
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
              links: COUPON_FINANCE_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: couponFinanceHref({ ...filters, page: 1, review: item.review }),
                id: item.review,
                label: item.label,
              })),
            },
            {
              id: 'take',
              links: FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                active: filters.take === take,
                activePillClassName: 'pill-success',
                href: couponFinanceHref({ ...filters, page: 1, take }),
                id: take,
                label: `${take} rows`,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      <AdminSection
        className="admin-mb-16"
        description={`All coupon accounting totals for ${selectedReviewLabel.toLowerCase()} in ${couponRangeScope}.`}
        id="coupon-finance-period-totals"
        statusLabel={`${summary.couponSettlementCount} record(s)`}
        statusTone={summary.couponReviewFlagCount > 0 ? 'warning' : 'info'}
        title="Current filtered totals"
      >
        <FinanceStageList
          items={[
            {
              helper: 'Gross service value before the coupon discount.',
              key: 'booking-service-amount',
              label: 'Booking service amount',
              signal: 'Service',
              value: <MoneyText amount={summary.bookingServiceAmount} currency={summary.currency} />,
            },
            {
              helper: 'Coupon discount applied to the customer-facing price.',
              key: 'coupon-discount-amount',
              label: 'Coupon gross discount',
              signal: 'Discount',
              value: <MoneyText amount={summary.couponDiscountAmount} currency={summary.currency} />,
            },
            {
              helper: 'Customer payment after coupon discount. This remains clearing, not company revenue.',
              key: 'customer-paid-amount',
              label: 'Customer paid',
              signal: 'Payment',
              value: <MoneyText amount={summary.customerPaidAmount} currency={summary.currency} />,
            },
            {
              helper: 'Pre-coupon base retained for Partner tax, payout, and platform fee calculation.',
              key: 'settlement-base-amount',
              label: 'Settlement base',
              signal: 'Settlement',
              value: (
                <MoneyText
                  amount={summary.settlementBaseAmount || summary.bookingServiceAmount}
                  currency={summary.currency}
                />
              ),
            },
            {
              helper: 'Company-funded value recognized as marketing expense.',
              key: 'company-coupon-expense',
              label: 'Company coupon expense',
              signal: 'Expense',
              value: <MoneyText amount={summary.companyCouponExpense} currency={summary.currency} />,
            },
            {
              helper: 'Partner-funded value retained separately from company coupon expense.',
              key: 'partner-funded-coupon',
              label: 'Partner-funded coupon',
              signal: 'Partner',
              value: <MoneyText amount={summary.partnerFundedCouponAmount} currency={summary.currency} />,
            },
            {
              helper: 'Discount explicitly applied against platform fee and requiring retained policy evidence.',
              key: 'platform-fee-discount',
              label: 'Platform fee discount',
              signal: summary.platformFeeDiscountAmount > 0 ? 'Review' : 'Clear',
              value: <MoneyText amount={summary.platformFeeDiscountAmount} currency={summary.currency} />,
            },
            {
              helper: (
                <>
                  Company expense reversal{' '}
                  <MoneyText amount={summary.reversedCompanyCouponExpense} currency={summary.currency} />.
                </>
              ),
              key: 'reversed-coupon',
              label: 'Reversed coupon discount',
              signal: 'Reversal',
              value: <MoneyText amount={summary.reversedCouponDiscountAmount} currency={summary.currency} />,
            },
          ]}
        />
      </AdminSection>

      <FinanceTablePanel
        grouped
        description="Coupon policy values are historical settlement records. Changing coupon settings later must not rewrite these rows."
        id="coupon-finance-records"
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
                      {coupon.reviewFlag ?? 'Policy record OK'}
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
