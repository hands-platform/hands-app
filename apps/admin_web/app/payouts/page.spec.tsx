import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type {
  AdminEarning,
  AdminOperationalPolicySetting,
  AdminPayoutBatch,
  AdminPayoutBatchSummary,
} from '../../lib/admin-api';
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
const payoutPolicyHref =
  '/admin/operational-policy?keys=payout.batch_cycle_policy%2Ccash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters';

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
      if (href === '/admin/payout-batches?range=today&take=10') {
        return [batch];
      }
      if (href === '/admin/payout-batches/summary?range=today') {
        return null;
      }
      if (href === '/admin/earnings?range=today&take=10') {
        return [] as AdminEarning[];
      }
      if (href === payoutPolicyHref) {
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

  it('uses the payout summary endpoint for top-level payout metrics', async () => {
    const batch = {
      createdAt: '2026-06-27T00:00:00.000Z',
      currency: 'VND',
      earnings: [],
      id: 'sample-payout-row',
      providerProfile: {
        displayName: 'Visible Payout Row',
        user: {
          fullName: 'Visible Partner',
          phone: '+84900007777',
        },
      },
      providerProfileId: 'visible-provider-row',
      status: 'DRAFT',
      totalNetAmount: 120000,
      transferRef: null,
      withholdingLogs: [],
    } as AdminPayoutBatch;
    const summary = {
      currency: 'VND',
      generatedAt: '2026-06-27T00:00:00.000Z',
      inProgress: 7,
      missingTransferRefs: 8,
      needsReview: 6,
      open: 10,
      payoutHolds: 5,
      settled: 4,
      total: 99,
      totalNetAmount: 987654,
      withholdingAmount: 45678,
    } satisfies AdminPayoutBatchSummary;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/payout-batches?range=today&take=10') {
        return [batch];
      }
      if (href === '/admin/payout-batches/summary?range=today') {
        return summary;
      }
      if (href === '/admin/earnings?range=today&take=10') {
        return [] as AdminEarning[];
      }
      if (href === payoutPolicyHref) {
        return [] as AdminOperationalPolicySetting[];
      }
      return fallback;
    });

    const page = await PayoutsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('987.654 VND');
    expect(markup).toContain('45.678 VND');
  });
});
