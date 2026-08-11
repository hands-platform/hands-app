import { AlertTriangle, CircleDollarSign, ReceiptText, ShieldCheck } from 'lucide-react';

import type { AdminMonthlyTaxClosingSummary, AdminPlatformVatSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import { AdminPageTemplate } from '../../../components/admin-page-template';
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
  const [summary, monthlyClosingSummary] = await Promise.all([
    adminGet<AdminPlatformVatSummary>(
      buildPlatformVatSummaryApiHref(filters),
      emptyPlatformVatSummary(filters.period),
    ),
    adminGet<AdminMonthlyTaxClosingSummary>(
      buildMonthlyTaxClosingSummaryApiHref(filters),
      emptyMonthlyTaxClosingSummary(filters.period),
    ),
  ]);
  const csvHref = buildPlatformVatExportHref(filters);
  const periodScope = `Period ${filters.period}`;
  const closeoutState = buildMonthlyTaxCloseoutCommandState(monthlyClosingSummary);
  const reviewFlagCount = summary.manualReviewCount + (summary.netRevenueDelta === 0 ? 0 : 1);
  const periodSettlementHref = bookingSettlementAuditHref({
    ...settlementFilters,
    page: 1,
    period: filters.period,
    range: 'all',
    review: 'all',
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
          <StatusBadgeLink
            download={`hands-platform-vat-${filters.period}.csv`}
            href={csvHref}
            tone="success"
          >
            Export company VAT CSV
          </StatusBadgeLink>
        </TaxFinanceWorkflowActions>
      }
      description="Company output VAT from HANDS platform fee. Customer payment amount is not company revenue."
      title="Platform VAT"
    >
      <FinanceListCommandBoard ariaLabel="VAT command board">
        <FinanceListCommandCard
          detail={closeoutState.detail}
          href={`/finance-tax/monthly-tax-closing?period=${encodeURIComponent(filters.period)}`}
          icon={ShieldCheck}
          label="Tax closeout"
          scope={closeoutState.scope}
          tone={closeoutState.tone}
          value={closeoutState.value}
        />
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
          detail={`${summary.manualReviewCount} non-standard rate event(s); formula delta must be 0 before monthly closeout.`}
          href={
            summary.netRevenueDelta === 0
              ? `/finance-tax/platform-vat?period=${encodeURIComponent(filters.period)}`
              : `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(filters.period)}`
          }
          icon={AlertTriangle}
          label="VAT review flags"
          scope={reviewFlagCount === 0 ? periodScope : 'Needs action'}
          tone={summary.netRevenueDelta !== 0 ? 'danger' : summary.manualReviewCount > 0 ? 'warning' : 'success'}
          value={String(reviewFlagCount)}
        />
      </FinanceListCommandBoard>

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
        grouped
        description="Review the VAT rate, reversal impact, and gross-to-net formula before monthly closeout."
        resultLabel={`${summary.rateBreakdown.length} row(s)`}
        resultTone={reviewFlagCount > 0 ? 'warning' : 'success'}
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
  return 'Manual review';
}

function platformVatRowDelta(row: AdminPlatformVatSummary['rateBreakdown'][number]) {
  return row.platformFeeGrossTotal - row.companyOutputVatTotal - row.platformFeeNetRevenueTotal;
}
