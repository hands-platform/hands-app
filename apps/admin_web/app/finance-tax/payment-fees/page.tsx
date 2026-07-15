import { CreditCard, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';

import type {
  AdminPaymentFeePolicyPreflight,
  AdminPaymentFeePolicyApproval,
  AdminPaymentFeePolicyVersion,
  AdminPaymentFeeMethodBreakdown,
  AdminPaymentFeeSummary,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminFilterSummary } from '../../../components/admin-filter-summary';
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
  const [summary, policies, operatorAccess] = await Promise.all([
    adminGet<AdminPaymentFeeSummary>(
      buildPaymentFeeSummaryApiHref(filters),
      emptyPaymentFeeSummary(filters.period),
    ),
    adminGet<AdminPaymentFeePolicyVersion[]>('/admin/payment-fee-policies?take=20', []),
    getCurrentAdminOperatorAccess(),
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
        </TaxFinanceWorkflowActions>
      }
      description="Payment processing fees are tracked separately from Partner VAT/PIT and company output VAT."
      title="Payment Fees"
    >
      <FinanceListCommandBoard ariaLabel="Fee command board">
        <FinanceListCommandCard
          detail="Payment processing fee cost from posted settlement records."
          href={paymentFeeHref(filters)}
          icon={CreditCard}
          label="Processing fee"
          scope={periodScope}
          tone={summary.paymentProcessingFeeTotal > 0 ? 'warning' : 'neutral'}
          value={<MoneyText amount={summary.paymentProcessingFeeTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Processing fee as a share of customer payment volume for the selected period."
          href={paymentFeeHref(filters)}
          icon={ReceiptText}
          label="Effective rate"
          scope={periodScope}
          tone={summary.paymentProcessingFeeTotal > 0 ? 'info' : 'neutral'}
          value={formatFinancePercent(summary.paymentProcessingFeeTotal, summary.customerPaymentAmountTotal)}
        />
        <FinanceListCommandCard
          detail="Customer payment volume used only to audit payment fee cost."
          href="/finance-tax/booking-settlement-audit"
          icon={WalletCards}
          label="Customer paid"
          scope={periodScope}
          tone={summary.customerPaymentAmountTotal > 0 ? 'primary' : 'neutral'}
          value={<MoneyText amount={summary.customerPaymentAmountTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Posted settlements without retained payment fee policy evidence."
          href={evidenceQueueHref}
          icon={ReceiptText}
          label="Evidence review"
          scope={periodScope}
          tone={remediationPreview.evidenceReviewCount > 0 ? 'danger' : 'success'}
          value={`${remediationPreview.evidenceReviewCount} settlement(s)`}
        />
        <FinanceListCommandCard
          detail="Fee payer and treatment splits remain separate from VAT/PIT."
          href={paymentFeeHref(filters)}
          icon={ShieldCheck}
          label="Fee treatment"
          scope={periodScope}
          tone={summary.byTreatment.length > 0 ? 'success' : 'neutral'}
          value={`${summary.byTreatment.length} treatment(s)`}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description={`Period ${summary.period}. Fee totals are grouped from posted settlement records; no booking list is loaded here.`}
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
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="This is a read-only policy readiness check. Example rates in tests are not production policy and are never applied from this page."
        resultLabel={paymentFeePolicyReadinessLabel(policyReadiness.status)}
        resultTone={paymentFeePolicyReadinessTone(policyReadiness.status)}
        title="Active payment fee policy"
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
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
        description="Read-only comparison for posted settlements missing retained payment fee evidence. No settlement, journal, or monthly close record is changed here."
        resultLabel={remediationPreview.status === 'READY' ? 'Preview ready' : 'Preview blocked'}
        resultTone={remediationPreview.status === 'READY' ? 'success' : 'warning'}
        title="Historical remediation preview"
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
      </FinanceTablePanel>

      <PaymentFeePolicyManagement
        approval={approval}
        confirmationAction={policyConfirmation}
        currentOperator={operatorAccess}
        notice={policyNotice}
        policies={policies}
        preflight={preflight}
        returnTo={policyReturnTo}
        selectedMethod={method}
        selectedPolicyId={selectedDraftId}
      />

      <PaymentFeeBreakdownTable
        currency={summary.currency}
        emptyMessage="No payment payer fee rows exist for this period."
        keyField="paymentFeePayer"
        label="Fee payer"
        rows={summary.byPayer}
        title="Fees by payer"
      />
      <PaymentFeeBreakdownTable
        currency={summary.currency}
        emptyMessage="No payment treatment fee rows exist for this period."
        keyField="paymentFeeTreatment"
        label="Fee treatment"
        rows={summary.byTreatment}
        title="Fees by treatment"
      />
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
  const params = new URLSearchParams({ period });
  if (policyId) params.set('policyId', policyId);
  if (method) params.set('method', method);
  return `/finance-tax/payment-fees?${params.toString()}`;
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
  return 'Active policy missing';
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
        'Settlements',
        'Evidence review',
        'Evidence customer paid',
        'Recorded fee',
        'Expected fee',
        'Difference',
      ]}
      rowCount={rows.length}
    >
      {rows.map((row) => (
        <tr key={row.paymentMethod}>
          <td><strong>{row.paymentMethod}</strong></td>
          <td>{row.settlementCount}</td>
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
            <MoneyText amount={row.evidenceCustomerPaymentAmountTotal} currency={currency} />
          </td>
          <td>
            <MoneyText amount={row.evidenceRecordedFeeTotal} currency={currency} />
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

function PaymentFeeBreakdownTable<T extends Record<string, string | number>>({
  currency,
  emptyMessage,
  keyField,
  label,
  rows,
  title,
}: {
  readonly currency: string;
  readonly emptyMessage: string;
  readonly keyField: keyof T;
  readonly label: string;
  readonly rows: readonly T[];
  readonly title: string;
}) {
  return (
    <FinanceTablePanel
      grouped
      description="Amounts are aggregate totals only; open booking detail when settlement evidence is needed."
      resultLabel={`${rows.length} row(s)`}
      resultTone="info"
      title={title}
    >
      <FinanceDataTable
          emptyMessage={emptyMessage}
          headers={[label, 'Settlements', 'Customer paid', 'Payment fees', 'Effective rate']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={String(row[keyField])}>
              <td>
                <strong>{String(row[keyField])}</strong>
              </td>
              <td>{Number(row.settlementCount ?? 0)}</td>
              <td>
                <MoneyText amount={Number(row.customerPaymentAmountTotal ?? 0)} currency={currency} />
              </td>
              <td>
                <strong>
                  <MoneyText amount={Number(row.paymentProcessingFeeTotal ?? 0)} currency={currency} />
                </strong>
              </td>
              <td>{formatFinancePercent(Number(row.paymentProcessingFeeTotal ?? 0), Number(row.customerPaymentAmountTotal ?? 0))}</td>
            </tr>
          ))}
        </FinanceDataTable>
    </FinanceTablePanel>
  );
}
