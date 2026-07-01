import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import BankReconciliationPage from './bank-reconciliation/page';
import BookingSettlementAuditPage from './booking-settlement-audit/page';
import CouponFinancePage from './coupon-finance/page';
import GeneralLedgerPage from './general-ledger/page';
import PaymentClearingPage from './payment-clearing/page';
import SettlementReversalsPage from './settlement-reversals/page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('finance list pages', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it.each([
    ['booking settlement audit', BookingSettlementAuditPage, 'Settlement audit filters', 'Booking settlement snapshot rows'],
    ['coupon finance', CouponFinancePage, 'Coupon finance filters', 'Coupon settlement rows'],
    ['settlement reversals', SettlementReversalsPage, 'Settlement reversal filters', 'Settlement reversal rows'],
  ] as const)('renders %s filters and rows with Vuexy table panels', async (_name, Page, filterTitle, tableTitle) => {
    const page = await Page({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(filterTitle);
    expect(markup).toContain(tableTitle);
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).not.toContain('card admin-card-scroll');
  });

  it.each([
    [
      'payment clearing',
      PaymentClearingPage,
      '/finance-tax/payment-clearing/clearing-1',
      [
        {
          amount: 500000,
          booking: { status: 'COMPLETED' },
          bookingId: 'booking-1',
          currency: 'VND',
          id: 'clearing-1',
          occurredAt: '2026-06-20T09:10:00.000Z',
          payment: {
            amount: 500000,
            currency: 'VND',
            method: 'CARD',
            status: 'CAPTURED',
          },
          paymentId: 'payment-1',
          sourceKey: 'seed-finance-smoke-clearing',
          status: 'OPEN',
          type: 'CUSTOMER_PAYMENT_CAPTURED',
        },
      ],
      {
        amount: 500000,
        clearedCount: 0,
        count: 1,
        currency: 'VND',
        openCount: 1,
      },
    ],
    [
      'general ledger',
      GeneralLedgerPage,
      '/finance-tax/general-ledger/journal-batch-1',
      [
        {
          _count: { entries: 2 },
          booking: { status: 'COMPLETED' },
          bookingId: 'booking-1',
          createdAt: '2026-06-20T09:00:00.000Z',
          currency: 'VND',
          customerProfile: { user: { fullName: 'Demo Customer', phone: '+84900000001' } },
          customerProfileId: 'customer-1',
          id: 'journal-batch-1',
          monthlyPeriod: '2026-06',
          postedAt: '2026-06-20T09:10:00.000Z',
          providerProfile: {
            displayName: 'Linh Wellness',
            user: { fullName: 'Demo Partner', phone: '+84900000002' },
          },
          providerProfileId: 'provider-1',
          reversedAt: null,
          sourceId: 'booking-1',
          sourceKey: 'seed-finance-smoke-journal-batch',
          sourceType: 'BOOKING_SETTLEMENT',
          status: 'POSTED',
          totalCredit: 500000,
          totalDebit: 500000,
          updatedAt: '2026-06-20T09:10:00.000Z',
        },
      ],
      {
        count: 1,
        currency: 'VND',
        postedCount: 1,
        reversedCount: 0,
        totalCredit: 500000,
        totalDebit: 500000,
      },
    ],
    [
      'bank reconciliation',
      BankReconciliationPage,
      '/finance-tax/bank-reconciliation/bank-transaction-1',
      [
        {
          _count: { reconciliationMatches: 0 },
          amount: 500000,
          bankAccount: {
            accountNumberLast4: '3101',
            accountNumberMasked: '****3101',
            bankName: 'Vietcombank',
            name: 'HANDS Finance Smoke Account',
          },
          counterpartyName: 'Demo customer card processor',
          currency: 'VND',
          description: 'Finance smoke bank transaction',
          id: 'bank-transaction-1',
          occurredAt: '2026-06-20T10:00:00.000Z',
          sourceKey: 'seed-finance-smoke-bank-transaction',
          status: 'UNMATCHED',
          transferRef: 'FIN-SMOKE-3101',
          type: 'INFLOW',
          valueDate: '2026-06-20T00:00:00.000Z',
        },
      ],
      {
        amount: 500000,
        count: 1,
        currency: 'VND',
        matchedCount: 0,
        unmatchedCount: 1,
      },
    ],
  ] as const)('renders %s rows with a dedicated Evidence action column', async (_name, Page, detailHref, rows, summary) => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (String(href).includes('/summary')) {
        return summary;
      }
      return rows.length > 0 ? rows : fallback;
    });

    const page = await Page({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Evidence');
    expect(markup).toContain('Open detail');
    expect(markup).toContain(detailHref);
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table');
    expect(markup).toContain('vuexy-booking-table-footer');
  });
});
