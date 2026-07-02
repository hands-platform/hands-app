import Link from 'next/link';
import { BadgePercent, Banknote, CreditCard, RotateCcw } from 'lucide-react';

import type {
  AdminBookingSettlementReversalEntry,
  AdminBookingSettlementReversalSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminRoundedPagination } from '../../../components/admin-rounded-pagination';
import { formatDateTime, formatMoney, shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  SETTLEMENT_REVERSAL_REVIEW_LINKS,
  bookingSettlementReversalDetailHref,
  bookingSettlementReversalHref,
  buildBookingSettlementReversalApiHref,
  buildBookingSettlementReversalEvidenceState,
  buildBookingSettlementReversalSummaryApiHref,
  buildBookingSettlementReversalTraceLinks,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyBookingSettlementReversalSummary,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type SettlementReversalsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DATE_RANGE_LINKS = [
  ['Today', 'today'],
  ['Last 7 days', '7d'],
  ['Last 30 days', '30d'],
  ['All dates', 'all'],
] as const;

export default async function SettlementReversalsPage({ searchParams }: SettlementReversalsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summary, reversals] = await Promise.all([
    adminGet<AdminBookingSettlementReversalSummary>(
      buildBookingSettlementReversalSummaryApiHref(filters),
      emptyBookingSettlementReversalSummary(),
    ),
    adminGet<AdminBookingSettlementReversalEntry[]>(buildBookingSettlementReversalApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(reversals, filters, summary.count);
  const taxReversalImpact = summary.partnerWithholdingTotal + summary.companyOutputVat;

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'settlement-reversals',
            monthlyFilters,
            settlementFilters: filters,
            withholdingFilters,
          })}
        />
      }
      description="Closed-period refund and settlement reversal records. These rows preserve the original monthly close and point finance to reversal journal and clearing evidence."
      metrics={[
        { helper: 'Reversal rows matching the current filters.', label: 'Reversals', value: summary.count },
        { helper: 'Cash settlement reversals.', label: 'Cash', value: summary.cashCount },
        { helper: 'Non-cash settlement reversals.', label: 'Non-cash', value: summary.nonCashCount },
        {
          helper: 'Platform fee revenue reversed in this scope.',
          label: 'Revenue reversal',
          value: formatMoney(summary.platformFeeNetRevenue, summary.currency),
        },
        {
          helper: 'Company output VAT reversed in this scope.',
          label: 'VAT reversal',
          value: formatMoney(summary.companyOutputVat, summary.currency),
        },
      ]}
      title="Settlement Reversals"
    >
      <section className="finance-list-command-board admin-mb-16" aria-label="Reversal command board">
        <FinanceListCommandCard
          detail={`${summary.count} closed-period reversal row(s) preserve the original settlement and post correction evidence.`}
          href={bookingSettlementReversalHref({ ...filters, page: 1 })}
          icon={RotateCcw}
          label="Reversal amount"
          tone={summary.count > 0 ? 'warning' : 'success'}
          value={formatMoney(summary.customerPaymentAmount, summary.currency)}
        />
        <FinanceListCommandCard
          detail={`${summary.cashCount} cash reversal row(s) may affect partner wallet receivable and manual settlement follow-up.`}
          href={bookingSettlementReversalHref({ ...filters, page: 1, review: 'cash' })}
          icon={Banknote}
          label="Cash share"
          tone={summary.cashCount > 0 ? 'warning' : 'neutral'}
          value={formatFinancePercent(summary.cashCount, summary.count)}
        />
        <FinanceListCommandCard
          detail={`${summary.nonCashCount} non-cash reversal row(s) should trace to refund, clearing, and bank reconciliation evidence.`}
          href={bookingSettlementReversalHref({ ...filters, page: 1, review: 'non-cash' })}
          icon={CreditCard}
          label="Non-cash share"
          tone={summary.nonCashCount > 0 ? 'info' : 'neutral'}
          value={formatFinancePercent(summary.nonCashCount, summary.count)}
        />
        <FinanceListCommandCard
          detail="Partner withholding plus company output VAT reversed in this selected scope."
          href="/finance-tax/platform-vat"
          icon={BadgePercent}
          label="Tax reversal impact"
          tone={taxReversalImpact > 0 ? 'danger' : 'success'}
          value={formatMoney(taxReversalImpact, summary.currency)}
        />
      </section>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${reversalReviewLabel(filters.review)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Settlement reversal filters"
      >
        <div className="participant-list admin-mt-12">
          {DATE_RANGE_LINKS.map(([label, range]) => (
            <Link
              className={`pill ${filters.range === range ? 'pill-info' : 'pill-neutral'}`}
              href={bookingSettlementReversalHref({ ...filters, page: 1, range })}
              key={range}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="participant-list admin-mt-10">
          {SETTLEMENT_REVERSAL_REVIEW_LINKS.map((item) => (
            <Link
              className={`pill ${filters.review === item.review ? 'pill-warn' : 'pill-neutral'}`}
              href={bookingSettlementReversalHref({ ...filters, page: 1, review: item.review })}
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
              href={bookingSettlementReversalHref({ ...filters, page: 1, take })}
              key={take}
            >
              {take} rows
            </Link>
          ))}
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="The original settlement remains immutable; this list shows the reversal row and its accounting impact."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Settlement reversal rows"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No settlement reversal rows match the current filters."
            headers={[
              'Booking',
              'Original close',
              'Customer',
              'Partner',
              'Payment',
              'Reversal amounts',
              'Tax and fee',
              'Evidence',
              'Status',
            ]}
            rowCount={pagination.rows.length}
          >
            {pagination.rows.map((reversal) => {
              const evidenceState = buildBookingSettlementReversalEvidenceState(reversal);

              return (
                <tr key={reversal.id}>
                  <td>
                    <Link className="text-link" href={`/bookings/${reversal.bookingId}`}>
                      {shortId(reversal.bookingId)}
                    </Link>
                    <div className="muted">{formatDateTime(reversal.occurredAt)}</div>
                    <div className="muted">{shortId(reversal.sourceKey)}</div>
                  </td>
                  <td>
                    <strong>{reversal.originalMonthlyPeriod}</strong>
                    <div className="muted">Closing {shortId(reversal.originalMonthlyClosingId)}</div>
                    <div className="muted">Snapshot {shortId(reversal.originalSettlementSnapshotId)}</div>
                  </td>
                  <td>
                    <strong>{personName(reversal.originalSettlementSnapshot?.customerProfile?.user, 'Unknown customer')}</strong>
                    <div className="muted">{reversal.originalSettlementSnapshot?.customerProfile?.user?.phone ?? '-'}</div>
                  </td>
                  <td>
                    <Link className="text-link" href={`/partners/${reversal.providerProfileId}?section=full`}>
                      {reversal.originalSettlementSnapshot?.providerProfile?.displayName ??
                        personName(reversal.originalSettlementSnapshot?.providerProfile?.user, 'Unknown partner')}
                    </Link>
                    <div className="muted">{reversal.originalSettlementSnapshot?.providerProfile?.user?.phone ?? '-'}</div>
                  </td>
                  <td>
                    <strong>{reversal.paymentMethod}</strong>
                    <div className="muted">Payment {reversal.paymentId ? shortId(reversal.paymentId) : '-'}</div>
                    <div className="muted">Reversal period {reversal.monthlyPeriod}</div>
                  </td>
                  <td>
                    <strong>{formatMoney(reversal.customerPaymentAmount, reversal.currency)}</strong>
                    <div className="muted">Partner {formatMoney(reversal.partnerPayoutAmount, reversal.currency)}</div>
                    <div className="muted">Fee {formatMoney(reversal.platformFeeGross, reversal.currency)}</div>
                  </td>
                  <td>
                    <strong>{formatMoney(reversal.partnerWithholdingTotal, reversal.currency)}</strong>
                    <div className="muted">VAT {formatMoney(reversal.companyOutputVat, reversal.currency)}</div>
                    <div className="muted">Processing {formatMoney(reversal.paymentProcessingFee, reversal.currency)}</div>
                  </td>
                  <td>
                    <div className="admin-table-substack">
                      <span className={`pill ${evidencePill(evidenceState.tone)}`}>{evidenceState.label}</span>
                      <div className="muted">{evidenceState.detail}</div>
                      <Link className="text-link" href={bookingSettlementReversalDetailHref(reversal.id)}>
                        Open reversal <span className="muted">{shortId(reversal.id)}</span>
                      </Link>
                      {buildBookingSettlementReversalTraceLinks(reversal).map((link) => (
                        <Link className="text-link" href={link.href} key={`${reversal.id}:${link.label}`}>
                          {link.label} <span className="muted">{link.value}</span>
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${statusPill(reversal.taxStatus)}`}>{reversal.taxStatus}</span>
                    <div className="muted admin-mt-8">{reversal.settlementStatus}</div>
                    <div className="muted">{reversal.reason ?? 'Payment refund'}</div>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
        <div className="vuexy-booking-table-footer">
          <span>
            Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
          </span>
          <AdminRoundedPagination
            activePage={pagination.page}
            ariaLabel="Settlement reversal pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) => bookingSettlementReversalHref({ ...filters, page })}
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

function reversalReviewLabel(review: string) {
  return SETTLEMENT_REVERSAL_REVIEW_LINKS.find((item) => item.review === review)?.label ?? 'All';
}

function statusPill(status: string) {
  return status === 'REVERSED' ? 'pill-danger' : 'pill-warn';
}

function evidencePill(tone: 'danger' | 'success' | 'warning') {
  if (tone === 'success') {
    return 'pill-success';
  }
  if (tone === 'danger') {
    return 'pill-danger';
  }
  return 'pill-warn';
}
