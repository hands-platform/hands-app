import {
  buildProviderFilters,
  partnerHasAdvancedOperationalFilters,
  providerFilterDescription,
  type ProviderFilters,
} from './partner-filters';

describe('partner filters', () => {
  it('keeps advanced operational filters collapsed for the default partner list', () => {
    const filters = buildProviderFilters({});

    expect(partnerHasAdvancedOperationalFilters(filters)).toBe(false);
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
});
