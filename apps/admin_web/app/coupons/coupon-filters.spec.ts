import {
  buildCouponFilterHref,
  couponApiState,
  couponViewLabel,
  parseCouponListFilters,
} from './coupon-filters';

describe('coupon filters', () => {
  it('defaults to the live operational queue and bounds search input', () => {
    expect(parseCouponListFilters({})).toEqual({ q: '', view: 'live' });
    expect(parseCouponListFilters({ q: ` ${'A'.repeat(100)} ` }).q).toHaveLength(80);
  });

  it('keeps only supported views', () => {
    expect(parseCouponListFilters({ view: 'scheduled' }).view).toBe('scheduled');
    expect(parseCouponListFilters({ view: 'unsafe' }).view).toBe('live');
    expect(couponApiState('all')).toBe('');
    expect(couponApiState('records')).toBe('records');
  });

  it('builds stable filter links without list paging state', () => {
    expect(buildCouponFilterHref({ q: '', view: 'live' })).toBe('/coupons');
    expect(buildCouponFilterHref({ q: 'WELCOME', view: 'records' })).toBe(
      '/coupons?view=records&q=WELCOME',
    );
    expect(couponViewLabel('scheduled')).toBe('Scheduled');
  });
});
