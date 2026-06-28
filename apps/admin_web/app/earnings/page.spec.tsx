import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminEarning, AdminEarningSummary, AdminPayoutBatch } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import EarningsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('EarningsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server earning rows without applying a second local date filter', async () => {
    const summary: AdminEarningSummary = {
      availableNetAmount: 120000,
      count: 1,
      currency: 'VND',
      grossAmount: 300000,
      netAmount: 120000,
      paidNetAmount: 0,
      pendingNetAmount: 0,
      platformFee: 150000,
      withholdingAmount: 30000,
    };
    const earning = {
      booking: {
        payment: {
          amount: 300000,
          currency: 'VND',
          method: 'CARD',
          status: 'CAPTURED',
        },
        services: [],
        status: 'COMPLETED',
      },
      bookingId: 'server-earning-booking',
      createdAt: '2020-01-01T00:00:00.000Z',
      currency: 'VND',
      grossAmount: 300000,
      id: 'server-earning-row',
      netAmount: 120000,
      platformFee: 150000,
      providerProfile: {
        displayName: 'Server Trusted Earning',
        user: {
          fullName: 'Server Trusted Partner',
          phone: '+84900005555',
        },
      },
      providerProfileId: 'server-provider-row',
      status: 'AVAILABLE',
      withholdingAmount: 30000,
    } as AdminEarning;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/earnings/summary') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=100') {
        return [earning];
      }
      if (href === '/admin/payout-batches?range=today&take=100') {
        return [] as AdminPayoutBatch[];
      }
      return fallback;
    });

    const page = await EarningsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Server Trusted Earning');
  });
});
