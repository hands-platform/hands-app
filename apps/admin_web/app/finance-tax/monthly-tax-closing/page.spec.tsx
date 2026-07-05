import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import MonthlyTaxClosingPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('MonthlyTaxClosingPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('uses shared badge atoms for stored closing status pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/monthly-tax-closing/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`pill ${closingStatusPill(closing.status)}`}');
    expect(source).not.toContain('className={`pill ${remittanceEvidencePill(closingRemittanceState.tone)}`}');
  });

  it('uses shared Vuexy badge link atoms for monthly tax export actions', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/monthly-tax-closing/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('pillClass=');
    expect(source).not.toContain('<AdminFormControlLink');
    expect(source).not.toContain('className="pill pill-info"');
    expect(source).not.toContain('className="pill pill-success"');
  });

  it('uses the shared Vuexy text link atom for remittance evidence links', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/monthly-tax-closing/page.tsx'), 'utf8');

    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('<a className="text-link"');
  });

  it('uses the shared DateTimeText atom for stored closing timestamps', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/monthly-tax-closing/page.tsx'), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('Declared {formatDateTime(closing.declaredAt)}');
    expect(source).not.toContain('Paid {formatDateTime(closing.paidAt)}');
    expect(source).not.toContain('Closed {formatDateTime(closing.closedAt)}');
  });

  it('keeps period and remittance forms on shared AdminForm atoms', async () => {
    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Monthly closing period');
    expect(markup).toContain('Closeout command board');
    expect(markup).toContain('Formula delta');
    expect(markup).toContain('Closeout status');
    expect(markup).toContain('Monthly closing action');
    expect(markup).toContain('Closeout risk queue');
    expect(markup).toContain('Monthly reconciliation');
    expect(markup.match(/card admin-filter-panel admin-mb-16/g)?.length).toBe(4);
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-input admin-form-control-labeled');
    expect(markup).toContain('admin-form-select admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
  });

  it('shows retained remittance evidence on the command board and stored closing row', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        return {
          cashDebtTotal: 0,
          closedAt: null,
          companyCouponExpenseTotal: 0,
          companyOutputVatTotal: 10000,
          couponDiscountAmountTotal: 0,
          couponReviewFlagCount: 0,
          couponSettlementCount: 0,
          currency: 'VND',
          customerPaymentAmountTotal: 500000,
          declaredAt: '2026-07-01T08:00:00.000Z',
          id: 'closing-1',
          netRevenueDelta: 0,
          nonCashPartnerPayoutTotal: 390000,
          notes: 'Tax paid with retained portal receipt',
          openTaxCount: 0,
          paidAt: '2026-07-02T10:00:00.000Z',
          paidTaxCount: 4,
          partnerCountWithRevenue: 2,
          partnerFundedCouponAmountTotal: 0,
          partnerPitWithheldTotal: 30000,
          partnerPayoutTotal: 390000,
          partnerVatWithheldTotal: 50000,
          partnerWithholdingTotal: 80000,
          paymentProcessingFeeTotal: 12000,
          period: '2026-06',
          platformFeeDiscountAmountTotal: 0,
          platformFeeGrossTotal: 100000,
          platformFeeNetRevenueTotal: 90000,
          reconciliationDelta: 0,
          remittanceMetadata: {
            channel: 'VCB manual transfer',
            evidenceUrl: 'https://evidence.example/tax-receipt.pdf',
            paidAt: '2026-07-02T10:00:00.000Z',
            transferRef: 'TAX-PAID-001',
          },
          settlementCount: 4,
          status: 'PAID',
        };
      }
      if (href === '/admin/monthly-tax-closings?period=2026-06&take=25') {
        return [
          {
            cashDebtTotal: 0,
            closedAt: null,
            companyOutputVatTotal: 10000,
            createdAt: '2026-07-01T08:00:00.000Z',
            currency: 'VND',
            declaredAt: '2026-07-01T08:00:00.000Z',
            id: 'closing-1',
            nonCashPartnerPayoutTotal: 390000,
            notes: 'Tax paid with retained portal receipt',
            paidAt: '2026-07-02T10:00:00.000Z',
            partnerPitWithheldTotal: 30000,
            partnerVatWithheldTotal: 50000,
            partnerWithholdingTotal: 80000,
            paymentProcessingFeeTotal: 12000,
            period: '2026-06',
            platformFeeGrossTotal: 100000,
            platformFeeNetRevenueTotal: 90000,
            remittanceMetadata: {
              channel: 'VCB manual transfer',
              evidenceUrl: 'https://evidence.example/tax-receipt.pdf',
              paidAt: '2026-07-02T10:00:00.000Z',
              transferRef: 'TAX-PAID-001',
            },
            settlementCount: 4,
            status: 'PAID',
            updatedAt: '2026-07-02T10:00:00.000Z',
          },
        ];
      }
      return fallback;
    });

    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Evidence retained');
    expect(markup).toContain('TAX-PAID-001');
    expect(markup).toContain('VCB manual transfer');
    expect(markup).toContain('https://evidence.example/tax-receipt.pdf');
  });
});
