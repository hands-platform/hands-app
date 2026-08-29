import {
  bookingListDefaultSort,
  buildBookingMonitorRouteLoadPlan,
} from './booking-monitor-route-load-plan';
import {
  COMPLETED_BOOKING_DEFAULT_VIEW,
  completedBookingViewOptions,
} from './booking-monitor-options';

describe('booking monitor route load plan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 18, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the exact server-counted needs-action queue by default', () => {
    const loadPlan = buildBookingMonitorRouteLoadPlan(undefined, 'all');
    const policyUrl = new URL(loadPlan.policySettingsHref, 'http://admin.local');

    expect(policyUrl.pathname).toBe('/admin/operational-policy');
    expect(policyUrl.searchParams.get('keys')?.split(',')).toEqual([
      'matching.provider_response_window_minutes',
      'matching.travel_buffer_minutes',
      'matching.marketplace_partner_radius_meters',
      'matching.marketplace_partner_location_max_age_minutes',
      'matching.marketplace_partner_invitation_limit',
      'wallet.negative_balance_gate',
    ]);
    expect(loadPlan.bookingsHref).toBe('/admin/bookings/page?statusGroup=needs-action&page=1&pageSize=20');
    expect(loadPlan.summaryHref).toBe('/admin/bookings/summary');
    expect(loadPlan.bookingGateAuditHref).toBeNull();
  });

  it('loads create rejection audit evidence only for the blocked-create view', () => {
    const loadPlan = buildBookingMonitorRouteLoadPlan({ view: 'blocked-create' }, 'all');
    const auditUrl = new URL(loadPlan.bookingGateAuditHref!, 'http://admin.local');

    expect(auditUrl.pathname).toBe('/admin/audit-logs');
    expect(auditUrl.searchParams.get('action')).toBe('booking.create.rejected');
    expect(auditUrl.searchParams.get('take')).toBe('20');
    expect(auditUrl.searchParams.get('from')).toBe(new Date(2026, 6, 18).toISOString());
    expect(auditUrl.searchParams.get('to')).toBe(new Date(2026, 6, 19).toISOString());
  });

  it('uses oldest-first defaults only for action queues', () => {
    expect(bookingListDefaultSort('all', 'attention')).toBe('oldest');
    expect(bookingListDefaultSort('all', 'matching-delays')).toBe('oldest');
    expect(bookingListDefaultSort('all', 'no-supply')).toBe('oldest');
    expect(bookingListDefaultSort('all', 'active')).toBe('newest');
    expect(bookingListDefaultSort('all', 'all')).toBe('newest');
  });

  it('keeps completed and cancellation route lists bounded with custom dates', () => {
    const completedPlan = buildBookingMonitorRouteLoadPlan(
      { dateRange: 'custom', dateFrom: '2026-06-01', dateTo: '2026-06-02' },
      'completed',
    );
    expect(completedPlan.bookingsHref).toBe(
      '/admin/bookings/page?dateRange=custom&statusGroup=completed-payment&page=1&pageSize=25&sort=oldest&dateFrom=2026-06-01&dateTo=2026-06-02',
    );
    expect(completedPlan.summaryHref).toBe(
      '/admin/bookings/completed-operations-summary?dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-02',
    );

    const cancellationPlan = buildBookingMonitorRouteLoadPlan({ dateRange: '7d' }, 'postMatchCancellations');
    expect(cancellationPlan.bookingsHref).toBe(
      '/admin/bookings/page?statusGroup=post-match-cancellations-review&page=1&pageSize=25&sort=oldest',
    );
    expect(cancellationPlan.summaryHref).toBe(
      '/admin/bookings/post-match-cancellations-summary?dateRange=7d',
    );
  });

  it('keeps the completed route default view and list cohort aligned', () => {
    const defaultPlan = buildBookingMonitorRouteLoadPlan(undefined, 'completed');
    const lastMonthPlan = buildBookingMonitorRouteLoadPlan({ dateRange: '30d' }, 'completed');
    const customPlan = buildBookingMonitorRouteLoadPlan(
      { dateFrom: '2026-06-01', dateRange: 'custom', dateTo: '2026-06-02' },
      'completed',
    );

    expect(completedBookingViewOptions[0]?.view).toBe(COMPLETED_BOOKING_DEFAULT_VIEW);
    expect(defaultPlan.bookingsHref).toBe(
      '/admin/bookings/page?dateRange=today&statusGroup=completed-payment&page=1&pageSize=25&sort=oldest',
    );
    expect(lastMonthPlan.bookingsHref).toContain('dateRange=30d&statusGroup=completed-payment');
    expect(customPlan.bookingsHref).toContain('statusGroup=completed-payment');
    expect(customPlan.bookingsHref).toContain('dateFrom=2026-06-01&dateTo=2026-06-02');
  });

  it('normalizes an invalid completed date range to today for list and summary queries', () => {
    const plan = buildBookingMonitorRouteLoadPlan({ dateRange: 'not-a-range' }, 'completed');

    expect(plan.bookingsHref).toBe(
      '/admin/bookings/page?dateRange=today&statusGroup=completed-payment&page=1&pageSize=25&sort=oldest',
    );
    expect(plan.summaryHref).toBe(
      '/admin/bookings/completed-operations-summary?dateRange=today',
    );
  });

  it.each(['yesterday', '7d', '30d'] as const)(
    'preserves the valid completed %s date range for list and summary queries',
    (dateRange) => {
      const plan = buildBookingMonitorRouteLoadPlan({ dateRange }, 'completed');

      expect(new URL(plan.bookingsHref, 'http://admin.local').searchParams.get('dateRange')).toBe(
        dateRange,
      );
      expect(new URL(plan.summaryHref, 'http://admin.local').searchParams.get('dateRange')).toBe(
        dateRange,
      );
    },
  );

  it('keeps explicit completed closeout on the closeout cohort', () => {
    const plan = buildBookingMonitorRouteLoadPlan({ view: 'closeout' }, 'completed');

    expect(plan.bookingsHref).toContain('statusGroup=completed-closeout');
    expect(plan.bookingsHref).toContain('sort=oldest');
  });

  it('normalizes an invalid completed view to the payment cohort', () => {
    const plan = buildBookingMonitorRouteLoadPlan(
      { dateRange: '30d', view: 'not-a-real-view' },
      'completed',
    );

    expect(plan.bookingsHref).toBe(
      '/admin/bookings/page?dateRange=30d&statusGroup=completed-payment&page=1&pageSize=25&sort=oldest',
    );
  });

  it('applies periods only to records and keeps live queues independent from creation date', () => {
    expect(buildBookingMonitorRouteLoadPlan({ dateRange: '7d', view: 'all' }, 'all').bookingsHref).toBe(
      '/admin/bookings/page?dateRange=7d&page=1&pageSize=20',
    );
    expect(buildBookingMonitorRouteLoadPlan({ dateRange: '7d', view: 'matching' }, 'all').bookingsHref).toBe(
      '/admin/bookings/page?statusGroup=matching&page=1&pageSize=20',
    );
    expect(
      buildBookingMonitorRouteLoadPlan({ dateRange: '7d', view: 'matching-delays' }, 'all').bookingsHref,
    ).toBe('/admin/bookings/page?statusGroup=matching-delays&page=1&pageSize=20');
    expect(buildBookingMonitorRouteLoadPlan({ dateRange: 'today', view: 'active' }, 'all').bookingsHref).toBe(
      '/admin/bookings/page?statusGroup=realtime&page=1&pageSize=20',
    );
    expect(
      buildBookingMonitorRouteLoadPlan({ dateRange: '30d', view: 'preferred-rejected' }, 'all').bookingsHref,
    ).toBe('/admin/bookings/page?dateRange=30d&statusGroup=preferred-rejected&page=1&pageSize=20');
  });

  it('maps the usage unresolved action to the same bounded server cohort', () => {
    const plan = buildBookingMonitorRouteLoadPlan(
      {
        dateFrom: '2026-07-13',
        dateRange: 'custom',
        dateTo: '2026-07-19',
        sort: 'oldest',
        view: 'usage-unresolved',
      },
      'all',
    );

    expect(plan.bookingsHref).toBe(
      '/admin/bookings/page?dateRange=custom&statusGroup=usage-unresolved&page=1&pageSize=20&sort=oldest&dateFrom=2026-07-13&dateTo=2026-07-19',
    );
  });

  it.each([
    ['first-pick', 'preferred-pending'],
    ['marketplace', 'marketplace-active'],
    ['customer-choice', 'customer-choice'],
    ['pre-match-cancelled', 'pre-match-cancellations'],
    ['preferred-rejected', 'preferred-rejected'],
    ['preferred-no-response', 'preferred-no-response'],
    ['matched', 'matched'],
    ['handoff-repair', 'handoff-repair'],
    ['no-supply', 'no-supply'],
    ['data-anomaly', 'data-anomaly'],
  ])('maps live and pre-match %s views to exact server groups', (view, statusGroup) => {
    const plan = buildBookingMonitorRouteLoadPlan({ view }, 'all');
    const url = new URL(plan.bookingsHref, 'http://admin.local');

    expect(url.searchParams.get('statusGroup')).toBe(statusGroup);
  });

  it('keeps the Live now client view and realtime server group aligned', () => {
    const plan = buildBookingMonitorRouteLoadPlan({ view: 'active' }, 'all');
    const url = new URL(plan.bookingsHref, 'http://admin.local');

    expect(url.searchParams.get('statusGroup')).toBe('realtime');
  });

  it('forwards bounded paging and operator search to the page API', () => {
    expect(
      buildBookingMonitorRouteLoadPlan({ page: '3', q: ' booking-123 ', view: 'attention' }, 'all')
        .bookingsHref,
    ).toBe('/admin/bookings/page?statusGroup=needs-action&page=3&pageSize=20&q=booking-123');
  });

  it('forwards queue age and oldest-first order to list and aggregate APIs', () => {
    const plan = buildBookingMonitorRouteLoadPlan(
      { age: 'over-24h', sla: 'overdue', sort: 'oldest', view: 'matching-delays' },
      'all',
    );

    expect(plan.bookingsHref).toBe(
      '/admin/bookings/page?statusGroup=matching-delays&page=1&pageSize=20&age=over-24h&sort=oldest&sla=overdue',
    );
  });

  it('forwards operator search to dedicated aggregate APIs without paging parameters', () => {
    const completedPlan = buildBookingMonitorRouteLoadPlan({ page: '4', q: ' booking-123 ' }, 'completed');

    expect(completedPlan.summaryHref).toBe(
      '/admin/bookings/completed-operations-summary?dateRange=today&q=booking-123',
    );
    expect(completedPlan.summaryHref).not.toContain('page=');
  });

  it('forwards a validated cancellation reason to the list and summary APIs', () => {
    const plan = buildBookingMonitorRouteLoadPlan(
      {
        cancellationReason: 'customer_not_found',
        dateRange: '30d',
        page: '2',
        view: 'post-match-cancellations',
      },
      'postMatchCancellations',
    );

    expect(plan.bookingsHref).toBe(
      '/admin/bookings/page?dateRange=30d&statusGroup=post-match-cancellations&page=2&pageSize=25&sort=newest&cancellationReason=CUSTOMER_NOT_FOUND',
    );
    expect(plan.summaryHref).toBe(
      '/admin/bookings/post-match-cancellations-summary?dateRange=30d',
    );

    const invalidPlan = buildBookingMonitorRouteLoadPlan(
      { cancellationReason: 'not-a-real-reason' },
      'postMatchCancellations',
    );
    expect(invalidPlan.bookingsHref).not.toContain('cancellationReason=');
    expect(invalidPlan.summaryHref).not.toContain('cancellationReason=');
  });

  it.each([
    ['payment', 'completed-payment'],
    ['cash-debt', 'completed-cash-debt'],
    ['closeout', 'completed-closeout'],
    ['pricing', 'completed-pricing'],
    ['refund-review', 'completed-refund'],
    ['expired', 'completed-expired'],
    ['all', 'completed'],
  ])('maps completed %s views to exact server operation groups', (view, statusGroup) => {
    const plan = buildBookingMonitorRouteLoadPlan({ dateRange: '30d', view }, 'completed');
    const url = new URL(plan.bookingsHref, 'http://admin.local');

    expect(url.searchParams.get('statusGroup')).toBe(statusGroup);
  });

  it.each([
    ['manual-decision', 'post-match-cancellations-review'],
    ['post-match-cancellations', 'post-match-cancellations'],
    ['no-show', 'post-match-cancellations-no-show'],
  ])('maps cancellation %s views to exact server operation groups', (view, statusGroup) => {
    const plan = buildBookingMonitorRouteLoadPlan({ dateRange: '30d', view }, 'postMatchCancellations');
    const url = new URL(plan.bookingsHref, 'http://admin.local');

    expect(url.searchParams.get('statusGroup')).toBe(statusGroup);
  });

  it('keeps open cancellation queues all-date and resolved records period-bound', () => {
    const needsDecision = buildBookingMonitorRouteLoadPlan(
      { dateRange: 'today', view: 'manual-decision' },
      'postMatchCancellations',
    );
    const noShow = buildBookingMonitorRouteLoadPlan(
      { dateRange: '7d', view: 'no-show' },
      'postMatchCancellations',
    );
    const records = buildBookingMonitorRouteLoadPlan(
      { view: 'post-match-cancellations' },
      'postMatchCancellations',
    );

    expect(needsDecision.bookingsHref).not.toContain('dateRange=');
    expect(needsDecision.bookingsHref).toContain('sort=oldest');
    expect(noShow.bookingsHref).not.toContain('dateRange=');
    expect(noShow.bookingsHref).toContain('sort=oldest');
    expect(records.bookingsHref).toContain('dateRange=30d');
    expect(records.bookingsHref).not.toContain('sort=oldest');
  });

  it.each([undefined, '', 'not-a-range'])(
    'normalizes post-match records dateRange %s to 30d for list and summary',
    (dateRange) => {
      const plan = buildBookingMonitorRouteLoadPlan(
        { dateRange, view: 'post-match-cancellations' },
        'postMatchCancellations',
      );
      const listUrl = new URL(plan.bookingsHref, 'http://admin.local');
      const summaryUrl = new URL(plan.summaryHref, 'http://admin.local');

      expect(listUrl.searchParams.get('dateRange')).toBe('30d');
      expect(summaryUrl.searchParams.get('dateRange')).toBe('30d');
      expect(plan.bookingsHref).not.toContain('not-a-range');
      expect(plan.summaryHref).not.toContain('not-a-range');
    },
  );

  it.each(['today', 'yesterday', '7d', '30d'] as const)(
    'preserves valid post-match records dateRange %s for list and summary',
    (dateRange) => {
      const plan = buildBookingMonitorRouteLoadPlan(
        { dateRange, view: 'post-match-cancellations' },
        'postMatchCancellations',
      );
      expect(new URL(plan.bookingsHref, 'http://admin.local').searchParams.get('dateRange')).toBe(
        dateRange,
      );
      expect(new URL(plan.summaryHref, 'http://admin.local').searchParams.get('dateRange')).toBe(
        dateRange,
      );
    },
  );

  it('preserves custom post-match dates for list and summary', () => {
    const plan = buildBookingMonitorRouteLoadPlan(
      {
        dateFrom: '2026-06-01',
        dateRange: 'custom',
        dateTo: '2026-06-02',
        view: 'post-match-cancellations',
      },
      'postMatchCancellations',
    );

    expect(plan.bookingsHref).toContain('dateRange=custom');
    expect(plan.bookingsHref).toContain('dateFrom=2026-06-01&dateTo=2026-06-02');
    expect(plan.summaryHref).toBe(
      '/admin/bookings/post-match-cancellations-summary?dateRange=custom&dateFrom=2026-06-01&dateTo=2026-06-02',
    );
  });

  it.each([
    [{ view: 'not-a-real-view' }, 'post-match-cancellations-review', null],
    [{ view: '' }, 'post-match-cancellations-review', null],
    [
      { view: ['post-match-cancellations', 'manual-decision'] as string[] },
      'post-match-cancellations',
      '30d',
    ],
  ] as const)('keeps invalid, empty, and array post-match views on the matching safe cohort', (params, statusGroup, dateRange) => {
    const plan = buildBookingMonitorRouteLoadPlan(params, 'postMatchCancellations');
    const listUrl = new URL(plan.bookingsHref, 'http://admin.local');

    expect(listUrl.searchParams.get('statusGroup')).toBe(statusGroup);
    expect(listUrl.searchParams.get('dateRange')).toBe(dateRange);
  });

  it('does not apply post-match cancellation reasons to the no-show queue', () => {
    const noShow = buildBookingMonitorRouteLoadPlan(
      { cancellationReason: 'CUSTOMER_NOT_FOUND', view: 'no-show' },
      'postMatchCancellations',
    );

    expect(noShow.bookingsHref).not.toContain('cancellationReason=');
  });
});
