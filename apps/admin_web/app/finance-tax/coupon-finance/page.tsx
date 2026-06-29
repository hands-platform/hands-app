import Link from 'next/link';

import type {
  AdminBookingSettlementSnapshot,
  AdminCouponFinanceSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { dateRangeLabel } from '../../../lib/date-range';
import { formatDateTime, formatMoney, shortId } from '../../../lib/admin-format';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  BOOKING_SETTLEMENT_REVIEW_LINKS,
  buildBookingSettlementSnapshotRowsCsvHref,
  buildCouponFinanceApiHref,
  buildCouponFinanceSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  emptyCouponFinanceSummary,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
  reviewLabel,
  type BookingSettlementReview,
} from '../tax-settlement-page-model';

type CouponFinancePageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DATE_RANGE_LINKS = [
  ['Today', 'today'],
  ['Last 7 days', '7d'],
  ['Last 30 days', '30d'],
  ['All dates', 'all'],
] as const;

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
  const csvHref = buildBookingSettlementSnapshotRowsCsvHref(snapshots);

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
          <a
            className="pill pill-success"
            download={`hands-coupon-finance-${filters.range}-${filters.review}.csv`}
            href={csvHref}
          >
            Export visible CSV
          </a>
        </TaxFinanceWorkflowActions>
      }
      description="Company-funded coupon expense and coupon settlement policy snapshots from immutable booking settlements."
      metrics={[
        {
          helper: 'Coupon discount amount applied to customer payment in the current bounded queue.',
          label: 'Coupon gross discount',
          value: formatMoney(summary.couponDiscountAmount, summary.currency),
        },
        {
          helper: 'Company-funded coupon amount. This is marketing expense, not reduced platform revenue.',
          label: 'Company coupon expense',
          value: formatMoney(summary.companyCouponExpense, summary.currency),
        },
        {
          helper: 'Partner-funded coupon amount from settlement metadata.',
          label: 'Partner-funded coupon',
          value: formatMoney(summary.partnerFundedCouponAmount, summary.currency),
        },
        {
          helper: 'Coupons explicitly treated as platform-fee discount.',
          label: 'Platform fee discount',
          value: formatMoney(summary.platformFeeDiscountAmount, summary.currency),
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
      ]}
      title="Coupon Finance"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`Showing ${snapshots.length} coupon settlement rows. Range: ${dateRangeLabel(
            filters.range,
          )}. Queue: ${reviewLabel(filters.review)}.`}
          status={<span className="pill pill-success">take {filters.take}</span>}
          title="Coupon finance filters"
        />
        <div className="participant-list admin-mt-12">
          {DATE_RANGE_LINKS.map(([label, range]) => (
            <Link
              className={`pill ${filters.range === range ? 'pill-info' : 'pill-neutral'}`}
              href={couponFinanceHref({ ...filters, range })}
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
              href={couponFinanceHref({ ...filters, review: item.review })}
              key={item.review}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="Coupon policy values are historical settlement snapshots. Changing coupon settings later must not rewrite these rows."
          title="Coupon settlement rows"
        />
        <AdminTableScroll>
          <AdminDataTable
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
            rowCount={snapshots.length}
          >
            {snapshots.map((snapshot) => {
              const coupon = couponSettlementInfo(snapshot);

              return (
                <tr key={snapshot.id}>
                  <td>
                    <Link className="text-link" href={`/bookings/${snapshot.bookingId}`}>
                      {shortId(snapshot.bookingId)}
                    </Link>
                    <div className="muted">{snapshot.monthlyPeriod}</div>
                  </td>
                  <td>
                    <strong>{formatDateTime(snapshot.closedAt ?? snapshot.booking?.closedAt ?? snapshot.postedAt)}</strong>
                    <div className="muted">Posted {formatDateTime(snapshot.postedAt)}</div>
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
                    <div className="muted">Customer paid {formatMoney(coupon.customerPaid, snapshot.currency)}</div>
                  </td>
                  <td>
                    <strong>{coupon.code}</strong>
                    <div className="muted">{coupon.fundingSource}</div>
                    <div className="muted">{coupon.accountingTreatment}</div>
                    <div className="muted">Base {coupon.settlementBasePolicy}</div>
                  </td>
                  <td>
                    <strong>Discount {formatMoney(coupon.discountAmount, snapshot.currency)}</strong>
                    <div className="muted">Service {formatMoney(coupon.bookingServiceAmount, snapshot.currency)}</div>
                    <div className="muted">Settlement {formatMoney(coupon.settlementBaseAmount, snapshot.currency)}</div>
                    <div className="muted">Company expense {formatMoney(coupon.companyExpense, snapshot.currency)}</div>
                  </td>
                  <td>
                    <span className={`pill ${coupon.reviewFlag ? 'pill-warn' : 'pill-success'}`}>
                      {coupon.reviewFlag ?? 'Snapshot OK'}
                    </span>
                    <div className="muted admin-mt-8">{snapshot.settlementStatus}</div>
                    <div className="muted">{snapshot.taxStatus}</div>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
      </section>
    </AdminPageTemplate>
  );
}

function couponFinanceHref(filters: {
  readonly range: string;
  readonly review: BookingSettlementReview;
}) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  return `/finance-tax/coupon-finance?${params.toString()}`;
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

function personName(user: { fullName?: string | null; phone?: string | null } | null | undefined, fallback: string) {
  return user?.fullName ?? user?.phone ?? fallback;
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
