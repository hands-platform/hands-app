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
  buildMonthlyTaxClosingExportHref,
  buildMonthlyTaxClosingHistoryApiHref,
  buildMonthlyTaxClosingRemittanceEvidenceState,
  buildMonthlyTaxClosingPreflightLinks,
  buildMonthlyTaxClosingRiskLinks,
  buildMonthlyTaxClosingSummaryApiHref,
  buildTaxSettlementServerPagination,
  buildTaxFinanceWorkflowLinks,
  emptyMonthlyTaxClosingSummary,
  monthlyTaxClosingHref,
  monthlyTaxClosingNextStatusOptions,
  resolveMonthlyTaxClosingPreflight,
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
    adminGet<AdminMonthlyTaxClosing[]>(buildMonthlyTaxClosingHistoryApiHref(filters), []),
  ]);
  const pagination = buildTaxSettlementServerPagination(
    closings,
    filters,
    summary.monthlyClosingHistoryCount ?? closings.length,
  );
  const tableRows = pagination.rows;
  const returnTo = monthlyTaxClosingHref(filters);
  const summaryCsvHref = buildMonthlyTaxClosingExportHref(filters, 'summary');
  const closingRowsCsvHref = buildMonthlyTaxClosingExportHref(filters, 'rows');
  const accountingJournalCsvHref = buildMonthlyTaxClosingExportHref(filters, 'accounting-journal');
  const closeoutPreflight = resolveMonthlyTaxClosingPreflight(summary);
  const periodState = summary.periodState ?? summary.status;
  const nextStatusOptions = monthlyTaxClosingNextStatusOptions(summary.status);
  const nextStatus = closeoutPreflight.nextStatus;
  const closeoutRiskLinks = buildMonthlyTaxClosingRiskLinks(summary, settlementFilters, filters);
  const activeCloseoutBlockers = buildMonthlyTaxClosingPreflightLinks(
    summary,
    settlementFilters,
    filters,
  );
  const activeCloseoutBlockerKeys = new Set(activeCloseoutBlockers.map((link) => link.key));
  const activeReviewFlags = closeoutRiskLinks.filter(
    (link) => !activeCloseoutBlockerKeys.has(link.key) && hasFinancePriorityWork(link),
  );
  const closeoutActionBlocked =
    Boolean(nextStatus) && (!closeoutPreflight.ready || activeCloseoutBlockers.length > 0);
  const closeoutActionHelper =
    activeCloseoutBlockers[0]?.helper ?? nextStatusOptions[0]?.helper;
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
  const periodScope = `Period ${filters.period}`;
  const readiness = monthlyTaxClosingReadiness(
    summary.status,
    periodState,
    summary.hasActivity ?? true,
    nextStatus,
    activeCloseoutBlockers.length,
  );
  const taxPayable = summary.companyOutputVatTotal + summary.partnerWithholdingTotal;

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
          detail={readiness.detail}
          href={monthlyTaxClosingHref(filters)}
          icon={CheckCircle2}
          label="Next closeout step"
          scope={readiness.scope}
          tone={readiness.tone}
          value={readiness.label}
        />
        <FinanceListCommandCard
          detail="Only conditions that prevent the next status transition are counted here."
          href={activeCloseoutBlockers[0]?.href ?? monthlyTaxClosingHref(filters)}
          icon={AlertTriangle}
          label="Close blockers"
          scope={activeCloseoutBlockers.length > 0 ? 'Needs action' : periodScope}
          tone={activeCloseoutBlockers.length > 0 ? 'danger' : 'success'}
          value={activeCloseoutBlockers.length}
        />
        <FinanceListCommandCard
          detail="Operational items that should be checked but do not currently prevent the next closeout step."
          href={activeReviewFlags[0]?.href ?? monthlyTaxClosingHref(filters)}
          icon={Scale}
          label="Review flags"
          scope={activeReviewFlags.length > 0 ? 'Needs review' : periodScope}
          tone={activeReviewFlags.length > 0 ? 'warning' : 'success'}
          value={activeReviewFlags.length}
        />
        <FinanceListCommandCard
          detail={`${summary.settlementCount} posted settlement(s) and ${summary.reversalCount ?? 0} reversal(s). Company VAT ${formatMoney(summary.companyOutputVatTotal, summary.currency)} · Partner withholding ${formatMoney(summary.partnerWithholdingTotal, summary.currency)}. ${remittanceEvidenceState.detail}`}
          href={monthlyTaxClosingHref(filters)}
          icon={Landmark}
          label="Tax payable"
          scope={periodScope}
          tone={remittanceEvidenceState.tone}
          value={<MoneyText amount={taxPayable} currency={summary.currency} />}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Period ${summary.period}. The preview nets active posted settlements with closed-period reversal entries; stored closing rows only retain status, totals, and closeout evidence.`}
        resultLabel={periodState.replaceAll('_', ' ')}
        resultTone={periodState === 'FUTURE_PERIOD' ? 'neutral' : financeMonthlyTaxClosingStatusTone(summary.status)}
        title="Monthly closing period"
      >
        <FinancePeriodFilterForm period={filters.period} rows={{ value: filters.take }} />
        <AdminFilterSummary
          ariaLabel="Active monthly closing filters"
          labels={[
            `Period: ${filters.period}`,
            `Rows: ${filters.take}`,
            `Status: ${periodState.replaceAll('_', ' ')}`,
          ]}
          tone="info"
        />
      </AdminFilterPanel>

      <AdminSection
        className="admin-mb-16"
        description="These conditions prevent the next monthly closing transition. Resolve them before using the closeout action."
        statusLabel={activeCloseoutBlockers.length > 0 ? `${activeCloseoutBlockers.length} blocked` : 'Ready'}
        statusTone={activeCloseoutBlockers.length > 0 ? 'danger' : 'success'}
        title="Close blockers"
      >
        {activeCloseoutBlockers.length > 0 ? (
          <FinanceStageList
            items={activeCloseoutBlockers.map((link) => ({
              helper: link.helper,
              href: link.href,
              key: link.key,
              label: link.label,
              signal: link.signal,
              value: renderFinancePriorityValue(link),
            }))}
          />
        ) : (
          <AdminInlineNotice role="status" tone="success">
            No hard blocker prevents the next closeout step.
          </AdminInlineNotice>
        )}
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Review these operating signals before final close, but treat them separately from hard API blockers."
        statusLabel={activeReviewFlags.length > 0 ? `${activeReviewFlags.length} to review` : 'Clear'}
        statusTone={activeReviewFlags.length > 0 ? 'warning' : 'success'}
        title="Needs review"
      >
        {activeReviewFlags.length > 0 ? (
          <FinanceStageList
            items={activeReviewFlags.map((link) => ({
              helper: link.helper,
              href: link.href,
              key: link.key,
              label: link.label,
              signal: link.signal,
              value: renderFinancePriorityValue(link),
            }))}
          />
        ) : (
          <AdminInlineNotice role="status" tone="success">
            No additional review flag is open for this period.
          </AdminInlineNotice>
        )}
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Advance only one controlled status at a time. Closed periods require reversal entries, not direct edits."
        statusLabel={readiness.label}
        statusTone={readiness.tone}
        title="Next closeout step"
      >
        {showStatusConfirmation && nextStatus ? (
          <AdminFormGrid action={updateMonthlyTaxClosingStatus} className="compact-form admin-mt-12">
            <input name="confirmationPeriod" type="hidden" value={filters.period} />
            <input name="confirmationStatus" type="hidden" value={nextStatus} />
            <input name="period" type="hidden" value={filters.period} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <input name="status" type="hidden" value={nextStatus} />
            <AdminInlineNotice role="status" tone={nextStatus === 'CLOSED' ? 'danger' : 'warning'}>
              <strong>{periodState.replaceAll('_', ' ')} → {nextStatus}</strong>{' '}
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
                {monthlyTaxClosingReviewActionLabel(nextStatus)}
              </AdminFormControlButton>
            ) : (
              <AdminFormControlLink className="button-primary" href={statusConfirmationHref}>
                {monthlyTaxClosingReviewActionLabel(nextStatus)}
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
        description="Both formulas should show 0 VND delta before an operator declares or closes the period."
        title="Monthly reconciliation"
      >
        <FinanceStageList
          items={[
            {
              helper:
                'Customer payment + company-funded coupon expense - Partner payout - Partner withholding = platform fee gross. Payment processing fees are excluded.',
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
                  {summary.couponSettlementCount} posted coupon settlement row(s),{' '}
                  {summary.couponReversalCount ?? 0} reversal(s), {summary.couponReviewFlagCount} review
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
        description="Stored monthly close records across all periods, newest first. Select a period to review its totals and retained evidence above."
        resultLabel={`${pagination.totalRows} row(s)`}
        resultTone="info"
        title="Closing history"
      >
        <FinanceDataTable
          emptyMessage="No stored monthly tax closing record exists yet."
          headers={['Period / status', 'Settlements', 'Company tax', 'Partner withholding', 'Evidence', 'Open']}
          rowCount={tableRows.length}
        >
          {tableRows.map((closing) => {
            const closingRemittanceState = buildMonthlyTaxClosingRemittanceEvidenceState(closing);

            return (
              <tr key={closing.id}>
                <td>
                  <strong>{closing.period}</strong>
                  <div className="admin-mt-6">
                    <StatusBadgeFromPillClass pillClass={financeMonthlyTaxClosingStatusPill(closing.status)}>
                      {closing.status}
                    </StatusBadgeFromPillClass>
                  </div>
                </td>
                <td>
                  <strong>{closing.settlementCount}</strong>
                  <div className="muted">
                    Processing <MoneyText amount={closing.paymentProcessingFeeTotal} currency={closing.currency} />
                  </div>
                </td>
                <td>
                  <strong>
                    <MoneyText amount={closing.companyOutputVatTotal} currency={closing.currency} />
                  </strong>
                  <div className="muted">
                    Net revenue <MoneyText amount={closing.platformFeeNetRevenueTotal} currency={closing.currency} />
                  </div>
                </td>
                <td>
                  <strong>
                    <MoneyText amount={closing.partnerWithholdingTotal} currency={closing.currency} />
                  </strong>
                  <div className="muted">
                    VAT <MoneyText amount={closing.partnerVatWithheldTotal} currency={closing.currency} /> · PIT{' '}
                    <MoneyText amount={closing.partnerPitWithheldTotal} currency={closing.currency} />
                  </div>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={financeEvidenceTonePill(closingRemittanceState.tone)}>
                    {closingRemittanceState.label}
                  </StatusBadgeFromPillClass>
                  <div className="muted admin-mt-8">
                    Paid <DateTimeText value={closing.paidAt} /> · Closed <DateTimeText value={closing.closedAt} />
                  </div>
                  {closing.notes ? <div className="muted admin-mt-8">{closing.notes}</div> : null}
                </td>
                <td>
                  <AdminTextLink
                    href={monthlyTaxClosingHref({ ...filters, page: 1, period: closing.period })}
                  >
                    Review period
                  </AdminTextLink>
                  {closingRemittanceState.evidenceHref ? (
                    <div className="admin-mt-6">
                      <AdminTextLink href={closingRemittanceState.evidenceHref} rel="noreferrer" target="_blank">
                        Open evidence
                      </AdminTextLink>
                    </div>
                  ) : null}
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
    return `Snapshot ${summary.settlementCount} posted settlement record(s), ${summary.reversalCount ?? 0} reversal entry or entries, and the current net tax totals for Finance review.`;
  }
  if (targetStatus === 'DECLARED') {
    return 'Record that this reviewed period was submitted to the tax portal. Open formula, fee, and bank-evidence gates remain blocked by the API.';
  }
  if (targetStatus === 'PAID') {
    return `Record retained payment evidence for ${formatMoney(summary.companyOutputVatTotal + summary.partnerWithholdingTotal, summary.currency)} of company VAT and Partner withholding obligations.`;
  }
  return 'Close and lock this paid period. Future corrections must use reversal entries; stored snapshots cannot be edited directly.';
}

function monthlyTaxClosingReviewActionLabel(targetStatus: string | null) {
  switch (targetStatus) {
    case 'REVIEWED':
      return 'Review totals';
    case 'DECLARED':
      return 'Review declaration';
    case 'PAID':
      return 'Review remittance';
    case 'CLOSED':
      return 'Review final close';
    default:
      return 'Review transition';
  }
}

function monthlyTaxClosingReadiness(
  status: AdminMonthlyTaxClosing['status'],
  periodState: NonNullable<AdminMonthlyTaxClosingSummary['periodState']> | AdminMonthlyTaxClosing['status'],
  hasActivity: boolean,
  nextStatus: string | null,
  blockerCount: number,
) {
  if (periodState === 'FUTURE_PERIOD') {
    return {
      detail: 'This is a future accounting period. No closeout transition is available yet.',
      label: 'Future period',
      scope: 'Planning',
      tone: 'neutral' as const,
    };
  }
  if (periodState === 'NOT_STARTED' && !hasActivity) {
    return {
      detail: 'No settlement, reversal, or reconciliation activity exists for this period.',
      label: 'Not started',
      scope: 'No period activity',
      tone: 'neutral' as const,
    };
  }
  if (periodState === 'NOT_STARTED') {
    return {
      detail: 'Period activity exists, but no monthly closing record has been started. Review and snapshot the current totals.',
      label: 'Review totals',
      scope: 'Current NOT STARTED',
      tone: 'info' as const,
    };
  }
  if (status === 'CLOSED') {
    return {
      detail: 'This period is locked. Future corrections must use reversal entries.',
      label: 'Closed',
      scope: 'Record',
      tone: 'success' as const,
    };
  }
  if (status === 'REVERSED') {
    return {
      detail: 'This closing was reversed and remains available as an audit record.',
      label: 'Reversed',
      scope: 'Record',
      tone: 'danger' as const,
    };
  }
  if (blockerCount > 0) {
    return {
      detail: `${blockerCount} hard blocker(s) must be resolved before the next status transition.`,
      label: 'Blocked',
      scope: 'Needs action',
      tone: 'danger' as const,
    };
  }

  const nextStep = {
    REVIEWED: {
      detail: 'Review and snapshot the current settlement and tax totals.',
      label: 'Review totals',
    },
    DECLARED: {
      detail: 'The reviewed period is ready to be recorded as submitted to the tax portal.',
      label: 'Ready to declare',
    },
    PAID: {
      detail: 'Record remittance evidence with a separate Finance approver.',
      label: 'Ready to record payment',
    },
    CLOSED: {
      detail: 'Payment evidence is retained and the period is ready to be locked.',
      label: 'Ready to close',
    },
  }[nextStatus ?? ''];

  return {
    detail: nextStep?.detail ?? 'No direct closeout action is available for this period.',
    label: nextStep?.label ?? status,
    scope: `Current ${status}`,
    tone: financeMonthlyTaxClosingStatusTone(status),
  };
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
