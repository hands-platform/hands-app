import type { AdminCashSettlementSummary, AdminEarning } from '../../lib/admin-api';
import { buildCashSettlementFilters, cashSettlementHref, cashSettlementQueueLabel } from './cash-settlement-page-filters';
import { buildCashSettlementPriorityBoard } from './cash-settlement-page-priority';
import {
  applyCashSettlementRowFilters,
  buildCashSettlementOpenDebtTableRows,
  buildCashSettlementRows,
} from './cash-settlement-page-rows';
import { buildProviderGroups, buildSummary, mergeAuthoritativeSummary } from './cash-settlement-page-summary';

const NOW = Date.parse('2026-06-10T09:00:00.000Z');

describe('cash settlement page model', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds open cash debt rows and summary without changing settlement state', () => {
    const rows = buildCashSettlementRows([
      earning({ id: 'cash-high', netAmount: -600000, platformFee: 500000, withholdingAmount: 100000 }),
      earning({ id: 'paid', netAmount: -50000, status: 'PAID' }),
      earning({ booking: { payment: { amount: 100000, method: 'CARD', status: 'AUTHORIZED' } }, id: 'card-negative' }),
      earning({
        booking: {
          closedAt: '2026-06-10T08:30:00.000Z',
          matchedAt: '2026-06-10T08:00:00.000Z',
          selectedProviderId: 'partner-profile-1',
          status: 'CANCELLED',
        },
        id: 'post-match-held',
        netAmount: -30000,
      }),
    ]);
    const providers = buildProviderGroups(rows);
    const summary = buildSummary(rows, providers);

    expect(rows.map((row) => row.earning.id)).toEqual(['cash-high', 'card-negative']);
    expect(summary).toMatchObject({
      cashPaymentRowCount: 1,
      debtAmount: 630000,
      highDebtProviderCount: 1,
      missingPaymentEvidenceCount: 0,
      providerCount: 1,
      rowCount: 2,
    });
  });

  it('filters queues, search text, and links consistently', () => {
    const rows = buildCashSettlementRows([
      earning({ createdAt: '2026-06-08T08:00:00.000Z', id: 'stale-row', settlementRef: null }),
      earning({ id: 'fresh-row', netAmount: -10000, platformFee: 10000, settlementRef: 'BANK-REF' }),
    ]);

    expect(buildCashSettlementFilters({ q: ' partner ', queue: 'missing-ref', range: '7d' })).toEqual({
      q: 'partner',
      queue: 'missing-ref',
      range: '7d',
    });
    expect(applyCashSettlementRowFilters(rows, { q: '', queue: 'stale', range: 'all' }).map((row) => row.earning.id)).toEqual([
      'stale-row',
    ]);
    expect(applyCashSettlementRowFilters(rows, { q: 'fresh-row', queue: 'all', range: 'all' })).toHaveLength(1);
    expect(cashSettlementHref({ q: 'Mai', queue: 'high-debt', range: '30d' })).toBe(
      '/cash-settlements?range=30d&queue=high-debt&q=Mai',
    );
    expect(cashSettlementQueueLabel('payment-check')).toBe('Payment check');
  });

  it('builds priority board and table row action evidence', () => {
    const rows = buildCashSettlementRows([
      earning({ createdAt: '2026-06-08T08:00:00.000Z', id: 'old-high', netAmount: -600000, platformFee: 600000 }),
    ]);

    expect(buildCashSettlementPriorityBoard(rows)[0]).toMatchObject({
      pillClass: 'pill-danger',
      priority: 'High debt',
    });
    expect(buildCashSettlementOpenDebtTableRows(rows)[0]?.actionRows.map((row) => row.action)).toEqual([
      'Confirm cash collection',
      'Attach settlement reference',
      'Settle wallet debt',
      'Ledger trace',
      'Aging follow-up',
    ]);
  });

  it('uses authoritative all-date API summary when available', () => {
    const visible = buildSummary([], []);
    const summary = mergeAuthoritativeSummary(visible, {
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
      totalDebtAmount: 700000,
      totalPlatformFee: 600000,
      totalTaxAmount: 100000,
    } satisfies AdminCashSettlementSummary);

    expect(summary).toMatchObject({
      cashPaymentRowCount: 2,
      debtAmount: 700000,
      providerCount: 4,
      rowCount: 5,
    });
  });
});

function earning(input: Partial<AdminEarning> = {}): AdminEarning {
  const booking = {
    payment: { amount: 120000, method: 'CASH', status: 'PENDING' },
    services: [
      {
        id: 'booking-service-1',
        price: 120000,
        quantity: 1,
        service: {
          basePrice: 120000,
          durationMin: 60,
          id: 'service-1',
          name: 'Massage 60',
        },
        serviceId: 'service-1',
      },
    ],
    ...input.booking,
  };

  return {
    bookingId: 'booking-1',
    createdAt: '2026-06-10T08:00:00.000Z',
    currency: 'VND',
    grossAmount: 120000,
    id: 'earning-1',
    netAmount: -30000,
    platformFee: 30000,
    providerProfile: { displayName: 'Partner Mai', user: { phone: '+8490' } },
    providerProfileId: 'partner-profile-1',
    settlementRef: null,
    status: 'PENDING',
    withholdingAmount: 0,
    ...input,
    booking,
  };
}
