import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
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
      if (href === '/admin/payments?range=today&take=100') {
        return [] as AdminPayment[];
      }
      if (href === '/admin/refunds?range=today&take=100') {
        return [refund];
      }
      if (href === '/admin/earnings/summary') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=100') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/payout-batches?range=today&take=100') {
        return [] as AdminPayoutBatch[];
      }
      if (href === '/admin/cash-settlement-summary') {
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
});
