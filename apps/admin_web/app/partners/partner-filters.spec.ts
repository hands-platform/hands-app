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
    expect(filters.sort).toBe('newest');
    expect(filters.providerStatus).toBe('');
    expect(buildPartnerListHref(filters, { page: 3 })).toBe(
      '/partners?review=unapproved&pageSize=25&page=3',
    );
    expect(buildPartnerListHref(filters, { review: 'unsettled' })).toBe(
      '/partners?review=unsettled&pageSize=25',
    );
  });

  it('accepts overview onlineStatus links as providerStatus aliases', () => {
    const filters = buildProviderFilters({
      onlineStatus: 'soon',
      review: 'marketplace-ready',
    });

    expect(filters.providerStatus).toBe('ONLINE_AVAILABLE_SOON');
    expect(buildPartnerListHref(filters)).toBe(
      '/partners?providerStatus=ONLINE_AVAILABLE_SOON&review=ready-now',
    );
    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&providerStatus=ONLINE_AVAILABLE_SOON&review=ready-now',
      listIsServerPaginated: true,
      summaryHref:
        '/admin/partners/list-providers/summary?providerStatus=ONLINE_AVAILABLE_SOON&review=ready-now',
      summaryMatchesVisibleFilter: true,
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

  it('keeps Partner Operations city, service, and wallet scope in list and summary queries', () => {
    const filters = buildProviderFilters({
      city: 'hcm',
      onlineStatus: 'available',
      serviceId: 'service-1',
      verification: 'APPROVED',
      walletStatus: 'negative',
    });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref:
        '/admin/partners/list-providers?take=10&verification=APPROVED&providerStatus=ONLINE_AVAILABLE&city=hcm&serviceId=service-1&walletStatus=negative',
      listIsServerPaginated: true,
      summaryHref:
        '/admin/partners/list-providers/summary?verification=APPROVED&providerStatus=ONLINE_AVAILABLE&city=hcm&serviceId=service-1&walletStatus=negative',
      summaryMatchesVisibleFilter: true,
    });
    expect(buildPartnerListHref(filters)).toBe(
      '/partners?city=hcm&verification=APPROVED&providerStatus=ONLINE_AVAILABLE&serviceId=service-1&walletStatus=negative',
    );
    expect(buildProviderActiveFilters(filters).map((filter) => filter.kind)).toEqual(
      expect.arrayContaining(['city', 'serviceId', 'walletStatus']),
    );
  });

  it('pushes factual activity and legacy readiness drilldowns to the server', () => {
    const filters = buildProviderFilters({
      activity: 'inactive-7d',
      review: 'marketplace-ready',
    });

    expect(filters.activity).toBe('inactive-7d');
    expect(buildPartnerListHref(filters)).toBe('/partners?activity=inactive-7d&review=ready-now');
    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&activity=inactive-7d&review=ready-now',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?activity=inactive-7d&review=ready-now',
      summaryMatchesVisibleFilter: true,
    });
  });

  it('keeps approval ageing on the server-paginated partner queue', () => {
    const filters = buildProviderFilters({
      age: 'over-24h',
      page: '2',
      review: 'approval-pending',
      sla: 'overdue',
      sort: 'oldest',
    });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref:
        '/admin/partners/list-providers?take=10&skip=10&age=over-24h&sla=overdue&sort=oldest&review=approval-pending',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?age=over-24h&sla=overdue&review=approval-pending',
      summaryMatchesVisibleFilter: true,
    });
  });

  it('keeps only dedicated approval filters and sends them to list and summary APIs', () => {
    const filters = buildProviderFilters({
      activity: 'app-inactive-7d',
      age: '4-24h',
      approvalMissing: 'identity-documents',
      approvalRisk: 'rejected-evidence',
      kyc: 'APPROVED',
      providerStatus: 'OFFLINE',
      review: 'approval-pending',
      sort: 'wallet-debt',
    });

    expect(filters).toMatchObject({
      activity: '',
      approvalMissing: 'identity-documents',
      approvalRisk: 'rejected-evidence',
      kyc: '',
      providerStatus: '',
      sort: 'oldest',
    });
    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref:
        '/admin/partners/list-providers?take=10&approvalMissing=identity-documents&approvalRisk=rejected-evidence&age=4-24h&sort=oldest&review=approval-pending',
      listIsServerPaginated: true,
      summaryHref:
        '/admin/partners/list-providers/summary?approvalMissing=identity-documents&approvalRisk=rejected-evidence&age=4-24h&review=approval-pending',
      summaryMatchesVisibleFilter: true,
    });
    expect(buildPartnerListHref(filters)).toBe(
      '/partners?age=4-24h&approvalMissing=identity-documents&approvalRisk=rejected-evidence&review=approval-pending&sort=oldest',
    );
  });

  it.each(['app-active-7d', 'app-inactive-7d', 'app-not-tracked'])(
    'pushes the %s Partner App activity filter to the paginated API list and summary',
    (activity) => {
      const filters = buildProviderFilters({ activity, page: '2' });

      expect(filters.activity).toBe(activity);
      expect(buildPartnerDataHrefs(filters)).toEqual({
        listHref: `/admin/partners/list-providers?take=10&skip=10&activity=${activity}`,
        listIsServerPaginated: true,
        summaryHref: `/admin/partners/list-providers/summary?activity=${activity}`,
        summaryMatchesVisibleFilter: true,
      });
    },
  );

  it.each(['never-online', 'inactive-7d', 'inactive-30d'])(
    'pushes the %s factual activity filter to the paginated API list and summary',
    (activity) => {
      const filters = buildProviderFilters({ activity, page: '2' });

      expect(buildPartnerDataHrefs(filters)).toEqual({
        listHref: `/admin/partners/list-providers?take=10&skip=10&activity=${activity}`,
        listIsServerPaginated: true,
        summaryHref: `/admin/partners/list-providers/summary?activity=${activity}`,
        summaryMatchesVisibleFilter: true,
      });
    },
  );

  it.each(['high-cancellation', 'no-show-risk', 'quality-risk', 'quality-all'])(
    'keeps the %s review lane server-paginated with its Vietnam-time quality range',
    (review) => {
      const filters = buildProviderFilters({ page: '2', qualityRange: '7d', review });

      expect(buildPartnerDataHrefs(filters)).toEqual({
        listHref: `/admin/partners/list-providers?take=10&skip=10&qualityRange=7d&review=${review}`,
        listIsServerPaginated: true,
        summaryHref: `/admin/partners/list-providers/summary?qualityRange=7d&review=${review}`,
        summaryMatchesVisibleFilter: true,
      });
      expect(buildPartnerListHref(filters)).toBe(`/partners?qualityRange=7d&review=${review}`);
    },
  );

  it.each(['payout-blocked', 'tax-info-missing'])(
    'keeps the %s finance review lane server-paginated without an unrelated quality range',
    (review) => {
      const filters = buildProviderFilters({ review });

      expect(buildPartnerDataHrefs(filters)).toEqual({
        listHref: `/admin/partners/list-providers?take=10&review=${review}`,
        listIsServerPaginated: true,
        summaryHref: `/admin/partners/list-providers/summary?review=${review}`,
        summaryMatchesVisibleFilter: true,
      });
      expect(buildPartnerListHref(filters)).toBe(`/partners?review=${review}`);
    },
  );

  it('keeps the exact approval-incomplete overview drilldown server-paginated', () => {
    const filters = buildProviderFilters({ review: 'approval-incomplete' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&review=approval-incomplete',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=approval-incomplete',
      summaryMatchesVisibleFilter: true,
    });
    expect(buildPartnerListHref(filters)).toBe('/partners?review=approval-incomplete');
  });

  it('keeps the exact ready-now overview drilldown server-paginated', () => {
    const filters = buildProviderFilters({ review: 'ready-now' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&review=ready-now',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=ready-now',
      summaryMatchesVisibleFilter: true,
    });
    expect(buildPartnerListHref(filters)).toBe('/partners?review=ready-now');
  });

  it('keeps the exact available-but-blocked overview drilldown server-paginated', () => {
    const filters = buildProviderFilters({ review: 'available-blocked' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&review=available-blocked',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=available-blocked',
      summaryMatchesVisibleFilter: true,
    });
    expect(buildPartnerListHref(filters)).toBe('/partners?review=available-blocked');
    expect(buildProviderActiveFilters(filters).map((filter) => filter.label)).toContain(
      'Review: Available but blocked',
    );
  });

  it.each([
    ['available-blocked-location', 'Stale location'],
    ['available-blocked-service', 'No active service'],
    ['available-blocked-wallet', 'Negative wallet while available'],
    ['available-blocked-account', 'Account blocked while available'],
  ])('keeps the exact %s blocker drilldown server-paginated', (review, label) => {
    const filters = buildProviderFilters({ review });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: `/admin/partners/list-providers?take=10&review=${review}`,
      listIsServerPaginated: true,
      summaryHref: `/admin/partners/list-providers/summary?review=${review}`,
      summaryMatchesVisibleFilter: true,
    });
    expect(buildPartnerListHref(filters)).toBe(`/partners?review=${review}`);
    expect(buildProviderActiveFilters(filters).map((filter) => filter.label)).toContain(`Review: ${label}`);
  });

  it.each([
    ['customer-visibility-location', 'Customer visibility: location'],
    ['customer-visibility-service', 'Customer visibility: service'],
    ['customer-visibility-bank', 'Customer visibility: bank'],
    ['customer-visibility-documents', 'Customer visibility: documents'],
  ])('keeps the exact %s Customer App blocker server-paginated', (review, label) => {
    const filters = buildProviderFilters({ page: '3', pageSize: '10', review, sort: 'oldest' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: `/admin/partners/list-providers?take=10&skip=20&sort=oldest&review=${review}`,
      listIsServerPaginated: true,
      summaryHref: `/admin/partners/list-providers/summary?review=${review}`,
      summaryMatchesVisibleFilter: true,
    });
    expect(buildPartnerListHref(filters)).toBe(`/partners?review=${review}&sort=oldest`);
    expect(buildProviderActiveFilters(filters).map((filter) => filter.label)).toContain(`Review: ${label}`);
    expect(providerFilterDescription('review', review)).toContain('hidden from the Customer App');
  });

  it('keeps the exact Customer App visible-now queue server-paginated', () => {
    const filters = buildProviderFilters({
      page: '2',
      pageSize: '10',
      review: 'customer-visible-now',
    });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&skip=10&review=customer-visible-now',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=customer-visible-now',
      summaryMatchesVisibleFilter: true,
    });
    expect(buildProviderActiveFilters(filters).map((filter) => filter.label)).toContain(
      'Review: Customer App visible now',
    );
    expect(providerFilterDescription('review', 'customer-visible-now')).toContain(
      'currently visible in Customer App discovery',
    );
  });

  it('describes stale-location review using the saved matching policy instead of a hardcoded age', () => {
    const description = providerFilterDescription('review', 'available-blocked-location');

    expect(description).toContain('current matching freshness policy');
    expect(description).not.toContain('30 minutes');
  });

  it('normalizes legacy readiness drilldowns into server-backed review filters', () => {
    const filters = buildProviderFilters({
      readiness: 'ready',
      sort: 'wallet-debt',
    });
    const unsafeFilters = buildProviderFilters({ readiness: 'DROP TABLE partners' });

    expect(filters.readiness).toBe('');
    expect(filters.review).toBe('ready-now');
    expect(unsafeFilters.readiness).toBe('');
    expect(buildProviderActiveFilters(filters).map((filter) => filter.label)).toContain('Review: Ready now');
    expect(buildPartnerListHref(filters, { sort: 'last-work' })).toBe(
      '/partners?review=ready-now',
    );
    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&review=ready-now',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=ready-now',
      summaryMatchesVisibleFilter: true,
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

  it('drops unsupported local-only query filters instead of filtering one fetched page', () => {
    const filters = buildProviderFilters({ location: 'stale' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary',
      summaryMatchesVisibleFilter: true,
    });
  });

  it.each([
    'active-booking',
    'first-pick',
    'marketplace-joined',
    'final-partner',
    'chat-live',
    'chat-missing',
    'completed-work',
    'no-work',
  ])('pushes the %s booking flow filter to the bounded API list', (bookingFlow) => {
    const filters = buildProviderFilters({ bookingFlow });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: `/admin/partners/list-providers?take=10&bookingFlow=${bookingFlow}`,
      listIsServerPaginated: true,
      summaryHref: `/admin/partners/list-providers/summary?bookingFlow=${bookingFlow}`,
      summaryMatchesVisibleFilter: true,
    });
  });

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

  it('server-paginates legacy marketplace-ready links across the full population', () => {
    const filters = buildProviderFilters({ page: '8', pageSize: '25', review: 'marketplace-ready' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=25&skip=175&review=ready-now',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=ready-now',
      summaryMatchesVisibleFilter: true,
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

  it.each<keyof ProviderFilters>(['location', 'security', 'readiness'])(
    'opens advanced operational filters when %s is active',
    (key) => {
      const filters = { ...buildProviderFilters({}), [key]: 'active' };

      expect(partnerHasAdvancedOperationalFilters(filters)).toBe(true);
    },
  );

  it('keeps the always-visible app activity filter out of the advanced disclosure state', () => {
    expect(partnerHasAdvancedOperationalFilters(buildProviderFilters({ activity: 'app-inactive-7d' }))).toBe(
      false,
    );
  });

  it('pushes the exact approval-pending lane to the bounded API list', () => {
    const filters = buildProviderFilters({ review: 'approval-pending' });

    expect(buildPartnerDataHrefs(filters)).toEqual({
      listHref: '/admin/partners/list-providers?take=10&sort=oldest&review=approval-pending',
      listIsServerPaginated: true,
      summaryHref: '/admin/partners/list-providers/summary?review=approval-pending',
      summaryMatchesVisibleFilter: true,
    });
    expect(buildPartnerListHref(filters)).toBe('/partners?review=approval-pending&sort=oldest');
    expect(providerFilterDescription('review', 'approval-pending')).toContain(
      'waiting for an admin decision',
    );
  });

  it('keeps primary and normalized legacy partner pages compact', () => {
    expect(partnerHasAdvancedOperationalFilters(buildProviderFilters({ review: 'unapproved' }))).toBe(false);
    expect(partnerHasAdvancedOperationalFilters(buildProviderFilters({ review: 'unsettled' }))).toBe(false);
    expect(partnerHasAdvancedOperationalFilters(buildProviderFilters({ review: 'marketplace-ready' }))).toBe(false);
  });

  it('keeps onboarding blocker copy focused on actionable evidence, not bank or tax', () => {
    const description = providerFilterDescription('review', 'unapproved');

    expect(description).toContain('KYC');
    expect(description).toContain('required evidence');
    expect(description).toContain('hold');
    expect(description).not.toContain('bank');
    expect(description).not.toContain('tax');
  });

  it('drops unsupported queue age and unrelated queue filters from onboarding and wallet debt', () => {
    const onboarding = buildProviderFilters({
      age: 'over-24h',
      bookingFlow: 'completed-work',
      providerStatus: 'ONLINE_AVAILABLE',
      review: 'unapproved',
      sort: 'oldest',
    });
    const walletDebt = buildProviderFilters({
      activity: 'app-active-7d',
      age: 'over-24h',
      kyc: 'PENDING',
      review: 'unsettled',
      verification: 'SUBMITTED',
    });

    expect(onboarding).toMatchObject({ age: 'all', bookingFlow: '', providerStatus: '', sort: 'newest' });
    expect(buildPartnerListHref(onboarding)).toBe('/partners?review=unapproved');
    expect(walletDebt).toMatchObject({ activity: '', age: 'all', kyc: '', verification: '' });
    expect(buildPartnerListHref(walletDebt)).toBe('/partners?review=unsettled');
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
