import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { CustomerFilterBoard } from './customer-filter-board';
import type { CustomerFilters } from './customer-filters';

const globalCss = readFileSync('app/globals.css', 'utf8');

describe('CustomerFilterBoard', () => {
  it('uses the shared Vuexy badge atom for active filter chips', () => {
    const source = readFileSync('app/customers/customer-filter-board.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-warn" key={filter}>');
  });

  it('renders the shared filter panel with customer filters and active chips', () => {
    const section = CustomerFilterBoard({
      activeFilters: ['Search: linh', 'Last login date: Last month'],
      csvHref: 'data:text/csv,customer',
      filteredCount: 4,
      filters: filters({ lastLoginRange: '30d', q: 'linh', sort: 'booking-count-asc' }),
      totalCount: 9,
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('card admin-filter-panel vuexy-customer-filter-card admin-mb-16');
    expect(rendered).toContain('Filters');
    expect(rendered).toContain('4 of 9');
    expect(rendered).toContain('vuexy-customer-filter-grid');
    expect(rendered).toContain('admin-directory-filter-grid');
    expect(rendered).toContain('vuexy-customer-filter-group admin-directory-filter-group is-primary');
    expect(rendered).toContain('admin-directory-filter-group is-primary');
    expect(rendered).toContain('admin-directory-filter-search');
    expect(rendered).toContain('admin-directory-filter-select');
    expect(rendered).toContain('vuexy-customer-filter-actions');
    expect(rendered).toContain('admin-directory-filter-actions');
    expect(rendered).toContain('vuexy-customer-date-filter-grid');
    expect(rendered).toContain('Search Customer');
    expect(rendered).toContain('All countries');
    expect(rendered).toContain('All genders');
    expect(rendered).toContain('Sign-up Date');
    expect(rendered).toContain('Today');
    expect(rendered).toContain('Previous day');
    expect(rendered).toContain('Last month');
    expect(rendered).toContain('Custom dates');
    expect(rendered).toContain('Last Reservation');
    expect(rendered).toContain('Last Login Date');
    expect(rendered).toContain('Reservation Count');
    expect(rendered).toContain('Many first');
    expect(rendered).toContain('Few first');
    expect(rendered).toContain('Export');
    expect(rendered).toContain('Apply');
    expect(rendered).toContain('Search: linh');
    expect(rendered).toContain('Last login date: Last month');
    expect(rendered).not.toContain('All bookings');
    expect(rendered).not.toContain('All wallet');
    expect(rendered).not.toContain('Min reservations');
    expect(rendered).not.toContain('Clear filters');
  });

  it('keeps clear filters available when no filters are active', () => {
    const rendered = renderToStaticMarkup(
      CustomerFilterBoard({
        activeFilters: [],
        csvHref: 'data:text/csv,customer',
        filteredCount: 9,
        filters: filters(),
        totalCount: 9,
      }),
    );

    expect(rendered).toContain('Clear filters');
    expect(rendered).toContain('href="/customers"');
    expect(rendered).toContain('admin-form-control-link button button-secondary admin-directory-filter-button is-ghost');
  });

  it('places custom date apply controls next to visible custom date fields', () => {
    const rendered = renderToStaticMarkup(
      CustomerFilterBoard({
        activeFilters: ['Sign-up date: 2026-06-01 - 2026-06-07'],
        csvHref: 'data:text/csv,customer',
        filteredCount: 2,
        filters: filters({
          joinedFrom: '2026-06-01',
          joinedRange: 'custom',
          joinedTo: '2026-06-07',
        }),
        totalCount: 9,
      }),
    );

    expect(rendered).toContain('booking-custom-date-grid vuexy-customer-custom-date-grid');
    expect(rendered).toContain('name="joinedFrom"');
    expect(rendered).toContain('name="joinedTo"');
    expect(rendered).toContain('admin-form-control-button button button-primary booking-date-apply-button');
    expect(rendered).toContain('Apply dates');
  });

  it('scopes customer and partner filter header typography to direct Vuexy panel copy slots', () => {
    expect(globalCss).toContain(
      '.vuexy-customer-filter-card > .admin-filter-panel-header > .admin-filter-panel-copy > h2,',
    );
    expect(globalCss).toContain(
      '.vuexy-partner-filter-card > .admin-filter-panel-header > .admin-filter-panel-copy > h2,',
    );
    expect(globalCss).toContain(
      '.vuexy-customer-filter-card > .admin-filter-panel-header > .admin-filter-panel-copy > p,',
    );
    expect(globalCss).toContain(
      '.vuexy-partner-filter-card > .admin-filter-panel-header > .admin-filter-panel-copy > p,',
    );

    expect(globalCss).not.toContain('.vuexy-customer-filter-card .admin-filter-panel-header h2,');
    expect(globalCss).not.toContain('.vuexy-partner-filter-card .admin-filter-panel-header h2,');
    expect(globalCss).not.toContain('.vuexy-customer-filter-card .admin-filter-panel-header p,');
    expect(globalCss).not.toContain('.vuexy-partner-filter-card .admin-filter-panel-header p,');
  });
});

function filters(input: Partial<CustomerFilters> = {}): CustomerFilters {
  return {
    country: '',
    gender: '',
    joinedRange: '',
    joinedFrom: '',
    joinedTo: '',
    lastBookingRange: '',
    lastBookingFrom: '',
    lastBookingTo: '',
    lastLoginRange: '',
    lastLoginFrom: '',
    lastLoginTo: '',
    page: 1,
    pageSize: 10,
    q: '',
    sort: 'last-booking',
    ...input,
  };
}
