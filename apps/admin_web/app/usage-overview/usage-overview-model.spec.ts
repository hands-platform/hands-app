import {
  buildUsageActionPriorities,
  usageOverviewWithDefaults,
  normalizeUsageOverviewRange,
  usageOverviewHref,
  usageOverviewRangeOptions,
} from './usage-overview-model';

describe('usage overview page model', () => {
  it('offers the low-cost usage ranges in the same order as operations filters', () => {
    expect(usageOverviewRangeOptions.map((option) => option.value)).toEqual([
      'today',
      'yesterday',
      '7d',
      'month',
      'all',
    ]);
  });

  it('builds stable range links without adding search or GPS parameters', () => {
    expect(usageOverviewHref('today')).toBe('/usage-overview?range=today');
    expect(usageOverviewHref('all')).toBe('/usage-overview?range=all');
  });

  it('defaults usage overview to today for the initial operations view', () => {
    expect(normalizeUsageOverviewRange(undefined)).toBe('today');
    expect(normalizeUsageOverviewRange('bad-input')).toBe('today');
  });

  it('fills Phase 2 usage sections when the API returns an older partial payload', () => {
    const overview = usageOverviewWithDefaults(
      {
        generatedAt: '2026-07-01T00:00:00.000Z',
        refreshSeconds: 60,
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

  it('builds operator action priorities from aggregate usage signals', () => {
    const overview = usageOverviewWithDefaults(
      {
        generatedAt: '2026-07-01T00:00:00.000Z',
        refreshSeconds: 60,
        source: 'stored-usage-aggregates',
        range: '7d',
        rangeLabel: 'Last 7 days',
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
      },
      '7d',
    );

    const priorities = buildUsageActionPriorities(overview);

    expect(priorities.map((priority) => priority.key)).toEqual([
      'issue-signal',
      'churn-risk',
      'new-unbooked',
      'discovery-dropoff',
      'completion-dropoff',
    ]);
    expect(priorities[0]).toMatchObject({
      label: 'Review problem customers',
      tone: 'danger',
      value: 6,
      valueLabel: 'customers',
    });
    expect(priorities[3]).toMatchObject({
      label: 'Improve Partner discovery',
      value: 13,
      valueLabel: 'view-to-request',
    });
    expect(priorities[4]).toMatchObject({
      label: 'Watch booking completion',
      value: 80,
      valueLabel: 'request-to-complete',
    });
  });
});
