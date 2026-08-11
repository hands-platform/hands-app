import { AlertTriangle, CreditCard, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';

import type {
  AdminPaymentFeePolicyPreflight,
  AdminPaymentFeePolicyApproval,
  AdminPaymentFeePolicyVersion,
  AdminPaymentFeeMethodBreakdown,
  AdminPaymentFeeSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../../lib/admin-operator-access-model';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeLink } from '../../../components/status-badge';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { FinancePeriodFilterForm } from '../finance-period-filter-form';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import { PaymentFeePolicyManagement } from './payment-fee-policy-management';
import {
  buildPaymentFeeExportHref,
  buildPaymentFeeSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  emptyPaymentFeeSummary,
  paymentFeeHref,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';

type PaymentFeesPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentFeesPage({ searchParams }: PaymentFeesPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = readMonthlyTaxClosingFilters(params);
  const settlementFilters = readBookingSettlementFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const policyMode = readPaymentFeeParam(params, 'settings') === 'policy';
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const canManagePolicy = hasAdminOperatorCategory(operatorAccess, 'SYSTEM_POLICY');
  const [summary, policies] = await Promise.all([
    policyMode
      ? Promise.resolve(emptyPaymentFeeSummary(filters.period))
      : adminGet<AdminPaymentFeeSummary>(
          buildPaymentFeeSummaryApiHref(filters),
          emptyPaymentFeeSummary(filters.period),
        ),
    policyMode && canManagePolicy
      ? adminGet<AdminPaymentFeePolicyVersion[]>('/admin/payment-fee-policies?take=20', [])
      : Promise.resolve([]),
  ]);
  const csvHref = buildPaymentFeeExportHref(filters);
  const periodScope = `Period ${filters.period}`;
  const policyReadiness = summary.policyReadiness;
  const remediationPreview = summary.remediationPreview;
  const activePolicy = policyReadiness.activePolicy;
  const policyId = readPaymentFeeParam(params, 'policyId');
  const method = readPaymentFeeParam(params, 'method');
  const policyNotice = readPaymentFeeParam(params, 'policyNotice');
  const policyConfirmation = readPaymentFeeParam(params, 'confirm');
  const selectedDraftId =
    policies.find((policy) => policy.status === 'DRAFT' && policy.id === policyId)?.id ??
    policies.find((policy) => policy.status === 'DRAFT')?.id ??
    null;
  const [preflight, approval] = selectedDraftId
    ? await Promise.all([
        adminGet<AdminPaymentFeePolicyPreflight | null>(
          `/admin/payment-fee-policies/${encodeURIComponent(selectedDraftId)}/preflight?sampleAmount=100000`,
          null,
        ),
        adminGet<AdminPaymentFeePolicyApproval | null>(
          `/admin/payment-fee-policies/${encodeURIComponent(selectedDraftId)}/approval`,
          null,
        ),
      ])
    : [null, null];
  const policyReturnTo = paymentFeePolicyReturnTo(filters.period, selectedDraftId ?? policyId, method);
  const evidenceQueueHref = paymentFeeEvidenceQueueHref(filters.period);

  return (
    <AdminPageTemplate
      actions={
        policyMode ? (
          <AdminFormControlLink className="button-secondary" href={paymentFeeHref(filters)}>
            Back to payment fee evidence
          </AdminFormControlLink>
        ) : (
          <TaxFinanceWorkflowActions
            links={buildTaxFinanceWorkflowLinks({
              current: 'payment-fees',
              monthlyFilters: filters,
              settlementFilters,
              withholdingFilters,
            })}
          >
            <StatusBadgeLink
              download={`hands-payment-fees-${filters.period}.csv`}
              href={csvHref}
              tone="success"
            >
              Export payment fee CSV
            </StatusBadgeLink>
            {canManagePolicy ? (
              <AdminFormControlLink className="button-outline" href={paymentFeePolicySettingsHref(filters.period)}>
                Open policy settings
              </AdminFormControlLink>
            ) : null}
          </TaxFinanceWorkflowActions>
        )
      }
      description={
        policyMode
          ? 'Restricted Settings for versioned payment processing fee policy. Draft changes require SYSTEM_POLICY access and independent Finance approval before activation.'
          : 'Payment processing fees are tracked separately from Partner VAT/PIT and company output VAT.'
      }
      title={policyMode ? 'Payment Fee Policy' : 'Payment Fees'}
    >
      {!policyMode ? <FinanceListCommandBoard ariaLabel="Fee command board">
        <FinanceListCommandCard
          detail={
            policyReadiness.status === 'READY'
              ? `${policyReadiness.configuredMethods.length} payment method rule(s) are active.`
              : `${policyReadiness.missingMethods.length} payment method rule(s) require configuration.`
          }
          href={paymentFeeHref(filters)}
          icon={ShieldCheck}
          label="Applicable policy"
          scope="Current"
          tone={paymentFeePolicyReadinessTone(policyReadiness.status)}
          value={paymentFeePolicyReadinessLabel(policyReadiness.status)}
        />
        <FinanceListCommandCard
          detail={`${summary.settlementCount} posted settlement(s) and ${summary.reversalCount} reversal(s) are netted into this amount.`}
          href={paymentFeeHref(filters)}
          icon={CreditCard}
          label="Net processing fee"
          scope={periodScope}
          tone={summary.paymentProcessingFeeTotal > 0 ? 'warning' : 'neutral'}
          value={<MoneyText amount={summary.paymentProcessingFeeTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail={`Net customer payment volume: ${formatMoneyForFeeDetail(summary.customerPaymentAmountTotal, summary.currency)}.`}
          href={paymentFeeHref(filters)}
          icon={ReceiptText}
          label="Effective fee rate"
          scope={periodScope}
          tone={summary.paymentProcessingFeeTotal > 0 ? 'info' : 'neutral'}
          value={formatFinancePercent(
            summary.paymentProcessingFeeTotal,
            summary.customerPaymentAmountTotal,
          )}
        />
        <FinanceListCommandCard
          detail="Posted settlements without retained payment fee policy evidence. Reversal rows are not treated as missing evidence."
          href={evidenceQueueHref}
          icon={AlertTriangle}
          label="Evidence review"
          scope={remediationPreview.evidenceReviewCount > 0 ? 'Needs action' : periodScope}
          tone={remediationPreview.evidenceReviewCount > 0 ? 'danger' : 'success'}
          value={`${remediationPreview.evidenceReviewCount} settlement(s)`}
        />
        <FinanceListCommandCard
          detail={
            remediationPreview.delta === null
              ? 'A complete period-covering policy is required before the evidence gap can be calculated.'
              : 'Expected fee minus recorded fee on evidence-review settlements.'
          }
          href={evidenceQueueHref}
          icon={WalletCards}
          label="Evidence fee gap"
          scope={remediationPreview.delta === null ? 'Blocked' : periodScope}
          tone={
            remediationPreview.delta === null
              ? 'warning'
              : remediationPreview.delta === 0
                ? 'success'
                : 'danger'
          }
          value={
            remediationPreview.delta === null ? (
              'Not calculated'
            ) : (
              <MoneyText amount={remediationPreview.delta} currency={summary.currency} />
            )
          }
        />
      </FinanceListCommandBoard> : null}

      {!policyMode ? <AdminFilterPanel
        className="admin-mb-16"
        description={`Period ${summary.period}. Posted settlements and closed-period reversal entries are netted; evidence review applies only to active posted settlements.`}
        resultLabel={summary.currency}
        resultTone="info"
        title="Payment fee period"
      >
        <FinancePeriodFilterForm period={filters.period} />
        <AdminFilterSummary
          ariaLabel="Active payment fee filters"
          labels={[`Period: ${filters.period}`, `Currency: ${summary.currency}`]}
          tone="info"
        />
      </AdminFilterPanel> : null}

      {!policyMode ? <FinanceTablePanel
        grouped
        description="This read-only register shows the immutable policy version covering the full selected month. Example rates in tests are not production policy and are never applied from this page."
        resultLabel={paymentFeePolicyReadinessLabel(policyReadiness.status)}
        resultTone={paymentFeePolicyReadinessTone(policyReadiness.status)}
        title="Applicable period policy"
      >
        <FinanceDataTable
          emptyMessage="Payment fee policy readiness is unavailable."
          headers={['Policy', 'Effective window', 'Configured methods', 'Missing methods', 'Status']}
          rowCount={1}
        >
          <tr>
            <td>
              <strong>{activePolicy?.name ?? 'No active policy'}</strong>
              {activePolicy ? (
                <>
                  <br />
                  <span className="muted">{activePolicy.id}</span>
                </>
              ) : null}
            </td>
            <td>
              {activePolicy ? (
                <>
                  <DateTimeText value={activePolicy.effectiveFrom} />
                  <br />
                  <span className="muted">
                    to <DateTimeText fallback="Open ended" value={activePolicy.effectiveTo} />
                  </span>
                </>
              ) : (
                <span className="muted">No effective window</span>
              )}
            </td>
            <td>{policyReadiness.configuredMethods.join(', ') || 'None'}</td>
            <td>{policyReadiness.missingMethods.join(', ') || 'None'}</td>
            <td>
              <StatusBadge tone={paymentFeePolicyReadinessTone(policyReadiness.status)}>
                {paymentFeePolicyReadinessLabel(policyReadiness.status)}
              </StatusBadge>
            </td>
          </tr>
        </FinanceDataTable>
      </FinanceTablePanel> : null}

      {!policyMode ? <FinanceTablePanel
        grouped
        description="Review net payment fee cost and missing policy evidence by payment method. This register is read-only and never changes settlement or journal records."
        resultLabel={remediationPreview.status === 'READY' ? 'Preview ready' : 'Preview blocked'}
        resultTone={remediationPreview.status === 'READY' ? 'success' : 'warning'}
        title="Payment fee evidence by method"
      >
        {remediationPreview.blockers.length ? (
          <AdminInlineFallback className="admin-mb-16">
            {remediationPreview.blockers.map((blocker) => blocker.message).join(' ')}
          </AdminInlineFallback>
        ) : null}
        <PaymentFeeMethodEvidenceTable
          currency={summary.currency}
          evidenceQueueHref={evidenceQueueHref}
          rows={summary.byPaymentMethod}
        />
      </FinanceTablePanel> : null}

      {policyMode && !canManagePolicy ? (
        <AdminInlineFallback>
          SYSTEM_POLICY access is required to open Payment Fee Policy settings. No policy data or write controls were loaded.
        </AdminInlineFallback>
      ) : null}

      {policyMode && canManagePolicy ? <PaymentFeePolicyManagement
        approval={approval}
        confirmationAction={policyConfirmation}
        currentOperator={operatorAccess}
        notice={policyNotice}
        policies={policies}
        preflight={preflight}
        returnTo={policyReturnTo}
        selectedMethod={method}
        selectedPolicyId={selectedDraftId}
      /> : null}

      {!policyMode ? <PaymentFeeAccountingBreakdownTable
        currency={summary.currency}
        payerRows={summary.byPayer}
        treatmentRows={summary.byTreatment}
      /> : null}
    </AdminPageTemplate>
  );
}

function readPaymentFeeParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function paymentFeePolicyReturnTo(period: string, policyId: string | null, method: string | null) {
  const params = new URLSearchParams({ period, settings: 'policy' });
  if (policyId) params.set('policyId', policyId);
  if (method) params.set('method', method);
  return `/finance-tax/payment-fees?${params.toString()}`;
}

function paymentFeePolicySettingsHref(period: string) {
  return `/finance-tax/payment-fees?${new URLSearchParams({ period, settings: 'policy' }).toString()}`;
}

function paymentFeeEvidenceQueueHref(period: string) {
  return `/finance-tax/booking-settlement-audit?${new URLSearchParams({
    period,
    range: 'all',
    review: 'payment-fee-evidence',
    take: '25',
  }).toString()}`;
}

function paymentFeePolicyReadinessLabel(status: AdminPaymentFeeSummary['policyReadiness']['status']) {
  if (status === 'READY') return 'Ready';
  if (status === 'MISSING_METHOD_RULES') return 'Method rules missing';
  return 'Period policy missing';
}

function paymentFeePolicyReadinessTone(status: AdminPaymentFeeSummary['policyReadiness']['status']) {
  if (status === 'READY') return 'success' as const;
  if (status === 'MISSING_METHOD_RULES') return 'warning' as const;
  return 'danger' as const;
}

function PaymentFeeMethodEvidenceTable({
  currency,
  evidenceQueueHref,
  rows,
}: {
  readonly currency: string;
  readonly evidenceQueueHref: string;
  readonly rows: readonly AdminPaymentFeeMethodBreakdown[];
}) {
  return (
    <FinanceDataTable
      emptyMessage="No payment method settlement rows exist for this period."
      headers={[
        'Payment method',
        'Posted',
        'Reversals',
        'Net customer payment',
        'Net processing fee',
        'Evidence review',
        'Expected correction',
        'Evidence gap',
      ]}
      rowCount={rows.length}
    >
      {rows.map((row) => (
        <tr key={row.paymentMethod}>
          <td><strong>{row.paymentMethod}</strong></td>
          <td>{row.settlementCount}</td>
          <td>{row.reversalCount}</td>
          <td>
            <MoneyText amount={row.customerPaymentAmountTotal} currency={currency} />
          </td>
          <td>
            <strong>
              <MoneyText amount={row.paymentProcessingFeeTotal} currency={currency} />
            </strong>
          </td>
          <td>
            {row.evidenceReviewCount > 0 ? (
              <StatusBadgeLink
                href={`${evidenceQueueHref}&paymentMethod=${encodeURIComponent(row.paymentMethod)}`}
                tone="warning"
              >
                {row.evidenceReviewCount} review
              </StatusBadgeLink>
            ) : (
              <StatusBadge tone="success">Clear</StatusBadge>
            )}
          </td>
          <td>
            {row.remediationExpectedFeeTotal === null ? (
              <span className="muted">Policy required</span>
            ) : (
              <MoneyText amount={row.remediationExpectedFeeTotal} currency={currency} />
            )}
          </td>
          <td>
            {row.remediationDelta === null ? (
              <span className="muted">Not calculated</span>
            ) : (
              <strong>
                <MoneyText amount={row.remediationDelta} currency={currency} />
              </strong>
            )}
          </td>
        </tr>
      ))}
    </FinanceDataTable>
  );
}

function PaymentFeeAccountingBreakdownTable({
  currency,
  payerRows,
  treatmentRows,
}: {
  readonly currency: string;
  readonly payerRows: AdminPaymentFeeSummary['byPayer'];
  readonly treatmentRows: AdminPaymentFeeSummary['byTreatment'];
}) {
  const rows = [
    ...payerRows.map((row) => ({
      dimension: 'Fee payer',
      label: row.paymentFeePayer,
      ...row,
    })),
    ...treatmentRows.map((row) => ({
      dimension: 'Accounting treatment',
      label: row.paymentFeeTreatment,
      ...row,
    })),
  ];

  return (
    <FinanceTablePanel
      grouped
      description="Fee payer identifies who bears the cost. Accounting treatment identifies how the same cost is posted; these are separate dimensions, not additional fees."
      resultLabel={`${rows.length} row(s)`}
      resultTone="info"
      title="Fee accounting classification"
    >
      <FinanceDataTable
        emptyMessage="No payment fee accounting classifications exist for this period."
        headers={[
          'Dimension',
          'Classification',
          'Posted',
          'Reversals',
          'Net customer payment',
          'Net processing fee',
          'Effective rate',
        ]}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr key={`${row.dimension}-${row.label}`}>
            <td>{row.dimension}</td>
            <td>
              <strong>{row.label}</strong>
            </td>
            <td>{row.settlementCount}</td>
            <td>{row.reversalCount}</td>
            <td>
              <MoneyText amount={row.customerPaymentAmountTotal} currency={currency} />
            </td>
            <td>
              <strong>
                <MoneyText amount={row.paymentProcessingFeeTotal} currency={currency} />
              </strong>
            </td>
            <td>
              {formatFinancePercent(
                row.paymentProcessingFeeTotal,
                row.customerPaymentAmountTotal,
              )}
            </td>
          </tr>
        ))}
      </FinanceDataTable>
    </FinanceTablePanel>
  );
}

function formatMoneyForFeeDetail(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}
