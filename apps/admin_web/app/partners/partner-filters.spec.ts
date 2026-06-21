import {
  buildPartnerListHref,
  buildProviderFilters,
  paginatePartnerRows,
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

  it.each<keyof ProviderFilters>(['location', 'security', 'bookingFlow', 'review'])(
    'opens advanced operational filters when %s is active',
    (key) => {
      const filters = { ...buildProviderFilters({}), [key]: 'active' };

      expect(partnerHasAdvancedOperationalFilters(filters)).toBe(true);
    },
  );

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
});
