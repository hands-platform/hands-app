import {
  buildPartnerDataHrefs,
  buildPartnerListHref,
  buildProviderActiveFilters,
  buildProviderFilters,
  paginatePartnerRows,
  partnerRowsPagination,
  partnerHasAdvancedOperationalFilters,
  partnerReviewFilterLabel,
  providerFilterDescription,
  type ProviderFilters,
} from './partner-filters';

describe('partner filters', () => {
  it('keeps advanced operational filters collapsed for the default partner list', () => {
    const filters = buildProviderFilters({});

    expect(partnerHasAdvancedOperationalFilters(filters)).toBe(false);
    expect(filters.page).toBe(1);
    expect(filters.pageSize).toBe(10);
  });

  it('normalizes partner pagination params and builds page hrefs', () => {
    const filters = buildProviderFilters({
      page: '2',
      pageSize: '25',
      providerStatus: 'ONLINE_AVAILABLE',
      review: 'unapproved',
      sort: 'wallet-debt',
    });

    expect(filters.page).toBe(2);
    expect(filters.pageSize).toBe(25);
    expect(buildPartnerListHref(filters, { page: 3 })).toBe(
      '/partners?providerStatus=ONLINE_AVAILABLE&review=unapproved&sort=wallet-debt&pageSize=25&page=3',
    );
    expect(buildPartnerListHref(filters, { review: 'unsettled' })).toBe(
      '/partners?providerStatus=ONLINE_AVAILABLE&review=unsettled&sort=wallet-debt&pageSize=25',
    );
  });

  it('accepts overview onlineStatus links as providerStatus aliases', () => {
    const filters = buildProviderFilters({
      onlineStatus: 'soon',
      review: 'marketplace-ready',
    });

    expect(filters.providerStatus).toBe('ONLINE_AVAILABLE_SOON');
    expect(buildPartnerListHref(filters)).toBe(
      '/partners?providerStatus=ONLINE_AVAILABLE_SOON&review=marketplace-ready',
    );
    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=50&providerStatus=ONLINE_AVAILABLE_SOON',
      listIsServerPaginated: false,
      summaryHref: '/admin/partners/list-providers/summary',
      summaryMatchesVisibleFilter: false,
    });
  });

  it('labels overview status and activity drilldowns for operators without exposing raw enum copy', () => {
    const filters = buildProviderFilters({
      activity: 'inactive-7d',
      onlineStatus: 'soon',
      review: 'marketplace-ready',
    });

    const labels = buildProviderActiveFilters(filters).map((filter) => filter.label);

    expect(labels).toContain('State: Available soon');
    expect(labels).toContain('Activity: Inactive 7D');
    expect(labels).not.toContain('Status: ONLINE_AVAILABLE_SOON');
  });

  it('keeps activity drilldown links as local bounded partner filters', () => {
    const filters = buildProviderFilters({
      activity: 'inactive-7d',
      review: 'marketplace-ready',
    });

    expect(filters.activity).toBe('inactive-7d');
    expect(buildPartnerListHref(filters)).toBe('/partners?activity=inactive-7d&review=marketplace-ready');
    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=50',
      listIsServerPaginated: false,
      summaryHref: '/admin/partners/list-providers/summary',
      summaryMatchesVisibleFilter: false,
    });
  });

  it('keeps partner directory hydration bounded while summary count is loaded separately', () => {
    const filters = buildProviderFilters({});

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary',
      summaryMatchesVisibleFilter: true,
    });
  });

  it('passes partner search and page offsets to the API without cumulative hydration', () => {
    const filters = buildProviderFilters({ page: '3', pageSize: '25', q: 'late arrival' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=25&skip=50&q=late+arrival',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?q=late+arrival',
      summaryMatchesVisibleFilter: true,
    });
  });

  it('pushes name sorting to the API without cumulative hydration', () => {
    const filters = buildProviderFilters({ page: '2', sort: 'name' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&skip=10&sort=name',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary',
      summaryMatchesVisibleFilter: true,
    });
  });

  it('pushes simple provider state filters to the bounded API list and summary', () => {
    const filters = buildProviderFilters({
      kyc: 'APPROVED',
      providerStatus: 'ONLINE_AVAILABLE',
      verification: 'SUBMITTED',
    });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref:
        '/admin/partners/list-providers?take=10&verification=SUBMITTED&providerStatus=ONLINE_AVAILABLE&kyc=APPROVED',
      listIsServerPaginated: true,
      summaryHref:
        '/admin/partners/list-providers/summary?verification=SUBMITTED&providerStatus=ONLINE_AVAILABLE&kyc=APPROVED',
      summaryMatchesVisibleFilter: true,
    });
  });

  it('keeps calculated partner filters on the local bounded hydration path', () => {
    const filters = buildProviderFilters({ location: 'stale' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=50',
      listIsServerPaginated: false,
      summaryHref: '/admin/partners/list-providers/summary',
      summaryMatchesVisibleFilter: false,
    });
  });

  it.each(['active-booking', 'first-pick', 'marketplace-joined', 'final-partner', 'chat-live', 'chat-missing', 'completed-work', 'no-work'])(
    'pushes the %s booking flow filter to the bounded API list',
    (bookingFlow) => {
      const filters = buildProviderFilters({ bookingFlow });

      expect(buildPartnerDataHrefs(filters)).toEqual({
        listHref: `/admin/partners/list-providers?take=10&bookingFlow=${bookingFlow}`,
        listIsServerPaginated: true,
        summaryHref: `/admin/partners/list-providers/summary?bookingFlow=${bookingFlow}`,
        summaryMatchesVisibleFilter: true,
      });
    },
  );

  it('pushes the primary unapproved partner review lane to the bounded API list', () => {
    const filters = buildProviderFilters({ review: 'unapproved' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&review=unapproved',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=unapproved',
      summaryMatchesVisibleFilter: true,
    });
  });

  it('pushes the primary unsettled partner review lane to the bounded API list', () => {
    const filters = buildProviderFilters({ review: 'unsettled' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&review=unsettled',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=unsettled',
      summaryMatchesVisibleFilter: true,
    });
  });

  it('pushes the blocked partner review lane to the bounded API list', () => {
    const filters = buildProviderFilters({ review: 'blocked' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&review=blocked',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=blocked',
      summaryMatchesVisibleFilter: true,
    });
  });

  it.each(['documents', 'public-media', 'bank'])(
    'pushes the %s partner review lane to the bounded API list',
    (review) => {
      const filters = buildProviderFilters({ review });

      expect(buildPartnerDataHrefs(filters)).toEqual({
        listHref: `/admin/partners/list-providers?take=10&review=${review}`,
        listIsServerPaginated: true,
        summaryHref: `/admin/partners/list-providers/summary?review=${review}`,
        summaryMatchesVisibleFilter: true,
      });
    },
  );

  it.each(['tax', 'reports'])('pushes the %s partner review lane to the bounded API list', (review) => {
    const filters = buildProviderFilters({ review });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: `/admin/partners/list-providers?take=10&review=${review}`,
      listIsServerPaginated: true,
      summaryHref: `/admin/partners/list-providers/summary?review=${review}`,
      summaryMatchesVisibleFilter: true,
    });
  });

  it.each(['kyc', 'push', 'cash-debt'])(
    'pushes the %s partner review lane to the bounded API list',
    (review) => {
      const filters = buildProviderFilters({ review });

      expect(buildPartnerDataHrefs(filters)).toEqual({
        listHref: `/admin/partners/list-providers?take=10&review=${review}`,
        listIsServerPaginated: true,
        summaryHref: `/admin/partners/list-providers/summary?review=${review}`,
        summaryMatchesVisibleFilter: true,
      });
    },
  );

  it('caps local partner filter hydration to the API provider list window', () => {
    const filters = buildProviderFilters({ page: '8', pageSize: '25', review: 'marketplace-ready' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=50',
      listIsServerPaginated: false,
      summaryHref: '/admin/partners/list-providers/summary',
      summaryMatchesVisibleFilter: false,
    });
  });

  it('paginates partner rows with safe bounds', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const filters = { ...buildProviderFilters({ page: '2' }), pageSize: 10 };

    expect(paginatePartnerRows(rows, filters)).toMatchObject({
      from: 11,
      page: 2,
      pageSize: 10,
      rows: ['k', 'l'],
      to: 12,
      totalPages: 2,
      totalRows: 12,
    });
    expect(paginatePartnerRows(rows, { ...filters, page: 99 }).page).toBe(2);
  });

  it('keeps server-paginated partner rows as the visible rows while using summary totals', () => {
    const rows = ['p51', 'p52'];
    const filters = { ...buildProviderFilters({ page: '3', pageSize: '25' }) };

    expect(partnerRowsPagination(rows, filters, { serverPaginated: true, totalRows: 62 })).toMatchObject({
      from: 51,
      page: 3,
      pageSize: 25,
      rows,
      to: 52,
      totalPages: 3,
      totalRows: 62,
    });
  });

  it.each<keyof ProviderFilters>(['location', 'security'])(
    'opens advanced operational filters when %s is active',
    (key) => {
      const filters = { ...buildProviderFilters({}), [key]: 'active' };

      expect(partnerHasAdvancedOperationalFilters(filters)).toBe(true);
    },
  );

  it('keeps primary partner pages compact while opening non-primary review lanes', () => {
    expect(partnerHasAdvancedOperationalFilters(buildProviderFilters({ review: 'unapproved' }))).toBe(false);
    expect(partnerHasAdvancedOperationalFilters(buildProviderFilters({ review: 'unsettled' }))).toBe(false);
    expect(partnerHasAdvancedOperationalFilters(buildProviderFilters({ review: 'marketplace-ready' }))).toBe(
      true,
    );
  });

  it('keeps unapproved review copy focused on Level 2 readiness, not bank or tax', () => {
    const description = providerFilterDescription('review', 'unapproved');

    expect(description).toContain('KYC');
    expect(description).toContain('public media');
    expect(description).toContain('hold');
    expect(description).not.toContain('bank');
    expect(description).not.toContain('tax');
  });

  it('keeps direct request held copy free of wallet bank approval gates', () => {
    const description = providerFilterDescription('review', 'acceptance-blocked');

    expect(description).toContain('identity');
    expect(description).toContain('device');
    expect(description).toContain('location');
    expect(description).not.toContain('bank');
  });

  it('labels legacy marketplace-blocked review values as dispatch repair', () => {
    expect(providerFilterDescription('review', 'marketplace-blocked')).toContain('Dispatch repair');
    expect(providerFilterDescription('review', 'marketplace-blocked')).not.toContain('Marketplace repair');
  });

  it('labels bank and tax review lanes as non-Level-2 gates', () => {
    expect(partnerReviewFilterLabel('bank')).toBe('Withdrawal detail review');
    expect(partnerReviewFilterLabel('tax')).toBe('Tax profile optional');
  });

  it('uses payout profile wording for first earning payout review lanes', () => {
    expect(partnerReviewFilterLabel('payout-setup')).toBe('First earning payout profile');
    expect(providerFilterDescription('review', 'payout-setup')).toContain('payout profile');
    expect(providerFilterDescription('review', 'payout-setup')).not.toContain('payout setup');
  });
});
