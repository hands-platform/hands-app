import { describe, expect, it } from 'vitest';

import { couponReturnTo, couponReturnWithNotice, sanitizeCouponReturnTo } from './coupon-return-context';

describe('coupon return context', () => {
  it('preserves the list view, search, and page', () => {
    expect(couponReturnTo({ couponPage: '3', q: 'welcome', view: 'records' })).toBe(
      '/coupons?couponPage=3&q=welcome&view=records',
    );
  });

  it('rejects external and unrelated return destinations', () => {
    expect(sanitizeCouponReturnTo('https://evil.example/coupons?view=all')).toBe('/coupons');
    expect(sanitizeCouponReturnTo('/payments?view=all')).toBe('/coupons');
  });

  it('keeps only canonical coupon query keys', () => {
    expect(sanitizeCouponReturnTo('/coupons?view=all&q=SAVE&couponPage=2&confirm=delete&couponId=1')).toBe(
      '/coupons?couponPage=2&q=SAVE&view=all',
    );
  });

  it('adds notices without dropping the original context', () => {
    expect(couponReturnWithNotice('/coupons?couponPage=2&view=live', 'deleted')).toBe(
      '/coupons?couponPage=2&view=live&couponNotice=deleted',
    );
  });
});
