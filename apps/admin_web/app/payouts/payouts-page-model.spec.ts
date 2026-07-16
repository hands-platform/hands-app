import { buildPayoutFilters, buildPayoutOperationsApiHrefs, payoutHref } from './payouts-page-model';

describe('payouts page model', () => {
  it('defaults payout operations filters to today and bounded API hrefs', () => {
    const defaultFilters = buildPayoutFilters({});
    const rangeFilters = buildPayoutFilters({ details: 'all', range: '30d' });

    expect(defaultFilters.details).toBe('operations');
    expect(defaultFilters.range).toBe('today');
    expect(defaultFilters.page).toBe(1);
    expect(defaultFilters.pageSize).toBe(10);
    expect(defaultFilters.withdrawalPage).toBe(1);
    expect(defaultFilters.withdrawalReconciliation).toBeNull();
    expect(defaultFilters.withdrawalStatus).toBe('REVIEW_REQUIRED');
    expect(defaultFilters.workspace).toBe('operations');
    expect(rangeFilters.workspace).toBe('policy');
    expect(buildPayoutFilters({ range: 'all' }).range).toBe('all');
    expect(buildPayoutOperationsApiHrefs(rangeFilters)).toEqual({
      earningsHref: '/admin/earnings?range=30d&take=10',
      operationalPolicyHref:
        '/admin/operational-policy?keys=payout.batch_cycle_policy%2Ccash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters',
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=10',
      payoutBatchSummaryHref: '/admin/payout-batches/summary?range=30d',
      providerWalletWithdrawalRequestsHref: null,
      providerWalletWithdrawalRequestSummaryHref: null,
    });
  });

  it('builds a separately paginated paid withdrawal reconciliation queue', () => {
    const filters = buildPayoutFilters({
      page: '4',
      range: '30d',
      withdrawalPage: '3',
      withdrawalReconciliation: 'unmatched',
    });

    expect(filters).toMatchObject({
      page: 4,
      withdrawalPage: 3,
      withdrawalReconciliation: 'unmatched',
      withdrawalStatus: 'PAID',
    });
    expect(buildPayoutOperationsApiHrefs(filters)).toMatchObject({
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=10&skip=30',
      providerWalletWithdrawalRequestsHref:
        '/admin/provider-wallet/withdrawal-requests?range=30d&take=10&skip=20&status=PAID&reconciliation=unmatched',
    });
  });

  it('passes withdrawal status filters only to partner wallet withdrawal requests', () => {
    const filters = buildPayoutFilters({
      range: '7d',
      withdrawalStatus: 'BANK_TRANSFER_PENDING',
    });

    expect(filters).toMatchObject({
      range: '7d',
      withdrawalStatus: 'BANK_TRANSFER_PENDING',
    });
    expect(buildPayoutOperationsApiHrefs(filters)).toMatchObject({
      earningsHref: null,
      payoutBatchesHref: '/admin/payout-batches?range=7d&take=10',
      providerWalletWithdrawalRequestsHref:
        '/admin/provider-wallet/withdrawal-requests?range=7d&take=10&status=BANK_TRANSFER_PENDING',
    });
  });

  it('turns payout list page state into bounded API skip offsets', () => {
    const filters = buildPayoutFilters({
      details: 'all',
      page: '3',
      pageSize: '25',
      range: '30d',
      view: 'records',
      withdrawalStatus: 'REVIEW_REQUIRED',
    });

    expect(filters).toMatchObject({
      page: 3,
      pageSize: 25,
      range: '30d',
      withdrawalStatus: 'REVIEW_REQUIRED',
    });
    expect(buildPayoutOperationsApiHrefs(filters)).toMatchObject({
      earningsHref: null,
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=25&skip=50',
      providerWalletWithdrawalRequestsHref:
        '/admin/provider-wallet/withdrawal-requests?range=30d&take=25&status=REVIEW_REQUIRED',
    });
  });

  it('keeps evidence-only API reads and pagination links behind the full details mode', () => {
    const operationsFilters = buildPayoutFilters({ range: 'today' });
    const apiHrefs = buildPayoutOperationsApiHrefs(operationsFilters);

    expect(apiHrefs.earningsHref).toBeNull();
    expect(apiHrefs.operationalPolicyHref).toBeNull();
    expect(
      payoutHref({
        details: 'all',
        page: 2,
        pageSize: 25,
        range: '30d',
        withdrawalPage: 3,
        withdrawalStatus: 'PAID',
      }),
    ).toBe('/payouts?details=all&range=30d&withdrawalStatus=PAID&withdrawalPage=3&pageSize=25&page=2');
  });

  it('separates policy, audit, and record evidence reads', () => {
    const policyFilters = buildPayoutFilters({ details: 'all', range: '30d' });
    const auditFilters = buildPayoutFilters({ details: 'all', range: '30d', view: 'audit' });
    const recordFilters = buildPayoutFilters({ details: 'all', range: '30d', view: 'records' });

    expect(policyFilters.workspace).toBe('policy');
    expect(auditFilters.workspace).toBe('audit');
    expect(recordFilters.workspace).toBe('records');
    expect(buildPayoutOperationsApiHrefs(policyFilters)).toMatchObject({
      earningsHref: '/admin/earnings?range=30d&take=10',
      operationalPolicyHref: expect.stringContaining('/admin/operational-policy?keys='),
      providerWalletWithdrawalRequestsHref: null,
    });
    expect(buildPayoutOperationsApiHrefs(auditFilters)).toMatchObject({
      earningsHref: '/admin/earnings?range=30d&take=10',
      operationalPolicyHref: null,
      providerWalletWithdrawalRequestsHref: null,
    });
    expect(buildPayoutOperationsApiHrefs(recordFilters)).toMatchObject({
      earningsHref: null,
      operationalPolicyHref: null,
      providerWalletWithdrawalRequestsHref:
        '/admin/provider-wallet/withdrawal-requests?range=30d&take=10&status=REVIEW_REQUIRED',
    });
    expect(payoutHref({ range: '30d', workspace: 'audit' })).toBe(
      '/payouts?details=all&view=audit&range=30d',
    );
    expect(payoutHref({ range: '30d', workspace: 'records' })).toBe(
      '/payouts?details=all&view=records&range=30d',
    );
  });
});
