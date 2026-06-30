import { buildPayoutFilters, buildPayoutOperationsApiHrefs } from './payouts-page-model';

describe('payouts page model', () => {
  it('defaults payout operations filters to today and bounded API hrefs', () => {
    const defaultFilters = buildPayoutFilters({});
    const rangeFilters = buildPayoutFilters({ range: '30d' });

    expect(defaultFilters.range).toBe('today');
    expect(defaultFilters.page).toBe(1);
    expect(defaultFilters.pageSize).toBe(10);
    expect(defaultFilters.withdrawalStatus).toBe('REVIEW_REQUIRED');
    expect(buildPayoutFilters({ range: 'all' }).range).toBe('all');
    expect(buildPayoutOperationsApiHrefs(rangeFilters)).toEqual({
      earningsHref: '/admin/earnings?range=30d&take=10',
      operationalPolicyHref:
        '/admin/operational-policy?keys=payout.batch_cycle_policy%2Ccash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters',
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=10',
      payoutBatchSummaryHref: '/admin/payout-batches/summary?range=30d',
      providerWalletWithdrawalRequestsHref:
        '/admin/provider-wallet/withdrawal-requests?range=30d&take=10&status=REVIEW_REQUIRED',
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
      earningsHref: '/admin/earnings?range=7d&take=10',
      payoutBatchesHref: '/admin/payout-batches?range=7d&take=10',
      providerWalletWithdrawalRequestsHref:
        '/admin/provider-wallet/withdrawal-requests?range=7d&take=10&status=BANK_TRANSFER_PENDING',
    });
  });

  it('turns payout list page state into bounded API skip offsets', () => {
    const filters = buildPayoutFilters({
      page: '3',
      pageSize: '25',
      range: '30d',
      withdrawalStatus: 'REVIEW_REQUIRED',
    });

    expect(filters).toMatchObject({
      page: 3,
      pageSize: 25,
      range: '30d',
      withdrawalStatus: 'REVIEW_REQUIRED',
    });
    expect(buildPayoutOperationsApiHrefs(filters)).toMatchObject({
      earningsHref: '/admin/earnings?range=30d&take=25&skip=50',
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=25&skip=50',
      providerWalletWithdrawalRequestsHref:
        '/admin/provider-wallet/withdrawal-requests?range=30d&take=25&skip=50&status=REVIEW_REQUIRED',
    });
  });
});
