import { BadgePercent, Banknote, CreditCard, RotateCcw } from 'lucide-react';

import type {
  AdminAccountingJournalBatch,
  AdminBookingSettlementReversalEntry,
  AdminBookingSettlementReversalSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTableSubstack } from '../../../components/admin-data-table';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import { shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { financePersonName } from '../finance-participant-label';
import { FinanceListFilterLinks, FINANCE_LIST_DATE_RANGE_LINKS } from '../finance-list-filter-links';
import {
  FinanceListCommandBoard,
  FinanceListCommandCard,
  formatFinancePercent,
} from '../finance-list-command-card';
import {
  financeEvidenceTonePill,
  financeSettlementReversalTaxStatusPill,
} from '../finance-status-badge-model';
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
  const [summary, reversals, reversalJournals] = await Promise.all([
    adminGet<AdminBookingSettlementReversalSummary>(
      buildBookingSettlementReversalSummaryApiHref(filters),
      emptyBookingSettlementReversalSummary(),
    ),
    adminGet<AdminBookingSettlementReversalEntry[]>(buildBookingSettlementReversalApiHref(filters), []),
    adminGet<AdminAccountingJournalBatch[]>(
      `/admin/accounting-journal-batches?${new URLSearchParams({
        q: 'reversal',
        range: filters.range,
        take: '20',
      }).toString()}`,
      [],
    ),
  ]);
  const disbursementReversalJournals = reversalJournals
    .filter(
      (journal) =>
        journal.sourceKey.endsWith(':reversal') &&
        (journal.sourceType === 'PROVIDER_PAYOUT_BATCH' || journal.sourceType === 'PROVIDER_WITHDRAWAL'),
    )
    .sort((left, right) => Date.parse(right.postedAt) - Date.parse(left.postedAt))
    .slice(0, 10);
  const pagination = buildTaxSettlementServerPagination(reversals, filters, summary.count);
  const taxReversalImpact = summary.partnerWithholdingTotal + summary.companyOutputVat;
  const rangeScope = dateRangeLabel(filters.range);

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
      title="Settlement Reversals"
    >
      <FinanceListCommandBoard ariaLabel="Reversal command board">
        <FinanceListCommandCard
          detail={`${summary.count} immutable closed-period reversal record(s) preserve the original settlement and correction evidence.`}
          href={bookingSettlementReversalHref({ ...filters, page: 1 })}
          icon={RotateCcw}
          label="Closed-period reversals"
          scope={rangeScope}
          tone={summary.count > 0 ? 'info' : 'success'}
          value={<MoneyText amount={summary.customerPaymentAmount} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail={`${summary.cashCount} cash reversal row(s) may affect partner wallet receivable and manual settlement follow-up.`}
          href={bookingSettlementReversalHref({ ...filters, page: 1, review: 'cash' })}
          icon={Banknote}
          label="Cash share"
          scope={rangeScope}
          tone={summary.cashCount > 0 ? 'warning' : 'neutral'}
          value={formatFinancePercent(summary.cashCount, summary.count)}
        />
        <FinanceListCommandCard
          detail={`${summary.nonCashCount} non-cash reversal row(s) should link to refund, clearing, and bank reconciliation evidence.`}
          href={bookingSettlementReversalHref({ ...filters, page: 1, review: 'non-cash' })}
          icon={CreditCard}
          label="Non-cash share"
          scope={rangeScope}
          tone={summary.nonCashCount > 0 ? 'info' : 'neutral'}
          value={formatFinancePercent(summary.nonCashCount, summary.count)}
        />
        <FinanceListCommandCard
          detail="Partner withholding and company output VAT corrections recorded through reversal entries in this selected scope."
          href="/finance-tax/platform-vat"
          icon={BadgePercent}
          label="Tax correction recorded"
          scope={rangeScope}
          tone={taxReversalImpact > 0 ? 'info' : 'success'}
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
              className: 'admin-mt-12',
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
                  <AdminTextLink href={`/bookings/${reversal.bookingId}`}>
                    {shortId(reversal.bookingId)}
                  </AdminTextLink>
                  <div className="muted">
                    <DateTimeText value={reversal.occurredAt} />
                  </div>
                  <div className="muted">{shortId(reversal.sourceKey)}</div>
                </td>
                <td>
                  <strong>{reversal.originalMonthlyPeriod}</strong>
                  <div className="muted">Closing {shortId(reversal.originalMonthlyClosingId)}</div>
                  <div className="muted">
                    Original record {shortId(reversal.originalSettlementSnapshotId)}
                  </div>
                </td>
                <td>
                  <strong>
                    {financePersonName(
                      reversal.originalSettlementSnapshot?.customerProfile?.user,
                      'Unknown customer',
                    )}
                  </strong>
                  {reversal.originalSettlementSnapshot?.customerProfile?.user?.phone ? (
                    <div className="muted">
                      {reversal.originalSettlementSnapshot.customerProfile.user.phone}
                    </div>
                  ) : (
                    <AdminInlineFallback className="admin-mt-6">No customer phone</AdminInlineFallback>
                  )}
                </td>
                <td>
                  <AdminTextLink href={`/partners/${reversal.providerProfileId}?section=full`}>
                    {reversal.originalSettlementSnapshot?.providerProfile?.displayName ??
                      financePersonName(
                        reversal.originalSettlementSnapshot?.providerProfile?.user,
                        'Unknown partner',
                      )}
                  </AdminTextLink>
                  {reversal.originalSettlementSnapshot?.providerProfile?.user?.phone ? (
                    <div className="muted">
                      {reversal.originalSettlementSnapshot.providerProfile.user.phone}
                    </div>
                  ) : (
                    <AdminInlineFallback className="admin-mt-6">No partner phone</AdminInlineFallback>
                  )}
                </td>
                <td>
                  <strong>{reversal.paymentMethod}</strong>
                  <div className="muted">
                    Payment {reversal.paymentId ? shortId(reversal.paymentId) : '-'}
                  </div>
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
                  <AdminTableSubstack>
                    <StatusBadgeFromPillClass pillClass={financeEvidenceTonePill(evidenceState.tone)}>
                      {evidenceState.label}
                    </StatusBadgeFromPillClass>
                    <div className="muted">{evidenceState.detail}</div>
                    <AdminTextLink href={bookingSettlementReversalDetailHref(reversal.id)}>
                      Open reversal <span className="muted">{shortId(reversal.id)}</span>
                    </AdminTextLink>
                    {buildBookingSettlementReversalTraceLinks(reversal).map((link) => (
                      <AdminTextLink href={link.href} key={`${reversal.id}:${link.label}`}>
                        {link.label} <span className="muted">{link.value}</span>
                      </AdminTextLink>
                    ))}
                  </AdminTableSubstack>
                </td>
                <td>
                  <StatusBadgeFromPillClass
                    pillClass={financeSettlementReversalTaxStatusPill(reversal.taxStatus)}
                  >
                    {reversal.taxStatus}
                  </StatusBadgeFromPillClass>
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

      <FinanceTablePanel
        description="Returned or rejected Partner disbursements. Each row restores the Partner wallet in the current open period while preserving the original paid record."
        resultLabel={`${disbursementReversalJournals.length} recent row(s)`}
        resultTone={disbursementReversalJournals.length > 0 ? 'warning' : 'success'}
        title="Payout and withdrawal reversal journals"
      >
        <FinanceDataTable
          emptyMessage="No payout or withdrawal reversal journal is visible in the selected range."
          headers={['Source', 'Partner', 'Posted', 'Debit', 'Credit', 'Evidence']}
          rowCount={disbursementReversalJournals.length}
        >
          {disbursementReversalJournals.map((journal) => (
            <tr key={journal.id}>
              <td>
                <strong>{disbursementReversalSourceLabel(journal)}</strong>
                <div className="muted">{shortId(journal.sourceId)}</div>
              </td>
              <td>
                {journal.providerProfileId ? (
                  <AdminTextLink href={`/partners/${journal.providerProfileId}?section=full#finance`}>
                    {journal.providerProfile?.displayName ??
                      financePersonName(journal.providerProfile?.user, 'Unknown partner')}
                  </AdminTextLink>
                ) : (
                  <AdminInlineFallback>No Partner link</AdminInlineFallback>
                )}
              </td>
              <td>
                <DateTimeText value={journal.postedAt} />
                <div className="muted">{journal.monthlyPeriod ?? 'Open period'}</div>
              </td>
              <td>
                <MoneyText amount={journal.totalDebit} currency={journal.currency} />
              </td>
              <td>
                <MoneyText amount={journal.totalCredit} currency={journal.currency} />
              </td>
              <td>
                <StatusBadgeFromPillClass
                  pillClass={journal.totalDebit === journal.totalCredit ? 'pill-success' : 'pill-danger'}
                >
                  {journal.totalDebit === journal.totalCredit ? 'Balanced' : 'Unbalanced'}
                </StatusBadgeFromPillClass>
                <div className="muted admin-mt-8">Bank return evidence recorded</div>
                <AdminTextLink href={`/finance-tax/general-ledger/${journal.id}`}>
                  Open reversal journal
                </AdminTextLink>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        <div className="admin-mt-12">
          <AdminTextLink href="/finance-tax/general-ledger?q=reversal">
            Open all reversal journals
          </AdminTextLink>
        </div>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function reversalReviewLabel(review: string) {
  return SETTLEMENT_REVERSAL_REVIEW_LINKS.find((item) => item.review === review)?.label ?? 'All';
}

function disbursementReversalSourceLabel(journal: AdminAccountingJournalBatch) {
  return journal.sourceType === 'PROVIDER_PAYOUT_BATCH'
    ? 'Payout batch reversal'
    : 'Partner withdrawal reversal';
}
