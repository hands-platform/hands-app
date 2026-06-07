import {
  bookingProviderLocationMetricHelper,
  bookingProviderLocationMetricValue,
} from './booking-provider-location-copy';

describe('booking provider location copy', () => {
  it.each([
    ['recent', 'Recent'],
    ['stale', 'Stale'],
    ['expired', 'Too old'],
    ['missing', 'Missing'],
    [null, 'Missing'],
  ])('maps freshness %s to metric value %s', (freshness, expected) => {
    expect(bookingProviderLocationMetricValue(freshness)).toBe(expected);
  });

  it('shows missing copy when there is no recorded timestamp', () => {
    expect(bookingProviderLocationMetricHelper(null)).toBe('No partner location shared yet');
  });

  it('shows invalid timestamp copy when the recorded timestamp cannot be parsed', () => {
    expect(bookingProviderLocationMetricHelper('not-a-date')).toBe(
      'Partner location timestamp is invalid',
    );
  });

  it('shows just now for sub-minute location age', () => {
    expect(
      bookingProviderLocationMetricHelper('2026-06-07T04:00:20.000Z', {
        nowMs: new Date('2026-06-07T04:00:40.000Z').getTime(),
      }),
    ).toBe('Updated just now');
  });

  it('shows minute age for recent locations under one hour', () => {
    expect(
      bookingProviderLocationMetricHelper('2026-06-07T03:52:00.000Z', {
        nowMs: new Date('2026-06-07T04:00:00.000Z').getTime(),
      }),
    ).toBe('Updated 8m ago');
  });

  it('shows hour age for older locations', () => {
    expect(
      bookingProviderLocationMetricHelper('2026-06-07T01:10:00.000Z', {
        nowMs: new Date('2026-06-07T04:00:00.000Z').getTime(),
      }),
    ).toBe('Updated 3h ago');
  });
});
