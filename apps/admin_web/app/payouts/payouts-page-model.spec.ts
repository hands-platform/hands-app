import { buildPayoutFilters, buildPayoutOperationsApiHrefs } from './payouts-page-model';

describe('payouts page model', () => {
  it('defaults payout operations filters to today and bounded API hrefs', () => {
    const defaultFilters = buildPayoutFilters({});
    const rangeFilters = buildPayoutFilters({ range: '30d' });

    expect(defaultFilters.range).toBe('today');
    expect(buildPayoutFilters({ range: 'all' }).range).toBe('all');
    expect(buildPayoutOperationsApiHrefs(rangeFilters)).toEqual({
      earningsHref: '/admin/earnings?range=30d&take=10',
      operationalPolicyHref:
        '/admin/operational-policy?keys=payout.batch_cycle_policy%2Ccash.settlement_clearance_policy%2Cwallet.negative_balance_gate%2Cmatching.marketplace_partner_radius_meters%2Cmatching.backup_provider_radius_meters',
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=10',
      payoutBatchSummaryHref: '/admin/payout-batches/summary?range=30d',
    });
  });
});
