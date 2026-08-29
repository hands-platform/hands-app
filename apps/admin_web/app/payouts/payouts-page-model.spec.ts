import {
  buildPayoutFilters,
  buildPayoutOperationsApiHrefs,
  payoutHref,
  payoutWithdrawalClearSavedViewHref,
} from './payouts-page-model';

describe('payouts page model', () => {
  it('defaults to the all-date payout batch workspace', () => {
    const filters = buildPayoutFilters({});
    expect(filters).toMatchObject({
      page: 1,
      pageSize: 20,
      range: 'all',
      queue: 'open',
      sort: 'newest',
      view: 'batches',
      withdrawalStatus: null,
    });
    expect(buildPayoutOperationsApiHrefs(filters)).toMatchObject({
      payoutBatchSummaryHref: '/admin/payout-batches/summary?range=all&queue=open',
      payoutBatchesHref: '/admin/payout-batches?range=all&take=20&view=summary&queue=open',
      providerWalletWithdrawalRequestsHref: null,
      providerWalletWithdrawalRequestGlobalSummaryHref:
        '/admin/provider-wallet/withdrawal-requests/summary?range=all',
    });
  });

  it('normalizes old record and audit bookmarks into the three supported views', () => {
    expect(buildPayoutFilters({ view: 'records' }).view).toBe('withdrawals');
    expect(buildPayoutFilters({ view: 'audit' }).view).toBe('reconciliation');
    expect(buildPayoutFilters({ view: 'policy' }).view).toBe('batches');
    expect(buildPayoutFilters({ withdrawalStatus: 'REVIEW_REQUIRED' }).view).toBe('withdrawals');
  });

  it('loads only active view row data', () => {
    const batches = buildPayoutOperationsApiHrefs(buildPayoutFilters({ view: 'batches' }));
    const withdrawals = buildPayoutOperationsApiHrefs(buildPayoutFilters({ view: 'withdrawals' }));
    expect(batches.payoutBatchesHref).not.toBeNull();
    expect(batches.providerWalletWithdrawalRequestsHref).toBeNull();
    expect(withdrawals.payoutBatchesHref).toBeNull();
    expect(withdrawals.providerWalletWithdrawalRequestsHref).toContain(
      '/admin/provider-wallet/withdrawal-requests?',
    );
    expect(withdrawals.payoutBatchSummaryHref).toBeNull();
  });

  it('keeps reconciliation overview aggregate-only and loads one selected repair dataset', () => {
    const overview = buildPayoutOperationsApiHrefs(
      buildPayoutFilters({ range: '30d', view: 'reconciliation' }),
    );
    expect(overview).toMatchObject({
      payoutBatchSummaryHref: null,
      payoutBatchesHref: null,
      providerWalletWithdrawalRequestsHref: null,
    });

    const bankUnmatchedFilters = buildPayoutFilters({
      range: '30d',
      recon: 'bank-unmatched',
      view: 'reconciliation',
    });
    expect(bankUnmatchedFilters).toMatchObject({
      recon: 'bank-unmatched',
      withdrawalReconciliation: 'unmatched',
      withdrawalStatus: 'PAID',
    });
    expect(buildPayoutOperationsApiHrefs(bankUnmatchedFilters)).toMatchObject({
      payoutBatchSummaryHref: null,
      payoutBatchesHref: null,
      providerWalletWithdrawalRequestsHref:
        '/admin/provider-wallet/withdrawal-requests?range=30d&take=20&status=PAID&reconciliation=unmatched',
    });

    const closeoutRepair = buildPayoutOperationsApiHrefs(
      buildPayoutFilters({
        range: '30d',
        recon: 'payout-closeout-repair',
        view: 'reconciliation',
      }),
    );
    expect(closeoutRepair).toMatchObject({
      payoutBatchesHref:
        '/admin/payout-batches?range=30d&take=20&view=summary&queue=repair',
      providerWalletWithdrawalRequestsHref: null,
    });
  });

  it('preserves explicit Finance batch scope instead of forcing the default open queue', () => {
    const filters = buildPayoutFilters({
      evidence: 'bank-match-incomplete',
      period: '2026-07',
      status: 'PAID',
    });

    expect(filters.queue).toBeNull();
  });

  it('passes bounded server search, queue, evidence, sort, and pagination', () => {
    const filters = buildPayoutFilters({
      evidence: 'missing-transfer-ref',
      page: '3',
      pageSize: '25',
      q: 'partner 01',
      queue: 'review',
      range: '7d',
      sort: 'oldest',
      status: 'DRAFT',
    });
    const hrefs = buildPayoutOperationsApiHrefs(filters);
    expect(hrefs.payoutBatchesHref).toBe(
      '/admin/payout-batches?range=7d&take=25&view=summary&evidence=missing-transfer-ref&q=partner+01&queue=review&sort=oldest&status=DRAFT&skip=50',
    );
    expect(hrefs.payoutBatchSummaryHref).toBe(
      '/admin/payout-batches/summary?range=7d&evidence=missing-transfer-ref&q=partner+01&queue=review&status=DRAFT',
    );
  });

  it('combines the repair queue with an authoritative evidence filter and amount priority', () => {
    const hrefs = buildPayoutOperationsApiHrefs(buildPayoutFilters({
      evidence: 'withholding-review',
      recon: 'payout-closeout-repair',
      sort: 'amount-desc',
      view: 'reconciliation',
    }));

    expect(hrefs.payoutBatchesHref).toBe(
      '/admin/payout-batches?range=all&take=20&view=summary&evidence=withholding-review&sort=amount-desc&queue=repair',
    );
  });

  it.each(['wallet-ledger-mismatch', 'posted-gl-journal-missing'])(
    'preserves the %s repair evidence contract in list and summary requests',
    (evidence) => {
      const hrefs = buildPayoutOperationsApiHrefs(buildPayoutFilters({
        evidence,
        recon: 'payout-closeout-repair',
        view: 'reconciliation',
      }));

      expect(hrefs.payoutBatchesHref).toBe(
        `/admin/payout-batches?range=all&take=20&view=summary&evidence=${evidence}&queue=repair`,
      );
      expect(hrefs.payoutBatchSummaryHref).toBe(
        `/admin/payout-batches/summary?range=all&evidence=${evidence}&queue=repair`,
      );
    },
  );

  it('preserves the exact monthly payout bank-evidence contract and safe Finance return', () => {
    const filters = buildPayoutFilters({
      evidence: 'bank-match-incomplete',
      period: '2026-07',
      returnTo: '/finance-overview?view=queues',
      sort: 'oldest',
      status: 'PAID',
    });
    const hrefs = buildPayoutOperationsApiHrefs(filters);

    expect(filters).toMatchObject({
      evidence: 'bank-match-incomplete',
      period: '2026-07',
      returnTo: '/finance-overview?view=queues',
    });
    expect(hrefs.payoutBatchesHref).toBe(
      '/admin/payout-batches?range=all&take=20&view=summary&evidence=bank-match-incomplete&period=2026-07&sort=oldest&status=PAID',
    );
    expect(hrefs.payoutBatchSummaryHref).toBe(
      '/admin/payout-batches/summary?range=all&evidence=bank-match-incomplete&period=2026-07&status=PAID',
    );
    expect(
      payoutHref({
        evidence: filters.evidence,
        period: filters.period,
        range: filters.range,
        returnTo: filters.returnTo,
        sort: filters.sort,
        status: filters.status,
      }),
    ).toBe(
      '/payouts?status=PAID&evidence=bank-match-incomplete&period=2026-07&returnTo=%2Ffinance-overview%3Fview%3Dqueues&sort=oldest',
    );
  });

  it('uses the same withdrawal filters for rows and selected-scope totals', () => {
    const hrefs = buildPayoutOperationsApiHrefs(
      buildPayoutFilters({
        q: 'VCB 123',
        range: '30d',
        view: 'withdrawals',
        withdrawalReconciliation: 'unmatched',
        withdrawalStatus: 'PAID',
      }),
    );
    expect(hrefs.providerWalletWithdrawalRequestSummaryHref).toBe(
      '/admin/provider-wallet/withdrawal-requests/summary?range=30d&q=VCB+123&reconciliation=unmatched&status=PAID',
    );
  });

  it('preserves withdrawal context and opens one reversal dialog', () => {
    expect(
      payoutHref({
        pageSize: 20,
        range: '30d',
        reverseWithdrawalRequestId: 'withdrawal-1',
        view: 'withdrawals',
        withdrawalReconciliation: 'unmatched',
        withdrawalStatus: 'PAID',
      }),
    ).toBe(
      '/payouts?view=withdrawals&range=30d&reverseWithdrawalRequestId=withdrawal-1&withdrawalStatus=PAID&withdrawalReconciliation=unmatched',
    );
  });

  it('validates exact payout and withdrawal ids and builds independent record fetches', () => {
    const payoutHrefs = buildPayoutOperationsApiHrefs(buildPayoutFilters({
      payoutBatchId: 'batch-exact-1',
    }));
    const withdrawalFilters = buildPayoutFilters({
      withdrawalId: 'withdrawal-exact-1',
      withdrawalStatus: 'BANK_TRANSFER_PENDING',
    });
    const withdrawalHrefs = buildPayoutOperationsApiHrefs(withdrawalFilters);

    expect(payoutHrefs.selectedPayoutBatchHref).toBe('/admin/payout-batches/batch-exact-1');
    expect(withdrawalFilters.view).toBe('withdrawals');
    expect(withdrawalHrefs.selectedWithdrawalRequestHref).toBe(
      '/admin/provider-wallet/withdrawal-requests?range=all&take=1&id=withdrawal-exact-1',
    );
  });

  it('clears withdrawal filters without changing the current view or search', () => {
    const filters = buildPayoutFilters({
      q: 'VCB',
      range: '30d',
      view: 'withdrawals',
      withdrawalStatus: 'REVIEW_REQUIRED',
    });
    expect(payoutWithdrawalClearSavedViewHref(filters)).toBe(
      '/payouts?view=withdrawals&range=30d&q=VCB',
    );
  });

  it('rejects unsafe record ids and unknown filters', () => {
    const filters = buildPayoutFilters({
      editPayoutBatchId: '../bad',
      evidence: 'raw-sql',
      payoutBatchId: '../bad',
      queue: 'anything',
      period: '2026-13',
      returnTo: 'https://evil.example/finance-overview',
      reverseWithdrawalRequestId: '../bad',
      sort: 'random',
      withdrawalId: '../bad',
    });
    expect(filters.editPayoutBatchId).toBeNull();
    expect(filters.payoutBatchId).toBeNull();
    expect(filters.reverseWithdrawalRequestId).toBeNull();
    expect(filters.evidence).toBeNull();
    expect(filters.queue).toBeNull();
    expect(filters.period).toBeNull();
    expect(filters.returnTo).toBeNull();
    expect(filters.sort).toBe('newest');
    expect(filters.withdrawalId).toBeNull();
  });
});
