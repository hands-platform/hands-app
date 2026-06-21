import { renderToStaticMarkup } from 'react-dom/server';

import { buildProviderActiveFilters, buildProviderFilters, type ProviderFilters } from './partner-filters';
import { PartnerFilterBoard } from './partner-filter-board';

describe('PartnerFilterBoard', () => {
  it('renders a compact Vuexy-style partner filter panel', () => {
    const filters = providerFilters({
      providerStatus: 'ONLINE_AVAILABLE',
      q: 'linh',
      review: 'unapproved',
      sort: 'booking-count',
    });
    const rendered = renderToStaticMarkup(
      PartnerFilterBoard({
        activeFilters: buildProviderActiveFilters(filters),
        csvDownloadName: 'hands-partners-review-unapproved.csv',
        csvHref: 'data:text/csv,partner',
        filteredCount: 4,
        filters,
        locationFreshnessLabel: 'Location freshness: 30m',
        showAdvancedFilters: false,
        totalCount: 12,
      }),
    );

    expect(rendered).toContain('card admin-filter-panel vuexy-partner-filter-card admin-mb-16');
    expect(rendered).toContain('Filters');
    expect(rendered).toContain('4 of 12');
    expect(rendered).toContain('vuexy-partner-filter-grid');
    expect(rendered).toContain('vuexy-partner-filter-group is-primary');
    expect(rendered).toContain('Search Partner');
    expect(rendered).toContain('State');
    expect(rendered).toContain('Verification');
    expect(rendered).toContain('KYC');
    expect(rendered).toContain('Partner sort');
    expect(rendered).toContain('Checklist');
    expect(rendered).toContain('Last work');
    expect(rendered).toContain('Bookings');
    expect(rendered).toContain('Completed');
    expect(rendered).toContain('Revenue');
    expect(rendered).toContain('Wallet debt');
    expect(rendered).toContain('More filters');
    expect(rendered).toContain('Location');
    expect(rendered).toContain('Device/session');
    expect(rendered).toContain('Booking flow');
    expect(rendered).toContain('Review lane');
    expect(rendered).toContain('Export');
    expect(rendered).toContain('Apply');
    expect(rendered).toContain('Location freshness: 30m');
    expect(rendered).toContain('Search: linh');
    expect(rendered).toContain('Status: ONLINE_AVAILABLE');
    expect(rendered).toContain('Review: Unapproved Partners');
    expect(rendered).toContain('Sort: booking count');
    expect(rendered).toContain('type="hidden" name="sort" value="booking-count"');
    expect(rendered).toContain(
      'href="/partners?q=linh&amp;providerStatus=ONLINE_AVAILABLE&amp;review=unapproved&amp;sort=last-work"',
    );
    expect(rendered).toContain(
      'href="/partners?q=linh&amp;providerStatus=ONLINE_AVAILABLE&amp;review=unapproved&amp;sort=wallet-debt"',
    );
    expect(rendered).not.toContain('Partner pages');
    expect(rendered).not.toContain('Partner filters');
    expect(rendered).not.toContain('Start with approval');
  });

  it('keeps clear filters available when no partner filters are active', () => {
    const rendered = renderToStaticMarkup(
      PartnerFilterBoard({
        activeFilters: [],
        csvDownloadName: 'hands-partners-all.csv',
        csvHref: 'data:text/csv,partner',
        filteredCount: 12,
        filters: providerFilters(),
        locationFreshnessLabel: 'Location freshness: 30m',
        showAdvancedFilters: false,
        totalCount: 12,
      }),
    );

    expect(rendered).toContain('Clear filters');
    expect(rendered).toContain('href="/partners"');
    expect(rendered).toContain('admin-form-control-link vuexy-partner-button is-ghost');
  });
});

function providerFilters(input: Partial<ProviderFilters> = {}): ProviderFilters {
  return {
    ...buildProviderFilters({}),
    ...input,
  };
}
