import {
  buildPartnerControlActiveFilters,
  buildPartnerControlFilters,
  isPartnerControlCashDebtReview,
  partnerControlListHref,
} from './partner-control-page-filters';

describe('partner control page filters', () => {
  it('reads the cash debt review lane from dashboard links', () => {
    const filters = buildPartnerControlFilters({
      q: '  Linh ',
      review: 'cash-debt',
      status: 'OPEN',
    });

    expect(filters).toMatchObject({
      q: 'linh',
      review: 'cash-debt',
      status: 'OPEN',
    });
    expect(isPartnerControlCashDebtReview(filters)).toBe(true);
  });

  it('surfaces the cash debt lane as an active operator filter', () => {
    const activeFilters = buildPartnerControlActiveFilters(
      buildPartnerControlFilters({ review: 'cash-debt' }),
    );

    expect(activeFilters).toContainEqual({
      kind: 'review',
      value: 'cash-debt',
      label: 'Review: cash debt',
      description:
        'Partner controls are narrowed to Partners with negative wallet debt from cash booking commission.',
    });
  });

  it('preserves the review lane across paged report and account control lists', () => {
    expect(
      partnerControlListHref(
        {
          details: 'reports',
          q: 'linh',
          review: 'cash-debt',
          reportPage: '3',
          sanctionPage: '2',
        },
        'reportPage',
        1,
      ),
    ).toBe('/partner-controls?details=reports&q=linh&review=cash-debt&sanctionPage=2');

    expect(
      partnerControlListHref(
        {
          q: 'linh',
          review: 'cash-debt',
          reportPage: '3',
          sanctionPage: '2',
        },
        'sanctionPage',
        4,
      ),
    ).toBe('/partner-controls?q=linh&review=cash-debt&reportPage=3&sanctionPage=4');
  });
});
