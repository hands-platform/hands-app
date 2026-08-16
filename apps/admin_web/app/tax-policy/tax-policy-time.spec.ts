import { isoToVietnamDateTimeLocal, vietnamLocalDateTimeToIso } from './tax-policy-time';

describe('tax policy Vietnam time', () => {
  it('interprets datetime-local values as Asia/Ho_Chi_Minh time', () => {
    expect(vietnamLocalDateTimeToIso('2026-08-12T09:30', 'Effective from')).toBe(
      '2026-08-12T02:30:00.000Z',
    );
  });

  it('round-trips stored UTC instants without a seven-hour drift', () => {
    const local = isoToVietnamDateTimeLocal('2026-08-12T02:30:00.000Z');
    expect(local).toBe('2026-08-12T09:30');
    expect(vietnamLocalDateTimeToIso(local, 'Effective from')).toBe(
      '2026-08-12T02:30:00.000Z',
    );
  });

  it('rejects normalized invalid calendar dates', () => {
    expect(() => vietnamLocalDateTimeToIso('2026-02-30T10:00', 'Effective from')).toThrow(
      'Effective from must be a valid Vietnam date and time.',
    );
  });
});
