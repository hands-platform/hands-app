import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminMonthlyTaxClosingSummary } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import FinanceTaxPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('FinanceTaxPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockResolvedValue({
      data: monthlySummary(),
      ok: true,
      status: 200,
    });
  });

  it('keeps the Tax landing page focused on one monthly close period', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ period: '2026-07' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Tax &amp; Period Close');
    expect(markup).toContain('Accounting month');
    expect(markup).toContain('Active close controls');
    expect(markup).toContain('Related registers');
    expect(markup).toContain('hard blockers');
    expect(markup).toContain('Prepare tax declaration');
    expect(markup).not.toContain('Closeout gates');
    expect(markup).not.toContain('Tax finance operating model');
    expect(markup).not.toContain('Finance operations priority desk');
    expect(markup).not.toContain('Finance optional summary desk');
    expect(markup).not.toContain('Payout and wallet priority desk');
  });

  it('loads one monthly summary instead of rebuilding the Finance command dashboard', async () => {
    await FinanceTaxPage({
      searchParams: Promise.resolve({ period: '2026-07' }),
    });

    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      expect.stringContaining('/admin/monthly-tax-closings/summary?period=2026-07'),
      expect.objectContaining({ period: '2026-07' }),
    );
  });

  it('does not render fallback zeroes when the monthly summary API fails', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: monthlySummary(),
      ok: false,
      status: 503,
    });

    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ period: '2026-07' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Tax and close data unavailable');
    expect(markup).toContain('API 503');
    expect(markup).toContain('Retry tax and close overview');
    expect(markup).not.toContain('Monthly closeout checks');
    expect(markup).not.toContain('Platform VAT');
  });

  it('keeps header actions focused on refresh and the authoritative next close step', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ period: '2026-07' }),
    });
    const markup = renderToStaticMarkup(page);
    const headerActions = sectionMarkup(markup, 'admin-page-header-actions');

    expect(headerActions).toContain('Refresh now');
    expect(headerActions).toContain('Prepare tax declaration');
    expect(headerActions).not.toContain('General Ledger');
    expect(headerActions).not.toContain('Bank Reconciliation');
  });

  it('uses one visible month filter and shared table panels', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ period: '2026-07' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('name="period"');
    expect(markup).toContain('Apply month');
    expect(markup).toContain('finance-overview-table-card');
    expect(markup).toContain('<th scope="col">Signal</th>');
    expect(markup).toContain('<th scope="col">Control</th>');
    expect(markup).toContain('<th scope="col">Affected records</th>');
    expect(markup).not.toContain('<th scope="col">Oldest</th>');
    expect(markup).not.toContain('<th scope="col">Owner</th>');
    expect(markup).toContain('<th scope="col">Action</th>');
  });

  it('renders only active close controls and labels zero-count checks as no signal', async () => {
    const page = await FinanceTaxPage({
      searchParams: Promise.resolve({ period: '2026-07' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Payment fee evidence');
    expect(markup).toContain('Partner deposit reconciliation');
    expect(markup).toContain('Payout bank outflow reconciliation');
    expect(markup).toContain('Payout return inflow reconciliation');
    expect(markup).toContain('Controls with no open signal');
    expect(markup).toContain('Show controls with no open signal');
    expect(markup).not.toContain('Cleared controls');
    expect(markup).not.toContain('<strong>Open tax rows</strong>');
    expect(markup).not.toContain('<strong>Coupon review flags</strong>');
  });

  it('does not expose transition actions or zero-success controls for a future period', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: {
        ...monthlySummary(),
        hasActivity: false,
        id: null,
        period: '2026-09',
        periodState: 'FUTURE_PERIOD',
        preflight: { blockers: [], nextStatus: null, ready: false },
      },
      ok: true,
      status: 200,
    });

    const markup = renderToStaticMarkup(await FinanceTaxPage({
      searchParams: Promise.resolve({ period: '2026-09' }),
    }));

    expect(markup).toContain('Future period — monitoring not started');
    expect(markup).not.toContain('Review monthly totals');
    expect(markup).not.toContain('Hard blockers');
    expect(markup).not.toContain('Controls with no open signal');
  });

  it('does not claim cleared controls or offer an unsupported close for an inactive past month', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: {
        ...monthlySummary(),
        hasActivity: false,
        id: null,
        period: '2025-01',
        periodState: 'NOT_STARTED',
        preflight: { blockers: [], nextStatus: 'REVIEWED', ready: true },
      },
      ok: true,
      status: 200,
    });

    const markup = renderToStaticMarkup(await FinanceTaxPage({
      searchParams: Promise.resolve({ period: '2025-01' }),
    }));

    expect(markup).toContain('No activity — no close record');
    expect(markup).not.toContain('Review monthly totals');
    expect(markup).not.toContain('cleared');
    expect(markup).not.toContain('Controls with no open signal');
  });

  it('uses shared money atoms for overview Finance amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });

  it('uses shared money atoms for bank match evidence amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/finance-bank-match-evidence.tsx'), 'utf8');

    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).toContain('MoneyText');
    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
    expect(source).not.toContain('formatMoney(');
    expect(source).not.toContain('<span className="muted">No bank transaction</span>');
    expect(source).not.toContain('<span className="muted">No journal entry</span>');
  });
});

function monthlySummary(): AdminMonthlyTaxClosingSummary {
  return {
    cashDebtTotal: 600000,
    closedAt: null,
    companyCouponExpenseTotal: 80000,
    companyOutputVatTotal: 25000,
    couponDiscountAmountTotal: 80000,
    couponReviewFlagCount: 0,
    couponSettlementCount: 4,
    currency: 'VND',
    customerPaymentAmountTotal: 5000000,
    declaredAt: null,
    id: 'close-2026-07',
    generatedAt: '2026-08-09T12:00:00.000Z',
    hasActivity: true,
    journalReconciliationIssueCount: 0,
    monthlyClosingHistoryCount: 1,
    netRevenueDelta: 0,
    nonCashPartnerPayoutTotal: 3200000,
    notes: null,
    openTaxCount: 0,
    paidAt: null,
    paidTaxCount: 2,
    partnerCountWithRevenue: 8,
    partnerDepositReconciliationOpenAmount: 120000,
    partnerDepositReconciliationOpenCount: 1,
    payoutBankOutflowReconciliationOpenAmount: 220000,
    payoutBankOutflowReconciliationOpenCount: 2,
    payoutReturnInflowReconciliationOpenAmount: 80000,
    payoutReturnInflowReconciliationOpenCount: 1,
    partnerFundedCouponAmountTotal: 0,
    partnerPitWithheldTotal: 45000,
    partnerPayoutTotal: 3800000,
    partnerVatWithheldTotal: 0,
    partnerWithholdingTotal: 45000,
    paymentFeeReviewFlagCount: 2,
    platformVatReviewFlagCount: 0,
    paymentProcessingFeeTotal: 70000,
    period: '2026-07',
    periodState: 'REVIEWED',
    platformFeeDiscountAmountTotal: 0,
    platformFeeGrossTotal: 500000,
    platformFeeNetRevenueTotal: 475000,
    reconciliationDelta: 0,
    remittanceMetadata: null,
    settlementCount: 12,
    preflight: {
      blockers: [
        { code: 'PAYMENT_FEE_EVIDENCE', message: 'Payment fee evidence remains open.' },
        { code: 'PARTNER_DEPOSIT_RECONCILIATION', message: 'Partner deposit matching remains open.' },
        { code: 'PAYOUT_BANK_OUTFLOW_RECONCILIATION', message: 'Payout outflow matching remains open.' },
        { code: 'PAYOUT_RETURN_INFLOW_RECONCILIATION', message: 'Payout return matching remains open.' },
      ],
      nextStatus: 'DECLARED',
      ready: false,
    },
    status: 'REVIEWED',
  };
}

function sectionMarkup(markup: string, marker: string) {
  const index = markup.indexOf(marker);
  if (index < 0) {
    return '';
  }

  return markup.slice(index, index + 3000);
}
