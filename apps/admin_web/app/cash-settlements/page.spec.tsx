import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminCashSettlementSummary, AdminEarning } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import CashSettlementsPage from './page';

const { mockedRedirect } = vi.hoisted(() => ({ mockedRedirect: vi.fn() }));

vi.mock('next/navigation', () => ({ redirect: mockedRedirect }));
vi.mock('../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn().mockResolvedValue({
    categories: ['FINANCE_SETTLEMENTS'],
    isMasterAdmin: false,
    roles: ['ADMIN'],
  }),
}));

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('CashSettlementsPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedRedirect.mockReset();
  });

  it('renders four action KPIs and the compact evidence workbench from server-scoped data', async () => {
    const earning = cashEarning();
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/cash-settlement-earnings?range=today&take=10&sort=oldest') {
        return { data: [earning], ok: true, status: 200 } as never;
      }
      if (href === '/admin/cash-settlement-summary?range=today&sort=oldest') {
        return { data: cashSummary(), ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: false, status: 404 } as never;
    });

    const page = await CashSettlementsPage({ searchParams: Promise.resolve({ range: 'today' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Cash Settlement Workbench');
    expect(markup).toContain('Open exposure');
    expect(markup).toContain('Overdue');
    expect(markup).toContain('Missing settlement evidence');
    expect(markup).toContain('Partners affected');
    expect(markup).toContain('Server Trusted Cash Partner');
    expect(markup).toContain('Filtered cash settlement queue');
    expect(markup).toContain('All dates · All open');
    expect(markup).toContain('Filtered queue · All open · 4 row(s)');
    expect(markup.match(/class="card admin-kpi-card cash-settlement-kpi-card"/g)).toHaveLength(4);
    expect(markup).toContain('class="admin-metric-grid cash-settlement-kpi-grid"');
    expect(markup).not.toContain('Review settlement');
    expect(markup).not.toContain('HANDS-CASH-');
    expect(markup).not.toContain('Cash settlement execution desk');
  });

  it('does not render API failures as zero financial values', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: false,
      status: 503,
    }));

    const page = await CashSettlementsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Cash settlement data is incomplete');
    expect(markup).toContain('Unavailable');
    expect(markup).not.toContain('Open exposure: </span>0');
  });

  it('loads a selected debt by exact earning id instead of searching the current page rows', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/cash-settlement-earnings/earning-exact-22') {
        return { data: null, ok: false, status: 404 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    await CashSettlementsPage({
      searchParams: Promise.resolve({
        page: '2',
        pageSize: '25',
        queue: 'missing-evidence',
        review: 'earning-exact-22',
        sort: 'oldest',
      }),
    });

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/cash-settlement-earnings/earning-exact-22',
      null,
    );
  });

  it('redirects legacy full view to the canonical lightweight guide', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: true,
      status: 200,
    }));

    const page = await CashSettlementsPage({
      searchParams: Promise.resolve({ range: 'today', view: 'full' }),
    });
    renderToStaticMarkup(page);

    expect(mockedRedirect).toHaveBeenCalledWith('/cash-settlements?range=today&view=guide&sort=oldest');
    expect(mockedAdminGetResult.mock.calls.some(([href]) => String(href).includes('operational-policy'))).toBe(false);
  });

  it('keeps shared money atoms and removes unsafe direct settlement wiring', () => {
    const source = readFileSync(join(process.cwd(), 'app/cash-settlements/page.tsx'), 'utf8');
    expect(source).toContain('MoneyText');
    expect(source).toContain('adminGetResult');
    expect(source).toContain('CashSettlementReviewDrawer');
    expect(source).not.toContain('ConfirmDialog');
    expect(source).not.toContain('settleCashFeeDebt');
    expect(source).not.toContain('AdminOperationalPolicySetting');
  });
});

function cashEarning(): AdminEarning {
  return {
    booking: {
      payment: { amount: 300_000, currency: 'VND', method: 'CASH', status: 'PENDING' },
      services: [],
      status: 'COMPLETED',
    },
    bookingId: 'server-cash-booking',
    createdAt: '2026-08-01T00:00:00.000Z',
    currency: 'VND',
    grossAmount: 300_000,
    id: 'server-cash-row',
    netAmount: -45_000,
    platformFee: 40_000,
    providerProfile: {
      displayName: 'Server Trusted Cash Partner',
      user: { fullName: 'Server Trusted Partner', phone: '+84900007777' },
    },
    providerProfileId: 'server-provider-row',
    status: 'AVAILABLE',
    withholdingAmount: 5_000,
  };
}

function cashSummary(): AdminCashSettlementSummary {
  return {
    cashPaymentRowCount: 4,
    currency: 'VND',
    generatedAt: '2026-08-09T00:00:00.000Z',
    global: {
      allocatedAmount: 70_000,
      missingSettlementEvidenceCount: 3,
      originalDebtAmount: 170_000,
      providerCount: 3,
      remainingDebtAmount: 100_000,
      rowCount: 4,
      staleDebtRowCount: 2,
    },
    highDebtProviderCount: 1,
    missingPaymentEvidenceCount: 1,
    missingSettlementEvidenceCount: 3,
    oldestOpenAgeMinutes: 26 * 60,
    oldestOpenAt: '2026-08-07T22:00:00.000Z',
    providerCount: 3,
    queueCounts: { all: 4, highDebt: 1, missingEvidence: 3, paymentCheck: 0, stale: 2 },
    rowCount: 4,
    staleDebtRowCount: 2,
    topProviderGroups: [],
    totalCompanyCouponOffset: 25_000,
    totalAllocatedAmount: 70_000,
    totalDebtAmount: 100_000,
    totalOriginalDebtAmount: 170_000,
    totalPlatformFee: 80_000,
    totalTaxAmount: 20_000,
  };
}
