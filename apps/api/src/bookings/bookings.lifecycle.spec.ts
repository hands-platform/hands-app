import { BookingStatus } from '@prisma/client';
import {
  bookingCompletedUpdateData,
  bookingResponseTimeoutAt,
  bookingServiceStartedUpdateData,
  openBookingRequestTiming,
} from './bookings.lifecycle';

describe('booking lifecycle update helpers', () => {
  it('builds on-demand opening timestamps from one request clock', () => {
    const openedAt = new Date('2026-06-11T00:00:00.000Z');

    expect(
      openBookingRequestTiming({
        durationMin: 60,
        providerResponseWindowMinutes: 10,
        openedAt,
      }),
    ).toEqual({
      scheduledStartAt: openedAt,
      scheduledEndAt: new Date('2026-06-11T01:00:00.000Z'),
      openedAt,
      expiresAt: new Date('2026-06-11T00:10:00.000Z'),
    });
  });

  it('keeps persisted booking response timeout when available', () => {
    const expiresAt = new Date('2026-06-11T00:15:00.000Z');

    expect(
      bookingResponseTimeoutAt({
        expiresAt,
        providerResponseWindowMinutes: 10,
        now: new Date('2026-06-11T00:00:00.000Z'),
      }),
    ).toBe(expiresAt);
  });

  it('builds booking response timeout fallback from the current clock', () => {
    expect(
      bookingResponseTimeoutAt({
        providerResponseWindowMinutes: 10,
        now: new Date('2026-06-11T00:00:00.000Z'),
      }),
    ).toEqual(new Date('2026-06-11T00:10:00.000Z'));
  });

  it('builds the service-started update data with chat handoff ready', () => {
    expect(bookingServiceStartedUpdateData()).toEqual({
      status: BookingStatus.IN_SERVICE,
      chatRoom: { upsert: { create: {}, update: {} } },
    });
  });

  it('builds the completed booking update without bypassing the payment state guard', () => {
    expect(bookingCompletedUpdateData()).toEqual({
      status: BookingStatus.COMPLETED,
    });
  });
});
