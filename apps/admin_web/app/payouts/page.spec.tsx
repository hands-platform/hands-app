import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminEarning, AdminOperationalPolicySetting, AdminPayoutBatch } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import PayoutsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('PayoutsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server payout rows without applying a second local date filter', async () => {
    const batch = {
      createdAt: '2020-01-01T00:00:00.000Z',
      currency: 'VND',
      earnings: [],
      id: 'server-payout-row',
      providerProfile: {
        displayName: 'Server Trusted Payout',
        user: {
          fullName: 'Server Trusted Partner',
          phone: '+84900006666',
        },
      },
      providerProfileId: 'server-provider-row',
      status: 'DRAFT',
      totalNetAmount: 120000,
      transferRef: null,
      withholdingLogs: [],
    } as AdminPayoutBatch;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payout-batches?range=today&take=25') {
        return [batch];
      }
      if (href === '/admin/earnings?range=today&take=25') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/operational-policy') {
        return [] as AdminOperationalPolicySetting[];
      }
      return fallback;
    });

    const page = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Server Trusted Payout');
  });
});
