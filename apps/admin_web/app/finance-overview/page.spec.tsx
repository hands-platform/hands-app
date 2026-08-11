import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import type { AdminGetResult } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import FinanceOverviewPage from './page';
import { emptyFinanceOverviewSummaries } from './finance-overview-model';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

function ok<T>(data: T): AdminGetResult<T> {
  return { data, ok: true, status: 200 };
}

function failed<T>(data: T): AdminGetResult<T> {
  return { data, ok: false, status: 500 };
}

describe('FinanceOverviewPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (/^\/admin\/finance-overview\?range=(today|7d)&period=\d{4}-\d{2}$/.test(href)) {
        const period = new URL(href, 'http://finance.local').searchParams.get('period') ?? '2026-07';
        return ok({
          generatedAt: '2026-07-02T00:00:00.000Z',
          range: href.includes('range=today') ? 'today' : '7d',
          period,
          amountSummary: {
            currency: 'VND',
            paymentFailedCount: 1,
            paymentFailedAmount: 75_000,
            refundCompletedCount: 1,
            refundCompletedAmount: 60_000,
            refundPendingCount: 2,
            refundPendingAmount: 40_000,
          },
          bankSummary: {
            amount: 0,
            clearedCount: 0,
            count: 0,
            currency: 'VND',
            matchedCount: 0,
            unmatchedCount: 0,
          },
          bankWithdrawalCandidateSummary: {
            assignedCount: 1,
            assignments: [],
            currency: 'VND',
            eligibleCount: 4,
            noneAmount: 100_000,
            noneCount: 1,
            oldestReviewOccurredAt: '2026-07-14T02:00:00.000Z',
            oldestStrongOccurredAt: '2026-07-12T02:00:00.000Z',
            reviewAmount: 300_000,
            reviewCount: 1,
            reviewOver24hCount: 1,
            reviewOver48hCount: 0,
            strongAmount: 800_000,
            strongCount: 2,
            strongOver24hCount: 2,
            strongOver48hCount: 1,
            unassignedCount: 3,
          },
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
          financeReviewSlaSummary: {
            assignedCount: 1,
            assignments: [],
            oldestOpenAt: '2026-07-11T02:00:00.000Z',
            open48To72Count: 1,
            openOverdueCount: 3,
            openOver72Count: 2,
            resolvedInRangeCount: 8,
            unassignedCount: 2,
          },
          monthlyClosingSummary: {
            cashDebtTotal: 0,
            companyOutputVatTotal: 0,
            couponReviewFlagCount: 0,
            currency: 'VND',
            customerPaymentAmountTotal: 0,
            netRevenueDelta: 0,
            nonCashPartnerPayoutTotal: 0,
            openTaxCount: 2,
            paidTaxCount: 10,
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
          paymentSummary: {
            authorized: 0,
            callbackReview: 1,
            callbackVerified: 0,
            captured: 10,
            cashDebt: 0,
            linkedRefunds: 1,
            needsAction: 1,
            pendingCash: 0,
            refunded: 1,
            totalCount: 12,
          },
          payoutSummary: {
            currency: 'VND',
            generatedAt: '2026-07-02T00:00:00.000Z',
            inProgress: 1,
            missingTransferRefs: 0,
            needsReview: 1,
            open: 2,
            payoutHolds: 1,
            settled: 8,
            total: 10,
            totalNetAmount: 76_000_000,
            withholdingAmount: 3_000_000,
          },
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
            needsActionCount: 1,
            resolvedCount: 11,
            reversedCount: 2,
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
        });
      }
      if (href === '/admin/booking-settlement-snapshots/summary?range=7d') {
        return ok({
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
        });
      }
      if (href === '/admin/booking-settlement-snapshots/coupon-finance-summary?range=7d') {
        return ok({
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
        });
      }
      return ok(fallback);
    });
  });

  it('renders finance overview with actual company revenue separated from gross payment', async () => {
    const commandPage = await FinanceOverviewPage({
      searchParams: Promise.resolve({}),
    });
    const flowPage = await FinanceOverviewPage({
      searchParams: Promise.resolve({ period: '2026-07', range: '7d', view: 'flow' }),
    });
    const queuesPage = await FinanceOverviewPage({
      searchParams: Promise.resolve({ view: 'queues' }),
    });
    const commandMarkup = renderToStaticMarkup(commandPage);
    const flowMarkup = renderToStaticMarkup(flowPage);
    const queuesMarkup = renderToStaticMarkup(queuesPage);
    const markup = `${commandMarkup}${flowMarkup}${queuesMarkup}`;
    const css = readFileSync('app/globals.css', 'utf8');

    expect(markup).toContain('Finance Overview');
    expect(commandMarkup).toContain('Today Movement');
    expect(commandMarkup).toContain('Current Balances');
    expect(commandMarkup).toContain('Records');
    expect(commandMarkup).not.toContain('Needs Action Now');
    expect(commandMarkup).not.toContain('This Month Close');
    expect(commandMarkup).not.toContain('Monthly tax period');
    expect(commandMarkup).not.toContain('Period Performance');
    expect(commandMarkup).not.toContain('Period Comparison');
    expect(commandMarkup).not.toContain('Finance Review SLA</h2>');
    expect(commandMarkup).not.toContain('Current Finance Queues');
    expect(commandMarkup).not.toContain('finance-overview-principle-grid');
    expect(flowMarkup).toContain('finance-overview-principle-grid');
    expect(flowMarkup).toContain('finance-overview-section-grid');
    expect(flowMarkup).not.toContain('Needs Action Now');
    expect(queuesMarkup).toContain('Current Open Backlog');
    expect(queuesMarkup).not.toContain('Period Performance');
    expect(markup).toContain('Finance overview workspaces');
    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
    expect(markup).toContain('Finance review SLA');
    expect(queuesMarkup).toMatch(/Current Open Backlog[\s\S]*Finance review SLA/);
    expect(markup).toContain(
      '/notifications?range=all&amp;review=finance-overdue&amp;financeOwner=unassigned',
    );
    expect(markup).not.toContain('admin-section-body finance-overview-sla-grid');
    expect(markup).not.toContain('finance-overview-sla-card is-danger');
    expect(queuesMarkup).toContain('Current unresolved queues across all dates');
    expect(markup).toContain('class="finance-overview-page"');
    expect(markup).not.toContain('usage-overview-page');
    expect(markup).toContain('card admin-filter-panel finance-overview-filter-panel admin-section');
    expect(commandMarkup).not.toContain('Scope: today movement in Vietnam time; balances are current.');
    expect(queuesMarkup).not.toContain('Scope: all unresolved queues across all dates.');
    expect(flowMarkup).not.toContain('Scope: Last 7 days movement; 2026-07 tax period.');
    expect(markup).toContain('booking-date-filter-buttons finance-overview-range-buttons');
    expect(markup).not.toContain('usage-overview-filter-panel');
    expect(markup).not.toContain('usage-overview-range-buttons');
    expect(markup).not.toContain('card admin-section finance-overview-filter-panel');
    expect(commandMarkup).not.toContain('finance-overview-priority-board');
    expect(markup).toContain('finance-overview-command-icon');
    expect(markup).not.toContain('usage-overview-command-card');
    expect(markup).not.toContain('usage-overview-command-icon');
    expect(markup).toContain('finance-overview-command-grid finance-overview-principle-grid');
    expect(markup).toContain('finance-overview-command-grid finance-overview-section-grid');
    expect(markup).not.toContain('usage-overview-command-grid');
    expect(css).toContain('.finance-overview-priority-card {');
    expect(css).toContain('.finance-overview-priority-card > div > strong {');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(css).toContain('grid-column: 1;');
    expect(css).toContain('white-space: normal;');
    expect(pageSource).toContain('AdminOverviewCommandGrid');
    expect(pageSource).not.toContain('<section className="finance-overview-control-board"');
    expect(pageSource).toContain('AdminOverviewCommandCard');
    expect(pageSource).not.toContain('<AdminLinkCard className={`finance-overview-control-card');
    expect(markup).toContain('Current Balances');
    expect(commandMarkup).not.toContain('This Month Close');
    expect(markup).toContain('card admin-section finance-overview-kpi-section');
    expect(markup).toContain('admin-section-body finance-overview-kpi-grid');
    expect(markup).toContain('class="metric-card-scope is-period"');
    expect(markup).toContain('class="metric-card-scope is-risk"');
    expect(markup).toContain('Last 7 days');
    expect(markup).toContain('Needs action');
    expect(markup).not.toContain('admin-section-body usage-overview-command-grid finance-overview-kpi-grid');
    expect(markup).toContain('card admin-card finance-overview-command-card');
    expect(markup).not.toContain('<article class="card admin-card finance-overview-command-card');
    expect(pageSource).not.toContain('<article className={`card admin-card usage-overview-command-card');
    expect(pageSource).not.toContain('<AdminCard className={`usage-overview-command-card is-${kpi.tone}`');
    expect(pageSource).not.toContain('<a className={`card admin-card usage-overview-command-card is-');
    expect(markup).toContain('card admin-card finance-overview-command-card finance-overview-principle-card');
    expect(pageSource).toContain('className="finance-overview-principle-grid"');
    expect(pageSource).not.toContain('<section className="finance-overview-principle-grid"');
    expect(pageSource).not.toContain('<AdminCard className="finance-overview-principle-card');
    expect(markup).toContain('money-text money-text-positive');
    expect(commandMarkup).toContain('Customer Wallet Liability');
    expect(commandMarkup).toContain('Failed Payments Today');
    expect(commandMarkup).toContain('Pending Refunds Created Today');
    expect(commandMarkup).not.toContain('Unmatched Bank');
    expect(commandMarkup).not.toContain('Payout / Withdrawal Risk');
    expect(commandMarkup).toContain('Booking Settlement Records');
    expect(pageSource).toContain('className="finance-overview-section-grid"');
    expect(pageSource).toContain('baseClassName={financeOverviewCommandGridClassName}');
    expect(pageSource).toContain('AdminRowLink');
    expect(pageSource).toContain('AdminRowItem');
    expect(pageSource).not.toContain('<section className="finance-overview-section-grid"');
    expect(pageSource).not.toContain('<a className="finance-overview-row" href={row.href} key={row.label}>');
    expect(pageSource).not.toContain('<div className="finance-overview-row" key={row.label}>');
    expect(markup).toContain('Gross customer payment');
    expect(markup).toContain('Actual company revenue');
    expect(markup).toContain('Customer paid amount is not company revenue');
    expect(markup).toContain('100.000.000');
    expect(markup).toContain('22.000.000');
    expect(markup).toContain('130.000');
    expect(markup).toContain('200.000');
    expect(markup).toContain('Current Open Backlog');
    expect(queuesMarkup).toContain('finance-overview-queue-header');
    expect(queuesMarkup).toContain('finance-overview-queue-owner is-unassigned');
    expect(queuesMarkup).toContain('Not available');
    expect(queuesMarkup).toContain('class="finance-overview-queue-action">Open');
    expect(markup).toContain('Strong withdrawal candidates');
    expect(markup).toContain('Withdrawal candidates to review');
    expect(markup).toContain(
      '/finance-tax/bank-reconciliation?range=all&amp;review=outflow&amp;candidate=strong',
    );
    expect(markup).toContain(
      '/finance-tax/bank-reconciliation?range=all&amp;review=outflow&amp;candidate=review',
    );
    expect(markup).toContain('card admin-section finance-overview-action-card');
    expect(markup).toContain('admin-section-body finance-overview-action-list');
    expect(markup).not.toContain('usage-overview-action-card finance-overview-action-card');
    expect(markup).not.toContain('usage-overview-action-list finance-overview-action-list');
    expect(markup).toContain('admin-row-link finance-overview-queue-row');
    expect(markup).toContain('finance-overview-action-icon');
    expect(markup).not.toContain('card admin-card usage-overview-action-item');
    expect(pageSource).toContain('className={`finance-overview-queue-row is-${item.tone}`}');
    expect(pageSource).not.toContain('<AdminLinkCard className={`finance-overview-action-item');
    expect(pageSource).not.toContain('<a className={`card admin-card usage-overview-action-item');
    expect(pageSource).not.toContain('usage-overview-command-icon');
    expect(pageSource).not.toContain('contentClassName="usage-overview-page finance-overview-page"');
    expect(pageSource).not.toContain('className="usage-overview-filter-panel finance-overview-filter-panel"');
    expect(pageSource).not.toContain('className="usage-overview-range-buttons"');
    expect(pageSource).not.toContain('bodyClassName="usage-overview-command-grid finance-overview-kpi-grid"');
    expect(pageSource).not.toContain(
      'className={`card admin-card usage-overview-command-card finance-overview-priority-card',
    );
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
    expect(pageSource).toContain('FinanceActionImpact');
    expect(pageSource).not.toContain('<em>{item.amountLabel}</em>');
    expect(pageSource).not.toContain('trailing={<em>{item.amountLabel}</em>}');
  });

  it('uses the shared money atom for finance KPI card amounts', () => {
    expect(pageSource).toContain('FinanceOverviewMetricValue');
    expect(pageSource).not.toContain('value={kpi.value}');
  });

  it('renders core finance KPIs through the shared AdminKpiCard surface', async () => {
    const page = await FinanceOverviewPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);
    const css = readFileSync('app/globals.css', 'utf8');

    expect(pageSource).toContain('AdminKpiCard');
    expect(pageSource).toContain('<AdminKpiCard');
    expect(markup).toContain('card admin-kpi-card finance-overview-kpi-card');
    expect(markup).not.toContain(
      'finance-overview-kpi-grid"><a class="card admin-card finance-overview-command-card',
    );
    expect(markup).not.toContain(
      'finance-overview-kpi-grid"><div class="card admin-card finance-overview-command-card',
    );
    expect(css).not.toContain('.finance-overview-kpi-grid .finance-overview-command-card');
    expect(css).toContain('.finance-overview-kpi-grid > .finance-overview-kpi-card > .metric-card {');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
  });

  it('labels today movement and current balances without exposing backlog or monthly close', async () => {
    const page = await FinanceOverviewPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toMatch(/metric-card-scope is-live">Current balance[\s\S]*Customer Wallet Liability/);
    expect(markup).toMatch(/metric-card-scope is-risk">Today[\s\S]*Failed Payments Today/);
    expect(markup).toMatch(/metric-card-scope is-period">Today[\s\S]*Customer Payments Today/);
    expect(markup).not.toContain('Finance review SLA');
    expect(markup).not.toContain('Platform VAT');
    expect(markup).not.toContain('Monthly tax period');
  });

  it('scopes finance KPI value typography to the direct shared metric-card slot', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.finance-overview-kpi-grid > .finance-overview-kpi-card');
    expect(css).not.toContain('.finance-overview-kpi-grid .finance-overview-kpi-card {');
    expect(css).toContain(
      '.finance-overview-kpi-grid > .finance-overview-kpi-card > .metric-card > .metric-card-content > .metric-card-value',
    );
    expect(css).not.toContain('.finance-overview-kpi-grid .finance-overview-kpi-card .metric-card h2 {');
  });

  it('scopes finance KPI icon tones to direct MetricCard icon slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    for (const tone of ['primary', 'success', 'warning', 'info', 'danger']) {
      expect(css).toContain(`.finance-overview-kpi-card.is-${tone} > .metric-card > .metric-card-icon`);
      expect(css).not.toContain(`.finance-overview-kpi-card.is-${tone} .metric-card-icon`);
    }
  });

  it('scopes finance command icon tones to direct command-card icon slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    for (const tone of ['primary', 'info', 'success', 'warning', 'danger']) {
      expect(css).toContain(`.finance-overview-command-card.is-${tone} > .finance-overview-command-icon`);
      expect(css).not.toContain(`.finance-overview-command-card.is-${tone} .finance-overview-command-icon`);
      expect(css).not.toContain(`.finance-overview-principle-card.is-${tone} .finance-overview-command-icon`);
      expect(css).not.toContain(`.finance-overview-kpi-grid .is-${tone} .finance-overview-command-icon`);
    }
  });

  it('does not let finance command-card label selectors override scope badges', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.finance-overview-command-card > div > span:not(.metric-card-scope)');
    expect(css).toContain('.finance-overview-action-item > div > span:not(.metric-card-scope)');
    expect(css).toContain('.finance-overview-control-card > div > span:not(.metric-card-scope)');
    expect(css).not.toContain('.finance-overview-command-card > div > span {');
    expect(css).not.toContain('.finance-overview-control-card > div > span {');
  });

  it('scopes finance action and control icon tones to direct icon slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    for (const tone of ['info', 'success', 'warning', 'danger']) {
      expect(css).toContain(`.finance-overview-action-item.is-${tone} > .finance-overview-action-icon`);
      expect(css).toContain(`.finance-overview-control-card.is-${tone} > .finance-overview-command-icon`);
      expect(css).not.toContain(`.finance-overview-action-item.is-${tone} .finance-overview-action-icon`);
      expect(css).not.toContain(`.finance-overview-control-card.is-${tone} .finance-overview-command-icon`);
    }
  });

  it('scopes principle card typography to direct command-card text children', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain(
      '.finance-overview-principle-card > div > span:not(.finance-overview-command-icon)',
    );
    expect(css).toContain('.finance-overview-principle-card > div > strong');
    expect(css).toContain('.finance-overview-principle-card > div > small');
    expect(css).not.toContain('.finance-overview-principle-card strong {');
    expect(css).not.toContain('.finance-overview-principle-card small {');
    expect(css).not.toContain('.finance-overview-principle-card span:not(.finance-overview-command-icon) {');
    expect(css).toContain('.finance-overview-principle-value');
    expect(css).not.toMatch(
      /\.finance-overview-principle-card > div > strong\s*\{[^}]*text-overflow:\s*ellipsis/s,
    );
  });

  it('uses a route-local loading state without unrelated workspace copy', () => {
    const loadingSource = readFileSync('app/finance-overview/loading.tsx', 'utf8');

    expect(loadingSource).toContain('title="Finance Overview"');
    expect(loadingSource).toContain('Loading current finance snapshot.');
    expect(loadingSource).not.toContain('Shift Command');
    expect(loadingSource).not.toContain('priority queue');
  });

  it('uses the shared money atom for finance section row amounts', () => {
    expect(pageSource).toContain('FinanceOverviewSectionRowValue');
    expect(pageSource).not.toContain('<span>{row.value}</span>');
  });

  it('scopes finance section row typography to direct row copy slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.finance-overview-row > div > strong');
    expect(css).toContain('.finance-overview-row > div > small');
    expect(css).toContain('.finance-overview-row > .finance-overview-row-tail');
    expect(css).not.toContain('.finance-overview-row strong {');
    expect(css).not.toContain('.finance-overview-row small {');
    expect(css).not.toContain('.finance-overview-row div {');
  });

  it('scopes priority card amount chips to the command-card trailing slot', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const priorityTrailingBlock = cssRuleBlockAt(
      css.indexOf('.finance-overview-priority-card > .finance-overview-action-trailing {'),
    );

    expect(css).toContain('.finance-overview-priority-card > .finance-overview-action-trailing');
    expect(priorityTrailingBlock).toContain('grid-column: 1');
    expect(priorityTrailingBlock).toContain('max-inline-size: 100%');
    expect(priorityTrailingBlock).toContain('white-space: normal');
    expect(css).toContain('.finance-overview-action-operation.is-unassigned');
  });

  it('uses manual refresh and explicit freshness status in the Finance header', () => {
    expect(pageSource).toContain('FinanceOverviewSnapshotControl');
    expect(pageSource).toContain('generatedAt={overviewSummary.generatedAt}');
    expect(pageSource).toContain("filters.workspace === 'queues'");
    expect(pageSource).not.toContain('DashboardDataScopeStatus');
  });

  it('calls the consolidated Finance Overview summary API and forwards range and period', async () => {
    await FinanceOverviewPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      expect.stringMatching(/^\/admin\/finance-overview\?range=today&period=\d{4}-\d{2}$/),
      expect.any(Object),
    );
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
  });

  it('does not present API fallback values as real zero balances', async () => {
    mockedAdminGetResult.mockImplementationOnce(async (_href, fallback) => failed(fallback));

    const page = await FinanceOverviewPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Finance data unavailable');
    expect(markup).toContain('Do not treat unavailable values as zero');
    expect(markup).toContain('Reload Finance Overview');
    expect(markup).not.toContain('Needs Action Now');
    expect(markup).not.toContain('Current Balances');
    expect(markup).not.toContain('Period Performance');
  });

  it('replaces an all-zero Today Movement card wall with one clear state', async () => {
    mockedAdminGetResult.mockImplementationOnce(async () =>
      ok({
        generatedAt: '2026-07-02T00:00:00.000Z',
        period: '2026-07',
        range: 'today',
        ...emptyFinanceOverviewSummaries('2026-07'),
      }),
    );

    const page = await FinanceOverviewPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toMatch(/Today movement clear[\s\S]*No finance movement recorded in Vietnam time[\s\S]*Current Balances/);
    expect(markup).not.toContain('<h2>Today Movement</h2>');
    expect(markup).not.toContain('Customer Payments Today');
    expect(markup).not.toContain('Failed Payments Today');
    expect(markup).not.toContain('Pending Refunds Created Today');
    expect(markup).not.toContain('Partner Payout Generated Today');
  });

  it('builds only the visible finance sections for the overview payload', () => {
    expect(pageSource).toContain('buildFinanceOverviewPageSections');
    expect(pageSource).not.toContain(
      'buildFinanceOverviewVisibleSections(buildFinanceOverviewSections(overviewInput))',
    );
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const css = readFileSync('app/globals.css', 'utf8');
  const endIndex = css.indexOf('}', index);
  return css.slice(index, endIndex + 1);
}
