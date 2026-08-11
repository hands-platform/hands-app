import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdminBooking, AdminPayment } from '../lib/admin-api';
import {
  bookingRegionLabel,
  buildBookingOperationsDeepDive,
  buildBookingOpsInsights,
  buildHourlyBookingDemand,
  buildPaymentMethodMix,
  buildRegionalBookingDemand,
  buildServiceDemandMix,
  isNoShowSignal,
} from './start-shift-booking-insights';

afterEach(() => {
  vi.useRealTimers();
});

describe('Start Shift booking insights', () => {
  it('keeps live, closed, and no-show signals in separate counters', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));

    const bookings = [
      booking('open', 'OPEN_MATCHING', {
        expiresAt: '2026-07-27T11:50:00.000Z',
        participants: [],
      }),
      booking('matched', 'MATCHED', {
        openedAt: '2026-07-27T10:00:00.000Z',
      }),
      booking('completed', 'COMPLETED'),
      booking('cancelled', 'CANCELLED'),
      booking('refunded', 'REFUNDED'),
    ];

    expect(buildBookingOpsInsights(bookings)).toMatchObject({
      active: 2,
      cancelled: 1,
      completed: 1,
      noShowSignal: 1,
      openMatching: 1,
      refunded: 1,
      total: 5,
    });

    expect(buildBookingOperationsDeepDive(bookings, [])).toMatchObject({
      expiredOpenMatching: 1,
      matchedWithoutChat: 1,
      openWithoutParticipants: 1,
    });
  });

  it('aggregates service demand and payment review evidence without mixing statuses', () => {
    const bookings = [
      booking('active', 'IN_SERVICE', {
        services: [
          {
            price: 300_000,
            quantity: 2,
            service: { durationMin: 60, name: 'Traditional massage' },
          },
        ],
      }),
      booking('completed', 'COMPLETED', {
        services: [
          {
            price: 300_000,
            quantity: 1,
            service: { durationMin: 60, name: 'Traditional massage' },
          },
        ],
      }),
    ];

    expect(buildServiceDemandMix(bookings)[0]).toMatchObject({
      active: 2,
      amount: 900_000,
      averagePrice: 300_000,
      completed: 1,
      label: 'Traditional massage / 60 min',
      total: 3,
    });

    expect(
      buildPaymentMethodMix([
        payment('authorized', 'CARD', 'AUTHORIZED', 'COMPLETED'),
        payment('captured', 'CARD', 'CAPTURED', 'COMPLETED'),
        payment('cash', 'CASH', 'PENDING', 'IN_SERVICE'),
      ]),
    ).toEqual([
      expect.objectContaining({
        amount: 200_000,
        authorized: 1,
        captured: 1,
        checkCount: 1,
        count: 2,
        method: 'CARD',
      }),
      expect.objectContaining({
        count: 1,
        method: 'CASH',
        pending: 1,
      }),
    ]);
  });

  it('uses Vietnam time and stored location evidence for demand grouping', () => {
    const bookings = [
      booking('hcm-active', 'IN_SERVICE', {
        address: '10 Le Loi, District 1, Ho Chi Minh City, Vietnam',
        createdAt: '2026-07-27T01:15:00.000Z',
      }),
      booking('hcm-completed', 'COMPLETED', {
        address: { addressText: '20 Nguyen Hue, Ho Chi Minh City, Vietnam' },
        createdAt: '2026-07-27T01:45:00.000Z',
      }),
      booking('pinned', 'CANCELLED', {
        createdAt: '2026-07-27T02:15:00.000Z',
        lat: 10.7769,
        lng: 106.7009,
      }),
    ];

    expect(buildHourlyBookingDemand(bookings)).toEqual([
      {
        active: 1,
        cancelled: 0,
        completed: 1,
        hour: '08:00',
        total: 2,
      },
      {
        active: 0,
        cancelled: 1,
        completed: 0,
        hour: '09:00',
        total: 1,
      },
    ]);
    expect(buildRegionalBookingDemand(bookings)).toEqual([
      {
        active: 1,
        cancelled: 0,
        completed: 1,
        noShowSignal: 0,
        region: 'Ho Chi Minh City',
        total: 2,
      },
      {
        active: 0,
        cancelled: 1,
        completed: 0,
        noShowSignal: 0,
        region: 'Pinned location',
        total: 1,
      },
    ]);
    expect(bookingRegionLabel(bookings[2])).toBe('Pinned location');
  });

  it('treats a matched booking without chat after 30 minutes as a no-show signal', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));

    expect(
      isNoShowSignal(
        booking('late-match', 'MATCHED', {
          openedAt: '2026-07-27T11:00:00.000Z',
        }),
      ),
    ).toBe(true);
    expect(
      isNoShowSignal(
        booking('recent-match', 'MATCHED', {
          chatRoom: { id: 'chat', messages: [] },
          openedAt: '2026-07-27T11:00:00.000Z',
        }),
      ),
    ).toBe(false);
  });
});

function booking(
  id: string,
  status: string,
  input: Partial<AdminBooking> = {},
): AdminBooking {
  return {
    id,
    status,
    ...input,
  };
}

function payment(
  id: string,
  method: string,
  status: string,
  bookingStatus: string,
): AdminPayment {
  return {
    amount: 100_000,
    booking: { status: bookingStatus },
    bookingId: `booking-${id}`,
    currency: 'VND',
    id,
    method,
    status,
  };
}
