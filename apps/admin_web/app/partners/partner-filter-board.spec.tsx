import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildProviderActiveFilters, buildProviderFilters, type ProviderFilters } from './partner-filters';
import { PartnerFilterBoard } from './partner-filter-board';

describe('PartnerFilterBoard', () => {
  it('routes Partner approvals to the dedicated queue filter board', () => {
    const source = readFileSync('app/partners/partner-filter-board.tsx', 'utf8');

    expect(source).toContain("if (filters.review === 'approval-pending')");
    expect(source).toContain('<PartnerApprovalFilterBoard');
    expect(source).toContain('PARTNER_APPROVAL_QUEUE_HREF');
    expect(source).not.toContain("{ label: 'Partner approvals', value: 'approval-pending' }");
  });

  it('uses shared Vuexy filter summary atoms for active filter chips', () => {
    const source = readFileSync('app/partners/partner-filter-board.tsx', 'utf8');

    expect(source).toContain('AdminFilterSummary');
    expect(source).not.toContain('<span className="pill pill-warn" key={`${filter.kind}-${filter.value}`}>');
    expect(source).not.toContain('<StatusBadge key={`${filter.kind}-${filter.value}`}');
  });

  it('does not keep stale partner filter card selectors in global CSS', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).not.toContain('.partners-page .partner-filter-card');
  });

  it('renders a compact Vuexy-style partner filter panel', () => {
    const filters = providerFilters({
      q: 'linh',
      review: 'unapproved',
      sort: 'newest',
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
    expect(rendered).toContain('Onboarding filters');
    expect(rendered).not.toContain(
      'Find a Partner, narrow the operating state, and open the record that needs attention.',
    );
    expect(rendered).toContain('4 on this page / 12 total');
    expect(rendered).toContain('vuexy-partner-filter-grid');
    expect(rendered).toContain('admin-directory-filter-grid');
    expect(rendered).toContain('vuexy-partner-filter-group admin-directory-filter-group is-primary');
    expect(rendered).toContain('admin-directory-filter-group is-primary');
    expect(rendered).toContain('admin-directory-filter-search');
    expect(rendered).toContain('admin-directory-filter-select');
    expect(rendered).toContain('Search Partner');
    expect(rendered).not.toContain('State</span>');
    expect(rendered).toContain('Partner activity');
    expect(rendered).toContain('App inactive 7D+');
    expect(rendered).toContain('App not tracked');
    expect(rendered).toContain('Verification stage');
    expect(rendered).toContain('KYC stage');
    expect(rendered).toContain('Sort');
    expect(rendered).toContain('Recently registered');
    expect(rendered).not.toContain('Oldest');
    expect(rendered).toContain('Name');
    expect(rendered).toContain('Export current page (4)');
    expect(rendered).toContain('Apply');
    expect(rendered).not.toContain('Location freshness: 30m');
    expect(rendered).toContain('vuexy-partner-filter-secondary-row');
    expect(rendered).toContain('matching Partners');
    expect(rendered).not.toContain('current operations view');
    expect(rendered).toContain('Search: linh');
    expect(rendered).not.toContain('State: Online available');
    expect(rendered).not.toContain('Status: ONLINE_AVAILABLE');
    expect(rendered).toContain('Review: Onboarding blockers');
    expect(rendered).toContain('Active onboarding filters');
    expect(rendered).toContain('class="admin-filter-summary vuexy-partner-active-filters"');
    expect(rendered).toContain('Clear onboarding filters');
    expect(rendered).toContain('type="hidden" name="sort" value="newest"');
    expect(rendered).toContain('type="hidden" name="review" value="unapproved"');
    expect(rendered).toContain(
      'href="/partners?q=linh&amp;review=unapproved&amp;sort=name"',
    );
    expect(rendered).not.toContain('More filters');
    expect(rendered).not.toContain('Booking flow');
    expect(rendered).not.toContain('Device/session');
    expect(rendered).not.toContain('Review lane');
    expect(rendered).not.toContain('Readiness');
    expect(rendered).not.toContain('Location</label>');
    expect(rendered).not.toContain('Partner pages');
    expect(rendered).not.toContain('Start with approval');
  });

  it('renders only canonical wallet debt queue controls', () => {
    const filters = providerFilters({ review: 'unsettled' });
    const rendered = renderToStaticMarkup(
      PartnerFilterBoard({
        activeFilters: buildProviderActiveFilters(filters),
        csvDownloadName: 'wallet-debt.csv',
        csvHref: '/api/admin/partners/export?review=unsettled',
        filteredCount: 10,
        filters,
        locationFreshnessLabel: 'Location freshness: 30m',
        showAdvancedFilters: false,
        totalCount: 124,
      }),
    );

    expect(rendered).toContain('Wallet debt filters');
    expect(rendered).toContain('canonical negative VND balance queue');
    expect(rendered).toContain('Export current page (10)');
    expect(rendered).toContain('Clear wallet debt filters');
    expect(rendered).not.toContain('Verification stage');
    expect(rendered).not.toContain('KYC stage');
    expect(rendered).not.toContain('Partner activity');
    expect(rendered).not.toContain('Debt age');
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
    expect(rendered).toContain(
      'admin-form-control-link button button-secondary admin-directory-filter-button is-ghost',
    );
  });

  it('renders only approval decision filters on the Partner approval queue', () => {
    const filters = providerFilters({
      age: '4-24h',
      approvalMissing: 'identity-documents',
      approvalRisk: 'rejected-evidence',
      review: 'approval-pending',
      sort: 'oldest',
    });
    const rendered = renderToStaticMarkup(
      PartnerFilterBoard({
        activeFilters: buildProviderActiveFilters(filters),
        ageCounts: { all: 9, 'under-1h': 1, '1-4h': 2, '4-24h': 4, 'over-24h': 2 },
        csvDownloadName: 'unused.csv',
        csvHref: '/unused.csv',
        filteredCount: 4,
        filters,
        locationFreshnessLabel: 'Location freshness: 30m',
        queueSla: { overdueCount: 3, thresholdMinutes: 240 },
        showAdvancedFilters: false,
        totalCount: 4,
      }),
    );

    expect(rendered).toContain('Approval queue filters');
    expect(rendered).toContain('Search Partner');
    expect(rendered).toContain('Missing item');
    expect(rendered).toContain('Identity documents');
    expect(rendered).toContain('Risk flag');
    expect(rendered).toContain('Rejected evidence');
    expect(rendered).toContain('Waiting age');
    expect(rendered).toContain('4-24h (4)');
    expect(rendered).toContain('Oldest first');
    expect(rendered).toContain('Overdue 3');
    expect(rendered).toContain('Target 4h');
    expect(rendered).toContain('Clear approval filters');
    expect(rendered).toContain('type="hidden" name="review" value="approval-pending"');
    expect(rendered).toContain('type="hidden" name="sort" value="oldest"');
    expect(rendered).not.toContain('Export');
    expect(rendered).not.toContain('State');
    expect(rendered).not.toContain('App activity');
    expect(rendered).not.toContain('Verification');
    expect(rendered).not.toContain('KYC');
    expect(rendered).not.toContain('Ready now / Records sort');
    expect(rendered).not.toContain('Bookings');
    expect(rendered).not.toContain('Revenue');
    expect(rendered).not.toContain('Wallet debt');
    expect(rendered).not.toContain('Location freshness');
  });

  it('keeps booking flow visible and opens only the quality period disclosure', () => {
    const filters = providerFilters({
      review: 'quality-risk',
      sort: 'newest',
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

    expect(rendered).toContain('Quality period');
    expect(rendered).toContain('class="admin-disclosure vuexy-partner-filter-details"');
    expect(rendered).toContain('App activity');
    expect(rendered).toContain('App inactive 7D+');
    expect(rendered).toContain('Booking flow');
    expect(rendered).toContain('Quality range');
    expect(rendered).not.toContain('Location</label>');
    expect(rendered).not.toContain('Device/session');
    expect(rendered).not.toContain('Review lane');
    expect(rendered).not.toContain('Tax profile optional');
    expect(rendered).toContain('type="hidden" name="review" value="quality-risk"');
  });

  it('keeps legacy readiness links readable without re-offering the local-only control', () => {
    const filters = providerFilters({
      readiness: 'ready',
      sort: 'newest',
    });
    const rendered = renderToStaticMarkup(
      PartnerFilterBoard({
        activeFilters: buildProviderActiveFilters(filters),
        csvDownloadName: 'hands-partners-readiness-ready.csv',
        csvHref: 'data:text/csv,partner',
        filteredCount: 2,
        filters,
        locationFreshnessLabel: 'Location freshness: 30m',
        showAdvancedFilters: true,
        totalCount: 12,
      }),
    );

    expect(rendered).not.toContain('More filters');
    expect(rendered).not.toContain('Quality period');
    expect(rendered).toContain('Booking flow');
    expect(rendered).toContain('Readiness: Dispatch ready');
    expect(rendered).not.toContain('name="readiness"');
    expect(rendered).not.toContain('Approved but offline');
    expect(rendered).not.toContain('type="hidden" name="readiness"');
    expect(rendered).toContain('href="/partners?review=ready-now&amp;sort=oldest"');
  });

  it('disables export when the filtered result has no records', () => {
    const rendered = renderToStaticMarkup(
      PartnerFilterBoard({
        activeFilters: [],
        csvDownloadName: 'hands-partners.csv',
        csvHref: '/api/admin/partners/export',
        filteredCount: 0,
        filters: providerFilters(),
        locationFreshnessLabel: 'Location freshness: 30m',
        showAdvancedFilters: false,
        totalCount: 0,
      }),
    );

    expect(rendered).toContain('disabled=""');
    expect(rendered).toContain('title="No records to export"');
    expect(rendered).toContain('No records to export');
    expect(rendered).not.toContain('href="/api/admin/partners/export"');
  });
});

function providerFilters(input: Partial<ProviderFilters> = {}): ProviderFilters {
  return {
    ...buildProviderFilters({}),
    ...input,
  };
}
