import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { normalizedText } from './booking-section-test-utils';
import {
  BookingMonitorAdditionalQueuesSection,
  BookingMonitorFiltersSection,
} from './booking-monitor-filters-section';
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

  it('puts Needs action first and compacts zero-result default filters only', () => {
    const options = [
      { description: 'Live.', label: 'Live now', operatorHint: 'Monitor.', view: 'active' as const },
      { description: 'Act.', label: 'Needs action', operatorHint: 'Start here.', view: 'attention' as const },
      { description: 'Match.', label: 'Matching now', operatorHint: 'Monitor.', view: 'matching' as const },
      { description: 'Service.', label: 'In service', operatorHint: 'Monitor.', view: 'in-service' as const },
    ];
    const defaultMarkup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: options[1],
        baseVisibleBookingCount: 0,
        onViewChange: vi.fn(),
        view: 'attention',
        viewCounts: new Map(options.map((option) => [option.view, 0])),
        viewOptions: options,
        visibleBookingCount: 0,
      }),
    );
    const filteredMarkup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: options[1],
        baseVisibleBookingCount: 0,
        hasActiveFilters: true,
        onViewChange: vi.fn(),
        searchQuery: 'missing',
        view: 'attention',
        viewCounts: new Map(options.map((option) => [option.view, 0])),
        viewOptions: options,
        visibleBookingCount: 0,
      }),
    );

    expect(defaultMarkup.indexOf('Needs action 0')).toBeLessThan(defaultMarkup.indexOf('Live now 0'));
    expect(defaultMarkup).toContain('admin-queue-age-sort-controls is-compact');
    expect(filteredMarkup).not.toContain('admin-queue-age-sort-controls is-compact');
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
    expect(rendered).toContain('Historical · 2026-06-01 to 2026-06-19 · 7 records · Audit fixtures excluded');
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

  it('preserves active queue filters but resets pagination in search submissions', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: viewOptions[0],
        baseVisibleBookingCount: 0,
        dateRangeHiddenInputs: [
          ['view', 'matching'],
          ['age', 'under-1h'],
          ['sort', 'newest'],
          ['page', '3'],
        ],
        onViewChange: vi.fn(),
        view: 'matching',
        viewCounts: new Map(),
        viewOptions,
        visibleBookingCount: 0,
      }),
    );

    expect(markup).toContain('name="view" value="matching"');
    expect(markup).toContain('name="age" value="under-1h"');
    expect(markup).toContain('name="sort" value="newest"');
    expect(markup).not.toContain('name="page" value="3"');
  });

  it('remounts the search control when the applied query changes', () => {
    const renderWithQuery = (searchQuery: string) =>
      BookingMonitorFiltersSection({
        activeView: viewOptions[0],
        baseVisibleBookingCount: 0,
        onViewChange: vi.fn(),
        searchQuery,
        view: 'attention',
        viewCounts: new Map(),
        viewOptions,
        visibleBookingCount: 0,
      });

    expect(elementKeyWithName(renderWithQuery('first query'), 'q')).toBe('first query');
    expect(elementKeyWithName(renderWithQuery('second query'), 'q')).toBe('second query');
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
    const markup = renderToStaticMarkup(
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
    );
    const rendered = normalizedText(markup);
    const css = readFileSync('app/globals.css', 'utf8');

    expect(rendered).toContain('Needs action');
    expect(rendered).toContain('History');
    expect(rendered).toContain('Resolve payment and closeout exceptions.');
    expect(rendered).toContain('Browse expired and terminal records by closed period.');
    expect(rendered).toContain('2 empty checks');
    expect(rendered).not.toContain('Show 2 empty checks');
    expect(rendered).toContain('Counts overlap: All payment exceptions includes the cash and refund queues.');
    expect(markup.indexOf('>Refund mismatch</span>')).toBeLessThan(
      markup.indexOf('>Expired records</span>'),
    );
    expect(rendered.match(/Counts overlap:/g)).toHaveLength(1);
    expect(rendered).not.toContain('Additional queues');
    expect(rendered).toContain('booking-completed-disclosure-chevron');
    expect(markup).toContain('booking-completed-queue-group is-action');
    expect(markup).toContain('booking-completed-queue-group is-history');
    expect(markup.indexOf('2 empty checks')).toBeLessThan(markup.indexOf('>History</h3>'));
    expect(markup.match(/booking-completed-queue-count/g)).toHaveLength(5);
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toMatch(
      /booking-completed-queue-group[\s\S]*> \.booking-date-filter-button \{\s*min-height: 44px;/,
    );
    expect(css).toContain('grid-template-columns: minmax(150px, 0.24fr) minmax(0, 1fr);');
    expect(css).toContain('@media (min-width: 1600px)');
  });

  it('expands only the completed search row when reset actions are visible', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const completedMarkup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: viewOptions[2],
        baseVisibleBookingCount: 0,
        dateRangeFormAction: '/bookings/completed',
        hasActiveFilters: true,
        onViewChange: vi.fn(),
        searchQuery: 'missing',
        view: 'closeout',
        viewCounts: new Map([['closeout', 0]]),
        viewOptions: [viewOptions[2]],
        visibleBookingCount: 0,
      }),
    );
    const liveMarkup = renderToStaticMarkup(
      BookingMonitorFiltersSection({
        activeView: viewOptions[0],
        baseVisibleBookingCount: 0,
        hasActiveFilters: true,
        onViewChange: vi.fn(),
        searchQuery: 'missing',
        view: 'active',
        viewCounts: new Map([['active', 0]]),
        viewOptions: [viewOptions[0]],
        visibleBookingCount: 0,
      }),
    );

    expect(completedMarkup).toContain('booking-completed-search-form-expanded');
    expect(liveMarkup).not.toContain('booking-completed-search-form-expanded');
    expect(css).toContain('@media (min-width: 1101px) and (max-width: 1599px)');
    expect(css).toContain('.booking-completed-filter-panel .booking-monitor-search-form > :is(button, a)');
  });

  it('shows the payment queue overlap note only in related action contexts', () => {
    const options = [
      ['payment', 'All payment exceptions'],
      ['cash-debt', 'Cash commission'],
      ['refund-review', 'Refund mismatch'],
      ['expired', 'Expired records'],
      ['all', 'Terminal records'],
    ].map(([view, label]) => ({
      description: `${label} description`,
      label,
      operatorHint: `${label} hint`,
      view: view as Parameters<typeof BookingMonitorFiltersSection>[0]['view'],
    }));
    const renderFor = (view: Parameters<typeof BookingMonitorFiltersSection>[0]['view']) =>
      normalizedText(
        renderToStaticMarkup(
          BookingMonitorFiltersSection({
            activeView: options.find((option) => option.view === view) ?? options[0],
            baseVisibleBookingCount: 1,
            dateRangeFormAction: '/bookings/completed',
            onViewChange: vi.fn(),
            view,
            viewCounts: new Map(options.map((option) => [option.view, 1])),
            viewOptions: options,
            visibleBookingCount: 1,
          }),
        ),
      );

    for (const view of ['payment', 'cash-debt', 'refund-review'] as const) {
      expect(renderFor(view).match(/Counts overlap:/g)).toHaveLength(1);
    }
    for (const view of ['expired', 'all'] as const) {
      expect(renderFor(view)).not.toContain('Counts overlap:');
    }
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

describe('BookingMonitorAdditionalQueuesSection', () => {
  const directoryViewOptions = [
    {
      description: 'Needs action.',
      label: 'Needs action',
      operatorHint: 'Review.',
      view: 'attention' as const,
    },
    {
      description: 'Preferred pending.',
      label: 'Preferred pending',
      operatorHint: 'Monitor.',
      view: 'first-pick' as const,
    },
    {
      description: 'Open matching.',
      label: 'Open matching',
      operatorHint: 'Monitor.',
      view: 'marketplace' as const,
    },
    {
      description: 'Customer choice.',
      label: 'Customer choice',
      operatorHint: 'Monitor.',
      view: 'customer-choice' as const,
    },
    {
      description: 'Matched handoff.',
      label: 'Matched / handoff',
      operatorHint: 'Monitor.',
      view: 'matched' as const,
    },
    {
      description: 'Matching delays.',
      label: 'Matching delays',
      operatorHint: 'Intervene.',
      view: 'matching-delays' as const,
    },
    {
      description: 'Supply intervention.',
      label: 'Supply intervention',
      operatorHint: 'Intervene.',
      view: 'no-supply' as const,
    },
    {
      description: 'Handoff repair.',
      label: 'Handoff repair',
      operatorHint: 'Intervene.',
      view: 'handoff-repair' as const,
    },
    {
      description: 'Data anomaly.',
      label: 'Data anomaly',
      operatorHint: 'Intervene.',
      view: 'data-anomaly' as const,
    },
  ];

  it.each(['first-pick', 'marketplace', 'customer-choice', 'matched'] as const)(
    'opens the native directory and exposes the active %s queue',
    (view) => {
      const markup = renderToStaticMarkup(
        BookingMonitorAdditionalQueuesSection({
          onViewChange: vi.fn(),
          view,
          viewCounts: new Map(),
          viewHrefFor: (nextView) => `/bookings?view=${nextView}`,
          viewOptions: directoryViewOptions,
        }),
      );

      expect(markup).toMatch(/<details[^>]*aria-label="Browse booking queue directory"[^>]*open=""[^>]*>/);
      expect(markup).toContain('<summary class="booking-monitor-queue-directory-summary">');
      expect(markup).toContain('aria-current="page"');
      expect(markup).toContain(`href="/bookings?view=${view}"`);
    },
  );

  it('keeps the directory closed for the default Needs action queue', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorAdditionalQueuesSection({
        onViewChange: vi.fn(),
        view: 'attention',
        viewCounts: new Map(),
        viewHrefFor: (nextView) => `/bookings?view=${nextView}`,
        viewOptions: directoryViewOptions,
      }),
    );

    expect(markup).not.toMatch(/<details[^>]*aria-label="Browse booking queue directory"[^>]*open=""[^>]*>/);
    expect(markup).toContain('<summary class="booking-monitor-queue-directory-summary">');
  });

  it('keeps the clear exception state compact and explains the decision order', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorAdditionalQueuesSection({
        onViewChange: vi.fn(),
        view: 'attention',
        viewCounts: new Map(),
        viewHrefFor: (nextView) => `/bookings?view=${nextView}`,
        viewOptions: directoryViewOptions,
      }),
    );

    expect(markup).toContain('Stage &amp; exception queues');
    expect(markup).toContain('Exception queues needing review appear first.');
    expect(markup).toContain('Exceptions clear');
    expect(markup).toContain('booking-monitor-queue-directory-disclosure');
    expect(markup).not.toContain('No additional exceptions.');
  });

  it('still promotes an active zero-count exception above the directory', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorAdditionalQueuesSection({
        onViewChange: vi.fn(),
        view: 'matching-delays',
        viewCounts: new Map([['matching-delays', 0]]),
        viewHrefFor: (nextView) => `/bookings?view=${nextView}`,
        viewOptions: directoryViewOptions,
      }),
    );

    expect(markup).toContain('aria-label="Additional booking exceptions"');
    expect(markup).toContain('Matching delays 0');
    expect(markup).toContain('aria-current="page"');
    expect(markup).not.toContain('>Matching delays</strong>');
  });

  it('promotes non-zero exception queues once and reports how many need review', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorAdditionalQueuesSection({
        onViewChange: vi.fn(),
        view: 'attention',
        viewCounts: new Map([
          ['matching-delays', 2],
          ['no-supply', 1],
        ]),
        viewHrefFor: (nextView) => `/bookings?view=${nextView}`,
        viewOptions: directoryViewOptions,
      }),
    );

    expect(markup).toContain('2 queues need review');
    expect(markup).toContain('Matching delays 2');
    expect(markup).toContain('Supply intervention 1');
    expect(markup).not.toContain('>Matching delays</strong>');
    expect(markup).not.toContain('>Supply intervention</strong>');
    expect(normalizedText(markup)).toContain('6 views');
  });

  it('groups stage and intervention queues once in visual keyboard order', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorAdditionalQueuesSection({
        onViewChange: vi.fn(),
        view: 'marketplace',
        viewCounts: new Map(),
        viewHrefFor: (nextView) => `/bookings?view=${nextView}`,
        viewOptions: directoryViewOptions,
      }),
    );
    const monitorStart = markup.indexOf('id="booking-queue-directory-group-live-flow"');
    const interventionStart = markup.indexOf('id="booking-queue-directory-group-exceptions"');
    const monitorGroup = markup.slice(monitorStart, interventionStart);
    const interventionGroup = markup.slice(interventionStart);

    expect(normalizedText(markup)).toContain('Monitor stages');
    expect(markup).toContain('Intervention &amp; repair');
    expect(normalizedText(markup)).toContain(
      'Follow bookings through matching, customer choice, and handoff.',
    );
    expect(normalizedText(markup)).toContain('Investigate delayed, missing, or inconsistent booking states.');
    expect(normalizedText(markup)).toContain('8 views');
    expect(normalizedText(markup)).toContain('Current');
    for (const label of ['Preferred pending', 'Open matching', 'Customer choice', 'Matched / handoff']) {
      expect(monitorGroup).toContain(label);
      expect(interventionGroup).not.toContain(label);
      expect(markup.match(new RegExp(`>${label}</strong>`, 'g'))).toHaveLength(1);
    }
    for (const label of ['Matching delays', 'Supply intervention', 'Handoff repair', 'Data anomaly']) {
      expect(interventionGroup).toContain(label);
      expect(monitorGroup).not.toContain(label);
      expect(markup.match(new RegExp(`>${label}</strong>`, 'g'))).toHaveLength(1);
    }
    expect(markup.indexOf('>Preferred pending</strong>')).toBeLessThan(
      markup.indexOf('>Open matching</strong>'),
    );
    expect(markup.indexOf('>Open matching</strong>')).toBeLessThan(
      markup.indexOf('>Customer choice</strong>'),
    );
    expect(markup.indexOf('>Customer choice</strong>')).toBeLessThan(
      markup.indexOf('>Matched / handoff</strong>'),
    );
    expect(markup.indexOf('>Matching delays</strong>')).toBeLessThan(
      markup.indexOf('>Supply intervention</strong>'),
    );
    expect(markup.indexOf('>Supply intervention</strong>')).toBeLessThan(
      markup.indexOf('>Handoff repair</strong>'),
    );
    expect(markup.indexOf('>Handoff repair</strong>')).toBeLessThan(markup.indexOf('>Data anomaly</strong>'));
    expect(markup.match(/>0 bookings<\/strong>/g)).toHaveLength(8);
    expect(markup).toContain('href="/bookings?view=marketplace"');
    expect(markup).toContain('aria-current="page"');
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

function elementKeyWithName(value: unknown, name: string): string | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const child of value) {
      const key = elementKeyWithName(child, name);
      if (key !== null) return key;
    }
    return null;
  }

  const element = readRecord(value);
  const props = readRecord(element?.props);
  if (props?.name === name && typeof element?.key === 'string') return element.key;
  return elementKeyWithName(props?.children, name);
}
