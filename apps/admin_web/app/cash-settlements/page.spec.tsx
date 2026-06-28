import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminOperationalPolicySetting,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import CashSettlementsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('CashSettlementsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server settlement rows without applying a second local date filter', async () => {
    const earning = {
      booking: {
        payment: {
          amount: 300000,
          currency: 'VND',
          method: 'CASH',
          status: 'PENDING',
        },
        services: [],
        status: 'COMPLETED',
      },
      bookingId: 'server-cash-booking',
      createdAt: '2020-01-01T00:00:00.000Z',
      currency: 'VND',
      grossAmount: 300000,
      id: 'server-cash-row',
      netAmount: -45000,
      platformFee: 40000,
      providerProfile: {
        displayName: 'Server Trusted Cash Partner',
        user: {
          fullName: 'Server Trusted Partner',
          phone: '+84900007777',
        },
      },
      providerProfileId: 'server-provider-row',
      status: 'AVAILABLE',
      withholdingAmount: 5000,
    } as AdminEarning;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/cash-settlement-earnings?range=today&take=100') {
        return [earning];
      }
      if (href === '/admin/cash-settlement-summary') {
        return null as AdminCashSettlementSummary | null;
      }
      if (href === '/admin/operational-policy') {
        return [] as AdminOperationalPolicySetting[];
      }
      return fallback;
    });

    const page = await CashSettlementsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Server Trusted Cash Partner');
  });
});
