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
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { formatMoney } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
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
  buildTaxFinanceMetrics,
  buildFinanceOperationsPriorityLinks,
  buildFinanceOperationsSummaryFilters,
  buildFinancePayoutPriorityLinks,
  bankReconciliationHref,
  emptyBankReconciliationSummary,
  emptyBookingPaymentClearingSummary,
  emptyBookingSettlementSummary,
  emptyCouponFinanceSummary,
  emptyMonthlyTaxClosingSummary,
  emptyPartnerWithholdingTaxSummary,
  emptyProviderWalletWithdrawalRequestSummary,
  generalLedgerHref,
  monthlyTaxClosingHref,
  paymentClearingHref,
  paymentFeeHref,
  partnerWithholdingTaxHref,
  platformVatHref,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
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
    monthlyFormulaIssueCount;

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'overview',
            accountingFilters,
            monthlyFilters: monthlyClosingFilters,
            settlementFilters,
            withholdingFilters,
          })}
        />
      }
      description="Tax, fee, VAT, PIT, payment fee, and immutable booking settlement snapshot control view."
      metrics={buildTaxFinanceMetrics(settlementSummary, withholdingSummary)}
      title="Tax Overview"
    >
      <FinanceListCommandBoard ariaLabel="Tax command board">
        <FinanceListCommandCard
          detail="Open tax, payment clearing, bank reconciliation, coupon, and monthly formula signals."
          href={paymentClearingHref({ ...clearingFilters, page: 1, review: 'open' })}
          icon={AlertTriangle}
          label="Open finance risk"
          tone={openFinanceRiskCount > 0 ? 'danger' : 'success'}
          value={String(openFinanceRiskCount)}
        />
        <FinanceListCommandCard
          detail="Company output VAT from HANDS platform fee snapshots."
          href={platformVatHref(monthlyClosingFilters)}
          icon={ReceiptText}
          label="Platform VAT"
          tone={settlementSummary.companyOutputVat > 0 ? 'warning' : 'neutral'}
          value={formatMoney(settlementSummary.companyOutputVat, currency)}
        />
        <FinanceListCommandCard
          detail="Partner VAT/PIT withholding payable for the active monthly period."
          href={partnerWithholdingTaxHref(withholdingFilters)}
          icon={Landmark}
          label="Partner withholding"
          tone={withholdingSummary.totalPartnerTaxWithheld > 0 ? 'warning' : 'neutral'}
          value={formatMoney(withholdingSummary.totalPartnerTaxWithheld, withholdingSummary.currency)}
        />
        <FinanceListCommandCard
          detail="Monthly tax closing state and formula readiness."
          href={monthlyTaxClosingHref(monthlyClosingFilters)}
          icon={Scale}
          label="Monthly close"
          tone={monthlyClosingSummary.status === 'CLOSED' ? 'success' : openFinanceRiskCount > 0 ? 'warning' : 'info'}
          value={monthlyClosingSummary.status}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description="Use the summary APIs first. Open the bounded audit lists only when a finance operator needs booking-level evidence."
        resultLabel="Summary API"
        resultTone="success"
        title="Tax finance operating model"
      >
        <FinanceStageList
          items={[
            {
              helper:
                'Completed booking settlement stores customer payment, Partner payout, VAT/PIT, payment fee, and company VAT values at posting time.',
              key: 'booking-snapshot',
              label: 'Booking snapshot is immutable',
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
                  Company net fee is {formatMoney(settlementSummary.platformFeeNetRevenue, currency)} before
                  payment processing cost of {formatMoney(settlementSummary.paymentProcessingFee, currency)}.
                </>
              ),
              key: 'snapshot-totals',
              label: 'Finance uses snapshot totals',
              signal: '3',
              value: `${formatMoney(settlementSummary.companyOutputVat, currency)} VAT`,
            },
          ]}
        />
      </AdminFilterPanel>

      <AdminFilterPanel
        className="admin-mb-16"
        description="Summary-only command desk for today's finance work. Open bounded lists only when a row-level review is needed."
        resultLabel="Needs action first"
        resultTone="warning"
        title="Finance operations priority desk"
      >
        <FinanceStageList
          items={buildFinanceOperationsPriorityLinks({
            accountingFilters,
            bankSummary,
            clearingSummary,
            monthlyClosingFilters,
            monthlyClosingSummary,
            settlementFilters,
            settlementSummary,
          }).map((link) => ({
            helper: link.helper,
            href: link.href,
            key: link.key,
            label: link.label,
            signal: link.signal,
            value: link.amountLabel ?? (typeof link.count === 'number' ? `${link.count} open` : 'Open queue'),
          }))}
        />
      </AdminFilterPanel>

      {showFullSummaryView ? (
        <>
          <AdminFilterPanel
            className="admin-mb-16"
            description="Company-funded coupons are marketing expense, not reduced platform-fee revenue. This summary reads settlement snapshot metadata only."
            resultLabel="Coupon summary API"
            resultTone="info"
            title="Coupon finance summary"
          >
            <FinanceStageList
              items={[
                {
                  helper: 'Bookings with coupon metadata in the current finance range and queue.',
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
                  value: formatMoney(couponFinanceSummary.couponDiscountAmount, couponFinanceSummary.currency),
                },
                {
                  helper: 'Actual customer payment after coupon discount. This feeds clearing and is not platform revenue.',
                  key: 'customer-paid',
                  label: 'Customer paid amount',
                  signal: 'PAID',
                  value: formatMoney(couponFinanceSummary.customerPaidAmount, couponFinanceSummary.currency),
                },
                {
                  helper: 'Pre-coupon service amount used for Partner payout, withholding, and platform fee snapshots.',
                  key: 'settlement-base',
                  label: 'Settlement base',
                  signal: 'BASE',
                  value: formatMoney(
                    couponFinanceSummary.settlementBaseAmount || couponFinanceSummary.bookingServiceAmount,
                    couponFinanceSummary.currency,
                  ),
                },
                {
                  helper: 'Company-funded coupon amount to review as marketing expense, separate from revenue and VAT.',
                  key: 'company-coupon-expense',
                  label: 'Company coupon expense',
                  signal: 'EXP',
                  value: formatMoney(couponFinanceSummary.companyCouponExpense, couponFinanceSummary.currency),
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
                  value: formatMoney(
                    couponFinanceSummary.reversedCouponDiscountAmount,
                    couponFinanceSummary.currency,
                  ),
                },
              ]}
            />
          </AdminFilterPanel>

          <AdminFilterPanel
            className="admin-mb-16"
            description="This overview stays summary-only. Open the bounded payout and cash-debt queues only when finance needs request-level evidence."
            resultLabel="Priority links"
            resultTone="info"
            title="Payout and wallet priority desk"
          >
            <FinanceStageList
              items={buildFinancePayoutPriorityLinks(settlementFilters, withdrawalRequestSummary).map((link) => ({
                helper: link.helper,
                href: link.href,
                key: link.key,
                label: link.label,
                signal: link.signal,
                value: link.amountLabel ?? (typeof link.count === 'number' ? `${link.count} open` : 'Open queue'),
              }))}
            />
          </AdminFilterPanel>
        </>
      ) : (
        <AdminFilterPanel
          className="admin-mb-16"
          description="Default view keeps finance overview focused on current action counts. Open the full summary only when coupon and payout rollups are needed."
          resultLabel="Compact default"
          resultTone="info"
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
          />
        </AdminFilterPanel>
      )}

      <AdminFilterPanel
        className="admin-mb-16"
        description="Keep summary, evidence, tax, reconciliation, and policy workspaces separate so operators open row-level data only when needed."
        title="Finance tax workspaces"
      >
        <FinanceStageList
          items={[
            {
              helper: 'Today/needs-action by default. Review posted, cash, non-cash, declared, paid, and reversed snapshots.',
              href: bookingSettlementAuditHref(settlementFilters),
              key: 'booking-settlement-audit',
              label: 'Booking Settlement Audit',
              signal: 'AUDIT',
              value: `${settlementSummary.openTaxCount} open`,
            },
            {
              helper: 'Bounded journal batch lookup for posting, reversal, refund, and adjustment evidence.',
              href: generalLedgerHref(accountingFilters),
              key: 'general-ledger',
              label: 'General Ledger',
              signal: 'GL',
              value: 'Journal',
            },
            {
              helper: 'Customer payment capture, settlement posting, refund, payment fee, and coupon offset queue.',
              href: paymentClearingHref(accountingFilters),
              key: 'payment-clearing',
              label: 'Payment Clearing',
              signal: 'CLEAR',
              value: 'Clearing',
            },
            {
              helper: 'Company bank transaction lookup for manual matching against accounting evidence.',
              href: bankReconciliationHref(accountingFilters),
              key: 'bank-reconciliation',
              label: 'Bank Reconciliation',
              signal: 'BANK',
              value: 'Reconcile',
            },
            {
              helper: 'Monthly Partner VAT/PIT totals for manual tax and payout closeout review.',
              href: partnerWithholdingTaxHref(withholdingFilters),
              key: 'partner-withholding-tax',
              label: 'Partner Withholding Tax',
              signal: 'TAX',
              value: formatMoney(withholdingSummary.totalPartnerTaxWithheld, withholdingSummary.currency),
            },
            {
              helper: 'Preview platform VAT, Partner withholding, payment fee, cash debt, and reconciliation deltas.',
              href: monthlyTaxClosingHref(monthlyClosingFilters),
              key: 'monthly-tax-closing',
              label: 'Monthly Tax Closing',
              signal: 'CLOSE',
              value: monthlyClosingFilters.period,
            },
            {
              helper: 'Review company output VAT by platform fee rate bucket.',
              href: platformVatHref(monthlyClosingFilters),
              key: 'platform-vat',
              label: 'Platform VAT',
              signal: 'VAT',
              value: formatMoney(settlementSummary.companyOutputVat, currency),
            },
            {
              helper: 'Review processing fee totals by method, payer, and treatment.',
              href: paymentFeeHref(monthlyClosingFilters),
              key: 'payment-fees',
              label: 'Payment Fees',
              signal: 'FEE',
              value: formatMoney(settlementSummary.paymentProcessingFee, currency),
            },
            {
              helper: 'Configure versioned tax rules. Historical settlement snapshots keep their own tax values.',
              href: '/tax-policy',
              key: 'tax-policy',
              label: 'Tax Policy',
              signal: 'RULES',
              value: 'Policy',
            },
          ]}
        />
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}
