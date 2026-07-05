import Link from 'next/link';
import { BadgePercent, Banknote, CreditCard, RotateCcw } from 'lucide-react';

import type {
  AdminBookingSettlementReversalEntry,
  AdminBookingSettlementReversalSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { financePersonName } from '../finance-participant-label';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { financeEvidenceTonePill, financeSettlementReversalTaxStatusPill } from '../finance-status-badge-model';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
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
          value: <MoneyText amount={summary.platformFeeNetRevenue} currency={summary.currency} />,
        },
        {
          helper: 'Company output VAT reversed in this scope.',
          label: 'VAT reversal',
          value: <MoneyText amount={summary.companyOutputVat} currency={summary.currency} />,
        },
      ]}
      title="Settlement Reversals"
    >
      <FinanceListCommandBoard ariaLabel="Reversal command board">
        <FinanceListCommandCard
          detail={`${summary.count} closed-period reversal row(s) preserve the original settlement and post correction evidence.`}
          href={bookingSettlementReversalHref({ ...filters, page: 1 })}
          icon={RotateCcw}
          label="Reversal amount"
          tone={summary.count > 0 ? 'warning' : 'success'}
          value={<MoneyText amount={summary.customerPaymentAmount} currency={summary.currency} />}
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
          value={<MoneyText amount={taxReversalImpact} currency={summary.currency} />}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Showing page ${pagination.page} of ${pagination.totalPages}. Range: ${dateRangeLabel(filters.range)}. Queue: ${reversalReviewLabel(filters.review)}.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Settlement reversal filters"
      >
        <FinanceListFilterLinks
          groups={[
            {
              className: 'participant-list admin-mt-12',
              id: 'range',
              links: FINANCE_LIST_DATE_RANGE_LINKS.map(([label, range]) => ({
                active: filters.range === range,
                activePillClassName: 'pill-info',
                href: bookingSettlementReversalHref({ ...filters, page: 1, range }),
                id: range,
                label,
              })),
            },
            {
              id: 'review',
              links: SETTLEMENT_REVERSAL_REVIEW_LINKS.map((item) => ({
                active: filters.review === item.review,
                activePillClassName: 'pill-warn',
                href: bookingSettlementReversalHref({ ...filters, page: 1, review: item.review }),
                id: item.review,
                label: item.label,
              })),
            },
            {
              id: 'take',
              links: FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
                active: filters.take === take,
                activePillClassName: 'pill-success',
                href: bookingSettlementReversalHref({ ...filters, page: 1, take }),
                id: take,
                label: `${take} rows`,
              })),
            },
          ]}
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="The original settlement remains immutable; this list shows the reversal row and its accounting impact."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Settlement reversal rows"
      >
        <FinanceDataTable
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
                    <div className="muted">
                      <DateTimeText value={reversal.occurredAt} />
                    </div>
                    <div className="muted">{shortId(reversal.sourceKey)}</div>
                  </td>
                  <td>
                    <strong>{reversal.originalMonthlyPeriod}</strong>
                    <div className="muted">Closing {shortId(reversal.originalMonthlyClosingId)}</div>
                    <div className="muted">Snapshot {shortId(reversal.originalSettlementSnapshotId)}</div>
                  </td>
                  <td>
                    <strong>{financePersonName(reversal.originalSettlementSnapshot?.customerProfile?.user, 'Unknown customer')}</strong>
                    <div className="muted">{reversal.originalSettlementSnapshot?.customerProfile?.user?.phone ?? '-'}</div>
                  </td>
                  <td>
                    <Link className="text-link" href={`/partners/${reversal.providerProfileId}?section=full`}>
                      {reversal.originalSettlementSnapshot?.providerProfile?.displayName ??
                        financePersonName(reversal.originalSettlementSnapshot?.providerProfile?.user, 'Unknown partner')}
                    </Link>
                    <div className="muted">{reversal.originalSettlementSnapshot?.providerProfile?.user?.phone ?? '-'}</div>
                  </td>
                  <td>
                    <strong>{reversal.paymentMethod}</strong>
                    <div className="muted">Payment {reversal.paymentId ? shortId(reversal.paymentId) : '-'}</div>
                    <div className="muted">Reversal period {reversal.monthlyPeriod}</div>
                  </td>
                  <td>
                    <strong>
                      <MoneyText amount={reversal.customerPaymentAmount} currency={reversal.currency} />
                    </strong>
                    <div className="muted">
                      Partner <MoneyText amount={reversal.partnerPayoutAmount} currency={reversal.currency} />
                    </div>
                    <div className="muted">
                      Fee <MoneyText amount={reversal.platformFeeGross} currency={reversal.currency} />
                    </div>
                  </td>
                  <td>
                    <strong>
                      <MoneyText amount={reversal.partnerWithholdingTotal} currency={reversal.currency} />
                    </strong>
                    <div className="muted">
                      VAT <MoneyText amount={reversal.companyOutputVat} currency={reversal.currency} />
                    </div>
                    <div className="muted">
                      Processing{' '}
                      <MoneyText amount={reversal.paymentProcessingFee} currency={reversal.currency} />
                    </div>
                  </td>
                  <td>
                    <div className="admin-table-substack">
                      <StatusBadge tone={statusBadgeToneFromPillClass(financeEvidenceTonePill(evidenceState.tone))}>
                        {evidenceState.label}
                      </StatusBadge>
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
                    <StatusBadge tone={statusBadgeToneFromPillClass(financeSettlementReversalTaxStatusPill(reversal.taxStatus))}>
                      {reversal.taxStatus}
                    </StatusBadge>
                    <div className="muted admin-mt-8">{reversal.settlementStatus}</div>
                    <div className="muted">{reversal.reason ?? 'Payment refund'}</div>
                  </td>
                </tr>
              );
            })}
          </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Settlement reversal pages"
          hrefForPage={(page) => bookingSettlementReversalHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}


function reversalReviewLabel(review: string) {
  return SETTLEMENT_REVERSAL_REVIEW_LINKS.find((item) => item.review === review)?.label ?? 'All';
}
