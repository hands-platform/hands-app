import { buildPayoutFilters, buildPayoutOperationsApiHrefs } from './payouts-page-model';

describe('payouts page model', () => {
  it('defaults payout operations filters to today and bounded API hrefs', () => {
    const defaultFilters = buildPayoutFilters({});
    const rangeFilters = buildPayoutFilters({ range: '30d' });

    expect(defaultFilters.range).toBe('today');
    expect(buildPayoutFilters({ range: 'all' }).range).toBe('all');
    expect(buildPayoutOperationsApiHrefs(rangeFilters)).toEqual({
      earningsHref: '/admin/earnings?range=30d&take=10',
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=10',
    });
  });
});
