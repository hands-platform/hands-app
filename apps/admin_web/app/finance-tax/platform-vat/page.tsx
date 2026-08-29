import { AlertTriangle, CircleDollarSign, ReceiptText, ShieldCheck } from 'lucide-react';

import type { AdminMonthlyTaxClosingSummary, AdminPlatformVatSummary } from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSection } from '../../../components/admin-surface';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass, StatusBadgeLink } from '../../../components/status-badge';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { FinancePeriodFilterForm } from '../finance-period-filter-form';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildPlatformVatExportHref,
  buildPlatformVatSummaryApiHref,
  buildMonthlyTaxClosingSummaryApiHref,
  buildMonthlyTaxCloseoutCommandState,
  buildTaxFinanceWorkflowLinks,
  bookingSettlementAuditHref,
  emptyMonthlyTaxClosingSummary,
  emptyPlatformVatSummary,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type PlatformVatPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlatformVatPage({ searchParams }: PlatformVatPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readMonthlyTaxClosingFilters(params);
  const settlementFilters = readBookingSettlementFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summaryResult, monthlyClosingResult] = await Promise.all([
    adminGetResult<AdminPlatformVatSummary>(
      buildPlatformVatSummaryApiHref(filters),
      emptyPlatformVatSummary(filters.period),
    ),
    adminGetResult<AdminMonthlyTaxClosingSummary>(
      buildMonthlyTaxClosingSummaryApiHref(filters),
      emptyMonthlyTaxClosingSummary(filters.period),
    ),
  ]);
  if (!summaryResult.ok) {
    return <PlatformVatUnavailable period={filters.period} status={summaryResult.status} />;
  }
  const summary = summaryResult.data;
  const monthlyClosingSummary = monthlyClosingResult.data;
  const csvHref = buildPlatformVatExportHref(filters);
  const periodScope = `Period ${filters.period}`;
  const closeoutState = monthlyClosingResult.ok
    ? buildMonthlyTaxCloseoutCommandState(monthlyClosingSummary)
    : {
        detail: 'Monthly closeout status could not be loaded. VAT register data remains available.',
        scope: 'API unavailable',
        tone: 'danger' as const,
        value: 'Data unavailable',
      };
  const closeoutEligible =
    monthlyClosingResult.ok &&
    monthlyClosingSummary.periodState !== 'FUTURE_PERIOD' &&
    (monthlyClosingSummary.hasActivity ?? true);
  const showVatData = !monthlyClosingResult.ok || closeoutEligible;
  const reviewFlagCount = summary.manualReviewCount + (summary.netRevenueDelta === 0 ? 0 : 1);
  const periodSettlementHref = bookingSettlementAuditHref({
    ...settlementFilters,
    page: 1,
    period: filters.period,
    range: 'all',
    review: 'all',
  });
  const vatEvidenceReviewHref = bookingSettlementAuditHref({
    ...settlementFilters,
    page: 1,
    period: filters.period,
    range: 'all',
    returnTo: `/finance-tax/platform-vat?period=${encodeURIComponent(filters.period)}`,
    review: 'platform-vat-evidence',
    sort: 'oldest',
  });

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'platform-vat',
            monthlyFilters: filters,
            settlementFilters,
            withholdingFilters,
          })}
        >
          {closeoutEligible ? (
            <StatusBadgeLink
              download={`hands-platform-vat-${filters.period}.csv`}
              href={csvHref}
              tone="success"
            >
              Export company VAT CSV
            </StatusBadgeLink>
          ) : null}
        </TaxFinanceWorkflowActions>
      }
      description="Company output VAT from HANDS platform fee. Customer payment amount is not company revenue."
      title="Platform VAT"
    >
      <FinanceListCommandBoard ariaLabel="VAT command board" className="finance-five-card-command-board">
        <FinanceListCommandCard
          detail={closeoutState.detail}
          href={`/finance-tax/monthly-tax-closing?period=${encodeURIComponent(filters.period)}`}
          icon={ShieldCheck}
          label="Tax closeout"
          scope={closeoutState.scope}
          tone={closeoutState.tone}
          value={closeoutState.value}
        />
        {showVatData ? (
          <>
            <FinanceListCommandCard
              detail="HANDS platform fee including company output VAT. Customer booking payment is not this amount."
              href={periodSettlementHref}
              icon={CircleDollarSign}
              label="Platform fee gross"
              scope={periodScope}
              tone={summary.platformFeeGrossTotal > 0 ? 'info' : 'neutral'}
              value={<MoneyText amount={summary.platformFeeGrossTotal} currency={summary.currency} />}
            />
            <FinanceListCommandCard
              detail="Company output VAT payable from HANDS platform fee gross."
              href={`/finance-tax/platform-vat?period=${encodeURIComponent(filters.period)}`}
              icon={ReceiptText}
              label="Company output VAT"
              scope={periodScope}
              tone={summary.companyOutputVatTotal > 0 ? 'warning' : 'neutral'}
              value={<MoneyText amount={summary.companyOutputVatTotal} currency={summary.currency} />}
            />
            <FinanceListCommandCard
              detail="Company revenue after removing output VAT from platform fee gross."
              href={periodSettlementHref}
              icon={CircleDollarSign}
              label="Net platform revenue"
              scope={periodScope}
              tone={summary.platformFeeNetRevenueTotal > 0 ? 'success' : 'neutral'}
              value={<MoneyText amount={summary.platformFeeNetRevenueTotal} currency={summary.currency} />}
            />
            <FinanceListCommandCard
              detail={`${summary.manualReviewCount} settlement(s) have unexplained zero VAT or unavailable retained evidence; formula delta must also be 0.`}
              href={
                summary.manualReviewCount > 0
                  ? vatEvidenceReviewHref
                  : summary.netRevenueDelta === 0
                    ? `/finance-tax/platform-vat?period=${encodeURIComponent(filters.period)}`
                    : `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(filters.period)}`
              }
              icon={AlertTriangle}
              label="VAT review flags"
              scope={reviewFlagCount === 0 ? periodScope : 'Needs action'}
              tone={summary.netRevenueDelta !== 0 ? 'danger' : summary.manualReviewCount > 0 ? 'warning' : 'success'}
              value={String(reviewFlagCount)}
            />
          </>
        ) : null}
      </FinanceListCommandBoard>

      {!closeoutEligible ? (
        <AdminInlineNotice
          className="admin-mb-16"
          role={monthlyClosingResult.ok ? 'status' : 'alert'}
          tone={monthlyClosingResult.ok ? 'info' : 'danger'}
        >
          {closeoutState.detail}
        </AdminInlineNotice>
      ) : null}

      <AdminFilterPanel
        className="admin-mb-16"
        description="Choose the monthly company VAT period. Open-period reversals are excluded and closed-period reversal entries reduce this period's totals."
        resultLabel={`${summary.settlementCount} posted · ${summary.reversalCount} reversal`}
        resultTone="info"
        title="Platform VAT period"
      >
        <FinancePeriodFilterForm period={filters.period} />
        <AdminFilterSummary
          ariaLabel="Active platform VAT filters"
          labels={[`Period: ${filters.period}`, `Currency: ${summary.currency}`]}
          tone="info"
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        actions={
          summary.manualReviewCount > 0 ? (
            <AdminFormControlLink href={vatEvidenceReviewHref}>Open exact evidence queue</AdminFormControlLink>
          ) : null
        }
        grouped
        description="Retained settlement policy and rule snapshots distinguish legitimate 0% VAT from evidence that blocks declaration."
        resultLabel={`${summary.manualReviewCount} need review`}
        resultTone={summary.manualReviewCount > 0 ? 'warning' : 'success'}
        title="Platform VAT evidence"
      >
        <FinanceDataTable
          emptyMessage="No platform VAT evidence rows exist for this period."
          headers={['Evidence state', 'Records', 'Close control']}
          rowCount={summary.evidenceBreakdown.length}
        >
          {summary.evidenceBreakdown.map((row) => {
            const needsReview = platformVatEvidenceNeedsReview(row.status);
            return (
              <tr key={row.status}>
                <td>
                  <StatusBadgeFromPillClass pillClass={needsReview ? 'pill-danger' : 'pill-success'}>
                    {platformVatEvidenceLabel(row.status)}
                  </StatusBadgeFromPillClass>
                </td>
                <td>{row.recordCount}</td>
                <td>{needsReview ? 'Blocks before DECLARED' : 'Evidence retained'}</td>
              </tr>
            );
          })}
        </FinanceDataTable>
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
        description="Review the VAT rate, reversal impact, and gross-to-net formula before monthly closeout."
        resultLabel={`${summary.rateBreakdown.length} row(s)`}
        resultTone={monthlyClosingResult.ok && !closeoutEligible ? 'neutral' : reviewFlagCount > 0 ? 'warning' : 'success'}
        title="Company VAT register"
      >
        <FinanceDataTable
          emptyMessage="No platform VAT rows exist for this period."
          headers={[
            'VAT category',
            'Rate',
            'Posted',
            'Reversals',
            'Platform fee gross',
            'Company output VAT',
            'Net platform revenue',
            'Formula delta',
          ]}
          rowCount={summary.rateBreakdown.length}
        >
          {summary.rateBreakdown.map((row) => (
            <tr key={`${row.category}-${row.platformVatRateBps}`}>
              <td>
                <StatusBadgeFromPillClass pillClass={platformVatCategoryPill(row.category)}>
                  {platformVatCategoryLabel(row.category)}
                </StatusBadgeFromPillClass>
              </td>
              <td>{formatBps(row.platformVatRateBps)}</td>
              <td>{row.settlementCount}</td>
              <td>{row.reversalCount}</td>
              <td>
                <MoneyText amount={row.platformFeeGrossTotal} currency={summary.currency} />
              </td>
              <td>
                <strong>
                  <MoneyText amount={row.companyOutputVatTotal} currency={summary.currency} />
                </strong>
              </td>
              <td>
                <MoneyText amount={row.platformFeeNetRevenueTotal} currency={summary.currency} />
              </td>
              <td>
                <MoneyText amount={platformVatRowDelta(row)} currency={summary.currency} />
              </td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function PlatformVatUnavailable({ period, status }: { readonly period: string; readonly status: number | null }) {
  const href = `/finance-tax/platform-vat?${new URLSearchParams({ period }).toString()}`;
  return (
    <AdminPageTemplate
      description={`Company VAT data for ${period} could not be loaded.`}
      title="Platform VAT"
    >
      <AdminSection
        actions={<AlertTriangle aria-hidden="true" size={18} />}
        className="admin-mb-16"
        description="VAT amounts, review counts, exports, and success states are hidden until the authoritative summary is available."
        statusLabel={status ? `API ${status}` : 'API unavailable'}
        statusTone="danger"
        title="Platform VAT data unavailable"
      >
        <AdminFormControlLink className="button-secondary" href={href}>
          Retry Platform VAT
        </AdminFormControlLink>
      </AdminSection>
    </AdminPageTemplate>
  );
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

function platformVatCategoryPill(category: string) {
  if (category === 'REDUCED_8') {
    return 'pill-info';
  }
  if (category === 'STANDARD_10') {
    return 'pill-success';
  }
  return 'pill-warn';
}

function platformVatCategoryLabel(category: string) {
  if (category === 'REDUCED_8') return 'Reduced VAT';
  if (category === 'STANDARD_10') return 'Standard VAT';
  return 'Non-standard rate';
}

function platformVatEvidenceLabel(status: AdminPlatformVatSummary['evidenceBreakdown'][number]['status']) {
  switch (status) {
    case 'POSITIVE_STANDARD_OR_REDUCED':
      return 'Positive standard / reduced VAT';
    case 'EXPLICIT_ZERO_RULE':
      return 'Explicit 0% service rule';
    case 'ZERO_FROM_POLICY':
      return 'Policy-backed 0%';
    case 'ZERO_UNEXPLAINED':
      return 'Unexplained 0%';
    case 'EVIDENCE_UNAVAILABLE':
      return 'Evidence unavailable';
  }
}

function platformVatEvidenceNeedsReview(
  status: AdminPlatformVatSummary['evidenceBreakdown'][number]['status'],
) {
  return status === 'ZERO_UNEXPLAINED' || status === 'EVIDENCE_UNAVAILABLE';
}

function platformVatRowDelta(row: AdminPlatformVatSummary['rateBreakdown'][number]) {
  return row.platformFeeGrossTotal - row.companyOutputVatTotal - row.platformFeeNetRevenueTotal;
}
