import {
  bookingOperatorNoteLines,
  canExpireBooking,
  canMarkNoShow,
} from './booking-operator-action-rules';

describe('booking operator action rules', () => {
  it('allows expiring only open matching bookings', () => {
    expect(canExpireBooking('OPEN_MATCHING')).toBe(true);
    expect(canExpireBooking('MATCHED')).toBe(false);
    expect(canExpireBooking('COMPLETED')).toBe(false);
  });

  it('allows no-show marking only before service completion or cancellation', () => {
    expect(canMarkNoShow('OPEN_MATCHING')).toBe(true);
    expect(canMarkNoShow('MATCHED')).toBe(true);
    expect(canMarkNoShow('PROVIDER_ON_THE_WAY')).toBe(true);
    expect(canMarkNoShow('ARRIVED')).toBe(true);
    expect(canMarkNoShow('IN_SERVICE')).toBe(false);
    expect(canMarkNoShow('COMPLETED')).toBe(false);
    expect(canMarkNoShow('CANCELLED')).toBe(false);
  });

  it('normalizes operator notes into non-empty trimmed lines', () => {
    expect(bookingOperatorNoteLines(' first note \n\n second note  ')).toEqual([
      'first note',
      'second note',
    ]);
    expect(bookingOperatorNoteLines(null)).toEqual([]);
    expect(bookingOperatorNoteLines(undefined)).toEqual([]);
  });
});
