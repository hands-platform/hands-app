import {
  bookingMonitorStatusPriority,
  compareBookingMonitorListOrder,
} from './booking-monitor-list-order';

describe('booking monitor list order', () => {
  it('prioritizes operationally urgent statuses before timestamps', () => {
    expect(
      [
        { id: 'open', status: 'OPEN_MATCHING', sortTimestampMs: 500 },
        { id: 'no-show', status: 'NO_SHOW', sortTimestampMs: 100 },
        { id: 'matched', status: 'MATCHED', sortTimestampMs: 900 },
        { id: 'in-service', status: 'IN_SERVICE', sortTimestampMs: 200 },
      ].sort(compareBookingMonitorListOrder).map((booking) => booking.id),
    ).toEqual(['no-show', 'in-service', 'matched', 'open']);
  });

  it('uses newest timestamp when priorities match', () => {
    expect(
      [
        { id: 'older', status: 'MATCHED', sortTimestampMs: 100 },
        { id: 'newer', status: 'MATCHED', sortTimestampMs: 300 },
        { id: 'middle', status: 'MATCHED', sortTimestampMs: 200 },
      ].sort(compareBookingMonitorListOrder).map((booking) => booking.id),
    ).toEqual(['newer', 'middle', 'older']);
  });

  it('keeps the explicit status priority ladder stable', () => {
    expect(
      [
        'NO_SHOW',
        'IN_SERVICE',
        'PROVIDER_ON_THE_WAY',
        'ARRIVED',
        'MATCHED',
        'OPEN_MATCHING',
        'COMPLETED',
      ].map((status) => [status, bookingMonitorStatusPriority(status)]),
    ).toEqual([
      ['NO_SHOW', 6],
      ['IN_SERVICE', 5],
      ['PROVIDER_ON_THE_WAY', 4],
      ['ARRIVED', 4],
      ['MATCHED', 3],
      ['OPEN_MATCHING', 2],
      ['COMPLETED', 1],
    ]);
  });
});
