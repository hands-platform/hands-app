import Link from 'next/link';

import type { AdminPaymentFeeSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { formatMoney } from '../../../lib/admin-format';
import {
  buildPaymentFeeMetrics,
  buildPaymentFeeSummaryCsvHref,
  buildPaymentFeeSummaryApiHref,
  emptyPaymentFeeSummary,
  monthlyTaxClosingHref,
  readMonthlyTaxClosingFilters,
} from '../tax-settlement-page-model';

type PaymentFeesPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentFeesPage({ searchParams }: PaymentFeesPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readMonthlyTaxClosingFilters(params);
  const summary = await adminGet<AdminPaymentFeeSummary>(
    buildPaymentFeeSummaryApiHref(filters),
    emptyPaymentFeeSummary(filters.period),
  );
  const csvHref = buildPaymentFeeSummaryCsvHref(summary);

  return (
    <AdminPageTemplate
      actions={
        <>
          <a className="pill pill-success" download={`hands-payment-fees-${filters.period}.csv`} href={csvHref}>
            Export payment fee CSV
          </a>
          <Link className="pill pill-info" href="/finance-tax">
            Tax overview
          </Link>
          <Link className="pill pill-info" href={monthlyTaxClosingHref(filters)}>
            Monthly tax closing
          </Link>
        </>
      }
      description="Payment processing fees are tracked separately from Partner VAT/PIT and company output VAT."
      metrics={buildPaymentFeeMetrics(summary)}
      title="Payment Fees"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`Period ${summary.period}. Fee totals are grouped from immutable settlement snapshots; no booking list is loaded here.`}
          status={<span className="pill pill-info">{summary.currency}</span>}
          title="Payment fee period"
        />
        <form className="form-grid compact-form admin-mt-12" method="get">
          <label>
            Month
            <input name="period" type="month" defaultValue={filters.period} />
          </label>
          <button type="submit">Apply period</button>
        </form>
      </section>

      <PaymentFeeBreakdownTable
        emptyMessage="No payment method fee rows exist for this period."
        keyField="paymentMethod"
        label="Payment method"
        rows={summary.byPaymentMethod}
        title="Fees by payment method"
      />
      <PaymentFeeBreakdownTable
        emptyMessage="No payment payer fee rows exist for this period."
        keyField="paymentFeePayer"
        label="Fee payer"
        rows={summary.byPayer}
        title="Fees by payer"
      />
      <PaymentFeeBreakdownTable
        emptyMessage="No payment treatment fee rows exist for this period."
        keyField="paymentFeeTreatment"
        label="Fee treatment"
        rows={summary.byTreatment}
        title="Fees by treatment"
      />
    </AdminPageTemplate>
  );
}

function PaymentFeeBreakdownTable<T extends Record<string, string | number>>({
  emptyMessage,
  keyField,
  label,
  rows,
  title,
}: {
  readonly emptyMessage: string;
  readonly keyField: keyof T;
  readonly label: string;
  readonly rows: readonly T[];
  readonly title: string;
}) {
  return (
    <section className="card admin-card-scroll admin-mb-16">
      <AdminSectionHeader
        description="Amounts are aggregate totals only; open booking detail when settlement evidence is needed."
        title={title}
      />
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={emptyMessage}
          headers={[label, 'Settlements', 'Customer paid', 'Payment fees']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={String(row[keyField])}>
              <td>
                <strong>{String(row[keyField])}</strong>
              </td>
              <td>{Number(row.settlementCount ?? 0)}</td>
              <td>{formatMoney(Number(row.customerPaymentAmountTotal ?? 0), 'VND')}</td>
              <td>
                <strong>{formatMoney(Number(row.paymentProcessingFeeTotal ?? 0), 'VND')}</strong>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </section>
  );
}
