import Link from 'next/link';

import type { AdminPlatformVatSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { formatMoney } from '../../../lib/admin-format';
import {
  buildPlatformVatMetrics,
  buildPlatformVatSummaryCsvHref,
  buildPlatformVatSummaryApiHref,
  emptyPlatformVatSummary,
  monthlyTaxClosingHref,
  readMonthlyTaxClosingFilters,
} from '../tax-settlement-page-model';

type PlatformVatPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlatformVatPage({ searchParams }: PlatformVatPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readMonthlyTaxClosingFilters(params);
  const summary = await adminGet<AdminPlatformVatSummary>(
    buildPlatformVatSummaryApiHref(filters),
    emptyPlatformVatSummary(filters.period),
  );
  const csvHref = buildPlatformVatSummaryCsvHref(summary);

  return (
    <AdminPageTemplate
      actions={
        <>
          <a className="pill pill-success" download={`hands-platform-vat-${filters.period}.csv`} href={csvHref}>
            Export company VAT CSV
          </a>
          <Link className="pill pill-info" href="/finance-tax">
            Tax overview
          </Link>
          <Link className="pill pill-info" href={monthlyTaxClosingHref(filters)}>
            Monthly tax closing
          </Link>
        </>
      }
      description="Company output VAT from HANDS platform fee. Customer payment amount is not company revenue."
      metrics={buildPlatformVatMetrics(summary)}
      title="Platform VAT"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`Period ${summary.period}. Showing VAT rate buckets from immutable booking settlement snapshots.`}
          status={<span className="pill pill-info">{summary.currency}</span>}
          title="Platform VAT period"
        />
        <form className="form-grid compact-form admin-mt-12" method="get">
          <label>
            Month
            <input name="period" type="month" defaultValue={filters.period} />
          </label>
          <button type="submit">Apply period</button>
        </form>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="Use this breakdown for company VAT review. The net revenue formula delta should be 0 VND before monthly closeout."
          title="VAT rate breakdown"
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No platform VAT rows exist for this period."
            headers={['VAT bucket', 'Rate', 'Settlements', 'Platform fee gross', 'Company VAT', 'Net revenue']}
            rowCount={summary.rateBreakdown.length}
          >
            {summary.rateBreakdown.map((row) => (
              <tr key={`${row.category}-${row.platformVatRateBps}`}>
                <td>
                  <span className={`pill ${platformVatCategoryPill(row.category)}`}>{row.category}</span>
                </td>
                <td>{formatBps(row.platformVatRateBps)}</td>
                <td>{row.settlementCount}</td>
                <td>{formatMoney(row.platformFeeGrossTotal, summary.currency)}</td>
                <td>
                  <strong>{formatMoney(row.companyOutputVatTotal, summary.currency)}</strong>
                </td>
                <td>{formatMoney(row.platformFeeNetRevenueTotal, summary.currency)}</td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </section>
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
