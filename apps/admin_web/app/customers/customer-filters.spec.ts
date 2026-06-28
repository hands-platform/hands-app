import {
  buildCustomerActiveFilters,
  buildCustomerDataHrefs,
  buildCustomerFilters,
  buildCustomerListHref,
} from './customer-filters';

describe('customer filters', () => {
  it('adds date range filters and reservation count sort without keeping removed filters', () => {
    const filters = buildCustomerFilters({
      booking: 'active',
      country: 'VN',
      gender: 'female',
      joinedRange: 'today',
      lastBookingRange: '7d',
      lastLoginRange: '30d',
      minBookings: '5',
      minCompleted: '3',
      minSpend: '400000',
      payment: 'captured',
      q: 'linh',
      seen: 'live',
      sort: 'booking-count-asc',
    });

    expect(filters.q).toBe('linh');
    expect(filters.country).toBe('VN');
    expect(filters.gender).toBe('female');
    expect(filters.sort).toBe('booking-count-asc');
    expect(filters.joinedRange).toBe('today');
    expect(filters.joinedFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.joinedTo).toBe(filters.joinedFrom);
    expect(filters.lastBookingRange).toBe('7d');
    expect(filters.lastBookingFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.lastBookingTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.lastLoginRange).toBe('30d');
    expect(filters.lastLoginFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.lastLoginTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const href = buildCustomerListHref(filters);
    const activeFilters = buildCustomerActiveFilters(filters);

    expect(href).not.toContain('booking=');
    expect(href).not.toContain('payment=');
    expect(href).not.toContain('seen=');
    expect(href).not.toContain('minBookings=');
    expect(activeFilters).not.toEqual(expect.arrayContaining([expect.stringContaining('Booking:')]));
    expect(activeFilters).not.toEqual(expect.arrayContaining([expect.stringContaining('Payment:')]));
    expect(activeFilters).not.toEqual(expect.arrayContaining([expect.stringContaining('Recent access:')]));
  });

  it('keeps custom date values in generated customer links and active chips', () => {
    const filters = buildCustomerFilters({
      joinedFrom: '2026-06-01',
      joinedRange: 'custom',
      joinedTo: '2026-06-07',
      lastBookingFrom: '2026-06-10',
      lastBookingRange: 'custom',
      lastBookingTo: '2026-06-20',
      lastLoginFrom: '2026-06-11',
      lastLoginRange: 'custom',
      lastLoginTo: '2026-06-21',
      sort: 'booking-count',
    });

    const href = buildCustomerListHref(filters);
    const activeFilters = buildCustomerActiveFilters(filters);

    expect(href).toContain('joinedRange=custom');
    expect(href).toContain('joinedFrom=2026-06-01');
    expect(href).toContain('joinedTo=2026-06-07');
    expect(href).toContain('lastBookingRange=custom');
    expect(href).toContain('lastBookingFrom=2026-06-10');
    expect(href).toContain('lastBookingTo=2026-06-20');
    expect(href).toContain('lastLoginRange=custom');
    expect(href).toContain('lastLoginFrom=2026-06-11');
    expect(href).toContain('lastLoginTo=2026-06-21');
    expect(href).toContain('sort=booking-count');
    expect(activeFilters).toEqual(
      expect.arrayContaining([
        'Sign-up date: 2026-06-01 - 2026-06-07',
        'Last reservation: 2026-06-10 - 2026-06-20',
        'Last login date: 2026-06-11 - 2026-06-21',
        'Sort: reservations many first',
      ]),
    );
  });

  it('builds bounded admin API hrefs for customer directory data and summary', () => {
    const filters = buildCustomerFilters({
      joinedFrom: '2026-06-01',
      joinedRange: 'custom',
      joinedTo: '2026-06-07',
      page: '3',
      pageSize: '25',
      q: 'mai',
    });

    expect(buildCustomerDataHrefs(filters)).toEqual({
      listHref:
        '/admin/customers?q=mai&joinedFrom=2026-06-01&joinedTo=2026-06-07&take=25&skip=50',
      summaryHref: '/admin/customers/summary?q=mai&joinedFrom=2026-06-01&joinedTo=2026-06-07',
    });
  });
});
