import { Landmark, ReceiptText, ShieldCheck, UsersRound } from 'lucide-react';

import type {
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxRow,
  AdminPartnerWithholdingTaxSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminTextLink } from '../../../components/admin-text-link';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeLink } from '../../../components/status-badge';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { FinancePeriodFilterForm } from '../finance-period-filter-form';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildMonthlyTaxClosingSummaryApiHref,
  buildMonthlyTaxCloseoutCommandState,
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxExportHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildTaxSettlementServerPagination,
  buildTaxFinanceWorkflowLinks,
  emptyMonthlyTaxClosingSummary,
  emptyPartnerWithholdingTaxSummary,
  partnerWithholdingTaxHref,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type PartnerWithholdingTaxPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PartnerWithholdingTaxPage({ searchParams }: PartnerWithholdingTaxPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readPartnerWithholdingTaxFilters(params);
  const settlementFilters = readBookingSettlementFilters(params);
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const [summary, rows, monthlyClosingSummary] = await Promise.all([
    adminGet<AdminPartnerWithholdingTaxSummary>(
      buildPartnerWithholdingTaxSummaryApiHref(filters),
      emptyPartnerWithholdingTaxSummary(filters.period),
    ),
    adminGet<AdminPartnerWithholdingTaxRow[]>(buildPartnerWithholdingTaxApiHref(filters), []),
    adminGet<AdminMonthlyTaxClosingSummary>(
      buildMonthlyTaxClosingSummaryApiHref(monthlyFilters),
      emptyMonthlyTaxClosingSummary(monthlyFilters.period),
    ),
  ]);
  const pagination = buildTaxSettlementServerPagination(rows, filters, summary.partnerCountWithRevenue);
  const tableRows = pagination.rows;
  const csvHref = buildPartnerWithholdingTaxExportHref(filters);
  const periodScope = `Period ${filters.period}`;
  const closeoutState = buildMonthlyTaxCloseoutCommandState(monthlyClosingSummary);

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'partner-withholding-tax',
            monthlyFilters,
            settlementFilters,
            withholdingFilters: filters,
          })}
        >
          <StatusBadgeLink
            download={`hands-partner-withholding-tax-${filters.period}.csv`}
            href={csvHref}
            tone="success"
          >
            Export current page CSV
          </StatusBadgeLink>
        </TaxFinanceWorkflowActions>
      }
      description="Monthly Partner VAT/PIT withholding totals grouped by Partner from posted settlements and closed-period reversal entries."
      title="Partner Withholding Tax"
    >
      <FinanceListCommandBoard ariaLabel="Withholding command board">
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
          detail={`${summary.postedSettlementCount ?? summary.taxableBookingCount} posted settlement(s) and ${summary.reversalCount ?? 0} reversal(s) are netted into this payable.`}
          href={`/finance-tax/partner-withholding-tax?period=${encodeURIComponent(filters.period)}`}
          icon={ReceiptText}
          label="Withholding payable"
          scope={periodScope}
          tone={summary.totalPartnerTaxWithheld > 0 ? 'warning' : 'neutral'}
          value={<MoneyText amount={summary.totalPartnerTaxWithheld} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail={`PIT withheld: ${formatMoneyForDetail(summary.partnerPitWithheldTotal, summary.currency)}.`}
          href={partnerWithholdingTaxHref({ ...filters, page: 1 })}
          icon={Landmark}
          label="VAT withheld"
          scope={periodScope}
          tone={summary.partnerVatWithheldTotal > 0 ? 'primary' : 'neutral'}
          value={<MoneyText amount={summary.partnerVatWithheldTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail={`${summary.taxableBookingCount} net taxable booking record(s) across the selected partners.`}
          href={partnerWithholdingTaxHref({ ...filters, page: 1 })}
          icon={UsersRound}
          label="Taxable partners"
          scope={periodScope}
          tone={summary.partnerCountWithRevenue > 0 ? 'info' : 'neutral'}
          value={String(summary.partnerCountWithRevenue)}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description="Choose the tax month and page size. Active posted settlements and closed-period reversal entries are netted by Partner."
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Withholding tax period"
      >
        <FinancePeriodFilterForm period={filters.period} rows={{ value: filters.take }} />
        <AdminFilterSummary
          ariaLabel="Active withholding tax filters"
          labels={[`Period: ${filters.period}`, `Rows: ${filters.take}`]}
          tone="info"
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="Review each Partner's net taxable revenue and VAT/PIT withholding before declaration. Posted and reversal counts stay visible so a refund cannot silently disappear from the register."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Partner withholding register"
      >
        <FinanceDataTable
          emptyMessage="No Partner withholding tax rows exist for this period."
          headers={[
            'Partner',
            'Posted',
            'Reversals',
            'Net records',
            'Partner taxable revenue',
            'VAT withheld',
            'PIT withheld',
            'Total withheld',
            'Effective rate',
          ]}
          rowCount={tableRows.length}
        >
          {tableRows.map((row) => (
            <tr key={`${row.providerProfileId}-${row.period}`}>
              <td>
                <AdminTextLink href={`/partners/${row.providerProfileId}?section=full`}>
                  {row.partnerName}
                </AdminTextLink>
              </td>
              <td>{row.postedSettlementCount ?? row.completedBookingCount}</td>
              <td>{row.reversalCount ?? 0}</td>
              <td>{row.completedBookingCount}</td>
              <td>
                <MoneyText amount={row.grossServiceRevenue} currency={row.currency} />
              </td>
              <td>
                <MoneyText amount={row.partnerVatWithheldTotal} currency={row.currency} />
              </td>
              <td>
                <MoneyText amount={row.partnerPitWithheldTotal} currency={row.currency} />
              </td>
              <td>
                <strong>
                  <MoneyText amount={row.totalPartnerTaxWithheld} currency={row.currency} />
                </strong>
              </td>
              <td>{withholdingEffectiveRate(row)}%</td>
            </tr>
          ))}
        </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Partner withholding tax pages"
          hrefForPage={(page) => partnerWithholdingTaxHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function withholdingEffectiveRate(row: AdminPartnerWithholdingTaxRow) {
  if (row.grossServiceRevenue <= 0) {
    return '0';
  }
  return (Math.round((row.totalPartnerTaxWithheld / row.grossServiceRevenue) * 1000) / 10).toFixed(1);
}

function formatMoneyForDetail(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}
