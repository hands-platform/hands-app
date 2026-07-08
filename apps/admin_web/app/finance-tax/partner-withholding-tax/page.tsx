import { Landmark, ReceiptText, ShieldCheck, UsersRound, WalletCards } from 'lucide-react';

import type {
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxRow,
  AdminPartnerWithholdingTaxSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
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
            Export partner tax CSV
          </StatusBadgeLink>
        </TaxFinanceWorkflowActions>
      }
      description="Monthly Partner VAT/PIT withholding totals grouped by Partner from posted booking settlement records."
      title="Partner Withholding Tax"
    >
      <FinanceListCommandBoard ariaLabel="Withholding command board">
        <FinanceListCommandCard
          detail="Partner VAT plus PIT withholding payable for the selected month."
          href={`/finance-tax/partner-withholding-tax?period=${encodeURIComponent(filters.period)}`}
          icon={ReceiptText}
          label="Partner tax payable"
          tone={summary.totalPartnerTaxWithheld > 0 ? 'warning' : 'neutral'}
          value={<MoneyText amount={summary.totalPartnerTaxWithheld} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Partners with taxable completed booking revenue in this period."
          href={partnerWithholdingTaxHref({ ...filters, page: 1 })}
          icon={UsersRound}
          label="Taxable partners"
          tone={summary.partnerCountWithRevenue > 0 ? 'info' : 'neutral'}
          value={String(summary.partnerCountWithRevenue)}
        />
        <FinanceListCommandCard
          detail="Completed booking settlement rows included in withholding totals."
          href="/finance-tax/booking-settlement-audit"
          icon={Landmark}
          label="Taxable bookings"
          tone={summary.taxableBookingCount > 0 ? 'primary' : 'neutral'}
          value={String(summary.taxableBookingCount)}
        />
        <FinanceListCommandCard
          detail="Partner payout total before payout batch execution."
          href="/earnings"
          icon={WalletCards}
          label="Partner payout base"
          tone={summary.partnerPayoutTotal > 0 ? 'success' : 'neutral'}
          value={<MoneyText amount={summary.partnerPayoutTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail={withholdingRemittanceDetail(monthlyClosingSummary)}
          href={`/finance-tax/monthly-tax-closing?period=${encodeURIComponent(filters.period)}`}
          icon={ShieldCheck}
          label="Remittance status"
          tone={withholdingRemittanceTone(monthlyClosingSummary.status)}
          value={monthlyClosingSummary.status}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Period ${filters.period}. Showing page ${pagination.page} of ${pagination.totalPages} from the monthly group API.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Withholding tax period"
      >
        <FinancePeriodFilterForm period={filters.period} rows={{ value: filters.take }} />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="Use this list for monthly tax declaration preparation. Booking-level evidence stays in Booking Settlement Audit."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Partner monthly withholding rows"
      >
        <FinanceDataTable
            emptyMessage="No Partner withholding tax rows exist for this period."
            headers={['Partner', 'Period', 'Bookings', 'Gross revenue', 'Partner payout', 'VAT / PIT', 'Total withheld']}
            rowCount={tableRows.length}
          >
            {tableRows.map((row) => (
              <tr key={`${row.providerProfileId}-${row.period}`}>
                <td>
                  <AdminTextLink href={`/partners/${row.providerProfileId}?section=full`}>
                    {row.partnerName}
                  </AdminTextLink>
                  <div className="muted">{row.partnerPhone ?? '-'}</div>
                </td>
                <td>{row.period}</td>
                <td>{row.completedBookingCount}</td>
                <td>
                  <MoneyText amount={row.grossServiceRevenue} currency={row.currency} />
                </td>
                <td>
                  <MoneyText amount={row.partnerPayoutTotal} currency={row.currency} />
                </td>
                <td>
                  <strong>
                    <MoneyText amount={row.partnerVatWithheldTotal} currency={row.currency} />
                  </strong>
                  <div className="muted">
                    PIT <MoneyText amount={row.partnerPitWithheldTotal} currency={row.currency} />
                  </div>
                </td>
                <td>
                  <strong>
                    <MoneyText amount={row.totalPartnerTaxWithheld} currency={row.currency} />
                  </strong>
                </td>
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

function withholdingRemittanceTone(status: string): 'danger' | 'neutral' | 'success' | 'warning' {
  if (status === 'PAID' || status === 'CLOSED') {
    return 'success';
  }
  if (status === 'DECLARED' || status === 'REVIEWED') {
    return 'warning';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'neutral';
}

function withholdingRemittanceDetail(summary: AdminMonthlyTaxClosingSummary) {
  const transferRef = summary.remittanceMetadata?.transferRef;

  if (summary.status === 'PAID' || summary.status === 'CLOSED') {
    return transferRef
      ? `Tax payment evidence retained under ${transferRef}.`
      : 'Tax payment evidence is recorded for this monthly closing.';
  }
  if (summary.status === 'DECLARED') {
    return 'Tax declaration is submitted; payment evidence still needs to be recorded.';
  }
  if (summary.status === 'REVIEWED') {
    return 'Monthly totals are reviewed; declare and remit withholding before closeout.';
  }
  if (summary.status === 'REVERSED') {
    return 'This monthly closing was reversed. Review reversal evidence before remittance action.';
  }
  return 'Monthly withholding totals are still in draft preview.';
}
