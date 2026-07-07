import type { AdminEarning } from '../../lib/admin-api';
import {
  buildCashDebtQueue,
  buildCashDebtQueueItems,
  buildEarningBatchStateCards,
  buildEarningFilters,
  buildEarningOperationsApiHrefs,
  buildEarningServerPagination,
  buildEarningsLedgerRows,
  buildEarningsMoneyFlowCards,
  buildEarningsMoneyFlowChecks,
  buildProviderPayoutQueue,
  buildServiceEarningBridge,
  filterEarningsByBatchState,
  sortEarnings,
  summarizeEarnings,
} from './earnings-page-model';

describe('earnings page model', () => {
  it('defaults finance operations filters to today and bounded API hrefs', () => {
    const defaultFilters = buildEarningFilters({});
    const rangeFilters = buildEarningFilters({ range: '7d', batchState: 'ready', page: '3', pageSize: '25' });

    expect(defaultFilters.range).toBe('today');
    expect(buildEarningFilters({ range: 'all' }).range).toBe('all');
    expect(buildEarningOperationsApiHrefs(rangeFilters)).toEqual({
      earningsHref: '/admin/earnings?range=7d&take=25&review=ready&skip=50',
      earningsSummaryHref: '/admin/earnings/summary?range=7d',
      payoutBatchesHref: '/admin/payout-batches?range=7d&take=10&review=needs-review',
    });
    expect(buildEarningServerPagination(['row-a'], rangeFilters, 52)).toEqual({
      from: 51,
      hrefForPage: expect.any(Function),
      page: 3,
      pageSize: 25,
      rows: ['row-a'],
      to: 51,
      totalPages: 3,
      totalRows: 52,
    });
  });

  it('passes supported batch state filters to the earnings API instead of filtering only locally', () => {
    expect(
      buildEarningOperationsApiHrefs(buildEarningFilters({ batchState: 'cash-debt' })).earningsHref,
    ).toBe('/admin/earnings?range=today&take=10&review=cash-debt');
    expect(
      buildEarningOperationsApiHrefs(buildEarningFilters({ batchState: 'batched' })).earningsHref,
    ).toBe('/admin/earnings?range=today&take=10&review=batched');
    expect(
      buildEarningOperationsApiHrefs(buildEarningFilters({ batchState: 'paid' })).earningsHref,
    ).toBe('/admin/earnings?range=today&take=10&review=paid');
    expect(
      buildEarningOperationsApiHrefs(buildEarningFilters({ batchState: 'closeout-review' })).earningsHref,
    ).toBe('/admin/earnings?range=today&take=10&review=closeout-review');
  });

  it('summarizes, prioritizes, and filters earning rows without changing statuses', () => {
    const rows = [
      earning({ id: 'paid-row', netAmount: 70000, status: 'PAID' }),
      earning({ id: 'cash-debt', netAmount: -30000, platformFee: 30000 }),
      earning({ id: 'ready-row', netAmount: 90000, status: 'AVAILABLE' }),
      earning({ id: 'batched-row', netAmount: 50000, payoutBatchId: 'batch-1', status: 'AVAILABLE' }),
    ];

    const summary = summarizeEarnings(rows, 'VND');
    const cashDebtState = buildEarningFilters({ batchState: 'cash-debt' }).batchState;
    const batchStateCards = buildEarningBatchStateCards(rows, 'all');

    expect(summary).toMatchObject({
      availableNetAmount: 140000,
      count: 4,
      netAmount: 180000,
      paidNetAmount: 70000,
      pendingNetAmount: -30000,
    });
    expect(sortEarnings(rows).map((row) => row.id)).toEqual([
      'cash-debt',
      'ready-row',
      'batched-row',
      'paid-row',
    ]);
    expect(filterEarningsByBatchState(rows, cashDebtState).map((row) => row.id)).toEqual(['cash-debt']);
    expect(batchStateCards.find((card) => card.state === 'ready')).toMatchObject({
      amount: 90000,
      count: 1,
      href: '/earnings?batchState=ready',
    });
  });

  it('builds cash debt and payout queues from API facts only', () => {
    const rows = [
      earning({
        id: 'cash-debt',
        netAmount: -30000,
        platformFee: 25000,
        withholdingAmount: 5000,
        walletLedgerEntries: [
          {
            amount: -30000,
            currency: 'VND',
            id: 'ledger-cash-debt',
            metadata: {
              totalPartnerDueToCompany: 30000,
              walletDeductionCompanyOutputVat: 5000,
              walletDeductionPartnerTaxPayable: 5000,
              walletDeductionPlatformFeeNetRevenue: 20000,
            },
            sourceKey: 'earning:cash-debt:cash-platform-fee-net',
            type: 'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
          },
        ],
      }),
      earning({ id: 'ready-row', netAmount: 90000, status: 'AVAILABLE' }),
      earning({ id: 'paid-row', netAmount: 70000, status: 'PAID' }),
    ];

    const cashDebtQueue = buildCashDebtQueue(rows);
    const cashDebtItems = buildCashDebtQueueItems(cashDebtQueue);
    const payoutQueue = buildProviderPayoutQueue(rows, []);

    expect(cashDebtItems[0]).toMatchObject({
      debtAmount: 30000,
      paymentMethod: 'CASH',
      platformFee: 25000,
      settlementReference: 'HANDS-WALLET-PROFILE1',
      taxAmount: 5000,
    });
    expect(cashDebtItems[0]?.cashAccountingPreview.map((item) => textContent(item).replace(/\s+/g, ' ').trim())).toEqual([
      'Dr Partner receivable 30.000 VND',
      'Cr Platform fee net revenue 20.000 VND',
      'Cr Company output VAT payable 5.000 VND',
      'Cr Partner withholding tax payable 5.000 VND',
    ]);
    expect(cashDebtItems[0]?.settlementChecklist[0]).toContain('Confirm Partner deposit');
    expect(payoutQueue).toHaveLength(1);
    expect(payoutQueue[0]).toMatchObject({
      canBatch: false,
      cashDebtAmount: 30000,
      status: 'HOLD',
      unbatchedCount: 1,
      unbatchedNet: 90000,
    });
  });

  it('separates post-match cancellation fee holds from cash debt settlement', () => {
    const rows = [
      earning({
        booking: {
          closedAt: '2026-06-10T08:30:00.000Z',
          closedReason: 'partner_cancelled',
          matchedAt: '2026-06-10T08:00:00.000Z',
          selectedProviderId: 'partner-profile1',
          status: 'CANCELLED',
        },
        id: 'post-match-held',
        netAmount: -30000,
        platformFee: 30000,
      }),
      earning({ id: 'cash-debt', netAmount: -30000, platformFee: 30000 }),
      earning({
        booking: {
          closedAt: '2026-06-10T08:10:00.000Z',
          closedReason: 'post_match_cancellation_approved',
          matchedAt: '2026-06-10T08:00:00.000Z',
          selectedProviderId: 'partner-profile1',
          status: 'CANCELLED',
        },
        id: 'post-match-restored',
        netAmount: 0,
        status: 'CANCELLED',
      }),
    ];

    const ledgerRows = buildEarningsLedgerRows(rows);

    expect(buildCashDebtQueue(rows).map((item) => item.earning.id)).toEqual(['cash-debt']);
    expect(filterEarningsByBatchState(rows, 'cash-debt').map((row) => row.id)).toEqual(['cash-debt']);
    expect(ledgerRows.find((row) => row.id === 'post-match-held')).toMatchObject({
      cancellationDecisionLabel: 'Pending admin decision',
      cancellationDecisionTone: 'pill-warn',
      cancellationFeeLabel: 'Fee held',
      cancellationFeeTone: 'pill-danger',
      canDirectlyPay: false,
      statusHint: 'Pending admin decision; Fee held.',
      statusLabel: 'Post-match cancellation',
    });
    expect(ledgerRows.find((row) => row.id === 'post-match-restored')).toMatchObject({
      cancellationDecisionLabel: 'Auto-approved',
      cancellationDecisionTone: 'pill-success',
      cancellationFeeLabel: 'Fee restored',
      cancellationFeeTone: 'pill-success',
      statusLabel: 'Post-match cancellation',
    });
  });

  it('builds ledger, service bridge, and money flow rows for the admin view', () => {
    const rows = [
      earning({
        grossAmount: 120000,
        id: 'service-row',
        netAmount: 90000,
        platformFee: 25000,
        status: 'AVAILABLE',
        withholdingAmount: 5000,
      }),
      earning({ id: 'cash-debt', netAmount: -30000, platformFee: 30000 }),
    ];
    const summary = summarizeEarnings(rows, 'VND');
    const cashDebtQueue = buildCashDebtQueue(rows);
    const cashDebtTotals = {
      bookingAmount: 120000,
      debtAmount: 30000,
      platformFee: 30000,
      taxAmount: 0,
    };
    const serviceBridge = buildServiceEarningBridge(rows);
    const ledgerRows = buildEarningsLedgerRows(rows);

    expect(ledgerRows[0]).toMatchObject({
      bookingShortId: 'booking-1',
      providerName: 'Partner Mai',
      statusLabel: 'AVAILABLE',
    });
    const cashDebtLedgerRow = ledgerRows.find((row) => row.id === 'cash-debt');
    expect(cashDebtLedgerRow).toMatchObject({
      statusHint: 'Cash fee debt blocks Partner wallet until settled',
    });
    expect(
      cashDebtLedgerRow?.cashAccountingPreview.map((item) => textContent(item).replace(/\s+/g, ' ').trim()),
    ).toEqual(['Dr Partner receivable 30.000 VND', 'Cr Platform fee net revenue 30.000 VND']);
    expect(serviceBridge[0]).toMatchObject({
      bookingCount: 2,
      label: 'Massage 60 / 60 min',
    });
    expect(
      buildEarningsMoneyFlowCards(summary, serviceBridge, cashDebtTotals).map((card) => card.label),
    ).toEqual(['Customer charge', 'Partner payout', 'HANDS fee', 'Tax withheld', 'Company net', 'Cash debt']);
    const bookingServiceLinkCheck = buildEarningsMoneyFlowChecks(summary, serviceBridge, cashDebtQueue).find(
      (check) => check.title === 'Booking service link',
    );
    const cashJobLockCheck = buildEarningsMoneyFlowChecks(summary, serviceBridge, cashDebtQueue).find(
      (check) => check.title === 'Cash job lock',
    );

    expect(bookingServiceLinkCheck).toMatchObject({
      action: 'Service option links are ready for finance review.',
      detail: 'Every visible earning is connected to a service option or fallback row.',
    });
    expect(cashJobLockCheck).toMatchObject({
      pillClass: 'pill-danger',
      title: 'Cash job lock',
    });
  });
});

function earning(input: Partial<AdminEarning> = {}): AdminEarning {
  const booking = {
    payment: { amount: 120000, currency: 'VND', method: 'CASH', status: 'PENDING' },
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
          serviceGroupKey: 'massage',
        },
        serviceId: 'service-1',
      },
    ],
    status: 'COMPLETED',
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
    providerProfileId: 'partner-profile1',
    settlementRef: null,
    status: 'PENDING',
    withholdingAmount: 0,
    ...input,
    booking,
  };
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
