import Link from 'next/link';

import type {
  AdminPartnerWithholdingTaxRow,
  AdminPartnerWithholdingTaxSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminRoundedPagination } from '../../../components/admin-rounded-pagination';
import { formatMoney } from '../../../lib/admin-format';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxRowsCsvHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildTaxSettlementServerPagination,
  buildTaxFinanceWorkflowLinks,
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
  const [summary, rows] = await Promise.all([
    adminGet<AdminPartnerWithholdingTaxSummary>(
      buildPartnerWithholdingTaxSummaryApiHref(filters),
      emptyPartnerWithholdingTaxSummary(filters.period),
    ),
    adminGet<AdminPartnerWithholdingTaxRow[]>(buildPartnerWithholdingTaxApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(rows, filters, summary.partnerCountWithRevenue);
  const tableRows = pagination.rows;
  const csvHref = buildPartnerWithholdingTaxRowsCsvHref(tableRows);

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
          <a
            className="pill pill-success"
            download={`hands-partner-withholding-tax-${filters.period}.csv`}
            href={csvHref}
          >
            Export partner tax CSV
          </a>
        </TaxFinanceWorkflowActions>
      }
      description="Monthly Partner VAT/PIT withholding totals grouped by Partner from immutable booking settlement snapshots."
      metrics={[
        {
          helper: 'Partners with taxable revenue in this monthly period.',
          label: 'Partners',
          value: summary.partnerCountWithRevenue,
        },
        {
          helper: 'Completed booking settlement rows included in this period.',
          label: 'Taxable bookings',
          value: summary.taxableBookingCount,
        },
        {
          helper: 'Customer payment total for this period.',
          label: 'Gross service revenue',
          value: formatMoney(summary.grossServiceRevenue, summary.currency),
        },
        {
          helper: 'Partner payout total before payout batch execution.',
          label: 'Partner payout',
          value: formatMoney(summary.partnerPayoutTotal, summary.currency),
        },
        {
          helper: 'Partner VAT withholding total.',
          label: 'VAT withheld',
          value: formatMoney(summary.partnerVatWithheldTotal, summary.currency),
        },
        {
          helper: 'Partner PIT withholding total.',
          label: 'PIT withheld',
          value: formatMoney(summary.partnerPitWithheldTotal, summary.currency),
        },
      ]}
      title="Partner Withholding Tax"
    >
      <AdminFilterPanel
        className="admin-mb-16"
        description={`Period ${filters.period}. Showing page ${pagination.page} of ${pagination.totalPages} from the monthly group API.`}
        resultLabel={`${pagination.pageSize} per page`}
        resultTone="success"
        title="Withholding tax period"
      >
        <form className="form-grid compact-form admin-mt-12" method="get">
          <AdminFormInput defaultValue={filters.period} label="Month" name="period" type="month" />
          <AdminFormSelect
            defaultValue={String(filters.take)}
            label="Rows"
            name="take"
            options={[25, 50, 75, 100].map((take) => ({ label: String(take), value: String(take) }))}
          />
          <AdminFormControlButton className="btn btn-primary" type="submit">
            Apply period
          </AdminFormControlButton>
        </form>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="Use this list for monthly tax declaration preparation. Booking-level evidence stays in Booking Settlement Audit."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Partner monthly withholding rows"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No Partner withholding tax rows exist for this period."
            headers={['Partner', 'Period', 'Bookings', 'Gross revenue', 'Partner payout', 'VAT / PIT', 'Total withheld']}
            rowCount={tableRows.length}
          >
            {tableRows.map((row) => (
              <tr key={`${row.providerProfileId}-${row.period}`}>
                <td>
                  <Link className="text-link" href={`/partners/${row.providerProfileId}?section=full`}>
                    {row.partnerName}
                  </Link>
                  <div className="muted">{row.partnerPhone ?? '-'}</div>
                </td>
                <td>{row.period}</td>
                <td>{row.completedBookingCount}</td>
                <td>{formatMoney(row.grossServiceRevenue, row.currency)}</td>
                <td>{formatMoney(row.partnerPayoutTotal, row.currency)}</td>
                <td>
                  <strong>{formatMoney(row.partnerVatWithheldTotal, row.currency)}</strong>
                  <div className="muted">PIT {formatMoney(row.partnerPitWithheldTotal, row.currency)}</div>
                </td>
                <td>
                  <strong>{formatMoney(row.totalPartnerTaxWithheld, row.currency)}</strong>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <div className="vuexy-booking-table-footer">
          <span>
            Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
          </span>
          <AdminRoundedPagination
            activePage={pagination.page}
            ariaLabel="Partner withholding tax pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) => partnerWithholdingTaxHref({ ...filters, page })}
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={pagination.totalPages}
          />
        </div>
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}
