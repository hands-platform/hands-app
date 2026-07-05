import type { AdminCashSettlementSummary, AdminEarning } from '../../lib/admin-api';
import {
  buildCashSettlementApiHref,
  buildCashSettlementFilters,
  buildCashSettlementSummaryApiHref,
  cashSettlementHref,
  cashSettlementQueueLabel,
} from './cash-settlement-page-filters';
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
      earning({
        booking: { payment: { amount: 100000, method: 'CARD', status: 'AUTHORIZED' } },
        id: 'card-negative',
      }),
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

    expect(
      buildCashSettlementFilters({
        page: '3',
        pageSize: '25',
        q: ' partner ',
        queue: 'missing-ref',
        range: '7d',
      }),
    ).toEqual({
      page: 3,
      pageSize: 25,
      q: 'partner',
      queue: 'missing-ref',
      range: '7d',
    });
    expect(
      applyCashSettlementRowFilters(rows, { page: 1, pageSize: 10, q: '', queue: 'stale', range: 'all' }).map(
        (row) => row.earning.id,
      ),
    ).toEqual(['stale-row']);
    expect(
      applyCashSettlementRowFilters(rows, {
        page: 1,
        pageSize: 10,
        q: 'fresh-row',
        queue: 'all',
        range: 'all',
      }),
    ).toHaveLength(1);
    expect(cashSettlementHref({ page: 2, pageSize: 25, q: 'Mai', queue: 'high-debt', range: '30d' })).toBe(
      '/cash-settlements?range=30d&queue=high-debt&q=Mai&pageSize=25&page=2',
    );
    expect(buildCashSettlementFilters({})).toEqual({
      page: 1,
      pageSize: 10,
      q: '',
      queue: 'all',
      range: 'today',
    });
    expect(cashSettlementHref({ page: 1, pageSize: 10, q: '', queue: 'all', range: 'all' })).toBe(
      '/cash-settlements?range=all',
    );
    expect(
      buildCashSettlementApiHref(
        buildCashSettlementFilters({ page: '3', pageSize: '25', q: 'Mai', queue: 'high-debt', range: '7d' }),
      ),
    ).toBe('/admin/cash-settlement-earnings?range=7d&take=25&queue=high-debt&q=Mai&skip=50');
    expect(
      buildCashSettlementSummaryApiHref(
        buildCashSettlementFilters({ q: 'Mai', queue: 'high-debt', range: '7d' }),
      ),
    ).toBe('/admin/cash-settlement-summary?range=7d&queue=high-debt&q=Mai');
    expect(cashSettlementQueueLabel('payment-check')).toBe('Payment check');
  });

  it('builds priority board and table row action evidence', () => {
    const rows = buildCashSettlementRows([
      earning({
        createdAt: '2026-06-08T08:00:00.000Z',
        id: 'old-high',
        netAmount: -600000,
        platformFee: 600000,
      }),
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

  it('builds cash coupon settlement breakdown from wallet ledger metadata', () => {
    const cashCouponRows = buildCashSettlementRows([cashCouponEarning()]);
    const [row] = buildCashSettlementOpenDebtTableRows(cashCouponRows);
    const providers = buildProviderGroups(cashCouponRows);
    const summary = buildSummary(cashCouponRows, providers);

    expect(row).toMatchObject({
      bookingAmount: 540_000,
      cashCouponOffsetAmount: 60_000,
      currency: 'VND',
      debtAmount: 110_000,
      platformFee: 170_000,
      taxAmount: 42_000,
    });
    expect(row.cashAccountingPreview.map((item) => textContent(item).replace(/\s+/g, ' ').trim())).toEqual([
      'Dr Partner receivable 110.000 VND',
      'Cr Platform fee net revenue 58.519 VND',
      'Cr Company output VAT payable 9.481 VND',
      'Cr Partner withholding tax payable 42.000 VND',
      'Coupon offset already applied 60.000 VND',
    ]);
    expect(row.walletDeductionBreakdown.map((item) => textContent(item).replace(/\s+/g, ' ').trim())).toEqual([
      'Platform net wallet deduction 58.519 VND',
      'Company VAT wallet deduction 9.481 VND',
      'Partner tax wallet deduction 42.000 VND',
    ]);
    expect(providers[0]).toMatchObject({ companyCouponOffset: 60_000 });
    expect(summary).toMatchObject({
      companyCouponOffset: 60_000,
      debtAmount: 110_000,
      platformFee: 170_000,
      taxAmount: 42_000,
    });
  });

  it('uses authoritative all-date API summary when available', () => {
    const visible = buildSummary([], []);
    const summary = mergeAuthoritativeSummary(visible, {
      cashPaymentRowCount: 2,
      totalCompanyCouponOffset: 60_000,
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
      companyCouponOffset: 60_000,
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

function cashCouponEarning(): AdminEarning {
  return earning({
    booking: { payment: { amount: 540_000, method: 'CASH', status: 'PENDING' } },
    grossAmount: 600_000,
    id: 'cash-coupon',
    netAmount: -110_000,
    platformFee: 170_000,
    withholdingAmount: 42_000,
    walletLedgerEntries: [
      {
        amount: -58_519,
        currency: 'VND',
        id: 'ledger-platform',
        metadata: {
          accountingComponentAmount: 118_519,
          cashBookingCompanyCouponExpense: 60_000,
          totalPartnerDueToCompany: 110_000,
          walletDeductionCompanyOutputVat: 9_481,
          walletDeductionPartnerTaxPayable: 42_000,
          walletDeductionPlatformFeeNetRevenue: 58_519,
        },
        sourceKey: 'earning:cash-coupon:cash-platform-fee-net',
        type: 'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
      },
    ],
  });
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
