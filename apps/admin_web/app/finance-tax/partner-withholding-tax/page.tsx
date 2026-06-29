import Link from 'next/link';

import type {
  AdminPartnerWithholdingTaxRow,
  AdminPartnerWithholdingTaxSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { formatMoney } from '../../../lib/admin-format';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  emptyPartnerWithholdingTaxSummary,
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
        />
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
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`Period ${filters.period}. Showing ${rows.length} bounded Partner rows from the monthly group API.`}
          status={<span className="pill pill-success">take {filters.take}</span>}
          title="Withholding tax period"
        />
        <form className="form-grid compact-form admin-mt-12" method="get">
          <label>
            Month
            <input name="period" type="month" defaultValue={filters.period} />
          </label>
          <label>
            Rows
            <select name="take" defaultValue={filters.take}>
              {[25, 50, 75, 100].map((take) => (
                <option key={take} value={take}>
                  {take}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply period</button>
        </form>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="Use this list for monthly tax declaration preparation. Booking-level evidence stays in Booking Settlement Audit."
          title="Partner monthly withholding rows"
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No Partner withholding tax rows exist for this period."
            headers={['Partner', 'Period', 'Bookings', 'Gross revenue', 'Partner payout', 'VAT / PIT', 'Total withheld']}
            rowCount={rows.length}
          >
            {rows.map((row) => (
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
      </section>
    </AdminPageTemplate>
  );
}
