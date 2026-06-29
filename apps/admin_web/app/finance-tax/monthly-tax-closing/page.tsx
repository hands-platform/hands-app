import type {
  AdminMonthlyTaxClosing,
  AdminMonthlyTaxClosingSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { formatDateTime, formatMoney } from '../../../lib/admin-format';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildMonthlyTaxClosingApiHref,
  buildMonthlyTaxClosingAccountingJournalCsvHref,
  buildMonthlyTaxClosingMetrics,
  buildMonthlyTaxClosingRowsCsvHref,
  buildMonthlyTaxClosingSummaryCsvHref,
  buildMonthlyTaxClosingSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  emptyMonthlyTaxClosingSummary,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';
import { updateMonthlyTaxClosingStatus } from './actions';

type MonthlyTaxClosingPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MonthlyTaxClosingPage({ searchParams }: MonthlyTaxClosingPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readMonthlyTaxClosingFilters(params);
  const settlementFilters = readBookingSettlementFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const [summary, closings] = await Promise.all([
    adminGet<AdminMonthlyTaxClosingSummary>(
      buildMonthlyTaxClosingSummaryApiHref(filters),
      emptyMonthlyTaxClosingSummary(filters.period),
    ),
    adminGet<AdminMonthlyTaxClosing[]>(buildMonthlyTaxClosingApiHref(filters), []),
  ]);
  const returnTo = `/finance-tax/monthly-tax-closing?${new URLSearchParams({
    period: filters.period,
    take: String(filters.take),
  }).toString()}`;
  const summaryCsvHref = buildMonthlyTaxClosingSummaryCsvHref(summary);
  const closingRowsCsvHref = buildMonthlyTaxClosingRowsCsvHref(closings);
  const accountingJournalCsvHref = buildMonthlyTaxClosingAccountingJournalCsvHref(summary);

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'monthly-tax-closing',
            monthlyFilters: filters,
            settlementFilters,
            withholdingFilters,
          })}
        >
          <a
            className="pill pill-info"
            download={`hands-monthly-tax-closing-${filters.period}-summary.csv`}
            href={summaryCsvHref}
          >
            Export summary CSV
          </a>
          <a
            className="pill pill-info"
            download={`hands-monthly-tax-closing-${filters.period}-rows.csv`}
            href={closingRowsCsvHref}
          >
            Export rows CSV
          </a>
          <a
            className="pill pill-success"
            download={`hands-accounting-journal-${filters.period}.csv`}
            href={accountingJournalCsvHref}
          >
            Export accounting journal CSV
          </a>
        </TaxFinanceWorkflowActions>
      }
      description="Monthly platform VAT, Partner VAT/PIT withholding, payment fee, and booking settlement reconciliation preview."
      metrics={buildMonthlyTaxClosingMetrics(summary)}
      title="Monthly Tax Closing"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`Period ${summary.period}. The preview is calculated from immutable settlement snapshots; stored closing rows only add status and closeout timestamps.`}
          status={<span className={`pill ${closingStatusPill(summary.status)}`}>{summary.status}</span>}
          title="Monthly closing period"
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

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Save the reviewed monthly totals into the closing row before declaration, payment, or final closeout. Closed periods require reversal entries, not direct edits."
          status={<span className={`pill ${closingStatusPill(summary.status)}`}>{summary.status}</span>}
          title="Monthly closing action"
        />
        <form action={updateMonthlyTaxClosingStatus} className="form-grid compact-form admin-mt-12">
          <input name="period" type="hidden" value={filters.period} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <label>
            Next status
            <select name="status" defaultValue={summary.status === 'DRAFT' ? 'REVIEWED' : summary.status}>
              <option value="REVIEWED">Reviewed</option>
              <option value="DECLARED">Declared</option>
              <option value="PAID">Paid</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
          <label>
            Operator notes
            <input
              name="notes"
              placeholder="Tax portal reference, declaration note, or closeout memo"
              defaultValue={summary.notes ?? ''}
            />
          </label>
          <button type="submit">Save closing status</button>
        </form>
      </section>

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Both formulas should show 0 VND delta before an operator declares or closes the period."
          title="Monthly reconciliation"
        />
        <div className="setup-stage-list admin-mt-12">
          <div className="setup-stage-item">
            <span>1</span>
            <div>
              <strong>Customer payment reconciliation</strong>
              <p className="muted">
                Customer payment - Partner payout - Partner withholding - payment fees = platform fee gross.
              </p>
            </div>
            <small>{formatMoney(summary.reconciliationDelta, summary.currency)}</small>
          </div>
          <div className="setup-stage-item">
            <span>2</span>
            <div>
              <strong>Platform VAT split</strong>
              <p className="muted">
                Platform fee gross - company output VAT = platform fee net revenue.
              </p>
            </div>
            <small>{formatMoney(summary.netRevenueDelta, summary.currency)}</small>
          </div>
          <div className="setup-stage-item">
            <span>3</span>
            <div>
              <strong>Partner withholding closeout</strong>
              <p className="muted">
                {summary.partnerCountWithRevenue} Partner(s), {summary.openTaxCount} open tax rows,{' '}
                {summary.paidTaxCount} paid tax rows.
              </p>
            </div>
            <small>{formatMoney(summary.partnerWithholdingTotal, summary.currency)}</small>
          </div>
        </div>
      </section>

      <section className="card admin-card-scroll">
        <AdminSectionHeader
          description="Stored closing rows. If no row exists yet, the cards above still show a draft preview from settlement snapshots."
          title="Stored monthly closing rows"
        />
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage="No stored monthly tax closing row exists for this period yet."
            headers={['Period', 'Status', 'Settlements', 'Platform VAT', 'Partner tax', 'Payment fees', 'Closeout']}
            rowCount={closings.length}
          >
            {closings.map((closing) => (
              <tr key={closing.id}>
                <td>
                  <strong>{closing.period}</strong>
                  <div className="muted">{closing.currency}</div>
                </td>
                <td>
                  <span className={`pill ${closingStatusPill(closing.status)}`}>{closing.status}</span>
                </td>
                <td>{closing.settlementCount}</td>
                <td>
                  <strong>{formatMoney(closing.companyOutputVatTotal, closing.currency)}</strong>
                  <div className="muted">Net {formatMoney(closing.platformFeeNetRevenueTotal, closing.currency)}</div>
                </td>
                <td>
                  <strong>{formatMoney(closing.partnerWithholdingTotal, closing.currency)}</strong>
                  <div className="muted">VAT {formatMoney(closing.partnerVatWithheldTotal, closing.currency)}</div>
                  <div className="muted">PIT {formatMoney(closing.partnerPitWithheldTotal, closing.currency)}</div>
                </td>
                <td>{formatMoney(closing.paymentProcessingFeeTotal, closing.currency)}</td>
                <td>
                  <div className="muted">Declared {formatDateTime(closing.declaredAt)}</div>
                  <div className="muted">Paid {formatDateTime(closing.paidAt)}</div>
                  <div className="muted">Closed {formatDateTime(closing.closedAt)}</div>
                  {closing.notes ? <div className="muted admin-mt-8">{closing.notes}</div> : null}
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </section>
    </AdminPageTemplate>
  );
}

function closingStatusPill(status: string) {
  if (status === 'PAID' || status === 'CLOSED') {
    return 'pill-success';
  }
  if (status === 'DECLARED' || status === 'REVIEWED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}
