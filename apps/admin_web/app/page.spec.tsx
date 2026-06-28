import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminExternalReadiness,
} from '../lib/admin-api';
import { adminGet, apiGet } from '../lib/admin-api';
import DashboardPage from './page';

vi.mock('../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/admin-api')>('../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
    apiGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedApiGet = vi.mocked(apiGet);

describe('DashboardPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedApiGet.mockReset();
  });

  it('renders server-scoped dashboard finance rows without applying a second local date filter', async () => {
    const earningSummary: AdminEarningSummary = {
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
    const cashSettlementSummary: AdminCashSettlementSummary = {
      cashPaymentRowCount: 0,
      currency: 'VND',
      generatedAt: '2026-06-28T00:00:00.000Z',
      highDebtProviderCount: 0,
      missingPaymentEvidenceCount: 0,
      oldestOpenAgeMinutes: 0,
      oldestOpenAt: null,
      providerCount: 0,
      rowCount: 0,
      staleDebtRowCount: 0,
      topProviderGroups: [],
      totalDebtAmount: 0,
      totalPlatformFee: 0,
      totalTaxAmount: 0,
    };
    const oldServerScopedEarning = {
      bookingId: 'server-dashboard-booking',
      createdAt: '2020-01-01T00:00:00.000Z',
      currency: 'VND',
      grossAmount: 300000,
      id: 'server-dashboard-earning',
      netAmount: 120000,
      platformFee: 150000,
      providerProfileId: 'server-provider-row',
      status: 'AVAILABLE',
      withholdingAmount: 30000,
    } as AdminEarning;

    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/earnings/summary') {
        return earningSummary;
      }
      if (href === '/admin/cash-settlement-summary') {
        return cashSettlementSummary;
      }
      if (typeof href === 'string' && href.startsWith('/admin/earnings?')) {
        return [oldServerScopedEarning];
      }
      return fallback;
    });

    const page = await DashboardPage({
      searchParams: Promise.resolve({ details: 'all', range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<span>Range earnings</span><strong>1</strong>');
  });

  it('uses dashboard summary instead of full people lists in default mode', async () => {
    mockedApiGet.mockResolvedValue({
      checks: [],
      ok: true,
      timestamp: '2026-06-28T00:00:00.000Z',
    } as AdminExternalReadiness);
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);

    await DashboardPage({
      searchParams: Promise.resolve({}),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/dashboard/summary');
    expect(hrefs).not.toContain('/admin/users');
    expect(hrefs).not.toContain('/admin/partners?view=list');
    expect(hrefs).toContain('/admin/app-sessions?role=PROVIDER&take=50');
  });
});
