import { AlertTriangle, CheckCircle2, Landmark, Scale } from 'lucide-react';

import type {
  AdminMonthlyTaxClosing,
  AdminMonthlyTaxClosingSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { formatDateTime, formatMoney } from '../../../lib/admin-format';
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { FinancePeriodFilterForm } from '../finance-period-filter-form';
import { FinanceStageList } from '../finance-stage-list';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildMonthlyTaxClosingApiHref,
  buildMonthlyTaxClosingAccountingJournalCsvHref,
  buildMonthlyTaxClosingMetrics,
  buildMonthlyTaxClosingRemittanceEvidenceState,
  buildMonthlyTaxClosingRiskLinks,
  buildMonthlyTaxClosingRowsCsvHref,
  buildMonthlyTaxClosingSummaryCsvHref,
  buildMonthlyTaxClosingSummaryApiHref,
  buildTaxSettlementServerPagination,
  buildTaxFinanceWorkflowLinks,
  emptyMonthlyTaxClosingSummary,
  monthlyTaxClosingHref,
  monthlyTaxClosingNextStatusOptions,
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
  const storedClosingTotal = summary.id || closings.length ? 1 : 0;
  const pagination = buildTaxSettlementServerPagination(closings, filters, storedClosingTotal);
  const tableRows = pagination.rows;
  const returnTo = monthlyTaxClosingHref(filters);
  const summaryCsvHref = buildMonthlyTaxClosingSummaryCsvHref(summary);
  const closingRowsCsvHref = buildMonthlyTaxClosingRowsCsvHref(tableRows);
  const accountingJournalCsvHref = buildMonthlyTaxClosingAccountingJournalCsvHref(summary);
  const nextStatusOptions = monthlyTaxClosingNextStatusOptions(summary.status);
  const closeoutRiskLinks = buildMonthlyTaxClosingRiskLinks(summary, settlementFilters, filters);
  const formulaDelta = Math.abs(summary.reconciliationDelta) + Math.abs(summary.netRevenueDelta);
  const remittanceEvidenceState = buildMonthlyTaxClosingRemittanceEvidenceState(summary);
  const openCloseoutRiskCount =
    summary.openTaxCount + summary.couponReviewFlagCount + (summary.cashDebtTotal > 0 ? 1 : 0) + (formulaDelta > 0 ? 1 : 0);

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
      <FinanceListCommandBoard ariaLabel="Closeout command board">
        <FinanceListCommandCard
          detail="Current stored closing status, or draft preview when no closing row exists yet."
          href={monthlyTaxClosingHref(filters)}
          icon={CheckCircle2}
          label="Closeout status"
          tone={closingStatusTone(summary.status)}
          value={summary.status}
        />
        <FinanceListCommandCard
          detail="Reconciliation and net revenue deltas must be 0 before declaration or final closeout."
          href={monthlyTaxClosingHref(filters)}
          icon={Scale}
          label="Formula delta"
          tone={formulaDelta === 0 ? 'success' : 'danger'}
          value={formatMoney(formulaDelta, summary.currency)}
        />
        <FinanceListCommandCard
          detail="Open tax rows, coupon review flags, cash debt, or formula mismatch still blocking closeout."
          href={closeoutRiskLinks.find((link) => link.count || link.amountLabel !== '0 VND')?.href ?? monthlyTaxClosingHref(filters)}
          icon={AlertTriangle}
          label="Closeout gates"
          tone={openCloseoutRiskCount > 0 ? 'warning' : 'success'}
          value={String(openCloseoutRiskCount)}
        />
        <FinanceListCommandCard
          detail={remittanceEvidenceState.detail}
          href={monthlyTaxClosingHref(filters)}
          icon={Landmark}
          label="Remittance evidence"
          tone={remittanceEvidenceState.tone}
          value={remittanceEvidenceState.label}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Period ${summary.period}. The preview is calculated from immutable settlement snapshots; stored closing rows only add status and closeout timestamps.`}
        resultLabel={summary.status}
        resultTone={closingStatusTone(summary.status)}
        title="Monthly closing period"
      >
        <FinancePeriodFilterForm period={filters.period} rows={{ value: filters.take }} />
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-mb-16"
        description="Save the reviewed monthly totals into the closing row before declaration, payment, or final closeout. Closed periods require reversal entries, not direct edits."
        resultLabel={summary.status}
        resultTone={closingStatusTone(summary.status)}
        title="Monthly closing action"
      >
        {nextStatusOptions.length ? (
          <form action={updateMonthlyTaxClosingStatus} className="form-grid compact-form admin-mt-12">
            <input name="period" type="hidden" value={filters.period} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <AdminFormSelect
              defaultValue={nextStatusOptions[0]?.value}
              label="Next status"
              labelVisibility="visible"
              name="status"
              options={nextStatusOptions.map((option) => ({ label: option.label, value: option.value }))}
            />
            <AdminFormInput
              defaultValue={summary.notes ?? ''}
              label="Operator notes"
              labelVisibility="visible"
              name="notes"
              placeholder="Tax portal reference, declaration note, or closeout memo"
            />
            <AdminFormInput
              defaultValue={summary.remittanceMetadata?.transferRef ?? ''}
              label="Remittance ref"
              labelVisibility="visible"
              name="remittanceTransferRef"
              placeholder="Required when moving to PAID"
            />
            <AdminFormInput
              defaultValue={summary.remittanceMetadata?.approvedByAdminId ?? ''}
              label="Approving admin ID"
              labelVisibility="visible"
              name="approvalAdminId"
              placeholder="Required when moving to PAID"
            />
            <AdminFormInput
              defaultValue={datetimeLocalValue(summary.remittanceMetadata?.paidAt ?? summary.paidAt)}
              label="Paid at"
              labelVisibility="visible"
              name="paidAt"
              type="datetime-local"
            />
            <AdminFormInput
              defaultValue={summary.remittanceMetadata?.channel ?? ''}
              label="Channel"
              labelVisibility="visible"
              name="remittanceChannel"
              placeholder="VCB manual transfer"
            />
            <AdminFormInput
              defaultValue={summary.remittanceMetadata?.evidenceUrl ?? ''}
              label="Evidence URL"
              labelVisibility="visible"
              name="remittanceEvidenceUrl"
              placeholder="Tax portal receipt or retained evidence URL"
            />
            <AdminFormControlButton className="button button-primary" type="submit">
              Save closing status
            </AdminFormControlButton>
            <p className="muted">{nextStatusOptions[0]?.helper}</p>
          </form>
        ) : (
          <p className="muted admin-mt-12">
            No direct status action is available. Closed or reversed periods require reversal entries, not direct edits.
          </p>
        )}
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-mb-16"
        description="Resolve these queues before declaration, payment, or final closeout. This section uses the monthly summary only."
        resultLabel="Closeout gates"
        resultTone="warning"
        title="Closeout risk queue"
      >
        <FinanceStageList
          items={closeoutRiskLinks.map((link) => ({
            helper: link.helper,
            href: link.href,
            key: link.key,
            label: link.label,
            signal: link.signal,
            value: link.amountLabel ?? (typeof link.count === 'number' ? `${link.count} open` : 'Open queue'),
          }))}
        />
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-mb-16"
        description="Both formulas should show 0 VND delta before an operator declares or closes the period."
        title="Monthly reconciliation"
      >
        <FinanceStageList
          items={[
            {
              helper: 'Customer payment - Partner payout - Partner withholding - payment fees = platform fee gross.',
              key: 'customer-payment-reconciliation',
              label: 'Customer payment reconciliation',
              signal: '1',
              value: formatMoney(summary.reconciliationDelta, summary.currency),
            },
            {
              helper: 'Platform fee gross - company output VAT = platform fee net revenue.',
              key: 'platform-vat-split',
              label: 'Platform VAT split',
              signal: '2',
              value: formatMoney(summary.netRevenueDelta, summary.currency),
            },
            {
              helper: (
                <>
                  {summary.couponSettlementCount} coupon settlement row(s), {summary.couponReviewFlagCount} review
                  flag(s). Company-funded coupons stay outside platform revenue and VAT.
                </>
              ),
              key: 'coupon-expense-closeout',
              label: 'Coupon expense closeout',
              signal: '3',
              value: formatMoney(summary.companyCouponExpenseTotal, summary.currency),
            },
            {
              helper: (
                <>
                  {summary.partnerCountWithRevenue} Partner(s), {summary.openTaxCount} open tax rows,{' '}
                  {summary.paidTaxCount} paid tax rows.
                </>
              ),
              key: 'partner-withholding-closeout',
              label: 'Partner withholding closeout',
              signal: '4',
              value: formatMoney(summary.partnerWithholdingTotal, summary.currency),
            },
          ]}
        />
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="Stored closing rows. If no row exists yet, the cards above still show a draft preview from settlement snapshots."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Stored monthly closing rows"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No stored monthly tax closing row exists for this period yet."
            headers={['Period', 'Status', 'Settlements', 'Platform VAT', 'Partner tax', 'Payment fees', 'Closeout']}
            rowCount={tableRows.length}
          >
            {tableRows.map((closing) => {
              const closingRemittanceState = buildMonthlyTaxClosingRemittanceEvidenceState(closing);

              return (
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
                    <span className={`pill ${remittanceEvidencePill(closingRemittanceState.tone)}`}>
                      {closingRemittanceState.label}
                    </span>
                    <div className="muted admin-mt-8">Declared {formatDateTime(closing.declaredAt)}</div>
                    <div className="muted">Paid {formatDateTime(closing.paidAt)}</div>
                    <div className="muted">Closed {formatDateTime(closing.closedAt)}</div>
                    <div className="muted">{closingRemittanceState.detail}</div>
                    {closingRemittanceState.evidenceHref ? (
                      <a className="text-link" href={closingRemittanceState.evidenceHref} rel="noreferrer" target="_blank">
                        Open remittance evidence
                      </a>
                    ) : null}
                    {closing.notes ? <div className="muted admin-mt-8">{closing.notes}</div> : null}
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
        </AdminTableScroll>
        <FinanceTablePaginationFooter
          ariaLabel="Monthly tax closing pages"
          hrefForPage={(page) => monthlyTaxClosingHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
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

function remittanceEvidencePill(tone: 'neutral' | 'success' | 'warning') {
  if (tone === 'success') {
    return 'pill-success';
  }
  if (tone === 'warning') {
    return 'pill-warn';
  }
  return 'pill-neutral';
}

function closingStatusTone(status: string) {
  if (status === 'PAID' || status === 'CLOSED') {
    return 'success';
  }
  if (status === 'DECLARED' || status === 'REVIEWED') {
    return 'info';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
}

function datetimeLocalValue(value?: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 16);
}
