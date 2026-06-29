import Link from 'next/link';

import type {
  AdminBookingSettlementSnapshotSummary,
  AdminCouponFinanceSummary,
  AdminPartnerWithholdingTaxSummary,
  AdminProviderWalletWithdrawalRequestSummary,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { formatMoney } from '../../lib/admin-format';
import { TaxFinanceWorkflowActions } from './tax-finance-workflow-actions';
import {
  bookingSettlementAuditHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildCouponFinanceSummaryApiHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildProviderWalletWithdrawalRequestSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildTaxFinanceMetrics,
  buildFinancePayoutPriorityLinks,
  emptyBookingSettlementSummary,
  emptyCouponFinanceSummary,
  emptyPartnerWithholdingTaxSummary,
  emptyProviderWalletWithdrawalRequestSummary,
  monthlyTaxClosingHref,
  paymentFeeHref,
  partnerWithholdingTaxHref,
  platformVatHref,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from './tax-settlement-page-model';

type FinanceTaxPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceTaxPage({ searchParams }: FinanceTaxPageProps) {
  const params = searchParams ? await searchParams : {};
  const settlementFilters = readBookingSettlementFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const monthlyClosingFilters = readMonthlyTaxClosingFilters(params);
  const [settlementSummary, couponFinanceSummary, withholdingSummary, withdrawalRequestSummary] = await Promise.all([
    adminGet<AdminBookingSettlementSnapshotSummary>(
      buildBookingSettlementSnapshotSummaryApiHref(settlementFilters),
      emptyBookingSettlementSummary(),
    ),
    adminGet<AdminCouponFinanceSummary>(
      buildCouponFinanceSummaryApiHref(settlementFilters),
      emptyCouponFinanceSummary(),
    ),
    adminGet<AdminPartnerWithholdingTaxSummary>(
      buildPartnerWithholdingTaxSummaryApiHref(withholdingFilters),
      emptyPartnerWithholdingTaxSummary(withholdingFilters.period),
    ),
    adminGet<AdminProviderWalletWithdrawalRequestSummary>(
      buildProviderWalletWithdrawalRequestSummaryApiHref(settlementFilters),
      emptyProviderWalletWithdrawalRequestSummary(),
    ),
  ]);

  const currency = settlementSummary.currency || withholdingSummary.currency || 'VND';

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            current: 'overview',
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
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Use the summary APIs first. Open the bounded audit lists only when a finance operator needs booking-level evidence."
          status={<span className="pill pill-success">Summary API</span>}
          title="Tax finance operating model"
        />
        <div className="setup-stage-list admin-mt-12">
          <div className="setup-stage-item">
            <span>1</span>
            <div>
              <strong>Booking snapshot is immutable</strong>
              <p className="muted">
                Completed booking settlement stores customer payment, Partner payout, VAT/PIT, payment fee, and
                company VAT values at posting time.
              </p>
            </div>
            <small>{settlementSummary.count} rows</small>
          </div>
          <div className="setup-stage-item">
            <span>2</span>
            <div>
              <strong>Partner tax is monthly</strong>
              <p className="muted">
                Partner withholding is grouped by month and Partner. Current period: {withholdingSummary.period}.
              </p>
            </div>
            <small>{withholdingSummary.partnerCountWithRevenue} partners</small>
          </div>
          <div className="setup-stage-item">
            <span>3</span>
            <div>
              <strong>Finance uses snapshot totals</strong>
              <p className="muted">
                Company net fee is {formatMoney(settlementSummary.platformFeeNetRevenue, currency)} before payment
                processing cost of {formatMoney(settlementSummary.paymentProcessingFee, currency)}.
              </p>
            </div>
            <small>{formatMoney(settlementSummary.companyOutputVat, currency)} VAT</small>
          </div>
        </div>
      </section>

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Company-funded coupons are marketing expense, not reduced platform-fee revenue. This summary reads settlement snapshot metadata only."
          status={<span className="pill pill-info">Coupon summary API</span>}
          title="Coupon finance summary"
        />
        <div className="setup-stage-list admin-mt-12">
          <Link className="setup-stage-item" href={bookingSettlementAuditHref(settlementFilters)}>
            <span>COUPON</span>
            <div>
              <strong>Coupon settlement rows</strong>
              <p className="muted">
                Bookings with coupon metadata in the current finance range and queue.
              </p>
            </div>
            <small>{couponFinanceSummary.couponSettlementCount} rows</small>
          </Link>
          <div className="setup-stage-item">
            <span>DISC</span>
            <div>
              <strong>Customer discount</strong>
              <p className="muted">
                Discount applied to customer payment while settlement keeps the pre-coupon service amount.
              </p>
            </div>
            <small>{formatMoney(couponFinanceSummary.couponDiscountAmount, couponFinanceSummary.currency)}</small>
          </div>
          <div className="setup-stage-item">
            <span>PAID</span>
            <div>
              <strong>Customer paid amount</strong>
              <p className="muted">
                Actual customer payment after coupon discount. This feeds clearing and is not platform revenue.
              </p>
            </div>
            <small>{formatMoney(couponFinanceSummary.customerPaidAmount, couponFinanceSummary.currency)}</small>
          </div>
          <div className="setup-stage-item">
            <span>BASE</span>
            <div>
              <strong>Settlement base</strong>
              <p className="muted">
                Pre-coupon service amount used for Partner payout, withholding, and platform fee snapshots.
              </p>
            </div>
            <small>
              {formatMoney(
                couponFinanceSummary.settlementBaseAmount || couponFinanceSummary.bookingServiceAmount,
                couponFinanceSummary.currency,
              )}
            </small>
          </div>
          <div className="setup-stage-item">
            <span>EXP</span>
            <div>
              <strong>Company coupon expense</strong>
              <p className="muted">
                Company-funded coupon amount to review as marketing expense, separate from revenue and VAT.
              </p>
            </div>
            <small>{formatMoney(couponFinanceSummary.companyCouponExpense, couponFinanceSummary.currency)}</small>
          </div>
          <div className="setup-stage-item">
            <span>FLAG</span>
            <div>
              <strong>Coupon review flags</strong>
              <p className="muted">
                Rows where coupon metadata needs finance review before closing.
              </p>
            </div>
            <small>{couponFinanceSummary.couponReviewFlagCount} flags</small>
          </div>
          <div className="setup-stage-item">
            <span>REV</span>
            <div>
              <strong>Reversed coupon amount</strong>
              <p className="muted">
                Refund or reversal metadata for coupon discount and company coupon expense recovery.
              </p>
            </div>
            <small>{formatMoney(couponFinanceSummary.reversedCouponDiscountAmount, couponFinanceSummary.currency)}</small>
          </div>
        </div>
      </section>

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="This overview stays summary-only. Open the bounded payout and cash-debt queues only when finance needs request-level evidence."
          status={<span className="pill pill-info">Priority links</span>}
          title="Payout and wallet priority desk"
        />
        <div className="setup-stage-list admin-mt-12">
          {buildFinancePayoutPriorityLinks(settlementFilters, withdrawalRequestSummary).map((link) => (
            <Link className="setup-stage-item" href={link.href} key={link.key}>
              <span>{link.signal}</span>
              <div>
                <strong>{link.label}</strong>
                <p className="muted">{link.helper}</p>
              </div>
              <small>{typeof link.count === 'number' ? `${link.count} open` : 'Open queue'}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Keep these two workspaces separate: one reviews booking-level immutable evidence, the other reviews Partner monthly withholding totals."
          title="Finance tax workspaces"
        />
        <div className="setup-stage-list admin-mt-12">
          <Link className="setup-stage-item" href={bookingSettlementAuditHref(settlementFilters)}>
            <span>AUDIT</span>
            <div>
              <strong>Booking Settlement Audit</strong>
              <p className="muted">
                Today/needs-action by default. Review posted, cash, non-cash, declared, paid, and reversed snapshots.
              </p>
            </div>
            <small>{settlementSummary.openTaxCount} open</small>
          </Link>
          <Link className="setup-stage-item" href={partnerWithholdingTaxHref(withholdingFilters)}>
            <span>TAX</span>
            <div>
              <strong>Partner Withholding Tax</strong>
              <p className="muted">
                Monthly Partner VAT/PIT totals for manual tax and payout closeout review.
              </p>
            </div>
            <small>{formatMoney(withholdingSummary.totalPartnerTaxWithheld, withholdingSummary.currency)}</small>
          </Link>
          <Link className="setup-stage-item" href={monthlyTaxClosingHref(monthlyClosingFilters)}>
            <span>CLOSE</span>
            <div>
              <strong>Monthly Tax Closing</strong>
              <p className="muted">
                Preview platform VAT, Partner withholding, payment fee, cash debt, and reconciliation deltas.
              </p>
            </div>
            <small>{monthlyClosingFilters.period}</small>
          </Link>
          <Link className="setup-stage-item" href={platformVatHref(monthlyClosingFilters)}>
            <span>VAT</span>
            <div>
              <strong>Platform VAT</strong>
              <p className="muted">Review company output VAT by platform fee rate bucket.</p>
            </div>
            <small>{formatMoney(settlementSummary.companyOutputVat, currency)}</small>
          </Link>
          <Link className="setup-stage-item" href={paymentFeeHref(monthlyClosingFilters)}>
            <span>FEE</span>
            <div>
              <strong>Payment Fees</strong>
              <p className="muted">Review processing fee totals by method, payer, and treatment.</p>
            </div>
            <small>{formatMoney(settlementSummary.paymentProcessingFee, currency)}</small>
          </Link>
          <Link className="setup-stage-item" href="/tax-policy">
            <span>RULES</span>
            <div>
              <strong>Tax Policy</strong>
              <p className="muted">
                Configure versioned tax rules. Historical settlement snapshots keep their own tax values.
              </p>
            </div>
            <small>Policy</small>
          </Link>
        </div>
      </section>
    </AdminPageTemplate>
  );
}
