import { buttonsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorFiltersSection } from './booking-monitor-filters-section';

describe('BookingMonitorFiltersSection', () => {
  const viewOptions = [
    {
      description: 'Current active bookings.',
      label: 'Active bookings',
      operatorHint: 'Start with active bookings.',
      view: 'active' as const,
    },
    {
      description: 'Full booking history.',
      label: 'All bookings',
      operatorHint: 'Use this for audit review.',
      view: 'all' as const,
    },
  ];

  it('renders filters, counts, and active queue copy', () => {
    const section = BookingMonitorFiltersSection({
      activeView: viewOptions[0],
      baseVisibleBookingCount: 7,
      evidenceFilter: 'all',
      evidenceFilterOptions: [
        { label: 'All evidence', value: 'all' },
        { label: 'Payment / wallet check', value: 'money' },
      ],
      onClearFilters: jest.fn(),
      onEvidenceFilterChange: jest.fn(),
      onPaymentFilterChange: jest.fn(),
      onSearchQueryChange: jest.fn(),
      onStatusFilterChange: jest.fn(),
      onViewChange: jest.fn(),
      paymentFilter: 'all',
      paymentFilterOptions: ['CASH', 'MOMO'],
      searchQuery: 'demo',
      statusFilter: 'all',
      statusFilterOptions: ['OPEN_MATCHING', 'NO_SHOW'],
      view: 'active',
      viewCounts: new Map([
        ['active', 3],
        ['all', 7],
      ]),
      viewOptions,
      visibleBookingCount: 3,
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Booking operation filters');
    expect(rendered).toContain('Active queue: Active bookings - Current active bookings.');
    expect(rendered).toContain('Showing 3 of 7');
    expect(rendered).toContain('All statuses');
    expect(rendered).toContain('CASH');
    expect(rendered).toContain('Payment / wallet check');
    expect(rendered).toContain('Active bookings ( 3 )');
    expect(rendered).toContain('All bookings ( 7 )');
    expect(rendered).toContain('Start with active bookings.');
  });

  it('wires the clear filters action', () => {
    const onClearFilters = jest.fn();
    const section = BookingMonitorFiltersSection({
      activeView: viewOptions[1],
      baseVisibleBookingCount: 7,
      evidenceFilter: 'money',
      evidenceFilterOptions: [{ label: 'All evidence', value: 'all' }],
      onClearFilters,
      onEvidenceFilterChange: jest.fn(),
      onPaymentFilterChange: jest.fn(),
      onSearchQueryChange: jest.fn(),
      onStatusFilterChange: jest.fn(),
      onViewChange: jest.fn(),
      paymentFilter: 'CASH',
      paymentFilterOptions: [],
      searchQuery: 'demo',
      statusFilter: 'NO_SHOW',
      statusFilterOptions: [],
      view: 'all',
      viewCounts: new Map(),
      viewOptions,
      visibleBookingCount: 7,
    });
    const clearButton = buttonsIn(section).find((button) =>
      normalizedText(button.props?.children).includes('Clear list filters'),
    );

    clearButton?.props?.onClick?.();
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(normalizedText(section)).toContain('Showing 7 of 7');
  });
});
