import {
  bookingLatestActivityAt,
  bookingRecordCreatedAt,
  bookingRequestOpenedAt,
} from './admin-booking-time';

describe('admin booking time helpers', () => {
  it('prefers explicit openedAt for request-opened copy and treats scheduledStartAt only as a legacy fallback', () => {
    expect(
      bookingRequestOpenedAt({
        openedAt: '2026-06-01T10:00:00.000Z',
        createdAt: '2026-06-01T09:55:00.000Z',
        scheduledStartAt: '2026-06-01T12:00:00.000Z',
      }),
    ).toBe('2026-06-01T10:00:00.000Z');

    expect(
      bookingRequestOpenedAt({
        createdAt: '2026-06-01T09:55:00.000Z',
        scheduledStartAt: '2026-06-01T12:00:00.000Z',
      }),
    ).toBe('2026-06-01T09:55:00.000Z');

    expect(
      bookingRequestOpenedAt({
        scheduledStartAt: '2026-06-01T12:00:00.000Z',
      }),
    ).toBe('2026-06-01T12:00:00.000Z');
  });

  it('uses createdAt as the booking record timestamp before falling back to legacy scheduledStartAt', () => {
    expect(
      bookingRecordCreatedAt({
        createdAt: '2026-06-01T09:55:00.000Z',
        scheduledStartAt: '2026-06-01T12:00:00.000Z',
      }),
    ).toBe('2026-06-01T09:55:00.000Z');

    expect(
      bookingRecordCreatedAt({
        scheduledStartAt: '2026-06-01T12:00:00.000Z',
      }),
    ).toBe('2026-06-01T12:00:00.000Z');
  });

  it('uses updatedAt first when an admin list needs latest booking activity', () => {
    expect(
      bookingLatestActivityAt({
        updatedAt: '2026-06-01T10:10:00.000Z',
        createdAt: '2026-06-01T09:55:00.000Z',
        scheduledStartAt: '2026-06-01T12:00:00.000Z',
      }),
    ).toBe('2026-06-01T10:10:00.000Z');

    expect(
      bookingLatestActivityAt({
        createdAt: '2026-06-01T09:55:00.000Z',
        scheduledStartAt: '2026-06-01T12:00:00.000Z',
      }),
    ).toBe('2026-06-01T09:55:00.000Z');
  });
});
