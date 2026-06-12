import {
  bookingCheckFlag,
  bookingCheckLevel,
  compactBookingCheckFlags,
  type BookingCheckLevelFlag,
} from './booking-check-level';

describe('bookingCheckLevel', () => {
  it('returns clear when there are no active booking checks', () => {
    expect(bookingCheckLevel([])).toEqual({
      label: 'Clear',
      helper: 'No active checks',
      tone: 'signal-ok',
    });
  });

  it('prioritizes high severity booking checks', () => {
    const flags: BookingCheckLevelFlag[] = [
      { severity: 'medium', title: 'Monitor location' },
      { severity: 'high', title: 'Payment unresolved' },
    ];

    expect(bookingCheckLevel(flags)).toEqual({
      label: 'Action',
      helper: '2 check(s)',
      tone: 'signal-warn',
    });
  });

  it('returns monitor when medium is the highest severity', () => {
    expect(bookingCheckLevel([{ severity: 'medium', title: 'No partner supply' }])).toEqual({
      label: 'Monitor',
      helper: '1 check(s)',
      tone: 'signal-info',
    });
  });

  it('returns note when only low severity booking checks exist', () => {
    expect(bookingCheckLevel([{ severity: 'low', title: 'Chat quiet' }])).toEqual({
      label: 'Note',
      helper: '1 check(s)',
      tone: 'signal-info',
    });
  });

  it('creates and compacts conditional booking checks', () => {
    expect(
      compactBookingCheckFlags([
        bookingCheckFlag(true, 'medium', 'Payment reference missing'),
        bookingCheckFlag(false, 'low', 'Chat quiet'),
      ]),
    ).toEqual([{ severity: 'medium', title: 'Payment reference missing' }]);
  });
});
