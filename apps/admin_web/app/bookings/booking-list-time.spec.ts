import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingAgeLabel,
  bookingCreatedTimestamp,
  bookingRecencyLabel,
  bookingTimestamp,
  formatBookingDate,
  relativeTimeLabel,
} from './booking-list-time';

function booking(overrides: Record<string, unknown> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'OPEN_MATCHING',
    createdAt: '2026-06-11T00:00:00.000Z',
    ...overrides,
  } as unknown as AdminBooking;
}

describe('booking list time helpers', () => {
  it('formats relative time labels from a supplied reference clock', () => {
    const nowMs = new Date('2026-06-11T01:00:00.000Z').getTime();

    expect(relativeTimeLabel('not-a-date', nowMs)).toBe('unknown time');
    expect(relativeTimeLabel('2026-06-11T01:00:00.000Z', nowMs)).toBe('just now');
    expect(relativeTimeLabel('2026-06-11T00:45:00.000Z', nowMs)).toBe('15m ago');
    expect(relativeTimeLabel('2026-06-10T23:00:00.000Z', nowMs)).toBe('2h ago');
  });

  it('builds booking recency and age labels from list sort timestamps', () => {
    const item = booking({ createdAt: '2026-06-11T00:00:00.000Z' });
    const nowMs = new Date('2026-06-11T01:30:00.000Z').getTime();

    expect(bookingTimestamp(item)).toBe(new Date('2026-06-11T00:00:00.000Z').getTime());
    expect(bookingRecencyLabel(item, null)).toBe('Recency loading...');
    expect(bookingRecencyLabel(item, nowMs)).toBe('Updated 2h ago');
    expect(bookingAgeLabel(item, nowMs)).toBe('2h old');
  });

  it('falls back when timestamps are missing and formats display dates', () => {
    const item = booking({ createdAt: null, scheduledStartAt: null, expiresAt: null });

    expect(bookingTimestamp(item)).toBe(0);
    expect(bookingCreatedTimestamp(item)).toBe(0);
    expect(bookingRecencyLabel(item, Date.now())).toBe('Created time unavailable');
    expect(bookingAgeLabel(item, Date.now())).toBe('age pending');
    expect(formatBookingDate(null)).toBe('No request time');
  });
});
