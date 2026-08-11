import { describe, expect, it } from 'vitest';

import {
  couponIctWallTimeToIso,
  couponIsoToIctWallTimeInput,
  formatCouponIctDateTime,
} from './coupon-ict-time';

describe('coupon ICT date-time contract', () => {
  it('formats UTC instants as explicit ICT wall time', () => {
    expect(formatCouponIctDateTime('2025-07-27T23:14:00.000Z')).toBe('28 Jul 2025, 06:14 ICT');
    expect(couponIsoToIctWallTimeInput('2025-07-27T23:14:00.000Z')).toBe('2025-07-28T06:14');
  });

  it('preserves the exact original instant when an edit is unchanged', () => {
    const original = '2025-07-27T23:14:37.123Z';
    const pickerValue = couponIsoToIctWallTimeInput(original);

    expect(couponIctWallTimeToIso(pickerValue, original)).toBe(original);
  });

  it('converts ICT wall time to the corresponding UTC instant', () => {
    expect(couponIctWallTimeToIso('2025-07-28T06:14')).toBe('2025-07-27T23:14:00.000Z');
  });

  it('handles empty and invalid values without inventing an instant', () => {
    expect(couponIsoToIctWallTimeInput()).toBe('');
    expect(couponIsoToIctWallTimeInput('not-a-date')).toBe('');
    expect(couponIctWallTimeToIso('')).toBeUndefined();
    expect(couponIctWallTimeToIso('2025-02-31T06:14')).toBeNull();
    expect(formatCouponIctDateTime('not-a-date', 'Invalid')).toBe('Invalid');
  });
});
