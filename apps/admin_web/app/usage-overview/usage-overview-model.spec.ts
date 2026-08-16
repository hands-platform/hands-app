import {
  buildUsageActionPriorities,
  usageOverviewWithDefaults,
  normalizeUsageOverviewRange,
  usageOverviewCustomHref,
  usageOverviewHref,
  usageOverviewRangeOptions,
  validateUsageCustomRange,
} from './usage-overview-model';

describe('usage overview page model', () => {
  it('offers the low-cost usage ranges in the same order as operations filters', () => {
    expect(usageOverviewRangeOptions.map((option) => option.value)).toEqual([
      'today',
      'yesterday',
      '7d',
      '30d',
      'month',
      'custom',
    ]);
    expect(usageOverviewRangeOptions.find((option) => option.value === 'month')?.label).toBe('This month');
  });

  it('builds stable range links without adding search or GPS parameters', () => {
    expect(usageOverviewHref('today')).toBe('/usage-overview?range=today');
    expect(usageOverviewCustomHref('2026-08-13')).toBe(
      '/usage-overview?range=custom&from=2026-08-07&to=2026-08-13',
    );
    expect(usageOverviewRangeOptions.some((option) => option.value === ('all' as never))).toBe(false);
  });

  it('defaults usage overview to today for the initial operations view', () => {
    expect(normalizeUsageOverviewRange(undefined)).toBe('today');
    expect(normalizeUsageOverviewRange('bad-input')).toBe('today');
  });

  it('fills Phase 2 usage sections when the API returns an older partial payload', () => {
    const overview = usageOverviewWithDefaults(
      {
        generatedAt: '2026-07-01T00:00:00.000Z',
        source: 'stored-usage-aggregates',
        range: '7d',
        rangeLabel: 'Last 7 days',
        totals: {
          customerSessionCount: 4,
          completedBookingCount: 2,
          partnerBookingRequestCount: 3,
          partnerProfileViewCount: 8,
        },
      },
      '7d',
    );

    expect(overview.customerLifecycle).toMatchObject({
      active30dCustomerCount: 0,
      churnRiskCustomerCount: 0,
      repeatCustomerCount: 0,
    });
    expect(overview.bookingQuality.createdBookingCount).toBe(0);
    expect(overview.bookingQuality.lowReviewCount).toBe(0);
    expect(overview.paymentAndCoupon.paymentFailureCount).toBe(0);
    expect(overview.paymentAndCoupon.refundAmount).toBe(0);
    expect(overview.paymentAndCoupon.paymentMethodMix).toEqual([]);
    expect(overview.behavior.popularServices).toEqual([]);
    expect(overview.behavior.hourlyActivity).toHaveLength(24);
    expect(overview.behavior.hourlyActivity[0]).toMatchObject({
      hour: 0,
      label: '00:00',
      totalActivityCount: 0,
    });
    expect(overview.customerSegments).toMatchObject({
      newUnbookedCustomerCount: 0,
      firstCompletedCustomerCount: 0,
      repeatCustomerCount: 0,
      vipCustomerCount: 0,
      churnRiskCustomerCount: 0,
      issueCustomerCount: 0,
    });
    expect(overview.platformUsage).toEqual([]);
    expect((overview.customerUsage as { qualityRiskCustomers?: unknown[] }).qualityRiskCustomers).toEqual([]);
    expect((overview.customerUsage as { lowReviewCustomers?: unknown[] }).lowReviewCustomers).toEqual([]);
    expect((overview.partnerUsage as { discoveryConversion?: unknown[] }).discoveryConversion).toEqual([]);
    expect(overview.totals.partnerProfileViewCount).toBe(8);
  });

  it('builds only count-parity actions with exact target dates', () => {
    const overview = usageOverviewWithDefaults(
      {
        generatedAt: '2026-07-01T00:00:00.000Z',
        source: 'stored-usage-aggregates',
        range: '7d',
        rangeLabel: 'Last 7 days',
        appliedRange: {
          dayCount: 7,
          fromDate: '2026-06-25',
          granularity: 'daily',
          toDate: '2026-07-01',
        },
        totals: {
          customerSessionCount: 100,
          completedBookingCount: 8,
          partnerBookingRequestCount: 10,
          partnerProfileViewCount: 80,
        },
        customerLifecycle: {
          newCustomerCount: 30,
          activeCustomerCount: 42,
          activeTodayCustomerCount: 12,
          active7dCustomerCount: 42,
          active30dCustomerCount: 64,
          completedCustomerCount: 9,
          repeatCustomerCount: 2,
          churnRiskCustomerCount: 5,
          neverBookedCustomerCount: 18,
        },
        customerSegments: {
          newUnbookedCustomerCount: 14,
          firstCompletedCustomerCount: 7,
          repeatCustomerCount: 2,
          vipCustomerCount: 1,
          churnRiskCustomerCount: 5,
          issueCustomerCount: 6,
        },
        bookingQuality: {
          unresolvedCount: 3,
        },
      },
      '7d',
    );

    const priorities = buildUsageActionPriorities(overview);

    expect(priorities.map((priority) => priority.key)).toEqual(['new-unbooked', 'unresolved-bookings']);
    expect(priorities[0]).toMatchObject({
      label: 'New customers without a verified production booking',
      tone: 'warning',
      value: 14,
      valueLabel: 'customers',
    });
    expect(priorities[0]?.href).toBe(
      '/customers?view=all&segment=usage-new-unbooked&dateField=joined&dateRange=custom&dateFrom=2026-06-25&dateTo=2026-07-01',
    );
    expect(priorities[1]).toMatchObject({
      label: 'Unresolved booking records',
      value: 3,
      valueLabel: 'bookings',
    });
    expect(priorities[1]?.href).toBe(
      '/bookings?dateFrom=2026-06-25&dateRange=custom&dateTo=2026-07-01&sort=oldest&view=usage-unresolved',
    );
    expect(JSON.stringify(priorities)).not.toContain('conversion');
    expect(JSON.stringify(priorities)).not.toContain('segment=issue');
    expect(JSON.stringify(priorities)).not.toContain('sort=profile-views');
  });

  it('uses singular action nouns for one record', () => {
    const overview = usageOverviewWithDefaults({
      bookingQuality: { unresolvedCount: 1 },
      customerSegments: { newUnbookedCustomerCount: 1 },
      generatedAt: '2026-07-01T00:00:00.000Z',
      range: '7d',
      rangeLabel: 'Last 7 days',
      source: 'stored-usage-aggregates',
    }, '7d');

    expect(buildUsageActionPriorities(overview).map((item) => item.valueLabel)).toEqual([
      'customer',
      'booking',
    ]);
  });

  it('rejects invalid custom ranges without silently changing them', () => {
    expect(validateUsageCustomRange('2026-07-10', '2026-07-01', '2026-07-20')).toContain('on or before');
    expect(validateUsageCustomRange('2026-07-01', '2026-07-21', '2026-07-20')).toContain('Future');
    expect(validateUsageCustomRange('2026-01-01', '2026-07-01', '2026-07-20')).toContain('90 days');
    expect(validateUsageCustomRange('not-a-date', '2026-07-01', '2026-07-20')).toContain('valid');
    expect(validateUsageCustomRange('2026-07-01', '2026-07-01', '2026-07-20')).toBeNull();
  });
});
