import { AlertTriangle, CircleDollarSign, ReceiptText, ShieldCheck } from 'lucide-react';

import type { AdminPlatformVatSummary } from '../../../lib/admin-api';
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
  buildTaxFinanceWorkflowLinks,
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
  const summary = await adminGet<AdminPlatformVatSummary>(
    buildPlatformVatSummaryApiHref(filters),
    emptyPlatformVatSummary(filters.period),
  );
  const csvHref = buildPlatformVatExportHref(filters);
  const periodScope = `Period ${filters.period}`;

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
          detail="Company output VAT payable from HANDS platform fee gross."
          href={`/finance-tax/platform-vat?period=${encodeURIComponent(filters.period)}`}
          icon={ReceiptText}
          label="Output VAT"
          scope={periodScope}
          tone={summary.companyOutputVatTotal > 0 ? 'warning' : 'neutral'}
          value={<MoneyText amount={summary.companyOutputVatTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Company revenue after removing output VAT from platform fee gross."
          href="/finance-tax/booking-settlement-audit"
          icon={CircleDollarSign}
          label="Net revenue"
          scope={periodScope}
          tone={summary.platformFeeNetRevenueTotal > 0 ? 'success' : 'neutral'}
          value={<MoneyText amount={summary.platformFeeNetRevenueTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Must be 0 before monthly closeout."
          href={`/finance-tax/monthly-tax-closing?period=${encodeURIComponent(filters.period)}`}
          icon={AlertTriangle}
          label="Formula delta"
          scope={summary.netRevenueDelta === 0 ? periodScope : 'Needs action'}
          tone={summary.netRevenueDelta === 0 ? 'success' : 'danger'}
          value={<MoneyText amount={summary.netRevenueDelta} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="VAT rate buckets from posted booking settlement records."
          href={`/finance-tax/platform-vat?period=${encodeURIComponent(filters.period)}`}
          icon={ShieldCheck}
          label="VAT buckets"
          scope={periodScope}
          tone={summary.rateBreakdown.length > 0 ? 'info' : 'neutral'}
          value={`${summary.rateBreakdown.length} bucket(s)`}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Period ${summary.period}. Showing VAT rate buckets from posted booking settlement records.`}
        resultLabel={summary.currency}
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
        description="Use this breakdown for company VAT review. The net revenue formula delta should be 0 VND before monthly closeout."
        resultLabel={`${summary.rateBreakdown.length} row(s)`}
        resultTone="info"
        title="VAT rate breakdown"
      >
        <FinanceDataTable
            emptyMessage="No platform VAT rows exist for this period."
            headers={['VAT bucket', 'Rate', 'Settlements', 'Platform fee gross', 'Company VAT', 'Net revenue']}
            rowCount={summary.rateBreakdown.length}
          >
            {summary.rateBreakdown.map((row) => (
              <tr key={`${row.category}-${row.platformVatRateBps}`}>
                <td>
                  <StatusBadgeFromPillClass pillClass={platformVatCategoryPill(row.category)}>
                    {row.category}
                  </StatusBadgeFromPillClass>
                </td>
                <td>{formatBps(row.platformVatRateBps)}</td>
                <td>{row.settlementCount}</td>
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
