import { BadgePercent, Banknote, CreditCard, RotateCcw } from 'lucide-react';

import type {
  AdminBookingSettlementReversalEntry,
  AdminBookingSettlementReversalSummary,
} from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTableSubstack } from '../../../components/admin-data-table';
import { AdminTextLink } from '../../../components/admin-text-link';
import { AdminErrorState } from '../../../components/admin-surface';
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
  const [summaryResult, reversalsResult] = await Promise.all([
    adminGetResult<AdminBookingSettlementReversalSummary>(
      buildBookingSettlementReversalSummaryApiHref(filters),
      emptyBookingSettlementReversalSummary(),
    ),
    adminGetResult<AdminBookingSettlementReversalEntry[]>(buildBookingSettlementReversalApiHref(filters), []),
  ]);
  const currentHref = bookingSettlementReversalHref(filters);
  const workflowLinks = buildTaxFinanceWorkflowLinks({
    current: 'settlement-reversals',
    monthlyFilters,
    settlementFilters: filters,
    withholdingFilters,
  });
  if (!summaryResult.ok || !reversalsResult.ok) {
    const failedStatus = !summaryResult.ok ? summaryResult.status : reversalsResult.status;
    return (
      <AdminPageTemplate
        actions={<TaxFinanceWorkflowActions links={workflowLinks} />}
        description="Closed-period reversal data could not be loaded. No zero-count or closeout conclusion has been inferred."
        title="Settlement Reversals"
      >
        <AdminErrorState
          action={<AdminFormControlLink href={currentHref}>Retry reversal records</AdminFormControlLink>}
          message={
            failedStatus === 401 || failedStatus === 403
              ? 'Finance access was rejected. Sign in again or request the required permission.'
              : 'Retry before using reversal counts or evidence for a closeout decision.'
          }
          title="Settlement reversal data unavailable"
        />
      </AdminPageTemplate>
    );
  }
  const summary = summaryResult.data;
  const reversals = reversalsResult.data;
  const pagination = buildTaxSettlementServerPagination(reversals, filters, summary.count);
  const taxReversalImpact = summary.partnerWithholdingTotal + summary.companyOutputVat;
  const rangeScope = dateRangeLabel(filters.range);

  return (
    <AdminPageTemplate
      actions={<TaxFinanceWorkflowActions links={workflowLinks} />}
      description="Closed-period refund and settlement reversal records. These rows preserve the original monthly close and point finance to reversal journal and clearing evidence."
      title="Closed-period Settlement Reversals"
    >
      <FinanceListCommandBoard ariaLabel="Reversal command board">
        <FinanceListCommandCard
          detail={`${summary.count} immutable closed-period reversal record(s) preserve the original settlement and correction evidence.`}
          href={bookingSettlementReversalHref({ ...filters, page: 1 })}
          icon={RotateCcw}
          label="Closed-period reversals"
          scope={rangeScope}
          tone={summary.count > 0 ? 'info' : 'success'}
          value={
            <>
              <MoneyText amount={Math.abs(summary.customerPaymentAmount)} currency={summary.currency} />{' '}
              reversed
            </>
          }
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
          detail="Partner withholding and company output VAT amounts offset by immutable reversal entries in this selected scope."
          href="/finance-tax/platform-vat"
          icon={BadgePercent}
          label="Tax correction recorded"
          scope={rangeScope}
          tone={taxReversalImpact > 0 ? 'info' : 'success'}
          value={
            <>
              <MoneyText amount={Math.abs(taxReversalImpact)} currency={summary.currency} /> corrected
            </>
          }
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
        description={
          <>
            Immutable closed-period corrections only. For open- and closed-period reversal signals, open{' '}
            <AdminTextLink href="/finance-tax/booking-settlement-audit?range=all&review=reversals&sort=oldest&take=25">
              Booking Audit · All reversal signals
            </AdminTextLink>
            .
          </>
        }
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Settlement reversal rows"
      >
        <FinanceDataTable
          emptyMessage="No settlement reversal rows match the current filters."
          headers={[
            'Decision / next action',
            'Booking / parties',
            'Original / payment',
            'Reversed amount',
            'Tax correction',
            'Record status',
          ]}
          rowCount={pagination.rows.length}
          tableClassName="settlement-reversal-decision-table"
        >
          {pagination.rows.map((reversal) => {
            const evidenceState = buildBookingSettlementReversalEvidenceState(reversal);

            return (
              <tr key={reversal.id}>
                <td>
                  <AdminTableSubstack>
                    <StatusBadgeFromPillClass pillClass={financeEvidenceTonePill(evidenceState.tone)}>
                      {evidenceState.label}
                    </StatusBadgeFromPillClass>
                    <strong>
                      <MoneyText
                        amount={Math.abs(reversal.customerPaymentAmount)}
                        currency={reversal.currency}
                      />{' '}
                      reversed
                    </strong>
                    <div className="muted">{reversalNextAction(evidenceState.tone)}</div>
                    <AdminTextLink href={bookingSettlementReversalDetailHref(reversal.id, currentHref)}>
                      Open closed-period reversal {shortId(reversal.id)}
                    </AdminTextLink>
                  </AdminTableSubstack>
                </td>
                <td>
                  <AdminTextLink href={`/bookings/${reversal.bookingId}`}>
                    Booking {shortId(reversal.bookingId)}
                  </AdminTextLink>
                  <div className="muted">
                    <DateTimeText value={reversal.occurredAt} />
                  </div>
                  <strong>
                    {financePersonName(
                      reversal.originalSettlementSnapshot?.customerProfile?.user,
                      'Unknown customer',
                    )}
                  </strong>
                  <span className="muted admin-block">to</span>
                  <AdminTextLink href={`/partners/${reversal.providerProfileId}?section=full`}>
                    {reversal.originalSettlementSnapshot?.providerProfile?.displayName ??
                      financePersonName(
                        reversal.originalSettlementSnapshot?.providerProfile?.user,
                        'Unknown partner',
                      )}
                  </AdminTextLink>
                </td>
                <td>
                  <strong>Original close {reversal.originalMonthlyPeriod}</strong>
                  <div className="muted">Record {shortId(reversal.originalSettlementSnapshotId)}</div>
                  <div className="muted">Closing {shortId(reversal.originalMonthlyClosingId)}</div>
                  <div className="admin-mt-8">
                    <strong>{reversal.paymentMethod}</strong>
                  </div>
                  <div className="muted">
                    Payment {reversal.paymentId ? shortId(reversal.paymentId) : '-'}
                  </div>
                  <div className="muted">Reversal period {reversal.monthlyPeriod}</div>
                </td>
                <td>
                  <strong>
                    Customer{' '}
                    <MoneyText
                      amount={Math.abs(reversal.customerPaymentAmount)}
                      currency={reversal.currency}
                    />
                  </strong>
                  <div className="muted">
                    Partner payout offset{' '}
                    <MoneyText amount={Math.abs(reversal.partnerPayoutAmount)} currency={reversal.currency} />
                  </div>
                  <div className="muted">
                    Platform fee offset{' '}
                    <MoneyText amount={Math.abs(reversal.platformFeeGross)} currency={reversal.currency} />
                  </div>
                </td>
                <td>
                  <strong>
                    Withholding{' '}
                    <MoneyText
                      amount={Math.abs(reversal.partnerWithholdingTotal)}
                      currency={reversal.currency}
                    />
                  </strong>
                  <div className="muted">
                    Output VAT{' '}
                    <MoneyText amount={Math.abs(reversal.companyOutputVat)} currency={reversal.currency} />
                  </div>
                  <div className="muted">
                    Processing fee{' '}
                    <MoneyText
                      amount={Math.abs(reversal.paymentProcessingFee)}
                      currency={reversal.currency}
                    />
                  </div>
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
        description="Payout and withdrawal returns belong to Partner Money. Use its authoritative reconciliation queue or the server-filtered General Ledger instead of a partial client-side slice here."
        resultLabel="Separate responsibility"
        resultTone="info"
        title="Related Partner Money reversals"
      >
        <AdminTableSubstack>
          <AdminTextLink href="/payouts?view=reconciliation">Open Partner Money reconciliation</AdminTextLink>
          <AdminTextLink href="/finance-tax/general-ledger?range=all&review=all&source=PROVIDER_PAYOUT_BATCH&page=1&take=25">
            Open payout batch journals
          </AdminTextLink>
          <AdminTextLink href="/finance-tax/general-ledger?range=all&review=all&source=PROVIDER_WITHDRAWAL&page=1&take=25">
            Open withdrawal journals
          </AdminTextLink>
        </AdminTableSubstack>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function reversalReviewLabel(review: string) {
  return SETTLEMENT_REVERSAL_REVIEW_LINKS.find((item) => item.review === review)?.label ?? 'All';
}

function reversalNextAction(tone: ReturnType<typeof buildBookingSettlementReversalEvidenceState>['tone']) {
  return tone === 'success'
    ? 'Review the immutable correction and continue closeout.'
    : 'Open the reversal and resolve the authoritative evidence blocker.';
}
