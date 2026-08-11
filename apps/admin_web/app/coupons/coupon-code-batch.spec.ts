import { describe, expect, it } from 'vitest';

import { COUPON_BATCH_LIMIT, parseCouponCodeBatch } from './coupon-code-batch';

describe('coupon batch parser', () => {
  it('normalizes separators and reports duplicates and invalid codes', () => {
    expect(parseCouponCodeBatch('welcome10, WELCOME10\npartner-20 invalid!')).toEqual({
      accepted: ['WELCOME10', 'PARTNER-20'],
      duplicates: ['WELCOME10'],
      invalid: ['INVALID!'],
      overLimit: [],
      tooLong: [],
    });
  });

  it('enforces the 50-code batch limit', () => {
    const result = parseCouponCodeBatch(
      Array.from({ length: COUPON_BATCH_LIMIT + 2 }, (_, index) => `CODE${index + 1}`).join(','),
    );

    expect(result.accepted).toHaveLength(50);
    expect(result.overLimit).toEqual(['CODE51', 'CODE52']);
  });

  it('reports codes longer than the API contract', () => {
    const result = parseCouponCodeBatch(`OK ${'A'.repeat(81)}`);

    expect(result.accepted).toEqual(['OK']);
    expect(result.tooLong).toHaveLength(1);
  });
});
