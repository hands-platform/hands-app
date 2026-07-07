import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import type {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminPayment,
  AdminPaymentSummary,
  AdminPayoutBatch,
  AdminRefund,
  AdminRefundSummary,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import FinanceCloseoutPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('FinanceCloseoutPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server closeout rows without applying second local date filters', async () => {
    const summary: AdminEarningSummary = {
      availableNetAmount: 0,
      count: 0,
      currency: 'VND',
      grossAmount: 0,
      netAmount: 0,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
    };
    const refund = {
      amount: 120000,
      bookingId: 'server-closeout-booking',
      createdAt: '2020-01-01T00:00:00.000Z',
      id: 'server-closeout-refund',
      paymentId: 'server-closeout-payment',
      status: 'REQUESTED',
    } as AdminRefund;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payments?range=today&take=10&review=needs-action') {
        return [] as AdminPayment[];
      }
      if (href === '/admin/refunds?range=today&take=10&review=open') {
        return [refund];
      }
      if (href === '/admin/earnings/summary?range=today') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=10&review=closeout-review') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/payout-batches?range=today&take=10&review=needs-review') {
        return [] as AdminPayoutBatch[];
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return null as AdminCashSettlementSummary | null;
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Refund queue');
    expect(markup).toContain('1 OPEN');
  });

  it('uses the server earnings summary instead of recalculating from the bounded earnings sample', async () => {
    const summary: AdminEarningSummary = {
      availableNetAmount: 900000,
      count: 24,
      currency: 'VND',
      grossAmount: 1200000,
      netAmount: 900000,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 300000,
      withholdingAmount: 0,
    };

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payments?range=today&take=10&review=needs-action') {
        return [] as AdminPayment[];
      }
      if (href === '/admin/refunds?range=today&take=10&review=open') {
        return [] as AdminRefund[];
      }
      if (href === '/admin/earnings/summary?range=today') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=10&review=closeout-review') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/payout-batches?range=today&take=10&review=needs-review') {
        return [] as AdminPayoutBatch[];
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return null as AdminCashSettlementSummary | null;
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Available payout');
    expect(markup).toContain('900.000 VND');
  });

  it('uses payment and refund summaries for closeout counts instead of bounded samples', async () => {
    const earningsSummary: AdminEarningSummary = {
      availableNetAmount: 0,
      count: 0,
      currency: 'VND',
      grossAmount: 0,
      netAmount: 0,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
    };
    const paymentSummary: AdminPaymentSummary = {
      authorized: 12,
      callbackReview: 0,
      callbackVerified: 0,
      captured: 0,
      cashDebt: 0,
      linkedRefunds: 0,
      needsAction: 15,
      pendingCash: 3,
      refunded: 0,
      totalCount: 15,
    };
    const refundSummary: AdminRefundSummary = {
      completedCount: 0,
      needsUpdateCount: 0,
      openCount: 4,
      outcomeLinkedCount: 0,
      refundedBookingCount: 0,
      requestedCount: 4,
      totalCount: 4,
    };

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payments?range=today&take=10&review=needs-action') {
        return [] as AdminPayment[];
      }
      if (href === '/admin/payments/summary?range=today') {
        return paymentSummary;
      }
      if (href === '/admin/refunds?range=today&take=10&review=open') {
        return [] as AdminRefund[];
      }
      if (href === '/admin/refunds/summary?range=today') {
        return refundSummary;
      }
      if (href === '/admin/earnings/summary?range=today') {
        return earningsSummary;
      }
      if (href === '/admin/earnings?range=today&take=10&review=closeout-review') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/payout-batches?range=today&take=10&review=needs-review') {
        return [] as AdminPayoutBatch[];
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return null as AdminCashSettlementSummary | null;
      }
      return fallback;
    });

    const page = await FinanceCloseoutPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('12 HOLD(S)');
    expect(markup).toContain('3 CASH');
    expect(markup).toContain('4 OPEN');
  });

  it('uses shared status links for closeout range filters', () => {
    expect(pageSource).toContain('AdminFilterChipGroup');
    expect(pageSource).toContain('StatusBadgeLink');
    expect(pageSource).not.toContain('bodyClassName="filter-row admin-mt-12"');
    expect(pageSource).not.toContain('PillClassBadgeLink');
  });

  it('uses the shared Vuexy text link atom for closeout audit links', () => {
    expect(pageSource).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(pageSource).toContain('<AdminTextLink');
    expect(pageSource).not.toContain('className="text-link"');
  });

  it('uses shared money atoms for closeout page KPI amounts', () => {
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).not.toContain('formatMoney(');
  });
});
