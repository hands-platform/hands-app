import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
      if (href === '/admin/cash-settlement-earnings?range=today&take=10') {
        return [earning];
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return null as AdminCashSettlementSummary | null;
      }
      if (
        href ===
        '/admin/operational-policy?keys=cash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cpayout.batch_cycle_policy%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters'
      ) {
        return [] as AdminOperationalPolicySetting[];
      }
      return fallback;
    });

    const page = await CashSettlementsPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Server Trusted Cash Partner');
    expect(markup).toContain('card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card');
    expect(markup).not.toContain('class="card admin-mb-16"');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/cash-settlement-summary?range=today', null);
    expect(markup).toContain('Open full operations view');
    expect(markup).toContain('/cash-settlements?view=full');
    expect(markup).not.toContain('Cash settlement execution desk');
    expect(markup).not.toContain('Cash fee operating rules');
    expect(markup).not.toContain('Cash fee settlement workflow');
    expect(markup).not.toContain('Partner wallet debt groups');
    expect(markup).not.toContain('Cash settlement evidence checklist');
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/operational-policy?keys=cash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cpayout.batch_cycle_policy%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters',
      [],
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith('/admin/operational-policy', []);
  });

  it('uses the shared ActionMenu atom for the optional full operations link', () => {
    const source = readFileSync(join(process.cwd(), 'app/cash-settlements/page.tsx'), 'utf8');

    expect(source).toContain('ActionMenu');
    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('<Link');
    expect(source).not.toContain('className="pill pill-info"');
  });

  it('uses shared money atoms for cash settlement page metrics', () => {
    const source = readFileSync(join(process.cwd(), 'app/cash-settlements/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });

  it('scopes cash settlement KPI cards by action, risk, and selected period', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/cash-settlement-earnings?range=7d&take=10') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/cash-settlement-summary?range=7d') {
        const summary: AdminCashSettlementSummary = {
          cashPaymentRowCount: 4,
          currency: 'VND',
          generatedAt: '2026-07-13T00:00:00.000Z',
          highDebtProviderCount: 1,
          missingPaymentEvidenceCount: 2,
          oldestOpenAgeMinutes: 26 * 60,
          oldestOpenAt: '2026-07-11T22:00:00.000Z',
          providerCount: 3,
          rowCount: 4,
          staleDebtRowCount: 1,
          topProviderGroups: [],
          totalCompanyCouponOffset: 25000,
          totalDebtAmount: 100000,
          totalPlatformFee: 80000,
          totalTaxAmount: 20000,
        };
        return summary;
      }
      return fallback;
    });

    const page = await CashSettlementsPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Needs action');
    expect(markup).toContain('Pending');
    expect(markup).toContain('Risk');
    expect(markup).toContain('Last 7 days');
    expect(markup).toContain('Partner-held cash debt needing follow-up.');
    expect(markup).toContain('Period coupon offsets already applied to cash settlements.');
    expect(markup).not.toContain('Visible settlement rows after filters.');
    expect(markup).not.toContain('Rows older than 24 hours.');
  });

  it('loads the full cash settlement operations playbook only when requested', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/cash-settlement-earnings?range=today&take=10') {
        return [] as AdminEarning[];
      }
      if (href === '/admin/cash-settlement-summary?range=today') {
        return null as AdminCashSettlementSummary | null;
      }
      if (
        href ===
        '/admin/operational-policy?keys=cash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cpayout.batch_cycle_policy%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters'
      ) {
        return [] as AdminOperationalPolicySetting[];
      }
      return fallback;
    });

    const page = await CashSettlementsPage({
      searchParams: Promise.resolve({ range: 'today', view: 'full' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Cash settlement execution desk');
    expect(markup).toContain('Cash fee operating rules');
    expect(markup).toContain('Cash fee settlement workflow');
    expect(markup).toContain('Partner wallet debt groups');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/operational-policy?keys=cash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cpayout.batch_cycle_policy%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters',
      [],
    );
  });
});
