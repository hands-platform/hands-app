import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingAgeLabel,
  bookingCreatedTimestamp,
  bookingStatusEvent,
  bookingTimestamp,
  deadlineRelativeLabel,
  formatBookingDate,
  orderBookingsForQueue,
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

  it('distinguishes matching deadlines from elapsed status time', () => {
    const nowMs = new Date('2026-06-11T01:00:00.000Z').getTime();

    expect(deadlineRelativeLabel(null, nowMs)).toBe('Deadline unavailable');
    expect(deadlineRelativeLabel('2026-06-11T00:45:00.000Z', nowMs)).toBe('15m overdue');
    expect(deadlineRelativeLabel('2026-06-11T03:00:00.000Z', nowMs)).toBe('2h remaining');
  });

  it('builds booking age labels from request timestamps', () => {
    const item = booking({ createdAt: '2026-06-11T00:00:00.000Z' });
    const nowMs = new Date('2026-06-11T01:30:00.000Z').getTime();

    expect(bookingTimestamp(item)).toBe(new Date('2026-06-11T00:00:00.000Z').getTime());
    expect(bookingAgeLabel(item, nowMs)).toBe('2h old');
  });

  it('derives status, relative time, and exact time from one status event timestamp', () => {
    const item = booking({
      createdAt: '2026-06-11T00:00:00.000Z',
      statusChangedAt: '2026-06-11T00:45:00.000Z',
      statusChangedLabel: 'Matching opened at',
    });
    const event = bookingStatusEvent(item);

    expect(event.label).toBe('Matching opened');
    expect(event.clockLabel).toBe('07:45:00');
    expect(event.relativeLabel(new Date('2026-06-11T01:00:00.000Z').getTime())).toBe(
      'Matching opened 15m ago',
    );
    expect(event.dateLabel).toContain('11 Jun 2026');
  });

  it('falls back when timestamps are missing and formats display dates', () => {
    const item = booking({ createdAt: null, scheduledStartAt: null, expiresAt: null });

    expect(bookingTimestamp(item)).toBe(0);
    expect(bookingCreatedTimestamp(item)).toBe(0);
    expect(bookingAgeLabel(item, Date.now())).toBe('age pending');
    expect(formatBookingDate(null)).toBe('No request time');
  });

  it('preserves server order and reverses local booking order by request time', () => {
    const older = booking({ createdAt: '2026-06-11T00:00:00.000Z', id: 'older' });
    const newer = booking({ createdAt: '2026-06-11T01:00:00.000Z', id: 'newer' });

    expect(orderBookingsForQueue([newer, older], 'oldest', true).map((item) => item.id)).toEqual([
      'newer',
      'older',
    ]);
    expect(orderBookingsForQueue([newer, older], 'oldest', false).map((item) => item.id)).toEqual([
      'older',
      'newer',
    ]);
    expect(orderBookingsForQueue([newer, older], 'newest', false).map((item) => item.id)).toEqual([
      'newer',
      'older',
    ]);
  });
});
