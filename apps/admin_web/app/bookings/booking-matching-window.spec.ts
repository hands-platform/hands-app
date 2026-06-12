import {
  bookingMatchingWindowExpired,
  bookingMatchingWindowLabel,
} from './booking-matching-window';

describe('booking matching window', () => {
  it('detects expired open matching windows only', () => {
    const nowMs = Date.parse('2026-06-12T10:00:00.000Z');

    expect(
      bookingMatchingWindowExpired(
        { expiresAt: '2026-06-12T09:59:00.000Z', status: 'OPEN_MATCHING' },
        nowMs,
      ),
    ).toBe(true);
    expect(
      bookingMatchingWindowExpired(
        { expiresAt: '2026-06-12T09:59:00.000Z', status: 'MATCHED' },
        nowMs,
      ),
    ).toBe(false);
    expect(bookingMatchingWindowExpired({ expiresAt: null, status: 'OPEN_MATCHING' }, nowMs)).toBe(
      false,
    );
  });

  it('formats matching window labels from the current clock', () => {
    const nowMs = Date.parse('2026-06-12T10:00:00.000Z');

    expect(bookingMatchingWindowLabel({ expiresAt: null, status: 'OPEN_MATCHING' }, nowMs)).toBe(
      'window pending',
    );
    expect(
      bookingMatchingWindowLabel({ expiresAt: 'not-a-date', status: 'OPEN_MATCHING' }, nowMs),
    ).toBe('window invalid');
    expect(
      bookingMatchingWindowLabel(
        { expiresAt: '2026-06-12T09:55:00.000Z', status: 'OPEN_MATCHING' },
        nowMs,
      ),
    ).toBe('5m overdue');
    expect(
      bookingMatchingWindowLabel(
        { expiresAt: '2026-06-12T10:00:00.000Z', status: 'OPEN_MATCHING' },
        nowMs,
      ),
    ).toBe('expires now');
    expect(
      bookingMatchingWindowLabel(
        { expiresAt: '2026-06-12T10:07:00.000Z', status: 'OPEN_MATCHING' },
        nowMs,
      ),
    ).toBe('7m left');
  });
});
