import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import FinanceOverviewPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('FinanceOverviewPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/finance-overview?range=7d&period=2026-07') {
        return {
          generatedAt: '2026-07-02T00:00:00.000Z',
          range: '7d',
          period: '2026-07',
          amountSummary: {
            currency: 'VND',
            paymentFailedAmount: 75_000,
            refundCompletedAmount: 60_000,
            refundPendingAmount: 40_000,
          },
          bankSummary: { amount: 0, clearedCount: 0, count: 0, currency: 'VND', matchedCount: 0, unmatchedCount: 0 },
          cashSummary: null,
          clearingSummary: { amount: 0, clearedCount: 0, count: 0, currency: 'VND', openCount: 0 },
          couponSummary: {
            bookingServiceAmount: 100_000_000,
            companyCouponExpense: 2_000_000,
            couponDiscountAmount: 3_000_000,
            couponReviewFlagCount: 1,
            couponSettlementCount: 4,
            currency: 'VND',
            customerPaidAmount: 97_000_000,
            partnerFundedCouponAmount: 500_000,
            platformFeeDiscountAmount: 0,
            reversedCompanyCouponExpense: 0,
            reversedCouponDiscountAmount: 0,
            settlementBaseAmount: 100_000_000,
          },
          earningsSummary: null,
          monthlyClosingSummary: {
            cashDebtTotal: 0,
            companyOutputVatTotal: 0,
            couponReviewFlagCount: 0,
            currency: 'VND',
            customerPaymentAmountTotal: 0,
            netRevenueDelta: 0,
            nonCashPartnerPayoutTotal: 0,
            partnerPitWithheldTotal: 0,
            partnerPayoutTotal: 0,
            partnerVatWithheldTotal: 0,
            partnerWithholdingTotal: 0,
            paymentProcessingFeeTotal: 0,
            period: '2026-07',
            platformFeeGrossTotal: 0,
            platformFeeNetRevenueTotal: 0,
            reconciliationDelta: 0,
            settlementCount: 0,
            status: 'DRAFT',
          },
          partnerWithholdingSummary: {
            currency: 'VND',
            grossServiceRevenue: 0,
            partnerCountWithRevenue: 0,
            partnerPayoutTotal: 0,
            partnerPitWithheldTotal: 0,
            partnerVatWithheldTotal: 0,
            period: '2026-07',
            taxableBookingCount: 0,
            totalPartnerTaxWithheld: 0,
          },
          paymentFeeSummary: null,
          paymentSummary: null,
          refundSummary: {
            completedCount: 1,
            needsUpdateCount: 1,
            openCount: 2,
            outcomeLinkedCount: 1,
            refundedBookingCount: 0,
            requestedCount: 1,
            totalCount: 3,
          },
          settlementSummary: {
            count: 12,
            currency: 'VND',
            customerPaymentAmount: 100_000_000,
            partnerPayoutAmount: 76_000_000,
            partnerWithholdingTotal: 3_000_000,
            platformFeeGross: 24_000_000,
            platformFeeNetRevenue: 22_000_000,
            companyOutputVat: 2_000_000,
            paymentProcessingFee: 1_000_000,
            openTaxCount: 2,
            paidTaxCount: 10,
          },
          walletSummary: {
            currency: 'VND',
            customerWalletAccountCount: 2,
            customerWalletLiabilityAmount: 130_000,
            negativePartnerWalletAmount: 70_000,
            partnerNegativeWalletAccountCount: 1,
            partnerPositiveWalletAccountCount: 1,
            partnerWalletLiabilityAmount: 200_000,
          },
          withdrawalSummary: {
            approved: 0,
            bankTransferPending: 0,
            correctionRequested: 0,
            currency: 'VND',
            paid: 0,
            pendingWithdrawalPayableAmount: 0,
            rejected: 0,
            requested: 0,
            reviewRequired: 0,
          },
        };
      }
      if (href === '/admin/booking-settlement-snapshots/summary?range=7d') {
        return {
          count: 12,
          currency: 'VND',
          customerPaymentAmount: 100_000_000,
          partnerPayoutAmount: 76_000_000,
          partnerWithholdingTotal: 3_000_000,
          platformFeeGross: 24_000_000,
          platformFeeNetRevenue: 22_000_000,
          companyOutputVat: 2_000_000,
          paymentProcessingFee: 1_000_000,
          openTaxCount: 2,
          paidTaxCount: 10,
        };
      }
      if (href === '/admin/booking-settlement-snapshots/coupon-finance-summary?range=7d') {
        return {
          bookingServiceAmount: 100_000_000,
          companyCouponExpense: 2_000_000,
          couponDiscountAmount: 3_000_000,
          couponReviewFlagCount: 1,
          couponSettlementCount: 4,
          currency: 'VND',
          customerPaidAmount: 97_000_000,
          partnerFundedCouponAmount: 500_000,
          platformFeeDiscountAmount: 0,
          reversedCompanyCouponExpense: 0,
          reversedCouponDiscountAmount: 0,
          settlementBaseAmount: 100_000_000,
        };
      }
      return fallback;
    });
  });

  it('renders finance overview with actual company revenue separated from gross payment', async () => {
    const page = await FinanceOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Finance Overview');
    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('Finance control board');
    expect(markup).toContain('Finance Priority Desk');
    expect(markup).toContain('Top finance queues');
    expect(markup).toContain('class="finance-overview-page"');
    expect(markup).not.toContain('usage-overview-page');
    expect(markup).toContain('card admin-section finance-overview-filter-panel');
    expect(markup).toContain('booking-date-filter-buttons finance-overview-range-buttons');
    expect(markup).not.toContain('usage-overview-filter-panel');
    expect(markup).not.toContain('usage-overview-range-buttons');
    expect(markup).not.toContain('card admin-filter-panel finance-overview-filter-panel');
    expect(markup).toContain('card admin-section finance-overview-priority-board');
    expect(markup).toContain('admin-section-body finance-overview-priority-grid');
    expect(markup).toContain('card admin-card finance-overview-command-card finance-overview-priority-card');
    expect(markup).toContain('card admin-card finance-overview-command-card finance-overview-control-card');
    expect(markup).toContain('finance-overview-command-icon');
    expect(markup).not.toContain('usage-overview-command-card');
    expect(markup).not.toContain('usage-overview-command-icon');
    expect(markup).toContain('finance-overview-command-grid finance-overview-control-board');
    expect(markup).toContain('finance-overview-command-grid finance-overview-principle-grid');
    expect(markup).toContain('finance-overview-command-grid finance-overview-section-grid');
    expect(markup).not.toContain('usage-overview-command-grid');
    expect(pageSource).toContain('AdminOverviewCommandGrid');
    expect(pageSource).not.toContain('<section className="finance-overview-control-board"');
    expect(pageSource).toContain('AdminOverviewCommandCard');
    expect(pageSource).not.toContain('<AdminLinkCard className={`finance-overview-control-card');
    expect(markup).toContain('Core Finance KPI');
    expect(markup).toContain('6 signals');
    expect(markup).toContain('card admin-section finance-overview-kpi-section');
    expect(markup).toContain('admin-section-body finance-overview-kpi-grid');
    expect(markup).not.toContain('admin-section-body usage-overview-command-grid finance-overview-kpi-grid');
    expect(markup).toContain('card admin-card finance-overview-command-card');
    expect(markup).not.toContain('<article class="card admin-card finance-overview-command-card');
    expect(pageSource).not.toContain(
      '<article className={`card admin-card usage-overview-command-card',
    );
    expect(pageSource).not.toContain('<AdminCard className={`usage-overview-command-card is-${kpi.tone}`');
    expect(pageSource).not.toContain('<a className={`card admin-card usage-overview-command-card is-');
    expect(markup).toContain('card admin-card finance-overview-command-card finance-overview-principle-card');
    expect(pageSource).toContain('className="finance-overview-principle-grid"');
    expect(pageSource).not.toContain('<section className="finance-overview-principle-grid"');
    expect(pageSource).not.toContain('<AdminCard className="finance-overview-principle-card');
    expect(markup).toContain('money-text money-text-positive');
    expect(markup).toContain('Revenue separation');
    expect(markup).toContain('Wallet exposure');
    expect(markup).toContain('Open finance risks');
    expect(pageSource).toContain('className="finance-overview-section-grid"');
    expect(pageSource).toContain('baseClassName={financeOverviewCommandGridClassName}');
    expect(pageSource).toContain('AdminRowLink');
    expect(pageSource).toContain('AdminRowItem');
    expect(pageSource).not.toContain('<section className="finance-overview-section-grid"');
    expect(pageSource).not.toContain('<a className="finance-overview-row" href={row.href} key={row.label}>');
    expect(pageSource).not.toContain('<div className="finance-overview-row" key={row.label}>');
    expect(markup).toContain('Gross Booking Amount');
    expect(markup).toContain('Platform Fee');
    expect(markup).toContain('Customer paid amount is not company revenue');
    expect(markup).toContain('100.000.000');
    expect(markup).toContain('22.000.000');
    expect(markup).toContain('130.000');
    expect(markup).toContain('200.000');
    expect(markup).toContain('75.000');
    expect(markup).toContain('Finance Action Lists');
    expect(markup).toContain('card admin-section finance-overview-action-card');
    expect(markup).toContain('admin-section-body finance-overview-action-list');
    expect(markup).not.toContain('usage-overview-action-card finance-overview-action-card');
    expect(markup).not.toContain('usage-overview-action-list finance-overview-action-list');
    expect(markup).toContain('card admin-card finance-overview-action-item');
    expect(markup).toContain('finance-overview-action-icon');
    expect(markup).not.toContain('card admin-card usage-overview-action-item');
    expect(pageSource).toContain('baseClassName="finance-overview-action-item"');
    expect(pageSource).not.toContain('<AdminLinkCard className={`finance-overview-action-item');
    expect(pageSource).not.toContain('<a className={`card admin-card usage-overview-action-item');
    expect(pageSource).not.toContain('usage-overview-command-icon');
    expect(pageSource).not.toContain('contentClassName="usage-overview-page finance-overview-page"');
    expect(pageSource).not.toContain('className="usage-overview-filter-panel finance-overview-filter-panel"');
    expect(pageSource).not.toContain('className="usage-overview-range-buttons"');
    expect(pageSource).not.toContain('bodyClassName="usage-overview-command-grid finance-overview-kpi-grid"');
    expect(pageSource).not.toContain('className={`card admin-card usage-overview-command-card finance-overview-priority-card');
    expect(pageSource).toContain('baseClassName={financeOverviewCommandCardClassName}');
    expect(pageSource).toContain('iconClassName={financeOverviewCommandIconClassName}');
    expect(markup).toContain('/finance-tax/payment-clearing');
    expect(markup).toContain('/finance-tax/general-ledger');
    expect(markup).toContain('admin-form-date');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).not.toContain('<label class="admin-form-control"><span>Monthly tax period</span>');
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).not.toContain(
      '<strong>{formatMoney(settlementSummary.customerPaymentAmount, settlementSummary.currency)}</strong>',
    );
    expect(pageSource).not.toContain(
      '<strong>{formatMoney(settlementSummary.platformFeeNetRevenue, settlementSummary.currency)}</strong>',
    );
    expect(pageSource).not.toContain(
      '<strong>{formatMoney(settlementSummary.partnerPayoutAmount, settlementSummary.currency)}</strong>',
    );
    expect(pageSource).not.toContain(
      '<strong>{formatMoney(netRevenueEstimate, settlementSummary.currency)}</strong>',
    );
  });

  it('uses the shared money atom for finance action and priority amounts', () => {
    expect(pageSource).toContain('FinanceActionAmount');
    expect(pageSource).not.toContain('<em>{item.amountLabel}</em>');
    expect(pageSource).not.toContain('trailing={<em>{item.amountLabel}</em>}');
  });

  it('uses the shared money atom for finance KPI card amounts', () => {
    expect(pageSource).toContain('FinanceOverviewMetricValue');
    expect(pageSource).not.toContain('value={kpi.value}');
  });

  it('renders core finance KPIs through the shared AdminKpiCard surface', async () => {
    const page = await FinanceOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);
    const css = readFileSync('app/globals.css', 'utf8');

    expect(pageSource).toContain('AdminKpiCard');
    expect(pageSource).toContain('<AdminKpiCard');
    expect(markup).toContain('card admin-kpi-card finance-overview-kpi-card');
    expect(markup).not.toContain('finance-overview-kpi-grid"><a class="card admin-card finance-overview-command-card');
    expect(markup).not.toContain('finance-overview-kpi-grid"><div class="card admin-card finance-overview-command-card');
    expect(css).not.toContain('.finance-overview-kpi-grid .finance-overview-command-card');
  });

  it('uses the shared money atom for finance section row amounts', () => {
    expect(pageSource).toContain('FinanceOverviewSectionRowValue');
    expect(pageSource).not.toContain('<span>{row.value}</span>');
  });

  it('uses shared Vuexy badge atoms for page header status chips', () => {
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).not.toContain('<span className="pill pill-success">Read-only</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">{buildFinanceOverviewRangeLabel(filters.range)}</span>');
  });

  it('calls the consolidated Finance Overview summary API and forwards range and period', async () => {
    await FinanceOverviewPage({
      searchParams: Promise.resolve({ range: '7d', period: '2026-07' }),
    });

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/finance-overview?range=7d&period=2026-07',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledTimes(1);
  });
});
