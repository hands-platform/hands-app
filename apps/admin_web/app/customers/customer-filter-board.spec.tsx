import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { CustomerFilterBoard } from './customer-filter-board';
import type { CustomerFilters } from './customer-filters';

const globalCss = readFileSync('app/globals.css', 'utf8');

describe('CustomerFilterBoard', () => {
  it('uses shared filter and disclosure atoms', () => {
    const source = readFileSync('app/customers/customer-filter-board.tsx', 'utf8');

    expect(source).toContain('AdminFilterSummary');
    expect(source).toContain('AdminDisclosure');
    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('PillClassBadge');
  });

  it('renders compact operational views, search, segment, and advanced filters', () => {
    const rendered = renderToStaticMarkup(
      <CustomerFilterBoard
        activeFilters={['Search: linh', 'Session activity period: Last 30 days']}
        filters={filters({ dateRange: '30d', q: 'linh', view: 'needs-action' })}
        viewCounts={{ activeToday: 2, all: 38, needsAction: 9, newToday: 3 }}
      />,
    );

    expect(rendered).toContain('Customer filters');
    expect(rendered).toContain('Current queue: Payment &amp; review.');
    expect(rendered).toContain('Operational view');
    expect(rendered).toContain('All customers 38');
    expect(rendered).toContain('Payment &amp; review 9');
    expect(rendered).toContain('view=all');
    expect(rendered).toContain('aria-current="page"');
    expect(rendered).toContain('New today 3');
    expect(rendered).toContain('App seen today 2');
    expect(rendered).toContain('Name, phone, email, customer ID');
    expect(rendered).toContain('All customer segments');
    expect(rendered).toContain('More filters (1)');
    expect(rendered).toContain('Session activity period, recorded app language, and profile attributes');
    expect(rendered).toContain('Session activity period');
    expect(rendered).toContain('All app languages');
    expect(rendered).toContain('Sort customers');
    expect(rendered).toContain('Most bookings');
    expect(rendered).toContain('Apply filters');
    expect(rendered).toContain('Search: linh');
    expect(rendered).toContain('Clear filters');
    expect(rendered).not.toContain('Sign-up records');
    expect(rendered).not.toContain('Reservation risk / history');
    expect(rendered).not.toContain('Customer segments / history sort');
    expect(rendered).not.toContain('Export');
  });

  it('hides the clear action when no filters are active', () => {
    const rendered = renderToStaticMarkup(
      <CustomerFilterBoard
        activeFilters={[]}
        filters={filters()}
        viewCounts={{ activeToday: 1, all: 9, needsAction: 2, newToday: 1 }}
      />,
    );

    expect(rendered).not.toContain('Clear filters');
    expect(rendered).toContain('More filters');
    expect(rendered).not.toContain('More filters (');
  });

  it('shows required native date controls for a valid custom activity period', () => {
    const rendered = renderToStaticMarkup(
      <CustomerFilterBoard
        activeFilters={['Joined date: 2026-06-01 - 2026-06-07']}
        filters={filters({
          dateField: 'joined',
          dateFrom: '2026-06-01',
          dateRange: 'custom',
          dateTo: '2026-06-07',
        })}
        viewCounts={{ activeToday: 1, all: 9, needsAction: 2, newToday: 1 }}
      />,
    );

    expect(rendered).toContain('vuexy-customer-custom-date-grid');
    expect(rendered).toContain('name="dateFrom"');
    expect(rendered).toContain('name="dateTo"');
    expect(rendered).toContain('type="date"');
    expect(rendered).toContain('required=""');
    expect(rendered).not.toContain('calendar-datepicker-field');
  });

  it('shows an accessible validation error and blocks Apply for incomplete custom dates', () => {
    const rendered = renderToStaticMarkup(
      <CustomerFilterBoard
        activeFilters={[]}
        filters={filters({ dateRange: 'custom' })}
        viewCounts={{ activeToday: 1, all: 9, needsAction: 2, newToday: 1 }}
      />,
    );

    expect(rendered).toContain('Choose a start and end date.');
    expect(rendered).toContain('role="alert"');
    expect(rendered).toContain('aria-invalid="true"');
    expect(rendered).toContain('disabled=""');
  });

  it('keeps customer and partner header typography scoped to direct panel copy slots', () => {
    expect(globalCss).toContain(
      '.vuexy-customer-filter-card > .admin-filter-panel-header > .admin-filter-panel-copy > h2,',
    );
    expect(globalCss).toContain(
      '.vuexy-partner-filter-card > .admin-filter-panel-header > .admin-filter-panel-copy > h2,',
    );
    expect(globalCss).not.toContain('.vuexy-customer-filter-card .admin-filter-panel-header h2,');
  });
});

function filters(input: Partial<CustomerFilters> = {}): CustomerFilters {
  return {
    country: '',
    dateField: 'last-login',
    dateFrom: '',
    dateRange: '',
    dateTo: '',
    gender: '',
    page: 1,
    pageSize: 10,
    q: '',
    segment: '',
    sort: 'newest',
    view: 'needs-action',
    ...input,
  };
}
