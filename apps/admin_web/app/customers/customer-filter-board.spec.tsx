import { renderToStaticMarkup } from 'react-dom/server';

import { CustomerFilterBoard } from './customer-filter-board';
import type { CustomerFilters } from './customer-filters';

describe('CustomerFilterBoard', () => {
  it('renders the shared filter panel with customer filters and active chips', () => {
    const section = CustomerFilterBoard({
      activeFilters: ['Search: linh', 'Payment: captured'],
      csvHref: 'data:text/csv,customer',
      filteredCount: 4,
      filters: filters({ q: 'linh', payment: 'captured' }),
      totalCount: 9,
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('card admin-filter-panel vuexy-customer-filter-card admin-mb-16');
    expect(rendered).toContain('Filters');
    expect(rendered).toContain('4 of 9');
    expect(rendered).toContain('vuexy-customer-filter-grid');
    expect(rendered).toContain('vuexy-customer-filter-group is-primary');
    expect(rendered).toContain('vuexy-customer-filter-actions');
    expect(rendered).toContain('vuexy-customer-date-filter-grid');
    expect(rendered).toContain('Search Customer');
    expect(rendered).toContain('All countries');
    expect(rendered).toContain('All genders');
    expect(rendered).toContain('Most reservations');
    expect(rendered).toContain('Sign-up Date');
    expect(rendered).toContain('Sign-up: Today');
    expect(rendered).toContain('Last Reservation');
    expect(rendered).toContain('Last reservation: Specific period');
    expect(rendered).toContain('Reservation Count');
    expect(rendered).toContain('Min reservations');
    expect(rendered).toContain('admin-form-input vuexy-customer-number-field');
    expect(rendered).toContain('Export');
    expect(rendered).toContain('Apply');
    expect(rendered).toContain('Search: linh');
    expect(rendered).toContain('Payment: captured');
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
    expect(rendered).toContain('admin-form-control-link vuexy-customer-button is-ghost');
  });
});

function filters(input: Partial<CustomerFilters> = {}): CustomerFilters {
  return {
    address: '',
    booking: '',
    bookingFlow: '',
    chat: '',
    country: '',
    gender: '',
    joinedRange: '',
    joinedFrom: '',
    joinedTo: '',
    lastBookingRange: '',
    lastBookingFrom: '',
    lastBookingTo: '',
    memo: '',
    minBookings: null,
    minCompleted: null,
    minSpend: null,
    page: 1,
    pageSize: 10,
    payment: '',
    q: '',
    reachability: '',
    seen: '',
    sort: 'last-booking',
    ...input,
  };
}
