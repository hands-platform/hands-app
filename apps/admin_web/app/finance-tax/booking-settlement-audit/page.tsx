import Link from 'next/link';

import type {
  AdminBookingSettlementSnapshot,
  AdminBookingSettlementSnapshotSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { dateRangeLabel } from '../../../lib/date-range';
import { formatDateTime, formatMoney, shortId } from '../../../lib/admin-format';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  BOOKING_SETTLEMENT_REVIEW_LINKS,
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotRowsCsvHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  emptyBookingSettlementSummary,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
  reviewLabel,
  type BookingSettlementReview,
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
  const csvHref = buildBookingSettlementSnapshotRowsCsvHref(snapshots);

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
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`Showing ${snapshots.length} bounded rows. Range: ${dateRangeLabel(filters.range)}. Queue: ${reviewLabel(filters.review)}.`}
          status={<span className="pill pill-success">take {filters.take}</span>}
          title="Settlement audit filters"
        />
        <div className="participant-list admin-mt-12">
          {DATE_RANGE_LINKS.map(([label, range]) => (
            <Link
              className={`pill ${filters.range === range ? 'pill-info' : 'pill-neutral'}`}
              href={auditHref({ ...filters, range })}
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
              href={auditHref({ ...filters, review: item.review })}
              key={item.review}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="Open the booking detail only when evidence is needed; the list stays intentionally compact."
          title="Booking settlement snapshot rows"
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No settlement snapshots match the current filters."
            headers={['Booking', 'Customer', 'Partner', 'Payment', 'Partner tax', 'HANDS fee', 'Status']}
            rowCount={snapshots.length}
          >
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id}>
                <td>
                  <Link className="text-link" href={`/bookings/${snapshot.bookingId}`}>
                    {shortId(snapshot.bookingId)}
                  </Link>
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
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </section>
    </AdminPageTemplate>
  );
}

function auditHref(filters: {
  readonly range: string;
  readonly review: BookingSettlementReview;
}) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  return `/finance-tax/booking-settlement-audit?${params.toString()}`;
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
