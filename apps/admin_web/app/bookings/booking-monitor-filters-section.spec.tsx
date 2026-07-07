import { readFileSync } from 'node:fs';
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
      dateRangeFilter: '7d',
      dateRangeFilterOptions: [
        { label: 'Today', value: 'today' },
        { label: 'Previous day', value: 'yesterday' },
        { label: 'Last 7 days', value: '7d' },
        { label: 'Last month', value: '30d' },
        { label: 'Custom dates', value: 'custom' },
      ],
      onDateRangeFilterChange: vi.fn(),
      onViewChange: vi.fn(),
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
    expect(rendered).toContain('Today');
    expect(rendered).toContain('Previous day');
    expect(rendered).toContain('Last 7 days');
    expect(rendered).toContain('Last month');
    expect(rendered).toContain('Custom dates');
    expect(rendered).not.toContain('All dates');
    expect(rendered).not.toContain('All statuses');
    expect(rendered).not.toContain('Payment method');
    expect(rendered).not.toContain('Evidence filter');
    expect(rendered).not.toContain('Search booking/customer/Partner');
    expect(rendered).not.toContain('Clear list filters');
    expect(rendered).toContain('Active bookings (3)');
    expect(rendered).toContain('All bookings (7)');
    expect(rendered).toContain('Realtime Bookings');
    expect(rendered).toContain('Completed');
    expect(rendered).toContain('Closeout ops (2)');
    expect(rendered).toContain('Post-match Cancellations');
    expect(rendered).toContain('Post-match cancellations (1)');
    expect(rendered).not.toContain('No-show (0)');
    expect(rendered).toContain('Start with active bookings.');
    expect(renderToStaticMarkup(section)).toContain('aria-current="page"');
    expect(renderToStaticMarkup(section)).toContain('<fieldset class="booking-monitor-view-category">');
    expect(renderToStaticMarkup(section)).toContain('<legend class="booking-monitor-view-category-heading">');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'booking-date-filter-bar admin-mb-14',
        'booking-date-filter-buttons',
        'booking-date-filter-button is-active',
      ]),
    );
  });

  it('keeps the active view visible even when its count is zero', () => {
    const rendered = normalizedText(
      renderToStaticMarkup(
        BookingMonitorFiltersSection({
          activeView: viewOptions[4],
          baseVisibleBookingCount: 0,
          onViewChange: vi.fn(),
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

  it('renders custom date inputs when the custom list period is selected', () => {
    const section = BookingMonitorFiltersSection({
      activeView: viewOptions[1],
      baseVisibleBookingCount: 7,
      customDateFrom: '2026-06-01',
      customDateTo: '2026-06-19',
      dateRangeFilter: 'custom',
      dateRangeFilterOptions: [{ label: 'Custom dates', value: 'custom' }],
      onCustomDateFromChange: vi.fn(),
      onCustomDateToChange: vi.fn(),
      onDateRangeFilterChange: vi.fn(),
      onViewChange: vi.fn(),
      view: 'all',
      viewCounts: new Map(),
      viewOptions,
      visibleBookingCount: 7,
    });
    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Custom dates');
    expect(markup).toContain('name="dateFrom"');
    expect(markup).toContain('name="dateTo"');
    expect(markup).toContain('value="2026-06-01"');
    expect(markup).toContain('value="2026-06-19"');
    expect(rendered).toContain('Apply dates');
    expect(markup).toContain('admin-form-control-button button button-primary booking-date-apply-button');
    expect(rendered).toContain('Showing 7 of 7');
  });

  it('renders only the provided route workspace categories', () => {
    const rendered = normalizedText(
      renderToStaticMarkup(
        BookingMonitorFiltersSection({
          activeView: viewOptions[2],
          baseVisibleBookingCount: 2,
          onViewChange: vi.fn(),
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

  it('uses the shared Vuexy button atom for route workspace options', () => {
    const source = readFileSync('app/bookings/booking-monitor-filters-section.tsx', 'utf8');
    const markup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: viewOptions[0],
        baseVisibleBookingCount: 7,
        onViewChange: vi.fn(),
        view: 'active',
        viewCounts: new Map([
          ['active', 3],
          ['all', 7],
        ]),
        viewOptions,
        visibleBookingCount: 3,
      }),
    );

    expect(source).not.toContain('<button\n                  key={option.view}');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<section className="booking-monitor-view-category"');
    expect(source).toContain('<fieldset className="booking-monitor-view-category"');
    expect(source).toContain('<legend className="booking-monitor-view-category-heading">');
    expect(markup).toContain('admin-form-control-button button button-secondary booking-monitor-view-option');
  });

  it('uses the shared Vuexy table panel wrapper for the filter card', () => {
    const source = readFileSync('app/bookings/booking-monitor-filters-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
    );
  });

  it('can show empty route workspace options on dedicated pages', () => {
    const rendered = normalizedText(
      renderToStaticMarkup(
        BookingMonitorFiltersSection({
          activeView: viewOptions[2],
          baseVisibleBookingCount: 2,
          onViewChange: vi.fn(),
          showEmptyViewOptions: true,
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
