import { CreditCard, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';

import type { AdminPaymentFeeSummary } from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeLink } from '../../../components/status-badge';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard, formatFinancePercent } from '../finance-list-command-card';
import { FinancePeriodFilterForm } from '../finance-period-filter-form';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  buildPaymentFeeSummaryCsvHref,
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
  const summary = await adminGet<AdminPaymentFeeSummary>(
    buildPaymentFeeSummaryApiHref(filters),
    emptyPaymentFeeSummary(filters.period),
  );
  const csvHref = buildPaymentFeeSummaryCsvHref(summary);

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
          tone={summary.paymentProcessingFeeTotal > 0 ? 'warning' : 'neutral'}
          value={<MoneyText amount={summary.paymentProcessingFeeTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Processing fee as a share of customer payment volume for the selected period."
          href={paymentFeeHref(filters)}
          icon={ReceiptText}
          label="Effective rate"
          tone={summary.paymentProcessingFeeTotal > 0 ? 'info' : 'neutral'}
          value={formatFinancePercent(summary.paymentProcessingFeeTotal, summary.customerPaymentAmountTotal)}
        />
        <FinanceListCommandCard
          detail="Customer payment volume used only to audit payment fee cost."
          href="/finance-tax/booking-settlement-audit"
          icon={WalletCards}
          label="Customer paid"
          tone={summary.customerPaymentAmountTotal > 0 ? 'primary' : 'neutral'}
          value={<MoneyText amount={summary.customerPaymentAmountTotal} currency={summary.currency} />}
        />
        <FinanceListCommandCard
          detail="Payment methods with fee aggregation rows in this period."
          href={paymentFeeHref(filters)}
          icon={ReceiptText}
          label="Fee methods"
          tone={summary.byPaymentMethod.length > 0 ? 'info' : 'neutral'}
          value={`${summary.byPaymentMethod.length} method(s)`}
        />
        <FinanceListCommandCard
          detail="Fee payer and treatment splits remain separate from VAT/PIT."
          href={paymentFeeHref(filters)}
          icon={ShieldCheck}
          label="Fee treatment"
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
      </AdminFilterPanel>

      <PaymentFeeBreakdownTable
        currency={summary.currency}
        emptyMessage="No payment method fee rows exist for this period."
        keyField="paymentMethod"
        label="Payment method"
        rows={summary.byPaymentMethod}
        title="Fees by payment method"
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
