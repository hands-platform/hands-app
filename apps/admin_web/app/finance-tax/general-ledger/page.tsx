import { AlertTriangle, FileClock, ReceiptText, ShieldQuestion } from 'lucide-react';

import type {
  AdminAccountingJournalBatch,
  AdminAccountingJournalBatchSummary,
  AdminAccountingJournalIntegrity,
} from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  AdminFormActionRow,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
} from '../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTextLink } from '../../../components/admin-text-link';
import { AdminErrorState } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass, StatusBadgeLink } from '../../../components/status-badge';
import { formatMoney, shortId } from '../../../lib/admin-format';
import { dateRangeLabel } from '../../../lib/date-range';
import { FinanceDataTable } from '../finance-data-table';
import { financePersonName } from '../finance-participant-label';
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { financeJournalBatchStatusPill } from '../finance-status-badge-model';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  GENERAL_LEDGER_REVIEW_LINKS,
  FINANCE_ACCOUNTING_PAGE_SIZE_LINKS,
  buildAccountingJournalBatchApiHref,
  buildGeneralLedgerExportHref,
  buildAccountingJournalBatchSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxSettlementServerPagination,
  emptyAccountingJournalBatchSummary,
  financeAccountingReviewLabel,
  generalLedgerDetailHref,
  generalLedgerHref,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type GeneralLedgerPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const JOURNAL_RANGE_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

const JOURNAL_SOURCE_OPTIONS = [
  { label: 'All sources', value: '' },
  { label: 'Booking settlement', value: 'BOOKING_SETTLEMENT' },
  { label: 'Settlement reversal', value: 'BOOKING_SETTLEMENT_REVERSAL' },
  { label: 'Manual wallet adjustment', value: 'MANUAL_WALLET_ADJUSTMENT' },
  { label: 'Partner withdrawal', value: 'PROVIDER_WITHDRAWAL' },
  { label: 'Payout batch', value: 'PROVIDER_PAYOUT_BATCH' },
  { label: 'Partner bank deposit', value: 'PROVIDER_BANK_DEPOSIT' },
  { label: 'Referral reward', value: 'REFERRAL_REWARD' },
  { label: 'Refund', value: 'REFUND' },
  { label: 'Payment callback', value: 'PAYMENT_CALLBACK' },
  { label: 'Bank reconciliation adjustment', value: 'BANK_RECONCILIATION_ADJUSTMENT' },
  { label: 'Withholding remittance', value: 'WITHHOLDING_REMITTANCE' },
];

const JOURNAL_SORT_OPTIONS = [
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Newest first', value: 'newest' },
  { label: 'Largest discrepancy', value: 'largest-discrepancy' },
];

const JOURNAL_RELATED_FINANCE_KEYS = new Set([
  'overview',
  'approval-queue',
  'payment-clearing',
  'bank-reconciliation',
  'monthly-tax-closing',
]);

export default async function GeneralLedgerPage({ searchParams }: GeneralLedgerPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readFinanceAccountingFilters(params, 'needs-action');
  const ledgerQuery = filters.q ?? '';
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const overviewFilters = { ...filters, page: 1, q: undefined, review: 'all' as const };
  const [queueSummaryResult, overviewSummaryResult, batchesResult] = await Promise.all([
    adminGetResult<AdminAccountingJournalBatchSummary>(
      buildAccountingJournalBatchSummaryApiHref(filters),
      emptyAccountingJournalBatchSummary(),
    ),
    adminGetResult<AdminAccountingJournalBatchSummary>(
      buildAccountingJournalBatchSummaryApiHref(overviewFilters),
      emptyAccountingJournalBatchSummary(),
    ),
    adminGetResult<AdminAccountingJournalBatch[]>(
      buildAccountingJournalBatchApiHref(filters),
      [],
    ),
  ]);
  const queueSummary = queueSummaryResult.data;
  const overviewSummary = overviewSummaryResult.data;
  const batches = batchesResult.data;
  const totalRows = queueSummaryResult.ok ? queueSummary.count : batches.length;
  const pagination = buildTaxSettlementServerPagination(batches, filters, totalRows);
  const rangeScope = dateRangeLabel(filters.range);
  const currentHref = generalLedgerHref(filters);
  const queueHref = (nextFilters = filters) => generalLedgerHref(nextFilters);
  const clearSearchHref = generalLedgerHref({ ...filters, page: 1, q: undefined });
  const resetHref = generalLedgerHref({ page: 1, range: 'today', review: 'needs-action', take: 10 });
  const detailReturnTo = currentHref;
  const csvHref = buildGeneralLedgerExportHref(filters);
  const relatedFinanceLinks = buildTaxFinanceWorkflowLinks({
    accountingFilters: filters,
    current: 'general-ledger',
    monthlyFilters,
    settlementFilters,
    withholdingFilters,
  }).filter((link) => JOURNAL_RELATED_FINANCE_KEYS.has(link.key));
  const overviewError = journalLoadErrorCopy(overviewSummaryResult.status, 'summary');
  const recordsError = journalLoadErrorCopy(
    !batchesResult.ok ? batchesResult.status : queueSummaryResult.status,
    'records',
  );

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={relatedFinanceLinks}
        >
          <StatusBadgeLink
            download={`hands-journal-batches-${filters.period ?? filters.range}-${filters.review}.csv`}
            href={csvHref}
            tone="success"
          >
            Export filtered records
          </StatusBadgeLink>
        </TaxFinanceWorkflowActions>
      }
      description="Review bounded accounting journal batches and their server-verified header, entry, formula, and period integrity evidence."
      title="Journal Batches"
    >
      {overviewSummaryResult.ok ? (
      <>
      <FinanceListCommandBoard ariaLabel="Journal batch integrity queues">
        <FinanceListCommandCard
          detail={`${overviewSummary.blockedCount} blocked, ${overviewSummary.unknownCount} with incomplete evidence, and ${overviewSummary.draftCount} draft batch(es).`}
          href={queueHref({ ...filters, page: 1, q: undefined, review: 'needs-action' })}
          icon={AlertTriangle}
          label="Needs action"
          scope={overviewSummary.needsActionCount > 0 ? 'Action required' : rangeScope}
          tone={overviewSummary.needsActionCount > 0 ? 'danger' : 'success'}
          value={overviewSummary.needsActionCount}
        />
        <FinanceListCommandCard
          detail={`${formatMoney(overviewSummary.blockedAmount, overviewSummary.currency)} total maximum discrepancy across blocked batches.`}
          href={queueHref({ ...filters, page: 1, q: undefined, review: 'unbalanced' })}
          icon={ReceiptText}
          label="Blocked integrity"
          scope={overviewSummary.blockedCount > 0 ? 'Action required' : rangeScope}
          tone={overviewSummary.blockedCount > 0 ? 'danger' : 'success'}
          value={overviewSummary.blockedCount}
        />
        <FinanceListCommandCard
          detail="Required settlement formula or linked accounting-period evidence is missing. Do not interpret these records as zero discrepancy."
          href={queueHref({ ...filters, page: 1, q: undefined, review: 'needs-action' })}
          icon={ShieldQuestion}
          label="Evidence unknown"
          scope={overviewSummary.unknownCount > 0 ? 'Review required' : rangeScope}
          tone={overviewSummary.unknownCount > 0 ? 'warning' : 'success'}
          value={overviewSummary.unknownCount}
        />
        <FinanceListCommandCard
          detail={`${overviewSummary.draftCount} batch(es) are not posted and need Finance review before closeout.`}
          href={queueHref({ ...filters, page: 1, q: undefined, review: 'draft' })}
          icon={FileClock}
          label="Draft batches"
          scope={rangeScope}
          tone={overviewSummary.draftCount > 0 ? 'warning' : 'success'}
          value={overviewSummary.draftCount}
        />
       </FinanceListCommandBoard>
       <p className="muted admin-mb-16">
         Integrity checked <DateTimeText value={overviewSummary.generatedAt} />. Overview totals use the selected range and ignore search text; queue links clear search to preserve the displayed scope.
         {overviewSummary.oldestBlockerAt ? <> Oldest blocker <DateTimeText value={overviewSummary.oldestBlockerAt} />.</> : null}
       </p>
       </>
       ) : (
        <AdminErrorState
          action={<AdminFormControlLink href={currentHref}>Retry</AdminFormControlLink>}
          className="admin-mb-16"
          message={overviewError.message}
          title={overviewError.title}
        />
      )}

      <AdminFilterPanel
        className="admin-mb-16"
        description={generalLedgerFilterDescription({
          page: pagination.page,
          q: ledgerQuery,
          range: filters.range,
          review: filters.review,
          totalPages: pagination.totalPages,
        })}
        resultLabel={queueSummaryResult.ok ? `${pagination.totalRows} matching batch(es)` : 'Count unavailable'}
        resultTone={queueSummaryResult.ok ? generalLedgerResultTone(filters.review, pagination.totalRows) : 'danger'}
        title="Journal batch scope"
      >
        <AdminFormShell action="/finance-tax/general-ledger" className="filter-form" method="get">
          <AdminFormSearch
            defaultValue={ledgerQuery}
            label="Search journal batches"
            name="q"
            placeholder="Source, booking, payment, period, account"
          />
          <AdminFormSelect
            defaultValue={filters.review}
            label="Integrity queue"
            name="review"
            options={GENERAL_LEDGER_REVIEW_LINKS.map((item) => ({ label: item.label, value: item.review }))}
          />
          <AdminFormSelect
            defaultValue={filters.range}
            label="Posted range"
            name="range"
            options={JOURNAL_RANGE_OPTIONS}
          />
          <AdminFormSelect
            defaultValue={filters.journalSource ?? ''}
            label="Source type"
            name="source"
            options={JOURNAL_SOURCE_OPTIONS}
          />
          <AdminFormDate
            defaultValue={filters.period ?? ''}
            label="Accounting period"
            mode="month"
            name="period"
          />
          <AdminFormSelect
            defaultValue={filters.sort ?? (filters.review === 'needs-action' ? 'oldest' : 'newest')}
            label="Sort"
            name="sort"
            options={JOURNAL_SORT_OPTIONS}
          />
          <AdminFormSelect
            defaultValue={String(filters.take)}
            label="Rows"
            name="take"
            options={FINANCE_ACCOUNTING_PAGE_SIZE_LINKS.map((take) => ({
              label: String(take),
              value: String(take),
            }))}
          />
          <AdminFormActionRow wide={false}>
            <AdminFormControlButton className="button-primary" type="submit">Apply</AdminFormControlButton>
            {ledgerQuery ? <AdminFormControlLink href={clearSearchHref}>Clear search</AdminFormControlLink> : null}
            <AdminFormControlLink href={resetHref}>Reset</AdminFormControlLink>
          </AdminFormActionRow>
        </AdminFormShell>
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description={generalLedgerTableDescription(filters.review)}
        resultLabel={queueSummaryResult.ok ? `${pagination.totalRows} batch(es)` : 'Total unavailable'}
        resultTone={queueSummaryResult.ok ? generalLedgerResultTone(filters.review, pagination.totalRows) : 'danger'}
        title={financeAccountingReviewLabel(filters.review, GENERAL_LEDGER_REVIEW_LINKS)}
      >
        {!batchesResult.ok || !queueSummaryResult.ok ? (
          <AdminErrorState
            action={<AdminFormControlLink href={currentHref}>Retry filtered records</AdminFormControlLink>}
            message={recordsError.message}
            title={recordsError.title}
          />
        ) : (
          <>
        <FinanceDataTable
          ariaLabel="Journal batch results"
          emptyMessage={
            ledgerQuery
              ? `No journal batches match "${ledgerQuery}". Clear the search or reset the scope.`
              : 'No journal batches match the current scope.'
          }
          headers={['Journal batch', 'Related context', 'Period', 'Header / entries', 'Integrity']}
          rowCount={pagination.rows.length}
        >
          {pagination.rows.map((batch) => (
            <tr key={batch.id}>
              <td>
                <AdminTextLink href={generalLedgerDetailHref(batch.id, detailReturnTo)}>
                  <strong>{generalLedgerSourceLabel(batch.sourceType)}</strong>
                </AdminTextLink>
                <div className="muted">Source {shortId(batch.sourceId)}</div>
                <div className="muted">{batch._count?.entries ?? 0} entries</div>
              </td>
              <td>
                {batch.bookingId ? (
                  <div>
                    <AdminTextLink href={`/bookings/${batch.bookingId}`}>
                      Booking {shortId(batch.bookingId)}
                    </AdminTextLink>
                    <span className="muted"> · {batch.booking?.status ?? 'Unknown status'}</span>
                  </div>
                ) : (
                  <AdminInlineFallback>No booking</AdminInlineFallback>
                )}
                {batch.customerProfileId ? (
                  <div className="admin-mt-6">
                    <AdminTextLink href={`/customers/${batch.customerProfileId}`}>
                      {financePersonName(batch.customerProfile?.user, 'Unknown customer')}
                    </AdminTextLink>
                    <span className="muted"> · Customer</span>
                  </div>
                ) : null}
                {batch.providerProfileId ? (
                  <div className="admin-mt-6">
                    <AdminTextLink href={`/partners/${batch.providerProfileId}?section=full`}>
                      {batch.providerProfile?.displayName ??
                        financePersonName(batch.providerProfile?.user, 'Unknown partner')}
                    </AdminTextLink>
                    <span className="muted"> · Partner</span>
                  </div>
                ) : null}
                {batch.paymentId ? (
                  <div className="muted admin-mt-6">Payment {shortId(batch.paymentId)}</div>
                ) : null}
              </td>
              <td>
                {batch.monthlyPeriod ? (
                  <strong>{batch.monthlyPeriod}</strong>
                ) : (
                  <AdminInlineFallback>No monthly period</AdminInlineFallback>
                )}
                <div className="muted">
                  <DateTimeText value={batch.postedAt} />
                </div>
              </td>
              <td>
                <div><strong>Header debit </strong>
                  <MoneyText amount={batch.totalDebit} currency={batch.currency} />
                </div>
                <div className="muted">
                  Header credit <MoneyText amount={batch.totalCredit} currency={batch.currency} />
                </div>
                <div className="muted admin-mt-6">
                  Entries {batch.integrity?.entryCount ?? 'Unknown'} · debit{' '}
                  {batch.integrity ? (
                    <MoneyText amount={batch.integrity.entryDebit} currency={batch.currency} />
                  ) : 'Unknown'}
                  {' '}· credit{' '}
                  {batch.integrity ? (
                    <MoneyText amount={batch.integrity.entryCredit} currency={batch.currency} />
                  ) : 'Unknown'}
                </div>
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={financeJournalBatchStatusPill(batch.status)}>
                  {generalLedgerStatusLabel(batch.status)}
                </StatusBadgeFromPillClass>
                <div className="admin-mt-6">
                  <StatusBadge tone={journalIntegrityTone(batch.integrity?.state)}>
                    {journalIntegrityLabel(batch.integrity?.state)}
                  </StatusBadge>
                </div>
                {batch.integrity ? (
                  <div className="muted admin-mt-6">
                    Max discrepancy{' '}
                    <MoneyText amount={batch.integrity.discrepancyAmount} currency={batch.currency} />
                    {batch.integrity.formulaDelta !== null && batch.integrity.formulaDelta !== undefined ? (
                      <> · Formula <MoneyText amount={batch.integrity.formulaDelta} currency={batch.currency} /></>
                    ) : <> · Formula unknown</>}
                  </div>
                ) : null}
                 {batch.integrity?.blockerCodes.length ? (
                   <div className="muted admin-mt-6">{batch.integrity.blockerCodes.map(journalBlockerLabel).join(' · ')}</div>
                 ) : null}
                 {batch.integrity ? (
                   <div className="muted admin-mt-6">Checked <DateTimeText value={batch.integrity.checkedAt} /></div>
                 ) : null}
                {batch.reversedAt ? (
                  <div className="muted admin-mt-8">
                    <DateTimeText value={batch.reversedAt} />
                  </div>
                ) : null}
              </td>
             </tr>
          ))}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="General ledger pages"
          hrefForPage={(page) => queueHref({ ...filters, page })}
          pagination={pagination}
        />
          </>
        )}
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function generalLedgerFilterDescription(input: {
  page: number;
  q: string;
  range: Parameters<typeof generalLedgerHref>[0]['range'];
  review: Parameters<typeof generalLedgerHref>[0]['review'];
  totalPages: number;
}) {
  const parts = [
    `Showing page ${input.page} of ${input.totalPages}.`,
    `Queue: ${financeAccountingReviewLabel(input.review, GENERAL_LEDGER_REVIEW_LINKS)}.`,
    `Range: ${dateRangeLabel(input.range)}.`,
  ];
  if (input.q) parts.push(`Search: ${input.q}.`);
  return parts.join(' ');
}

function generalLedgerTableDescription(
  review: Parameters<typeof generalLedgerHref>[0]['review'],
) {
  if (review === 'needs-action') {
    return 'Oldest draft or integrity-blocked journal batches appear first. Resolve the source evidence before monthly close.';
  }
  if (review === 'unbalanced') {
    return 'Journal batches blocked by header, entry, formula, or accounting-period integrity evidence.';
  }
  if (review === 'draft') {
    return 'Draft journal batches awaiting Finance review, ordered from oldest to newest.';
  }
  if (review === 'reversed') {
    return 'Historical reversal journals. Open detail to inspect the retained original and reversal evidence.';
  }
  return 'Journal batches are ordered by the selected accounting sort. Open detail for entry-level and canonical source evidence.';
}

function generalLedgerResultTone(
  review: Parameters<typeof generalLedgerHref>[0]['review'],
  count: number,
) {
  if (review === 'needs-action' || review === 'unbalanced') {
    return count > 0 ? 'warning' as const : 'success' as const;
  }
  if (review === 'draft') return count > 0 ? 'warning' as const : 'success' as const;
  if (review === 'posted') return 'success' as const;
  return 'info' as const;
}

function generalLedgerSourceLabel(sourceType: AdminAccountingJournalBatch['sourceType']) {
  return sourceType
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function generalLedgerStatusLabel(status: AdminAccountingJournalBatch['status']) {
  if (status === 'DRAFT') return 'Draft';
  if (status === 'REVERSED') return 'Reversed';
  return 'Posted';
}

function journalIntegrityTone(state: AdminAccountingJournalIntegrity['state'] | undefined) {
  if (state === 'CLEAR') return 'success' as const;
  if (state === 'BLOCKED') return 'danger' as const;
  return 'warning' as const;
}

function journalIntegrityLabel(state: AdminAccountingJournalIntegrity['state'] | undefined) {
  if (state === 'CLEAR') return 'Integrity clear';
  if (state === 'BLOCKED') return 'Integrity blocked';
  return 'Integrity unknown';
}

function journalBlockerLabel(
  code: NonNullable<AdminAccountingJournalBatch['integrity']>['blockerCodes'][number],
) {
  const labels: Record<typeof code, string> = {
    ENTRY_UNBALANCED: 'Entry debit/credit mismatch',
    FORMULA_DELTA: 'Formula delta',
    FORMULA_EVIDENCE_MISSING: 'Formula evidence missing',
    HEADER_ENTRY_MISMATCH: 'Header/entry mismatch',
    HEADER_UNBALANCED: 'Header debit/credit mismatch',
    PERIOD_EVIDENCE_MISSING: 'Period evidence missing',
    PERIOD_MISMATCH: 'Accounting period mismatch',
    POSTED_WITHOUT_ENTRIES: 'Posted without entries',
  };
  return labels[code];
}

function journalLoadErrorCopy(status: number | null, scope: 'records' | 'summary') {
  if (status === 401 || status === 403) {
    return {
      message: `Your Admin session does not have permission to load journal batch ${scope}. Sign in with Finance access or ask an administrator to review your role.`,
      title: 'Journal batch permission required',
    };
  }
  if (scope === 'summary') {
    return {
      message: 'Journal batch totals could not be loaded. Retry before using queue counts for closeout decisions.',
      title: 'Journal summary unavailable',
    };
  }
  return {
    message: 'Journal batches or their authoritative queue total could not be loaded. No zero-count assumption has been made.',
    title: 'Journal batch records unavailable',
  };
}
