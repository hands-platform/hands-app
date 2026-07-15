import { BookingStatus } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  adminBookingListCustomDateBounds,
  adminBookingListDateBounds,
  adminBookingListStatusGroupWhere,
  adminBookingListWhere,
  endOfLocalDay,
  startOfLocalDay,
} from './admin-booking-list-query';

describe('admin booking list query', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps live booking statuses in the realtime group', () => {
    expect(adminBookingListStatusGroupWhere('realtime')).toEqual({
      status: {
        in: [
          BookingStatus.CREATED,
          BookingStatus.OPEN_MATCHING,
          BookingStatus.MATCHED,
          BookingStatus.PROVIDER_ON_THE_WAY,
          BookingStatus.ARRIVED,
          BookingStatus.IN_SERVICE,
        ],
      },
    });
  });

  it('keeps closed records out of the realtime group', () => {
    expect(adminBookingListStatusGroupWhere('completed')).toEqual({
      status: {
        in: [BookingStatus.COMPLETED, BookingStatus.EXPIRED, BookingStatus.REFUNDED],
      },
    });
    expect(adminBookingListStatusGroupWhere('unknown')).toBeUndefined();
  });

  it('combines date and status filters without changing the query shape', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));

    const where = adminBookingListWhere({ dateRange: 'today', statusGroup: 'realtime' });

    const filters = (where as { AND: unknown[] }).AND;
    expect(filters).toHaveLength(2);
    expect(filters[0]).toMatchObject({
      OR: expect.arrayContaining([
        {
          openedAt: {
            gte: new Date(2026, 6, 15),
            lte: new Date(endOfLocalDay(new Date(2026, 6, 15).getTime())),
          },
        },
      ]),
    });
    expect(filters[1]).toEqual(adminBookingListStatusGroupWhere('realtime'));
  });

  it('builds local-day period bounds and preserves reversed custom ranges', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));

    const todayStartMs = startOfLocalDay(Date.now());
    expect(adminBookingListDateBounds({ dateRange: '7d' })).toEqual({
      startMs: new Date(2026, 6, 9).getTime(),
      endMs: endOfLocalDay(todayStartMs),
    });

    expect(adminBookingListCustomDateBounds('2026-07-15', '2026-07-10')).toEqual({
      startMs: endOfLocalDay(new Date(2026, 6, 10).getTime()),
      endMs: new Date(2026, 6, 15).getTime(),
    });
  });
});
