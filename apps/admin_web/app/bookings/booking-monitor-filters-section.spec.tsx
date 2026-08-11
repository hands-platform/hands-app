import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { normalizedText } from './booking-section-test-utils';
import { BookingMonitorFiltersSection } from './booking-monitor-filters-section';
import { bookingCustomDateRangeError } from './booking-date-range-filter';

describe('BookingMonitorFiltersSection', () => {
  const viewOptions = [
    {
      description: 'Current active bookings.',
      label: 'Active bookings',
      operatorHint: 'Start with active bookings.',
      view: 'active' as const,
    },
    {
      description: 'Latest booking records.',
      label: 'Recent records',
      operatorHint: 'Use this for a quick recent lookup.',
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

    expect(rendered).toContain('Booking queues');
    expect(rendered).not.toContain('Current workspace:');
    expect(rendered).toContain('Active bookings 3');
    expect(rendered).toContain('Start with active bookings.');
    expect(rendered).not.toContain('View: Active bookings');
    expect(rendered).not.toContain('Period: Last 7 days');
    expect(rendered).not.toContain('Total: 7');
    expect(rendered).toContain('Today');
    expect(rendered).toContain('Previous day');
    expect(rendered).toContain('Last 7 days');
    expect(rendered).toContain('Last month');
    expect(rendered).toContain('Custom dates');
    expect(rendered).not.toContain('All dates');
    expect(rendered).not.toContain('All statuses');
    expect(rendered).not.toContain('Payment method');
    expect(rendered).not.toContain('Evidence filter');
    expect(rendered).toContain('Search bookings');
    expect(rendered).toContain('Booking ID, customer, Partner, or address');
    expect(rendered).toContain('Requested');
    expect(rendered).toContain('Active bookings');
    expect(rendered).toContain('Recent records');
    expect(rendered).toContain('Additional queues');
    expect(rendered).not.toContain('shown');
    expect(rendered).toContain('Closeout ops');
    expect(rendered).toContain('Post-match cancellations');
    expect(rendered).not.toContain('No-show');
    expect(renderToStaticMarkup(section)).toContain('aria-current="page"');
    expect(renderToStaticMarkup(section)).toContain('aria-label="Primary booking queues"');
    expect(renderToStaticMarkup(section)).toContain('aria-label="Additional booking queues"');
    expect(renderToStaticMarkup(section)).toContain('<details aria-label="Additional booking queues"');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'booking-date-filter-bar admin-mt-14',
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

    expect(rendered).toContain('No-show');
    expect(rendered).toContain('Recent records');
    expect(rendered).toContain('Additional queues');
    expect(rendered).not.toContain('Post-match cancellations');
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
      viewOptions: [
        viewOptions[1],
        {
          description: 'Cancelled before matching.',
          label: 'Pre-match cancelled',
          operatorHint: 'Review pre-match cancellation records.',
          view: 'pre-match-cancelled',
        },
        {
          description: 'Preferred Partner rejected.',
          label: 'Preferred rejected',
          operatorHint: 'Review preferred rejection records.',
          view: 'preferred-rejected',
        },
        {
          description: 'Preferred Partner did not respond.',
          label: 'Preferred no response',
          operatorHint: 'Review preferred no-response records.',
          view: 'preferred-no-response',
        },
      ],
      visibleBookingCount: 7,
    });
    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Custom dates');
    expect(rendered).not.toContain('Period: 2026-06-01 to 2026-06-19');
    expect(markup).toContain('name="dateFrom"');
    expect(markup).toContain('name="dateTo"');
    expect(markup).toContain('value="2026-06-01"');
    expect(markup).toContain('value="2026-06-19"');
    expect(rendered).toContain('Apply dates');
    expect(markup).toContain('admin-form-control-button button button-primary booking-date-apply-button');
    expect(rendered).toContain('All records 0');
    expect(rendered.indexOf('All records 0')).toBeLessThan(rendered.indexOf('Pre-match cancelled 0'));
    expect(rendered).toContain(
      'Historical · 2026-06-01 to 2026-06-19 · 7 records · Audit fixtures excluded',
    );
    expect(rendered).toContain('Back to live bookings');
    expect(rendered).toContain('Report period');
    expect(rendered).toContain('Order');
    expect(rendered).not.toContain('Requested');
  });

  it('validates custom dates and keeps the current query until dates are applied', () => {
    expect(bookingCustomDateRangeError('', '')).toBe('Choose a valid start date and end date.');
    expect(bookingCustomDateRangeError('2026-06-02', '2026-06-01')).toBe(
      'Start date must be on or before end date.',
    );
    expect(bookingCustomDateRangeError('2026-01-01', '2026-04-01')).toBe(
      'Custom date range cannot exceed 90 days.',
    );
    expect(bookingCustomDateRangeError('2026-01-01', '2026-03-31')).toBeNull();

    const markup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: viewOptions[1],
        baseVisibleBookingCount: 7,
        customDateError: 'Choose a valid start date and end date.',
        dateRangeFilter: 'custom',
        dateRangeFilterOptions: [{ label: 'Custom dates', value: 'custom' }],
        dateRangeHiddenInputs: [
          ['view', 'all'],
          ['q', 'customer'],
          ['sort', 'oldest'],
          ['page', '3'],
        ],
        onViewChange: vi.fn(),
        view: 'all',
        viewCounts: new Map(),
        viewOptions,
        visibleBookingCount: 7,
      }),
    );

    expect(markup).toContain('aria-describedby="booking-custom-date-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-label="Start date"');
    expect(markup).toContain('aria-label="End date"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('name="view" value="all"');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('name="sort" value="oldest"');
    expect(markup).not.toContain('name="page" value="3"');
  });

  it('separates completed action queues from history and hides inactive checks', () => {
    const completedOptions = [
      ['payment', 'All payment exceptions'],
      ['cash-debt', 'Cash commission'],
      ['closeout', 'Closeout records'],
      ['pricing', 'Pricing'],
      ['refund-review', 'Refund mismatch'],
      ['expired', 'Expired records'],
      ['all', 'Terminal records'],
    ].map(([view, label]) => ({
      description: `${label} description`,
      label,
      operatorHint: `${label} hint`,
      view: view as Parameters<typeof BookingMonitorFiltersSection>[0]['view'],
    }));
    const rendered = normalizedText(
      renderToStaticMarkup(
        BookingMonitorFiltersSection({
          activeView: completedOptions[0],
          baseVisibleBookingCount: 5,
          dateRangeFormAction: '/bookings/completed',
          onViewChange: vi.fn(),
          showEmptyViewOptions: true,
          view: 'payment',
          viewCounts: new Map([
            ['payment', 5],
            ['cash-debt', 1],
            ['refund-review', 2],
            ['closeout', 0],
            ['pricing', 0],
            ['expired', 3],
            ['all', 9],
          ]),
          viewOptions: completedOptions,
          visibleBookingCount: 5,
        }),
      ),
    );

    expect(rendered).toContain('Needs action');
    expect(rendered).toContain('History');
    expect(rendered).toContain('Show 2 empty checks');
    expect(rendered).toContain(
      'Counts overlap: All payment exceptions includes the cash and refund queues.',
    );
    expect(rendered.indexOf('Refund mismatch 2')).toBeLessThan(rendered.indexOf('Expired records 3'));
    expect(rendered.match(/Counts overlap:/g)).toHaveLength(1);
    expect(rendered).not.toContain('Additional queues');
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

    expect(rendered).toContain('Closeout ops');
    expect(rendered).not.toContain('Live / Today');
    expect(rendered).not.toContain('Cancellation Review');
    expect(rendered).not.toContain('Recent records');
  });

  it('uses the shared Vuexy segmented atom for route workspace filters', () => {
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
    expect(source).not.toContain('AdminFilterChipGroup');
    expect(source).not.toContain('AdminFilterSummary');
    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<section className="booking-monitor-view-category"');
    expect(source).toContain('AdminDisclosure');
    expect(source).not.toContain('<fieldset className="booking-monitor-view-category"');
    expect(source).not.toContain('<legend className="booking-monitor-view-category-heading">');
    expect(markup).toContain(
      'booking-date-filter-buttons booking-monitor-view-options booking-monitor-primary-queues',
    );
    expect(markup).toContain('aria-label="Additional booking queues"');
    expect(markup).toContain('booking-date-filter-button is-active');
    expect(markup).toContain('href="?view=active"');
  });

  it('shows existing queue counts without a duplicate result summary', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: viewOptions[0],
        baseVisibleBookingCount: 7,
        onViewChange: vi.fn(),
        view: 'active',
        viewCounts: new Map([
          ['active', 3],
          ['matching', 3],
          ['all', 7],
        ]),
        viewOptions: [
          viewOptions[0],
          {
            description: 'Matching work.',
            label: 'Matching ops',
            operatorHint: 'Review matching.',
            view: 'matching',
          },
          viewOptions[1],
        ],
        visibleBookingCount: 3,
      }),
    );

    expect(markup).toContain('aria-label="Primary booking queues"');
    expect(markup).toContain('Active bookings 3');
    expect(markup).toContain('Matching ops 3');
    expect(markup).toContain('aria-label="Additional booking queues"');
    expect(markup).not.toContain('booking-monitor-view-category-count');
    expect(markup).not.toContain('6 shown');
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

    expect(rendered).toContain('Closeout ops');
    expect(rendered).toContain('Post-match cancellations');
    expect(rendered).toContain('Closeout ops 2');
    expect(rendered).toContain('Post-match cancellations 0');
    expect(rendered).toContain('Show empty queues');
  });

  it('renders the structured cancellation reason filter only when configured', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: viewOptions[3],
        baseVisibleBookingCount: 4,
        cancellationReasonFilter: 'CUSTOMER_NOT_FOUND',
        cancellationReasonFilterOptions: [
          { label: 'All cancellation reasons', value: 'all' },
          { label: 'Could not meet customer', value: 'CUSTOMER_NOT_FOUND' },
        ],
        dateRangeHiddenInputs: [
          ['view', 'post-match-cancellations'],
          ['cancellationReason', 'CUSTOMER_NOT_FOUND'],
        ],
        onViewChange: vi.fn(),
        view: 'post-match-cancellations',
        viewCounts: new Map([['post-match-cancellations', 4]]),
        viewOptions: [viewOptions[3]],
        visibleBookingCount: 4,
      }),
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Cancellation reason');
    expect(rendered).toContain('Could not meet customer');
    expect(rendered).not.toContain('Reason: Could not meet customer');
    expect(rendered).toContain('Apply filters');
    expect(markup.match(/name="cancellationReason"/g)).toHaveLength(1);
    expect(markup).toContain('value="CUSTOMER_NOT_FOUND" selected=""');
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
