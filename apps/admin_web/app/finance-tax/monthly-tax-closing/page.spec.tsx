import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { emptyMonthlyTaxClosingSummary } from '../tax-settlement-page-model';
import MonthlyTaxClosingPage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);

describe('MonthlyTaxClosingPage', () => {
  beforeEach(() => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({ id: 'operator-current', roles: ['ADMIN'] } as never);
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('uses shared badge atoms for stored closing status pills', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/monthly-tax-closing/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('className={`pill ${closingStatusPill(closing.status)}`}');
    expect(source).not.toContain('className={`pill ${remittanceEvidencePill(closingRemittanceState.tone)}`}');
  });

  it('uses shared Vuexy badge link atoms for monthly tax export actions', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/monthly-tax-closing/page.tsx'), 'utf8');

    expect(source).toContain('StatusBadgeLink');
    expect(source).toContain('buildMonthlyTaxClosingExportHref');
    expect(source).not.toContain('data:text/csv');
    expect(source).not.toContain('buildMonthlyTaxClosingSummaryCsvHref');
    expect(source).not.toContain('buildMonthlyTaxClosingRowsCsvHref');
    expect(source).not.toContain('buildMonthlyTaxClosingAccountingJournalCsvHref');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).toContain('<AdminFormControlLink className="button-primary" href={statusConfirmationHref}>');
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

  it('keeps period controls on shared AdminForm atoms and requires review before status submission', async () => {
    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Monthly closing period');
    expect(markup).toContain('Active monthly closing filters');
    expect(markup).toContain('Period: 2026-06');
    expect(markup).toContain('Rows: 25');
    expect(markup).toContain('Status: DRAFT');
    expect(markup).toContain('Closeout command board');
    expect(markup).toContain('Formula delta');
    expect(markup).toContain('Closeout status');
    expect(markup).toContain('Monthly closing action');
    expect(markup).toContain('Closeout risk queue');
    expect(markup).toContain('Monthly reconciliation');
    expect(markup.match(/card admin-filter-panel admin-mb-16/g)?.length).toBe(1);
    expect(markup.match(/card admin-section admin-mb-16/g)?.length).toBeGreaterThanOrEqual(3);
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('admin-form-select admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('Review Reviewed');
    expect(markup).toContain('confirm=status&amp;targetStatus=REVIEWED');
    expect(markup).not.toContain('name="confirmationStatus"');
    expect(markup).not.toContain('card admin-card-scroll');
    expect(markup).not.toContain('class="form-input"');
  });

  it('renders a scoped transition form only after the operator opens the matching review', async () => {
    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({
        confirm: 'status',
        period: '2026-06',
        take: '25',
        targetStatus: 'REVIEWED',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('DRAFT → REVIEWED');
    expect(markup).toContain('Snapshot 0 settlement record(s)');
    expect(markup).toContain('type="hidden" name="confirmationPeriod" value="2026-06"');
    expect(markup).toContain('type="hidden" name="confirmationStatus" value="REVIEWED"');
    expect(markup).toContain('Confirm Reviewed');
    expect(markup).toContain('href="/finance-tax/monthly-tax-closing?period=2026-06&amp;take=25"');
    expect(markup).not.toContain('Remittance ref');
    expect(markup).not.toContain('Approving admin ID');
  });

  it('shows required remittance evidence fields only for the paid transition', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        return {
          ...emptyMonthlyTaxClosingSummary('2026-06'),
          companyOutputVatTotal: 10000,
          partnerWithholdingTotal: 80000,
          status: 'DECLARED',
        };
      }
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') {
        return [
          {
            email: 'current@example.com',
            fullName: 'Current Operator',
            id: 'operator-current',
            phone: '',
            roles: ['ADMIN', 'FINANCE_APPROVER'],
          },
          {
            email: 'approver@example.com',
            fullName: 'Finance Approver',
            id: 'approver-2',
            phone: '',
            roles: ['ADMIN', 'FINANCE_APPROVER'],
          },
        ] as never;
      }
      return fallback;
    });

    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({
        confirm: 'status',
        period: '2026-06',
        targetStatus: 'PAID',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('DECLARED → PAID');
    expect(markup).toContain('90.000 VND');
    expect(markup).toContain('Remittance ref');
    expect(markup).toContain('Separate Finance approver');
    expect(markup).toContain('Finance Approver · approver@example.com');
    expect(markup).not.toContain('Current Operator · current@example.com');
    expect(markup).not.toContain('placeholder="Separate Finance approver ID"');
    expect(markup).toContain('Paid at');
    expect(markup).toContain('Evidence URL');
    expect(markup.match(/required=""/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps paid remittance closeout disabled when no separate Finance approver is available', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        return {
          ...emptyMonthlyTaxClosingSummary('2026-06'),
          status: 'DECLARED',
        };
      }
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') {
        return [
          {
            email: 'current@example.com',
            fullName: 'Current Operator',
            id: 'operator-current',
            phone: '',
            roles: ['ADMIN', 'FINANCE_APPROVER'],
          },
        ] as never;
      }
      return fallback;
    });

    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({
        confirm: 'status',
        period: '2026-06',
        targetStatus: 'PAID',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('No other Finance approver is available');
    expect(markup).toContain('<select disabled="" name="approvalAdminId" required="">');
    expect(markup).toContain('class="admin-form-control-button button button-primary" disabled="" type="submit"');
  });

  it('keeps the top monthly closing KPI wall focused on four Vuexy cards', async () => {
    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);
    const metricGridStart = markup.indexOf('admin-metric-grid');
    const commandBoardStart = markup.indexOf('Closeout command board');
    const metricGridMarkup = markup.slice(metricGridStart, commandBoardStart);

    expect(metricGridMarkup.match(/class="metric-card"/g)?.length).toBe(4);
    expect(metricGridMarkup).toContain('Period status');
    expect(metricGridMarkup).toContain('Settlements');
    expect(metricGridMarkup).toContain('Company output VAT');
    expect(metricGridMarkup).toContain('Partner withholding');
    expect(metricGridMarkup).not.toContain('Coupon expense');
    expect(metricGridMarkup).not.toContain('Net revenue delta');
  });

  it('disables closeout advancement while formula or payment fee evidence gates remain open', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        return {
          ...emptyMonthlyTaxClosingSummary('2026-06'),
          status: 'REVIEWED',
          paymentFeeReviewFlagCount: 2,
        };
      }
      return fallback;
    });

    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Resolve 2 payment fee evidence row(s) before declaration.');
    expect(markup).toContain('button-primary" disabled=""');
    expect(markup).toContain('Payment fee evidence');
    expect(markup).toContain('/finance-tax/payment-fees?period=2026-06');
  });

  it('blocks declaration and links the Partner deposit reconciliation queue when bank evidence is open', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/monthly-tax-closings/summary?period=2026-06') {
        return {
          ...emptyMonthlyTaxClosingSummary('2026-06'),
          status: 'REVIEWED',
          partnerDepositReconciliationOpenAmount: 250000,
          partnerDepositReconciliationOpenCount: 2,
        };
      }
      return fallback;
    });

    const page = await MonthlyTaxClosingPage({
      searchParams: Promise.resolve({ period: '2026-06', take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Reconcile 2 executed Partner bank deposit(s) before declaration.');
    expect(markup).toContain('button-primary" disabled=""');
    expect(markup).toContain('Partner deposit reconciliation');
    expect(markup).toContain(
      '/finance-tax/partner-bank-deposits?period=2026-06&amp;review=needs-reconciliation',
    );
    expect(markup).toContain('250.000 VND');
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
          paymentFeeReviewFlagCount: 0,
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
