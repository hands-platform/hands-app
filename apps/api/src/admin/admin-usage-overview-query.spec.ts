import { AppUsageOrigin, BookingStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  APP_USAGE_DELAY_THRESHOLD_MS,
  getAdminUsageOverview,
  usageFreshnessStatus,
} from './admin-usage-overview-query';
import { adminUsageRangeWindow } from './admin-usage-overview';

describe('getAdminUsageOverview', () => {
  it('uses stored daily usage aggregates and returns linked, bounded analytics', async () => {
    const summary = {
      active30dCustomerCount: 18,
      active7dCustomerCount: 12,
      activeCustomerCount: 10,
      activeTodayCustomerCount: 4,
      appOpenCount: 42,
      bookingCustomerCount: 5,
      cancellationCount: 2,
      churnRiskCustomerCount: 3,
      completedBookingCount: 4,
      completedCustomerCount: 4,
      couponBookingCount: 1,
      createdBookingCount: 7,
      firstCompletedCustomerCount: 2,
      issueCustomerCount: 2,
      lowReviewCount: 1,
      noShowCount: 0,
      expiredCount: 0,
      neverBookedCustomerCount: 8,
      newCustomerCount: 6,
      newUnbookedCustomerCount: 2,
      partnerBookingRequestCount: 6,
      partnerProfileViewCount: 30,
      paymentFailureCount: 1,
      refundAmount: 10000,
      refundCount: 1,
      unresolvedCount: 0,
      repeatCustomerCount: 2,
      sessionStartCount: 20,
      totalEventCount: 92,
      vipCustomerCount: 1,
    };
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([summary])
      .mockResolvedValueOnce([{ ...summary, activeCustomerCount: 8, appOpenCount: 35 }])
      .mockResolvedValueOnce([{
        activeCustomerCount: 10,
        viewedCustomerCount: 7,
        bookingCustomerCount: 5,
        completedCustomerCount: 4,
      }])
      .mockResolvedValueOnce([
        { eligibleCustomerCount: 20, milestone: 1, returnedCustomerCount: 12 },
        { eligibleCustomerCount: 18, milestone: 7, returnedCustomerCount: 8 },
        { eligibleCustomerCount: 10, milestone: 30, returnedCustomerCount: 3 },
      ])
      .mockResolvedValueOnce([{
        appOpenCount: 8,
        bookingRequestCount: 2,
        completedBookingCount: 1,
        label: '07/19',
        periodStart: new Date('2026-07-19T00:00:00.000Z'),
        providerProfileViewCount: 5,
        sessionStartCount: 4,
      }])
      .mockResolvedValueOnce([{
        appOpenCount: 8,
        completedBookingCount: 1,
        customerProfileId: 'customer-1',
        fullName: 'Customer One',
        issueCount: 0,
        lastActivityAt: new Date('2026-07-19T03:00:00.000Z'),
        phone: '0900000000',
        providerProfileViewCount: 5,
        sessionStartCount: 4,
        totalEventCount: 17,
        userId: 'user-1',
      }])
      .mockResolvedValueOnce([{
        city: 'Ha Noi',
        completedCount: 1,
        displayName: 'Partner One',
        lastActivityAt: new Date('2026-07-19T03:00:00.000Z'),
        phone: '0910000000',
        providerProfileId: 'partner-1',
        requestCount: 3,
        viewCount: 2,
      }])
      .mockResolvedValueOnce([{ amount: 250000, bookingCount: 2, method: 'CARD' }])
      .mockResolvedValueOnce([{
        active: true,
        amount: 500000,
        bookingCount: 2,
        durationMin: 60,
        name: 'Swedish massage',
        quantity: 2,
        serviceId: 'service-1',
      }])
      .mockResolvedValueOnce([{
        bookingRequestCount: 4,
        completedBookingCount: 2,
        regionCode: 'hanoi',
        cancellationCount: 1,
        expiredCount: 0,
        noShowCount: 0,
        refundedCount: 0,
        unresolvedCount: 1,
      }])
      .mockResolvedValueOnce([{
        active30dCustomerCount: 18,
        active7dCustomerCount: 12,
        activeTodayCustomerCount: 4,
        churnRiskCustomerCount: 3,
        neverBookedCustomerCount: 8,
      }])
      .mockResolvedValueOnce([{
        bookingActivityThroughAt: new Date('2026-07-19T03:00:00.000Z'),
        reviewActivityThroughAt: new Date('2026-07-19T03:30:00.000Z'),
        refundActivityThroughAt: new Date('2026-07-19T03:45:00.000Z'),
        unknownAggregateCount: 0,
        usageAggregatedThroughAt: new Date('2026-07-19T04:00:00.000Z'),
      }]);

    const overview = await getAdminUsageOverview(
      { $queryRaw: queryRaw } as never,
      { range: '7d' },
    );

    expect(overview).toMatchObject({
      source: 'stored-usage-aggregates',
      timeZone: 'Asia/Ho_Chi_Minh',
      totals: {
        activeCustomerCount: 10,
        appOpenCount: 42,
        customerSessionCount: 20,
      },
      comparison: { totals: { activeCustomerCount: 8, appOpenCount: 35 } },
      appliedRange: { dayCount: 7, granularity: 'daily' },
      dataThroughAt: '2026-07-19T04:00:00.000Z',
      provenance: { unknownAggregateCount: 0, usageFixtures: 'guaranteed' },
      freshness: {
        bookingActivityThroughAt: '2026-07-19T03:00:00.000Z',
        usageAggregatedThroughAt: '2026-07-19T04:00:00.000Z',
      },
      retention: [
        { milestone: 1, rate: 60 },
        { milestone: 7, rate: 44 },
        { milestone: 30, rate: 30 },
      ],
    });
    expect(overview.funnel.map((step) => step.count)).toEqual([10, 7, 5, 4]);
    expect(overview.funnel.every((step) => step.conversionRate === null || step.conversionRate <= 100)).toBe(true);
    expect(overview.partnerRankings[0]).toMatchObject({ viewCount: 2, requestCount: 3 });
    expect(overview.customerRankings[0]?.secondary).toBe('••••••0000');
    expect(JSON.stringify(overview)).not.toContain('0900000000');
    expect(JSON.stringify(overview)).not.toContain('0910000000');
    expect(overview.bookingQuality.createdBookingCount).toBe(
      overview.totals.completedBookingCount +
        overview.bookingQuality.cancellationCount +
        overview.bookingQuality.noShowCount +
        overview.bookingQuality.expiredCount +
        overview.bookingQuality.refundCount +
        overview.bookingQuality.unresolvedCount,
    );
    expect(overview.regionUsage).toHaveLength(1);
    expect(queryRaw).toHaveBeenCalledTimes(12);

    const sql = queryRaw.mock.calls
      .map(([query]) => (query as { strings?: string[] }).strings?.join(' ') ?? '')
      .join('\n');
    const summarySql = (queryRaw.mock.calls[0]?.[0] as { strings?: string[] }).strings?.join(' ') ?? '';
    const regionSql = (queryRaw.mock.calls[9]?.[0] as { strings?: string[] }).strings?.join(' ') ?? '';
    const aggregateQueries = queryRaw.mock.calls
      .map(([query]) => query as { strings?: string[]; values?: unknown[] })
      .filter((query) => query.strings?.join(' ').includes('"AppUsageDailyAggregate"'));
    const rawEventQueries = queryRaw.mock.calls
      .map(([query]) => query as { strings?: string[]; values?: unknown[] })
      .filter((query) => query.strings?.join(' ').includes('"AppUsageEvent"'));
    expect(sql).toContain('"AppUsageDailyAggregate"');
    expect(sql).toContain('booking."closedAt"');
    expect(sql).toContain('"origin"');
    expect(sql).toContain('PRODUCTION');
    expect(summarySql).not.toContain('booking."updatedAt"');
    expect(regionSql).not.toContain('booking."updatedAt"');
    expect(sql).toContain("booking.metadata #>> '{dataOrigin}'");
    expect(sql).not.toContain("event.metadata #>> '{dataOrigin}'");
    expect(aggregateQueries.length).toBeGreaterThan(0);
    expect(aggregateQueries.every((query) => query.values?.includes(AppUsageOrigin.PRODUCTION))).toBe(true);
    expect(rawEventQueries.every((query) => query.values?.includes(AppUsageOrigin.PRODUCTION))).toBe(true);
    expect((queryRaw.mock.calls[5]?.[0] as { values?: unknown[] }).values).toEqual(
      expect.arrayContaining([
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
        BookingStatus.NO_SHOW,
        BookingStatus.REFUNDED,
      ]),
    );
  });

  it('classifies production aggregate freshness without treating missing data as current', () => {
    const generatedAt = new Date('2026-08-10T05:00:00.000Z');
    const window = adminUsageRangeWindow('today', generatedAt);

    expect(usageFreshnessStatus(null, window, generatedAt)).toBe('unknown');
    expect(usageFreshnessStatus(
      new Date(generatedAt.getTime() - APP_USAGE_DELAY_THRESHOLD_MS - 1),
      window,
      generatedAt,
    )).toBe('delayed');
    expect(usageFreshnessStatus(
      new Date(generatedAt.getTime() - APP_USAGE_DELAY_THRESHOLD_MS),
      window,
      generatedAt,
    )).toBe('fresh');
  });
});
