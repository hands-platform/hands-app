import { AlertTriangle, Landmark, ReceiptText, Scale } from 'lucide-react';

import { ActionMenu } from '../../components/action-menu';
import type {
  AdminBankReconciliationSummary,
  AdminBookingPaymentClearingSummary,
  AdminBookingSettlementSnapshotSummary,
  AdminCouponFinanceSummary,
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxSummary,
  AdminProviderWalletWithdrawalRequestSummary,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSection } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import { readSearchParam } from '../../lib/date-range';
import { FinanceOverviewTablePanel, type FinanceOverviewTableRow } from './finance-overview-table-panel';
import { renderFinancePriorityValue } from './finance-priority-value';
import { FinanceListCommandBoard, FinanceListCommandCard } from './finance-list-command-card';
import { FinanceStageList } from './finance-stage-list';
import { TaxFinanceWorkflowActions } from './tax-finance-workflow-actions';
import {
  bookingSettlementAuditHref,
  buildBankReconciliationSummaryApiHref,
  buildBookingPaymentClearingSummaryApiHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildCouponFinanceSummaryApiHref,
  buildMonthlyTaxClosingSummaryApiHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildProviderWalletWithdrawalRequestSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildFinanceOperationsPriorityLinks,
  buildFinanceOperationsSummaryFilters,
  buildFinancePayoutPriorityLinks,
  emptyBankReconciliationSummary,
  emptyBookingPaymentClearingSummary,
  emptyBookingSettlementSummary,
  emptyCouponFinanceSummary,
  emptyMonthlyTaxClosingSummary,
  emptyPartnerWithholdingTaxSummary,
  emptyProviderWalletWithdrawalRequestSummary,
  monthlyTaxClosingHref,
  paymentClearingHref,
  partnerWithholdingTaxHref,
  platformVatHref,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
  type TaxFinanceWorkflowLink,
} from './tax-settlement-page-model';

type FinanceTaxPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceTaxPage({ searchParams }: FinanceTaxPageProps) {
  const params = searchParams ? await searchParams : {};
  const settlementFilters = readBookingSettlementFilters(params);
  const accountingFilters = readFinanceAccountingFilters(params, 'all');
  const { bankFilters, clearingFilters } = buildFinanceOperationsSummaryFilters(accountingFilters);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const monthlyClosingFilters = readMonthlyTaxClosingFilters(params);
  const showFullSummaryView = readSearchParam(params.view) === 'full';
  const [
    settlementSummary,
    couponFinanceSummary,
    withholdingSummary,
    withdrawalRequestSummary,
    clearingSummary,
    bankSummary,
    monthlyClosingSummary,
  ] =
    await Promise.all([
      adminGet<AdminBookingSettlementSnapshotSummary>(
        buildBookingSettlementSnapshotSummaryApiHref(settlementFilters),
        emptyBookingSettlementSummary(),
      ),
      showFullSummaryView
        ? adminGet<AdminCouponFinanceSummary>(
            buildCouponFinanceSummaryApiHref(settlementFilters),
            emptyCouponFinanceSummary(),
          )
        : Promise.resolve(emptyCouponFinanceSummary()),
      adminGet<AdminPartnerWithholdingTaxSummary>(
        buildPartnerWithholdingTaxSummaryApiHref(withholdingFilters),
        emptyPartnerWithholdingTaxSummary(withholdingFilters.period),
      ),
      showFullSummaryView
        ? adminGet<AdminProviderWalletWithdrawalRequestSummary>(
            buildProviderWalletWithdrawalRequestSummaryApiHref(settlementFilters),
            emptyProviderWalletWithdrawalRequestSummary(),
          )
        : Promise.resolve(emptyProviderWalletWithdrawalRequestSummary()),
      adminGet<AdminBookingPaymentClearingSummary>(
        buildBookingPaymentClearingSummaryApiHref(clearingFilters),
        emptyBookingPaymentClearingSummary(),
      ),
      adminGet<AdminBankReconciliationSummary>(
        buildBankReconciliationSummaryApiHref(bankFilters),
        emptyBankReconciliationSummary(),
      ),
      adminGet<AdminMonthlyTaxClosingSummary>(
        buildMonthlyTaxClosingSummaryApiHref(monthlyClosingFilters),
        emptyMonthlyTaxClosingSummary(monthlyClosingFilters.period),
      ),
    ]);

  const currency = settlementSummary.currency || withholdingSummary.currency || 'VND';
  const monthlyFormulaIssueCount =
    (monthlyClosingSummary.reconciliationDelta !== 0 ? 1 : 0) +
    (monthlyClosingSummary.netRevenueDelta !== 0 ? 1 : 0);
  const openFinanceRiskCount =
    settlementSummary.openTaxCount +
    clearingSummary.openCount +
    bankSummary.unmatchedCount +
    monthlyClosingSummary.couponReviewFlagCount +
    monthlyClosingSummary.paymentFeeReviewFlagCount +
    monthlyClosingSummary.partnerDepositReconciliationOpenCount +
    monthlyFormulaIssueCount;
  const monthlyScope = `Period ${monthlyClosingFilters.period}`;
  const settlementScope = 'Active queue';
  const workflowLinks = buildTaxFinanceWorkflowLinks({
    current: 'overview',
    accountingFilters,
    monthlyFilters: monthlyClosingFilters,
    settlementFilters,
    withholdingFilters,
  });
  const headerWorkflowLinks = workflowLinks.filter((link) => isFinanceOverviewHeaderLink(link.key));
  const priorityRows = buildFinanceOperationsPriorityLinks({
    accountingFilters,
    bankSummary,
    clearingSummary,
    monthlyClosingFilters,
    monthlyClosingSummary,
    settlementFilters,
    settlementSummary,
  }).map((link) => ({
    actionLabel: 'Review',
    helper: link.helper,
    href: link.href,
    key: link.key,
    label: link.label,
    signal: link.signal,
    signalTone: 'warn' as const,
    value: renderFinancePriorityValue(link),
  }));
  const workspaceRows = [
    ...workflowLinks.map((link) =>
      financeWorkspaceRowForLink(link, {
        companyOutputVat: settlementSummary.companyOutputVat,
        couponReviewFlagCount: monthlyClosingSummary.couponReviewFlagCount,
        currency,
        monthlyPeriod: monthlyClosingFilters.period,
        partnerTaxWithheld: withholdingSummary.totalPartnerTaxWithheld,
        paymentProcessingFee: settlementSummary.paymentProcessingFee,
        settlementOpenTaxCount: settlementSummary.openTaxCount,
      }),
    ),
    {
      actionLabel: 'Open',
      helper: 'Manage company bank account records used by manual bank reconciliation.',
      href: '/finance-tax/company-bank-accounts',
      key: 'company-bank-accounts',
      label: 'Company Bank Accounts',
      signal: 'BANKS',
      value: 'Accounts',
    },
    {
      actionLabel: 'Open',
      helper: 'Configure versioned tax rules. Historical settlement records keep their own tax values.',
      href: '/tax-policy',
      key: 'tax-policy',
      label: 'Tax Policy',
      signal: 'RULES',
      value: 'Policy',
    },
  ];

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={headerWorkflowLinks}
        />
      }
      description="Tax, fee, VAT, PIT, payment fee, and posted booking settlement record control view."
      metrics={[
        {
          helper: 'Posted booking settlement records matching the active queue.',
          href: '/finance-tax/booking-settlement-audit',
          kind: 'record',
          label: 'Snapshot rows',
          scope: settlementScope,
          value: settlementSummary.count,
        },
        {
          helper: 'Snapshot rows still waiting for declaration, payment, or closeout.',
          href: '/finance-tax/booking-settlement-audit?review=open',
          kind: 'risk',
          label: 'Open tax rows',
          scope: 'Needs action',
          value: settlementSummary.openTaxCount,
        },
        {
          helper: 'Customer payment amount captured by posted settlement records.',
          kind: 'period',
          label: 'Customer paid',
          scope: settlementScope,
          value: <MoneyText amount={settlementSummary.customerPaymentAmount} currency={currency} />,
        },
        {
          helper: 'Partner payout amount before monthly payout execution.',
          kind: 'action',
          label: 'Partner payout',
          scope: 'Pending',
          value: <MoneyText amount={settlementSummary.partnerPayoutAmount} currency={currency} />,
        },
        {
          helper: 'VAT plus PIT withheld for the selected monthly tax period.',
          href: partnerWithholdingTaxHref({ ...withholdingFilters, page: 1 }),
          kind: 'period',
          label: 'Partner tax withheld',
          scope: monthlyScope,
          value: <MoneyText amount={withholdingSummary.totalPartnerTaxWithheld} currency={withholdingSummary.currency || currency} />,
        },
        {
          helper: 'Output VAT component from HANDS platform fee records.',
          kind: 'period',
          label: 'Company VAT',
          scope: monthlyScope,
          value: <MoneyText amount={settlementSummary.companyOutputVat} currency={currency} />,
        },
        {
          helper: 'Payment processing fee cost recorded on settlement records.',
          kind: 'period',
          label: 'Payment fees',
          scope: settlementScope,
          value: <MoneyText amount={settlementSummary.paymentProcessingFee} currency={currency} />,
        },
        {
          helper: 'Partners with taxable settlement rows in the selected period.',
          href: partnerWithholdingTaxHref({ ...withholdingFilters, page: 1 }),
          kind: 'period',
          label: 'Partners with revenue',
          scope: monthlyScope,
          value: withholdingSummary.partnerCountWithRevenue,
        },
      ]}
      title="Tax Overview"
    >
      <FinanceListCommandBoard ariaLabel="Tax command board">
        <FinanceListCommandCard
          detail="Open tax, payment clearing, bank reconciliation, coupon, and monthly formula signals."
          href={paymentClearingHref({ ...clearingFilters, page: 1, review: 'open' })}
          icon={AlertTriangle}
          label="Open finance risk"
          scope={openFinanceRiskCount > 0 ? 'Needs action' : monthlyScope}
          tone={openFinanceRiskCount > 0 ? 'danger' : 'success'}
          value={String(openFinanceRiskCount)}
        />
        <FinanceListCommandCard
          detail="Company output VAT from HANDS platform fee snapshots."
          href={platformVatHref(monthlyClosingFilters)}
          icon={ReceiptText}
          label="Platform VAT"
          scope={monthlyScope}
          tone={settlementSummary.companyOutputVat > 0 ? 'warning' : 'neutral'}
          value={<MoneyText amount={settlementSummary.companyOutputVat} currency={currency} />}
        />
        <FinanceListCommandCard
          detail="Partner VAT/PIT withholding payable for the active monthly period."
          href={partnerWithholdingTaxHref(withholdingFilters)}
          icon={Landmark}
          label="Partner withholding"
          scope={monthlyScope}
          tone={withholdingSummary.totalPartnerTaxWithheld > 0 ? 'warning' : 'neutral'}
          value={<MoneyText amount={withholdingSummary.totalPartnerTaxWithheld} currency={withholdingSummary.currency} />}
        />
        <FinanceListCommandCard
          detail="Monthly tax closing state and formula readiness."
          href={monthlyTaxClosingHref(monthlyClosingFilters)}
          icon={Scale}
          label="Monthly close"
          scope={monthlyScope}
          tone={monthlyClosingSummary.status === 'CLOSED' ? 'success' : openFinanceRiskCount > 0 ? 'warning' : 'info'}
          value={monthlyClosingSummary.status}
        />
      </FinanceListCommandBoard>

      <AdminSection
        className="admin-mb-16"
        description="Use the summary APIs first. Open the bounded audit lists only when a finance operator needs booking-level evidence."
        statusLabel="Summary API"
        statusTone="success"
        title="Tax finance operating model"
      >
        <FinanceStageList
          items={[
            {
              helper:
                'Completed booking settlement stores customer payment, Partner payout, VAT/PIT, payment fee, and company VAT values at posting time.',
              key: 'booking-snapshot',
              label: 'Booking settlement record is immutable',
              signal: '1',
              value: `${settlementSummary.count} rows`,
            },
            {
              helper: `Partner withholding is grouped by month and Partner. Current period: ${withholdingSummary.period}.`,
              key: 'partner-tax-monthly',
              label: 'Partner tax is monthly',
              signal: '2',
              value: `${withholdingSummary.partnerCountWithRevenue} partners`,
            },
            {
              helper: (
                <>
                  Company net fee is{' '}
                  <MoneyText amount={settlementSummary.platformFeeNetRevenue} currency={currency} /> before payment
                  processing cost of <MoneyText amount={settlementSummary.paymentProcessingFee} currency={currency} />.
                </>
              ),
              key: 'snapshot-totals',
              label: 'Finance uses posted totals',
              signal: '3',
              value: (
                <>
                  <MoneyText amount={settlementSummary.companyOutputVat} currency={currency} /> VAT
                </>
              ),
            },
          ]}
        />
      </AdminSection>

      <FinanceOverviewTablePanel
        description="Summary-only command desk for today's finance work. Open bounded lists only when a row-level review is needed."
        resultLabel="Needs action first"
        resultTone="warning"
        rows={priorityRows}
        title="Finance operations priority desk"
      />

      {showFullSummaryView ? (
        <>
          <AdminSection
            className="admin-mb-16"
            description="Company-funded coupons are marketing expense, not reduced platform-fee revenue. This summary reads posted settlement record metadata only."
            statusLabel="Coupon summary API"
            statusTone="info"
            title="Coupon finance summary"
          >
            <FinanceStageList
              items={[
                {
                  helper: 'Bookings with coupon metadata in the selected finance range and active queue.',
                  href: bookingSettlementAuditHref(settlementFilters),
                  key: 'coupon-settlement-rows',
                  label: 'Coupon settlement rows',
                  signal: 'COUPON',
                  value: `${couponFinanceSummary.couponSettlementCount} rows`,
                },
                {
                  helper: 'Discount applied to customer payment while settlement keeps the pre-coupon service amount.',
                  key: 'customer-discount',
                  label: 'Customer discount',
                  signal: 'DISC',
                  value: <MoneyText amount={couponFinanceSummary.couponDiscountAmount} currency={couponFinanceSummary.currency} />,
                },
                {
                  helper: 'Actual customer payment after coupon discount. This feeds clearing and is not platform revenue.',
                  key: 'customer-paid',
                  label: 'Customer paid amount',
                  signal: 'PAID',
                  value: <MoneyText amount={couponFinanceSummary.customerPaidAmount} currency={couponFinanceSummary.currency} />,
                },
                {
                  helper: 'Pre-coupon service amount used for Partner payout, withholding, and platform fee records.',
                  key: 'settlement-base',
                  label: 'Settlement base',
                  signal: 'BASE',
                  value: (
                    <MoneyText
                      amount={couponFinanceSummary.settlementBaseAmount || couponFinanceSummary.bookingServiceAmount}
                      currency={couponFinanceSummary.currency}
                    />
                  ),
                },
                {
                  helper: 'Company-funded coupon amount to review as marketing expense, separate from revenue and VAT.',
                  key: 'company-coupon-expense',
                  label: 'Company coupon expense',
                  signal: 'EXP',
                  value: <MoneyText amount={couponFinanceSummary.companyCouponExpense} currency={couponFinanceSummary.currency} />,
                },
                {
                  helper: 'Rows where coupon metadata needs finance review before closing.',
                  key: 'coupon-review-flags',
                  label: 'Coupon review flags',
                  signal: 'FLAG',
                  value: `${couponFinanceSummary.couponReviewFlagCount} flags`,
                },
                {
                  helper: 'Refund or reversal metadata for coupon discount and company coupon expense recovery.',
                  key: 'reversed-coupon-amount',
                  label: 'Reversed coupon amount',
                  signal: 'REV',
                  value: (
                    <MoneyText
                      amount={couponFinanceSummary.reversedCouponDiscountAmount}
                      currency={couponFinanceSummary.currency}
                    />
                  ),
                },
              ]}
            />
          </AdminSection>

          <AdminSection
            className="admin-mb-16"
            description="This overview stays summary-only. Open the bounded payout and cash-debt queues only when finance needs request-level evidence."
            statusLabel="Priority links"
            statusTone="info"
            title="Payout and wallet priority desk"
          >
            <FinanceStageList
              items={buildFinancePayoutPriorityLinks(settlementFilters, withdrawalRequestSummary).map((link) => ({
                helper: link.helper,
                href: link.href,
                key: link.key,
                label: link.label,
                signal: link.signal,
                value: renderFinancePriorityValue(link),
              }))}
            />
          </AdminSection>
        </>
      ) : (
        <AdminSection
          className="admin-mb-16"
          description="Default view keeps finance overview focused on current action counts. Open the full summary only when coupon and payout rollups are needed."
          statusLabel="Compact default"
          statusTone="info"
          title="Finance optional summary desk"
        >
          <ActionMenu
            actions={[
              {
                href: '/finance-tax?view=full',
                kind: 'link',
                label: 'Open full finance summary view',
                tone: 'info',
              },
            ]}
            label="Finance optional summary actions"
            variant="button-list"
          />
        </AdminSection>
      )}

      <FinanceOverviewTablePanel
        description="Keep summary, evidence, tax, reconciliation, and policy workspaces separate so operators open row-level data only when needed."
        resultLabel={`${workspaceRows.length} workspaces`}
        resultTone="info"
        rows={workspaceRows}
        title="Finance tax workspaces"
      />
    </AdminPageTemplate>
  );
}

function isFinanceOverviewHeaderLink(key: TaxFinanceWorkflowLink['key']) {
  return key === 'payment-clearing' || key === 'general-ledger' || key === 'bank-reconciliation';
}

function financeWorkspaceRowForLink(
  link: TaxFinanceWorkflowLink,
  values: {
    readonly companyOutputVat: number;
    readonly couponReviewFlagCount: number;
    readonly currency: string;
    readonly monthlyPeriod: string;
    readonly partnerTaxWithheld: number;
    readonly paymentProcessingFee: number;
    readonly settlementOpenTaxCount: number;
  },
): FinanceOverviewTableRow {
  switch (link.key) {
    case 'approval-queue':
      return {
        actionLabel: 'Review',
        helper: 'Current payment fee policy reviews and Partner withdrawal actions, separated from completed wallet evidence.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'QUEUE',
        value: 'Pending',
      };
    case 'booking-settlement-audit':
      return {
        actionLabel: 'Review',
        helper: 'Today/needs-action by default. Review posted, cash, non-cash, declared, paid, and reversed records.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'AUDIT',
        value: `${values.settlementOpenTaxCount} open`,
      };
    case 'settlement-reversals':
      return {
        actionLabel: 'Review',
        helper: 'Refund, closed-period, and accounting reversal evidence for posted settlement records.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'REV',
        value: 'Reversals',
      };
    case 'general-ledger':
      return {
        helper: 'Bounded journal batch lookup for posting, reversal, refund, and adjustment evidence.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'GL',
        value: 'Journal',
      };
    case 'finance-approvers':
      return {
        actionLabel: 'Manage',
        helper: 'Maker/checker finance role separation and approval policy controls.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'APPROVE',
        value: 'Policy',
      };
    case 'payment-clearing':
      return {
        actionLabel: 'Review',
        helper: 'Customer payment capture, settlement posting, refund, payment fee, and coupon offset queue.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'CLEAR',
        value: 'Clearing',
      };
    case 'bank-reconciliation':
      return {
        actionLabel: 'Match',
        helper: 'Company bank transaction lookup for manual matching against accounting evidence.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'BANK',
        value: 'Reconcile',
      };
    case 'coupon-finance':
      return {
        actionLabel: 'Review',
        helper: 'Company-funded coupon expense, discount, reversal, and closeout review flags.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'COUPON',
        value: `${values.couponReviewFlagCount} flags`,
      };
    case 'monthly-tax-closing':
      return {
        actionLabel: 'Close',
        helper: 'Preview platform VAT, Partner withholding, payment fee, cash debt, and reconciliation deltas.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'CLOSE',
        value: values.monthlyPeriod,
      };
    case 'platform-vat':
      return {
        actionLabel: 'Review',
        helper: 'Review company output VAT by platform fee rate bucket.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'VAT',
        value: <MoneyText amount={values.companyOutputVat} currency={values.currency} />,
      };
    case 'payment-fees':
      return {
        actionLabel: 'Review',
        helper: 'Review processing fee totals by method, payer, and treatment.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'FEE',
        value: <MoneyText amount={values.paymentProcessingFee} currency={values.currency} />,
      };
    case 'partner-withholding-tax':
      return {
        actionLabel: 'Review',
        helper: 'Monthly Partner VAT/PIT totals for manual tax and payout closeout review.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'TAX',
        value: <MoneyText amount={values.partnerTaxWithheld} currency={values.currency} />,
      };
    case 'overview':
      return {
        helper: 'Finance and tax summary dashboard.',
        href: link.href,
        key: link.key,
        label: link.label,
        signal: 'HOME',
        value: 'Overview',
      };
  }
}
