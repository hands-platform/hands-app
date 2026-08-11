import type { AdminCashSettlementSummary, AdminEarning } from '../../lib/admin-api';
import {
  buildCashSettlementApiHref,
  buildCashSettlementFilters,
  buildCashSettlementSummaryApiHref,
  cashSettlementHref,
  safeCashSettlementReturnTo,
  safeCashSettlementOverviewReturnTo,
} from './cash-settlement-page-filters';
import {
  applyCashSettlementRowFilters,
  buildCashSettlementOpenDebtTableRows,
  buildCashSettlementRows,
} from './cash-settlement-page-rows';
import { buildSummary, mergeAuthoritativeSummary } from './cash-settlement-page-summary';

const NOW = Date.parse('2026-06-10T09:00:00.000Z');

describe('cash settlement page model', () => {
  beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => vi.restoreAllMocks());

  it('uses authoritative original, allocated and remaining amounts and excludes fully allocated debt', () => {
    const rows = buildCashSettlementRows([
      earning({
        allocatedAmount: 70_000,
        id: 'partial',
        netAmount: -170_000,
        originalDebtAmount: 170_000,
        remainingDebtAmount: 100_000,
      }),
      earning({
        allocatedAmount: 170_000,
        id: 'fully-allocated',
        netAmount: -170_000,
        originalDebtAmount: 170_000,
        remainingDebtAmount: 0,
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      allocatedAmount: 70_000,
      debtAmount: 100_000,
      originalDebtAmount: 170_000,
    });
    expect(buildSummary(rows)).toMatchObject({ debtAmount: 100_000, providerCount: 1, rowCount: 1 });
    expect(buildCashSettlementOpenDebtTableRows(rows)[0]).toMatchObject({
      allocatedAmount: 70_000,
      originalDebtAmount: 170_000,
      remainingDebtAmount: 100_000,
    });
  });

  it('applies the high exposure threshold to remaining debt, not original debt', () => {
    const below = buildCashSettlementRows([
      earning({
        allocatedAmount: 500_001,
        id: 'below',
        netAmount: -1_000_000,
        originalDebtAmount: 1_000_000,
        remainingDebtAmount: 499_999,
      }),
    ]);
    const atThreshold = buildCashSettlementRows([
      earning({
        allocatedAmount: 500_000,
        id: 'threshold',
        netAmount: -1_000_000,
        originalDebtAmount: 1_000_000,
        remainingDebtAmount: 500_000,
      }),
    ]);
    const filters = { ...buildCashSettlementFilters({}), queue: 'high-debt' as const };

    expect(applyCashSettlementRowFilters(below, filters)).toHaveLength(0);
    expect(applyCashSettlementRowFilters(atThreshold, filters)).toHaveLength(1);
  });

  it('builds bounded server list and summary URLs from one canonical filter model', () => {
    const filters = buildCashSettlementFilters({
      age: '4-24h',
      page: '2',
      pageSize: '25',
      q: ' Mai ',
      queue: 'missing-evidence',
      range: '7d',
      sla: 'overdue',
      sort: 'highest-debt',
    });

    expect(buildCashSettlementApiHref(filters)).toBe(
      '/admin/cash-settlement-earnings?range=7d&take=25&age=4-24h&sort=highest-debt&sla=overdue&queue=missing-evidence&q=Mai&skip=25',
    );
    expect(buildCashSettlementSummaryApiHref(filters)).toBe(
      '/admin/cash-settlement-summary?range=7d&age=4-24h&sort=highest-debt&sla=overdue&queue=missing-evidence&q=Mai',
    );
    expect(cashSettlementHref(filters)).toContain('queue=missing-evidence');
  });

  it('keeps one accounting month across list, summary, workbench, and safe overview return', () => {
    const filters = buildCashSettlementFilters({
      period: '2026-08',
      queue: 'missing-evidence',
      returnTo: '/finance-tax?period=2026-08',
    });

    expect(buildCashSettlementApiHref(filters)).toBe(
      '/admin/cash-settlement-earnings?period=2026-08&take=10&sort=oldest&queue=missing-evidence',
    );
    expect(buildCashSettlementSummaryApiHref(filters)).toBe(
      '/admin/cash-settlement-summary?period=2026-08&sort=oldest&queue=missing-evidence',
    );
    expect(cashSettlementHref(filters)).toBe(
      '/cash-settlements?period=2026-08&returnTo=%2Ffinance-tax%3Fperiod%3D2026-08&queue=missing-evidence&sort=oldest',
    );
    expect(safeCashSettlementOverviewReturnTo(filters.returnTo)).toBe('/finance-tax?period=2026-08');
    expect(safeCashSettlementOverviewReturnTo('https://evil.example/finance-tax?period=2026-08')).toBe(
      '/finance-tax',
    );
  });

  it('preserves canonical workbench state and rejects unsafe return paths', () => {
    const context = '/cash-settlements?queue=missing-evidence&q=Mai&sort=highest-debt&page=2';
    expect(safeCashSettlementReturnTo(context)).toBe(context);
    expect(safeCashSettlementReturnTo('https://evil.example/cash-settlements')).toBe('/cash-settlements');
    expect(safeCashSettlementReturnTo('/refunds')).toBe('/cash-settlements');
  });

  it('merges the authoritative remaining-debt summary without page-only totals', () => {
    const summary = mergeAuthoritativeSummary(buildSummary([]), {
      cashPaymentRowCount: 2,
      currency: 'VND',
      generatedAt: '2026-06-10T09:00:00.000Z',
      highDebtProviderCount: 1,
      missingPaymentEvidenceCount: 3,
      oldestOpenAgeMinutes: 60,
      oldestOpenAt: '2026-06-09T08:00:00.000Z',
      providerCount: 4,
      rowCount: 5,
      staleDebtRowCount: 6,
      topProviderGroups: [],
      totalCompanyCouponOffset: 60_000,
      totalDebtAmount: 700_000,
      totalPlatformFee: 600_000,
      totalTaxAmount: 100_000,
    } satisfies AdminCashSettlementSummary);

    expect(summary).toMatchObject({ debtAmount: 700_000, providerCount: 4, rowCount: 5 });
  });
});

function earning(input: Partial<AdminEarning> = {}): AdminEarning {
  return {
    booking: {
      payment: { amount: 170_000, method: 'CASH', status: 'PENDING' },
      services: [],
      status: 'COMPLETED',
    },
    bookingId: 'booking-1',
    createdAt: '2026-06-10T08:00:00.000Z',
    currency: 'VND',
    grossAmount: 170_000,
    id: 'earning-1',
    netAmount: -170_000,
    platformFee: 150_000,
    providerProfile: { displayName: 'Partner Mai', user: { phone: '+8490' } },
    providerProfileId: 'partner-profile-1',
    status: 'PENDING',
    withholdingAmount: 20_000,
    ...input,
  };
}
