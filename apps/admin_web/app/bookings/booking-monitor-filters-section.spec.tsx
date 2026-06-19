import { renderToStaticMarkup } from 'react-dom/server';

import { normalizedText } from './booking-section-test-utils';
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
    {
      description: 'Completed booking closeout.',
      label: 'Closeout ops',
      operatorHint: 'Use this for closeout review.',
      view: 'closeout' as const,
    },
    {
      description: 'Bookings waiting for post-match cancellation review.',
      label: 'Post-match cancellations',
      operatorHint: 'Use this for post-match cancellation review.',
      view: 'post-match-cancellations' as const,
    },
    {
      description: 'Bookings closed as no-show.',
      label: 'No-show',
      operatorHint: 'Use this for no-show evidence review.',
      view: 'no-show' as const,
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
        ['closeout', 2],
        ['post-match-cancellations', 1],
        ['no-show', 0],
      ]),
      viewOptions,
      visibleBookingCount: 3,
    });
    const rendered = normalizedText(renderToStaticMarkup(section));

    expect(rendered).toContain('Booking operation filters');
    expect(rendered).toContain('Active queue:');
    expect(rendered).toContain('Active bookings');
    expect(rendered).toContain('Current active bookings.');
    expect(rendered).toContain('Showing 3 of 7');
    expect(rendered).toContain('All statuses');
    expect(rendered).toContain('CASH');
    expect(rendered).toContain('Payment / wallet check');
    expect(rendered).toContain('Active bookings (3)');
    expect(rendered).toContain('All bookings (7)');
    expect(rendered).toContain('Realtime Bookings');
    expect(rendered).toContain('Completed');
    expect(rendered).toContain('Closeout ops (2)');
    expect(rendered).toContain('Post-match Cancellations');
    expect(rendered).toContain('Post-match cancellations (1)');
    expect(rendered).not.toContain('No-show (0)');
    expect(rendered).toContain('Start with active bookings.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-form-search booking-monitor-search',
        'admin-form-select booking-monitor-select',
        'admin-form-control-button booking-monitor-clear',
      ]),
    );
  });

  it('keeps the active view visible even when its count is zero', () => {
    const rendered = normalizedText(
      renderToStaticMarkup(
        BookingMonitorFiltersSection({
          activeView: viewOptions[4],
          baseVisibleBookingCount: 0,
          evidenceFilter: 'all',
          evidenceFilterOptions: [{ label: 'All evidence', value: 'all' }],
          onClearFilters: jest.fn(),
          onEvidenceFilterChange: jest.fn(),
          onPaymentFilterChange: jest.fn(),
          onSearchQueryChange: jest.fn(),
          onStatusFilterChange: jest.fn(),
          onViewChange: jest.fn(),
          paymentFilter: 'all',
          paymentFilterOptions: [],
          searchQuery: '',
          statusFilter: 'all',
          statusFilterOptions: [],
          view: 'no-show',
          viewCounts: new Map([
            ['active', 3],
            ['all', 7],
            ['closeout', 2],
            ['post-match-cancellations', 0],
            ['no-show', 0],
          ]),
          viewOptions,
          visibleBookingCount: 0,
        }),
      ),
    );

    expect(rendered).toContain('No-show (0)');
    expect(rendered).toContain('All bookings (7)');
    expect(rendered).toContain('Post-match Cancellations');
    expect(rendered).not.toContain('Post-match cancellations (0)');
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
    expect(normalizedText(renderToStaticMarkup(section))).toContain('Showing 7 of 7');
  });

  it('renders only the provided route workspace categories', () => {
    const rendered = normalizedText(
      renderToStaticMarkup(
        BookingMonitorFiltersSection({
          activeView: viewOptions[2],
          baseVisibleBookingCount: 2,
          evidenceFilter: 'all',
          evidenceFilterOptions: [{ label: 'All evidence', value: 'all' }],
          onClearFilters: jest.fn(),
          onEvidenceFilterChange: jest.fn(),
          onPaymentFilterChange: jest.fn(),
          onSearchQueryChange: jest.fn(),
          onStatusFilterChange: jest.fn(),
          onViewChange: jest.fn(),
          paymentFilter: 'all',
          paymentFilterOptions: [],
          searchQuery: '',
          statusFilter: 'all',
          statusFilterOptions: [],
          view: 'closeout',
          viewCounts: new Map([
            ['active', 3],
            ['all', 7],
            ['closeout', 2],
            ['post-match-cancellations', 1],
          ]),
          viewOptions: [viewOptions[2]],
          visibleBookingCount: 2,
        }),
      ),
    );

    expect(rendered).toContain('Completed');
    expect(rendered).toContain('Closeout ops (2)');
    expect(rendered).not.toContain('Realtime Bookings');
    expect(rendered).not.toContain('Post-match Cancellations');
    expect(rendered).not.toContain('All bookings');
  });

  it('can show empty route workspace options on dedicated pages', () => {
    const rendered = normalizedText(
      renderToStaticMarkup(
        BookingMonitorFiltersSection({
          activeView: viewOptions[2],
          baseVisibleBookingCount: 2,
          evidenceFilter: 'all',
          evidenceFilterOptions: [{ label: 'All evidence', value: 'all' }],
          onClearFilters: jest.fn(),
          onEvidenceFilterChange: jest.fn(),
          onPaymentFilterChange: jest.fn(),
          onSearchQueryChange: jest.fn(),
          onStatusFilterChange: jest.fn(),
          onViewChange: jest.fn(),
          paymentFilter: 'all',
          paymentFilterOptions: [],
          searchQuery: '',
          showEmptyViewOptions: true,
          statusFilter: 'all',
          statusFilterOptions: [],
          view: 'closeout',
          viewCounts: new Map([
            ['closeout', 2],
            ['post-match-cancellations', 0],
          ]),
          viewOptions: [viewOptions[2], viewOptions[3]],
          visibleBookingCount: 2,
        }),
      ),
    );

    expect(rendered).toContain('Closeout ops (2)');
    expect(rendered).toContain('Post-match cancellations (0)');
  });
});

type TestButton = {
  readonly props?: {
    readonly children?: unknown;
    readonly onClick?: () => void;
  };
};

function buttonsIn(value: unknown): TestButton[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(buttonsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const current = record?.type === 'button' ? [value as TestButton] : [];
  return [...current, ...buttonsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
