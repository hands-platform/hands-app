import { buildCustomerActiveFilters, buildCustomerFilters, buildCustomerListHref } from './customer-filters';

describe('customer filters', () => {
  it('adds date range and reservation count filters without dropping existing filters', () => {
    const filters = buildCustomerFilters({
      country: 'VN',
      gender: 'female',
      joinedRange: 'today',
      lastBookingRange: '7d',
      minBookings: '5',
      payment: 'captured',
      q: 'linh',
      sort: 'booking-count',
    });

    expect(filters.q).toBe('linh');
    expect(filters.country).toBe('VN');
    expect(filters.gender).toBe('female');
    expect(filters.payment).toBe('captured');
    expect(filters.sort).toBe('booking-count');
    expect(filters.minBookings).toBe(5);
    expect(filters.joinedRange).toBe('today');
    expect(filters.joinedFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.joinedTo).toBe(filters.joinedFrom);
    expect(filters.lastBookingRange).toBe('7d');
    expect(filters.lastBookingFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.lastBookingTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps custom date values in generated customer links and active chips', () => {
    const filters = buildCustomerFilters({
      joinedFrom: '2026-06-01',
      joinedRange: 'custom',
      joinedTo: '2026-06-07',
      lastBookingFrom: '2026-06-10',
      lastBookingRange: 'custom',
      lastBookingTo: '2026-06-20',
      minBookings: '2',
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
    expect(href).toContain('minBookings=2');
    expect(href).toContain('sort=booking-count');
    expect(activeFilters).toEqual(
      expect.arrayContaining([
        'Sign-up date: 2026-06-01 - 2026-06-07',
        'Last reservation: 2026-06-10 - 2026-06-20',
        'Min bookings: 2',
        'Sort: reservation count',
      ]),
    );
  });
});
