import { AlertTriangle, CheckCircle2, Landmark, Scale } from 'lucide-react';

import type {
  AdminMonthlyTaxClosing,
  AdminMonthlyTaxClosingSummary,
  AdminUser,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDateTime,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass, StatusBadgeLink } from '../../../components/status-badge';
import { formatMoney } from '../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { buildFinanceApproverOptions } from '../finance-approver-options';
import { hasFinancePriorityWork, renderFinancePriorityValue } from '../finance-priority-value';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { FinancePeriodFilterForm } from '../finance-period-filter-form';
import { FinanceStageList } from '../finance-stage-list';
import {
  financeEvidenceTonePill,
  financeMonthlyTaxClosingStatusPill,
  financeMonthlyTaxClosingStatusTone,
} from '../finance-status-badge-model';
import { FinanceTablePaginationFooter } from '../finance-table-pagination-footer';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildMonthlyTaxClosingApiHref,
  buildMonthlyTaxClosingExportHref,
  buildMonthlyTaxClosingRemittanceEvidenceState,
  buildMonthlyTaxClosingRiskLinks,
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
  const requestedStatusConfirmation = readSearchParam(params.confirm) === 'status';
  const requestedTargetStatus = readSearchParam(params.targetStatus);
  const closingNotice = monthlyTaxClosingNotice(readSearchParam(params.closingNotice));
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
  const summaryCsvHref = buildMonthlyTaxClosingExportHref(filters, 'summary');
  const closingRowsCsvHref = buildMonthlyTaxClosingExportHref(filters, 'rows');
  const accountingJournalCsvHref = buildMonthlyTaxClosingExportHref(filters, 'accounting-journal');
  const nextStatusOptions = monthlyTaxClosingNextStatusOptions(summary.status);
  const nextStatus = nextStatusOptions[0]?.value ?? null;
  const closeoutRiskLinks = buildMonthlyTaxClosingRiskLinks(summary, settlementFilters, filters);
  const formulaDelta = Math.abs(summary.reconciliationDelta) + Math.abs(summary.netRevenueDelta);
  const paymentFeeEvidenceBlocksNextStatus =
    Boolean(nextStatus && nextStatus !== 'REVIEWED') && summary.paymentFeeReviewFlagCount > 0;
  const partnerDepositReconciliationBlocksNextStatus =
    Boolean(nextStatus && nextStatus !== 'REVIEWED') && summary.partnerDepositReconciliationOpenCount > 0;
  const closeoutActionBlocked =
    formulaDelta > 0 || paymentFeeEvidenceBlocksNextStatus || partnerDepositReconciliationBlocksNextStatus;
  const closeoutActionHelper = formulaDelta > 0
    ? 'Resolve the formula delta before advancing this monthly closing.'
    : paymentFeeEvidenceBlocksNextStatus
      ? `Resolve ${summary.paymentFeeReviewFlagCount} payment fee evidence row(s) before declaration.`
      : partnerDepositReconciliationBlocksNextStatus
        ? `Reconcile ${summary.partnerDepositReconciliationOpenCount} executed Partner bank deposit(s) before declaration.`
      : nextStatusOptions[0]?.helper;
  const showStatusConfirmation =
    requestedStatusConfirmation &&
    Boolean(nextStatus) &&
    requestedTargetStatus === nextStatus &&
    !closeoutActionBlocked;
  const needsFinanceApproverDirectory = showStatusConfirmation && nextStatus === 'PAID';
  const [currentOperatorAccess, financeApproverUsers] = needsFinanceApproverDirectory
    ? await Promise.all([
        getCurrentAdminOperatorAccess(),
        adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', []),
      ])
    : [null, []];
  const financeApproverOptions = buildFinanceApproverOptions(
    financeApproverUsers,
    currentOperatorAccess?.id ?? null,
  );
  const paidApprovalUnavailable = needsFinanceApproverDirectory && financeApproverOptions.length === 0;
  const statusConfirmationHref = nextStatus
    ? monthlyTaxClosingConfirmationHref(returnTo, nextStatus)
    : returnTo;
  const remittanceEvidenceState = buildMonthlyTaxClosingRemittanceEvidenceState(summary);
  const openCloseoutRiskCount =
    summary.openTaxCount +
    summary.couponReviewFlagCount +
    summary.paymentFeeReviewFlagCount +
    summary.partnerDepositReconciliationOpenCount +
    (summary.cashDebtTotal > 0 ? 1 : 0) +
    (formulaDelta > 0 ? 1 : 0);
  const periodScope = `Period ${filters.period}`;

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
          <StatusBadgeLink
            download={`hands-monthly-tax-closing-${filters.period}-summary.csv`}
            href={summaryCsvHref}
            tone="info"
          >
            Export summary CSV
          </StatusBadgeLink>
          <StatusBadgeLink
            download={`hands-monthly-tax-closing-${filters.period}-rows.csv`}
            href={closingRowsCsvHref}
            tone="info"
          >
            Export rows CSV
          </StatusBadgeLink>
          <StatusBadgeLink
            download={`hands-accounting-journal-${filters.period}.csv`}
            href={accountingJournalCsvHref}
            tone="success"
          >
            Export accounting journal CSV
          </StatusBadgeLink>
        </TaxFinanceWorkflowActions>
      }
      description="Monthly platform VAT, Partner VAT/PIT withholding, payment fee, and booking settlement reconciliation preview."
      metrics={[
        {
          helper: 'Current stored closing status, or draft preview when no closing row exists yet.',
          kind: summary.status === 'CLOSED' ? 'record' : 'action',
          label: 'Period status',
          scope: periodScope,
          value: summary.status,
        },
        {
          helper: 'Settlement records included in this monthly tax period.',
          kind: 'period',
          label: 'Settlements',
          scope: periodScope,
          value: summary.settlementCount,
        },
        {
          helper: 'Company VAT payable from platform fee gross.',
          kind: 'period',
          label: 'Company output VAT',
          scope: periodScope,
          value: <MoneyText amount={summary.companyOutputVatTotal} currency={summary.currency} />,
        },
        {
          helper: 'Partner VAT plus PIT withheld for the month.',
          kind: 'period',
          label: 'Partner withholding',
          scope: periodScope,
          value: <MoneyText amount={summary.partnerWithholdingTotal} currency={summary.currency} />,
        },
      ]}
      title="Monthly Tax Closing"
    >
      {closingNotice ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone={closingNotice.tone}>
          <strong>{closingNotice.title}</strong> {closingNotice.detail}
        </AdminInlineNotice>
      ) : null}

      {requestedStatusConfirmation && !showStatusConfirmation ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          This monthly closing transition is stale, invalid, or blocked by an open closeout gate. Refresh the period before continuing. No closing status was changed.
        </AdminInlineNotice>
      ) : null}

      <FinanceListCommandBoard ariaLabel="Closeout command board">
        <FinanceListCommandCard
          detail="Current stored closing status, or draft preview when no closing row exists yet."
          href={monthlyTaxClosingHref(filters)}
          icon={CheckCircle2}
          label="Closeout status"
          scope={periodScope}
          tone={financeMonthlyTaxClosingStatusTone(summary.status)}
          value={summary.status}
        />
        <FinanceListCommandCard
          detail="Reconciliation and net revenue deltas must be 0 before declaration or final closeout."
          href={monthlyTaxClosingHref(filters)}
          icon={Scale}
          label="Formula delta"
          scope={periodScope}
          tone={formulaDelta === 0 ? 'success' : 'danger'}
          value={<MoneyText amount={formulaDelta} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Open tax rows, payment fee evidence, coupon flags, cash debt, or formula mismatch still blocking closeout."
          href={closeoutRiskLinks.find(hasFinancePriorityWork)?.href ?? monthlyTaxClosingHref(filters)}
          icon={AlertTriangle}
          label="Closeout gates"
          scope={openCloseoutRiskCount > 0 ? 'Needs action' : periodScope}
          tone={openCloseoutRiskCount > 0 ? 'warning' : 'success'}
          value={String(openCloseoutRiskCount)}
        />
        <FinanceListCommandCard
          detail={remittanceEvidenceState.detail}
          href={monthlyTaxClosingHref(filters)}
          icon={Landmark}
          label="Remittance evidence"
          scope={periodScope}
          tone={remittanceEvidenceState.tone}
          value={remittanceEvidenceState.label}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Period ${summary.period}. The preview is calculated from posted settlement records; stored closing rows only add status and closeout timestamps.`}
        resultLabel={summary.status}
        resultTone={financeMonthlyTaxClosingStatusTone(summary.status)}
        title="Monthly closing period"
      >
        <FinancePeriodFilterForm period={filters.period} rows={{ value: filters.take }} />
        <AdminFilterSummary
          ariaLabel="Active monthly closing filters"
          labels={[`Period: ${filters.period}`, `Rows: ${filters.take}`, `Status: ${summary.status}`]}
          tone="info"
        />
      </AdminFilterPanel>

      <AdminSection
        className="admin-mb-16"
        description="Save the reviewed monthly totals into the closing row before declaration, payment, or final closeout. Closed periods require reversal entries, not direct edits."
        statusLabel={summary.status}
        statusTone={financeMonthlyTaxClosingStatusTone(summary.status)}
        title="Monthly closing action"
      >
        {showStatusConfirmation && nextStatus ? (
          <AdminFormGrid action={updateMonthlyTaxClosingStatus} className="compact-form admin-mt-12">
            <input name="confirmationPeriod" type="hidden" value={filters.period} />
            <input name="confirmationStatus" type="hidden" value={nextStatus} />
            <input name="period" type="hidden" value={filters.period} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <input name="status" type="hidden" value={nextStatus} />
            <AdminInlineNotice role="status" tone={nextStatus === 'CLOSED' ? 'danger' : 'warning'}>
              <strong>{summary.status} → {nextStatus}</strong>{' '}
              {monthlyTaxClosingTransitionDescription(nextStatus, summary)}
            </AdminInlineNotice>
            {paidApprovalUnavailable ? (
              <AdminInlineNotice role="alert" tone="warning">
                No other Finance approver is available. Tax remittance closeout remains disabled until another operator has the FINANCE_APPROVER role.
              </AdminInlineNotice>
            ) : null}
            <AdminFormInput
              defaultValue={summary.notes ?? ''}
              label="Operator notes"
              labelVisibility="visible"
              name="notes"
              placeholder="Tax portal reference, declaration note, or closeout memo"
            />
            {nextStatus === 'PAID' ? (
              <>
                <AdminFormInput
                  defaultValue={summary.remittanceMetadata?.transferRef ?? ''}
                  label="Remittance ref"
                  labelVisibility="visible"
                  name="remittanceTransferRef"
                  placeholder="Bank or tax portal transfer reference"
                  required
                />
                <AdminFormSelect
                  defaultValue={summary.remittanceMetadata?.approvedByAdminId ?? ''}
                  disabled={paidApprovalUnavailable}
                  label="Separate Finance approver"
                  labelVisibility="visible"
                  name="approvalAdminId"
                  options={[{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions]}
                  required
                />
                <AdminFormDateTime
                  defaultValue={datetimeLocalValue(summary.remittanceMetadata?.paidAt ?? summary.paidAt)}
                  label="Paid at"
                  labelVisibility="visible"
                  name="paidAt"
                  required
                />
                <AdminFormInput
                  defaultValue={summary.remittanceMetadata?.channel ?? ''}
                  label="Channel"
                  labelVisibility="visible"
                  name="remittanceChannel"
                  placeholder="VCB manual transfer"
                  required
                />
                <AdminFormInput
                  defaultValue={summary.remittanceMetadata?.evidenceUrl ?? ''}
                  label="Evidence URL"
                  labelVisibility="visible"
                  name="remittanceEvidenceUrl"
                  placeholder="Tax portal receipt or retained evidence URL"
                  required
                />
              </>
            ) : null}
            <AdminFormControlButton
              className="button-primary"
              disabled={closeoutActionBlocked || paidApprovalUnavailable}
              type="submit"
            >
              Confirm {nextStatusOptions[0]?.label ?? nextStatus}
            </AdminFormControlButton>
            <AdminFormControlLink className="button-secondary" href={returnTo}>Cancel</AdminFormControlLink>
          </AdminFormGrid>
        ) : nextStatusOptions.length ? (
          <div className="admin-mt-12">
            {closeoutActionBlocked ? (
              <AdminFormControlButton className="button-primary" disabled type="button">
                Review {nextStatusOptions[0]?.label ?? nextStatus}
              </AdminFormControlButton>
            ) : (
              <AdminFormControlLink className="button-primary" href={statusConfirmationHref}>
                Review {nextStatusOptions[0]?.label ?? nextStatus}
              </AdminFormControlLink>
            )}
            <p className="muted admin-mt-8">{closeoutActionHelper}</p>
          </div>
        ) : (
          <p className="muted admin-mt-12">
            No direct status action is available. Closed or reversed periods require reversal entries, not direct edits.
          </p>
        )}
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Resolve these queues before declaration, payment, or final closeout. This section uses the monthly summary only."
        statusLabel="Closeout gates"
        statusTone="warning"
        title="Closeout risk queue"
      >
        <FinanceStageList
          items={closeoutRiskLinks.map((link) => ({
            helper: link.helper,
            href: link.href,
            key: link.key,
            label: link.label,
            signal: link.signal,
            value: renderFinancePriorityValue(link),
          }))}
        />
      </AdminSection>

      <AdminSection
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
              value: <MoneyText amount={summary.reconciliationDelta} currency={summary.currency} />,
            },
            {
              helper: 'Platform fee gross - company output VAT = platform fee net revenue.',
              key: 'platform-vat-split',
              label: 'Platform VAT split',
              signal: '2',
              value: <MoneyText amount={summary.netRevenueDelta} currency={summary.currency} />,
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
              value: <MoneyText amount={summary.companyCouponExpenseTotal} currency={summary.currency} />,
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
              value: <MoneyText amount={summary.partnerWithholdingTotal} currency={summary.currency} />,
            },
          ]}
        />
      </AdminSection>

      <FinanceTablePanel
        grouped
        description="Stored closing rows. If no row exists yet, the cards above still show a draft preview from settlement records."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Stored monthly closing rows"
      >
        <FinanceDataTable
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
                    <StatusBadgeFromPillClass pillClass={financeMonthlyTaxClosingStatusPill(closing.status)}>
                      {closing.status}
                    </StatusBadgeFromPillClass>
                  </td>
                  <td>{closing.settlementCount}</td>
                  <td>
                    <strong>
                      <MoneyText amount={closing.companyOutputVatTotal} currency={closing.currency} />
                    </strong>
                    <div className="muted">
                      Net <MoneyText amount={closing.platformFeeNetRevenueTotal} currency={closing.currency} />
                    </div>
                  </td>
                  <td>
                    <strong>
                      <MoneyText amount={closing.partnerWithholdingTotal} currency={closing.currency} />
                    </strong>
                    <div className="muted">
                      VAT <MoneyText amount={closing.partnerVatWithheldTotal} currency={closing.currency} />
                    </div>
                    <div className="muted">
                      PIT <MoneyText amount={closing.partnerPitWithheldTotal} currency={closing.currency} />
                    </div>
                  </td>
                  <td>
                    <MoneyText amount={closing.paymentProcessingFeeTotal} currency={closing.currency} />
                  </td>
                  <td>
                    <StatusBadgeFromPillClass pillClass={financeEvidenceTonePill(closingRemittanceState.tone)}>
                      {closingRemittanceState.label}
                    </StatusBadgeFromPillClass>
                    <div className="muted admin-mt-8">
                      Declared <DateTimeText value={closing.declaredAt} />
                    </div>
                    <div className="muted">
                      Paid <DateTimeText value={closing.paidAt} />
                    </div>
                    <div className="muted">
                      Closed <DateTimeText value={closing.closedAt} />
                    </div>
                    <div className="muted">{closingRemittanceState.detail}</div>
                    {closingRemittanceState.evidenceHref ? (
                      <AdminTextLink href={closingRemittanceState.evidenceHref} rel="noreferrer" target="_blank">
                        Open remittance evidence
                      </AdminTextLink>
                    ) : null}
                    {closing.notes ? <div className="muted admin-mt-8">{closing.notes}</div> : null}
                  </td>
                </tr>
              );
            })}
          </FinanceDataTable>
        <FinanceTablePaginationFooter
          ariaLabel="Monthly tax closing pages"
          hrefForPage={(page) => monthlyTaxClosingHref({ ...filters, page })}
          pagination={pagination}
        />
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function datetimeLocalValue(value?: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 16);
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function monthlyTaxClosingConfirmationHref(returnTo: string, targetStatus: string) {
  const url = new URL(returnTo, 'http://localhost');
  url.searchParams.set('confirm', 'status');
  url.searchParams.set('targetStatus', targetStatus);
  return `${url.pathname}${url.search}`;
}

function monthlyTaxClosingTransitionDescription(
  targetStatus: string,
  summary: AdminMonthlyTaxClosingSummary,
) {
  if (targetStatus === 'REVIEWED') {
    return `Snapshot ${summary.settlementCount} settlement record(s) and the current tax totals for Finance review.`;
  }
  if (targetStatus === 'DECLARED') {
    return 'Record that this reviewed period was submitted to the tax portal. Open formula, fee, and bank-evidence gates remain blocked by the API.';
  }
  if (targetStatus === 'PAID') {
    return `Record retained payment evidence for ${formatMoney(summary.companyOutputVatTotal + summary.partnerWithholdingTotal, summary.currency)} of company VAT and Partner withholding obligations.`;
  }
  return 'Close and lock this paid period. Future corrections must use reversal entries; stored snapshots cannot be edited directly.';
}

function monthlyTaxClosingNotice(value: string) {
  if (value === 'updated') {
    return {
      detail: 'The API accepted the transition and the monthly closing evidence was refreshed.',
      title: 'Monthly closing status updated.',
      tone: 'success' as const,
    };
  }
  if (value === 'failed') {
    return {
      detail: 'The API rejected the transition. Review open closeout gates, status freshness, approval separation, and remittance evidence before retrying.',
      title: 'Monthly closing status was not changed.',
      tone: 'danger' as const,
    };
  }
  if (value === 'confirmation-required') {
    return {
      detail: 'Open the transition review again before submitting. No monthly closing status was changed.',
      title: 'Transition confirmation is required.',
      tone: 'warning' as const,
    };
  }
  return null;
}
