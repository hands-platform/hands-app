import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildProviderActiveFilters, buildProviderFilters, type ProviderFilters } from './partner-filters';
import { PartnerFilterBoard } from './partner-filter-board';

describe('PartnerFilterBoard', () => {
  it('uses shared Vuexy badge atoms for active filter chips', () => {
    const source = readFileSync('app/partners/partner-filter-board.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-warn" key={`${filter.kind}-${filter.value}`}>');
  });

  it('does not keep stale partner filter card selectors in global CSS', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).not.toContain('.partners-page .partner-filter-card');
  });

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
    expect(rendered).toContain('admin-directory-filter-grid');
    expect(rendered).toContain('vuexy-partner-filter-group admin-directory-filter-group is-primary');
    expect(rendered).toContain('admin-directory-filter-group is-primary');
    expect(rendered).toContain('admin-directory-filter-search');
    expect(rendered).toContain('admin-directory-filter-select');
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
    expect(rendered).toContain('Export');
    expect(rendered).toContain('Apply');
    expect(rendered).toContain('Location freshness: 30m');
    expect(rendered).toContain('Search: linh');
    expect(rendered).toContain('State: Online available');
    expect(rendered).not.toContain('Status: ONLINE_AVAILABLE');
    expect(rendered).toContain('Review: Unapproved Partners');
    expect(rendered).toContain('Sort: booking count');
    expect(rendered).toContain('Active partner filters');
    expect(rendered).toContain('Clear filters');
    expect(rendered).toContain('type="hidden" name="sort" value="booking-count"');
    expect(rendered).toContain('type="hidden" name="review" value="unapproved"');
    expect(rendered).toContain(
      'href="/partners?q=linh&amp;providerStatus=ONLINE_AVAILABLE&amp;review=unapproved&amp;sort=last-work"',
    );
    expect(rendered).toContain(
      'href="/partners?q=linh&amp;providerStatus=ONLINE_AVAILABLE&amp;review=unapproved&amp;sort=wallet-debt"',
    );
    expect(rendered).not.toContain('More filters');
    expect(rendered).not.toContain('Device/session');
    expect(rendered).not.toContain('Booking flow');
    expect(rendered).not.toContain('Review lane');
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
    expect(rendered).toContain('admin-form-control-link button button-secondary admin-directory-filter-button is-ghost');
  });

  it('opens advanced filters for non-primary operational review lanes', () => {
    const filters = providerFilters({
      review: 'marketplace-ready',
      sort: 'ops-priority',
    });
    const rendered = renderToStaticMarkup(
      PartnerFilterBoard({
        activeFilters: buildProviderActiveFilters(filters),
        csvDownloadName: 'hands-partners-review-marketplace-ready.csv',
        csvHref: 'data:text/csv,partner',
        filteredCount: 3,
        filters,
        locationFreshnessLabel: 'Location freshness: 30m',
        showAdvancedFilters: true,
        totalCount: 12,
      }),
    );

    expect(rendered).toContain('More filters');
    expect(rendered).toContain('class="admin-disclosure vuexy-partner-filter-details"');
    expect(rendered).toContain('Location');
    expect(rendered).toContain('Device/session');
    expect(rendered).toContain('Activity');
    expect(rendered).toContain('Inactive 7D');
    expect(rendered).toContain('Booking flow');
    expect(rendered).toContain('Review lane');
    expect(rendered).toContain('Review: Marketplace ready');
    expect(rendered).not.toContain('Tax profile optional');
    expect(rendered).not.toContain('type="hidden" name="review"');
  });
});

function providerFilters(input: Partial<ProviderFilters> = {}): ProviderFilters {
  return {
    ...buildProviderFilters({}),
    ...input,
  };
}
