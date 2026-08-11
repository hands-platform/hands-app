import {
  buildCustomerActiveFilters,
  buildCustomerDataHrefs,
  buildCustomerFilters,
  buildCustomerListHref,
  safeCustomerReturnTo,
} from './customer-filters';

describe('customer filters', () => {
  it('uses Payment & review as the default support queue and keeps All customers explicit', () => {
    const defaults = buildCustomerFilters({});

    expect(defaults.view).toBe('needs-action');
    expect(buildCustomerActiveFilters(defaults)).toEqual([]);
    expect(buildCustomerDataHrefs(defaults)).toEqual({
      listHref: '/admin/customers?view=needs-action&take=10&skip=0',
      summaryHref: '/admin/customers/summary',
    });

    const allCustomers = buildCustomerFilters({ view: 'all' });
    expect(buildCustomerActiveFilters(allCustomers)).toEqual([]);
    expect(buildCustomerListHref(defaults, { view: 'all' })).toBe('/customers?view=all');
    expect(buildCustomerDataHrefs(allCustomers)).toEqual({
      listHref: '/admin/customers?take=10&skip=0',
      summaryHref: '/admin/customers/summary',
    });
  });

  it('builds operational view, segment, and one activity date dimension', () => {
    const filters = buildCustomerFilters({
      country: 'VN',
      dateField: 'last-login',
      dateRange: '30d',
      gender: 'female',
      q: 'linh',
      segment: 'inactive-30d',
      sort: 'booking-count-asc',
      view: 'needs-action',
    });

    expect(filters).toEqual(
      expect.objectContaining({
        country: 'VI',
        dateField: 'last-login',
        dateRange: '30d',
        gender: 'female',
        q: 'linh',
        segment: 'inactive-30d',
        sort: 'booking-count-asc',
        view: 'needs-action',
      }),
    );
    expect(filters.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(buildCustomerActiveFilters(filters)).toEqual(
      expect.arrayContaining([
        'Search: linh',
        'Segment: Inactive 30 days',
        'Recorded app language: Vietnamese',
        'Gender: Female',
        'Session activity period: Last 30 days',
      ]),
    );
  });

  it('keeps old customer date links readable while emitting the compact URL contract', () => {
    const filters = buildCustomerFilters({
      joinedFrom: '2026-06-01',
      joinedRange: 'custom',
      joinedTo: '2026-06-07',
      sort: 'booking-count',
    });

    expect(filters).toEqual(
      expect.objectContaining({
        dateField: 'joined',
        dateFrom: '2026-06-01',
        dateRange: 'custom',
        dateTo: '2026-06-07',
      }),
    );
    expect(buildCustomerListHref(filters)).toContain(
      'dateField=joined&dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-07',
    );
  });

  it('preserves the usage new-unbooked cohort in the visible and API filters', () => {
    const filters = buildCustomerFilters({
      dateField: 'joined',
      dateFrom: '2026-07-13',
      dateRange: 'custom',
      dateTo: '2026-07-19',
      segment: 'usage-new-unbooked',
      view: 'all',
    });

    expect(buildCustomerActiveFilters(filters)).toEqual([
      'Segment: New in period · no production booking',
      'Joined date: 2026-07-13 - 2026-07-19',
    ]);
    expect(buildCustomerDataHrefs(filters)).toEqual({
      listHref:
        '/admin/customers?segment=usage-new-unbooked&joinedFrom=2026-07-13&joinedTo=2026-07-19&take=10&skip=0',
      summaryHref:
        '/admin/customers/summary?segment=usage-new-unbooked&joinedFrom=2026-07-13&joinedTo=2026-07-19',
    });
  });

  it('maps the selected activity date to the existing bounded Admin API contract', () => {
    const filters = buildCustomerFilters({
      country: 'VI',
      dateField: 'last-booking',
      dateFrom: '2026-06-10',
      dateRange: 'custom',
      dateTo: '2026-06-20',
      gender: 'female',
      page: '3',
      pageSize: '25',
      q: 'mai',
      segment: 'completed',
      sort: 'booking-count',
      view: 'active-today',
    });

    expect(buildCustomerDataHrefs(filters)).toEqual({
      listHref:
        '/admin/customers?q=mai&view=active-today&segment=completed&country=VI&gender=female&lastBookingFrom=2026-06-10&lastBookingTo=2026-06-20&sort=booking-count&take=25&skip=50',
      summaryHref:
        '/admin/customers/summary?q=mai&segment=completed&country=VI&gender=female&lastBookingFrom=2026-06-10&lastBookingTo=2026-06-20',
    });
  });

  it('resets pagination when an operational filter changes', () => {
    const filters = buildCustomerFilters({ page: '4', pageSize: '25' });
    expect(buildCustomerListHref(filters, { view: 'new-today' })).toBe(
      '/customers?view=new-today&pageSize=25',
    );
  });

  it('drops incomplete, reversed, and impossible custom dates from URL and API contracts', () => {
    for (const params of [
      { dateFrom: '2026-08-01', dateRange: 'custom' },
      { dateFrom: '2026-08-10', dateRange: 'custom', dateTo: '2026-08-01' },
      { dateFrom: '2026-02-30', dateRange: 'custom', dateTo: '2026-03-01' },
    ]) {
      const filters = buildCustomerFilters(params);
      expect(filters).toEqual(expect.objectContaining({ dateFrom: '', dateRange: '', dateTo: '' }));
      expect(buildCustomerListHref(filters)).toBe('/customers');
      expect(buildCustomerDataHrefs(filters).listHref).not.toContain('From=');
    }
  });

  it('normalizes bare and regional app locales to base language filters while keeping old links readable', () => {
    expect(buildCustomerFilters({ country: 'VN' }).country).toBe('VI');
    expect(buildCustomerFilters({ country: 'CN' }).country).toBe('ZH');
    expect(buildCustomerFilters({ country: 'EN' }).country).toBe('EN');
  });

  it('accepts only the customer list route as a detail return target', () => {
    expect(safeCustomerReturnTo('/customers?view=all&page=3')).toBe('/customers?view=all&page=3');
    expect(safeCustomerReturnTo('/payments')).toBe('/customers');
    expect(safeCustomerReturnTo('https://example.com/customers')).toBe('/customers');
    expect(safeCustomerReturnTo('//example.com/customers')).toBe('/customers');
  });
});
