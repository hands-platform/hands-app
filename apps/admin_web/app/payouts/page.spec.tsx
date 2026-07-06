import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-date-range-card',
    );
    expect(markup).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-release-policy-card',
    );
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table admin-data-table payout-release-cycle-table');
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

  it('uses shared badge atoms for payout policy desk status labels', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('<div className="ops-task-grid admin-mt-12">');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-date-range-card"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group payout-release-policy-card"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('className={`ops-task-card');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-14">');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-16">');
    expect(source).not.toContain('<span className="pill pill-info">Live policy default</span>');
    expect(source).not.toContain('<span className={`pill ${signal.pillClass}`}>{signal.status}</span>');
    expect(source).not.toContain('<span className={`pill ${item.pillClass}`}>{item.status}</span>');
  });

  it('uses the shared Vuexy trace summary atom for applied payout policy cards', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses shared money atoms for payout summary KPI amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('value: formatMoney(summary.totalNetAmount, summary.currency)');
    expect(source).not.toContain('value: formatMoney(summary.withholdingAmount, summary.currency)');
  });

  it('uses shared money atoms for payout inclusion audit amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).not.toContain('helper: `${formatMoney(sumEarnings');
    expect(source).not.toContain('title: `${providerLabel} / ${formatMoney');
  });

  it('uses shared money atoms for payout command signal amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).not.toContain('detail: formatMoney(');
  });

  it('uses shared money atoms for payout money flow check amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).not.toContain('Batch net versus service evidence gap: ${formatMoney');
    expect(source).not.toContain('${formatMoney(cashDebtEvidence, currency)} negative wallet amount');
  });

  it('uses shared money atoms for payout release and marketplace cash debt amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).not.toContain('${formatMoney(cashDebtAmount, currency)} partner cash-fee debt');
    expect(source).not.toContain('${formatMoney(cashDebtAmount, cashDebtCurrency)} unpaid HANDS fee');
  });

  it('uses shared money atoms for payout action execution withholding amounts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payouts/page.tsx'), 'utf8');

    expect(source).toContain('function payoutReleaseBlockerDetail');
    expect(source).toContain('<MoneyText amount={batchWithholdingAmount(batch)} currency={batch.currency} />');
    expect(source).not.toContain('${formatMoney(withholdingAmount, batch.currency)} withholding exists');
    expect(source).not.toContain('detail: `Withholding exists (${formatMoney(withholdingAmount, batch.currency)}) but no tax log is linked.`');
  });
});
