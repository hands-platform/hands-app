import {
  buildCouponFilterHref,
  couponApiState,
  couponViewLabel,
  parseCouponListFilters,
} from './coupon-filters';

describe('coupon filters', () => {
  it('defaults to the live operational queue and bounds search input', () => {
    expect(parseCouponListFilters({})).toEqual({ q: '', sort: 'code', view: 'live' });
    expect(parseCouponListFilters({ q: ` ${'A'.repeat(100)} ` }).q).toHaveLength(80);
  });

  it('keeps only supported views', () => {
    expect(parseCouponListFilters({ view: 'scheduled' }).view).toBe('scheduled');
    expect(parseCouponListFilters({ view: 'paused' }).view).toBe('paused');
    expect(parseCouponListFilters({ view: 'expired' }).view).toBe('expired');
    expect(parseCouponListFilters({ view: 'unsafe' }).view).toBe('live');
    expect(couponApiState('all')).toBe('');
    expect(couponApiState('records')).toBe('records');
    expect(parseCouponListFilters({ sort: 'unsupported' }).sort).toBe('code');
    expect(parseCouponListFilters({ sort: 'ending-soon' }).sort).toBe('ending-soon');
  });

  it('builds stable filter links without list paging state', () => {
    expect(buildCouponFilterHref({ q: '', sort: 'code', view: 'live' })).toBe('/coupons');
    expect(buildCouponFilterHref({ q: 'WELCOME', sort: 'ending-soon', view: 'records' })).toBe(
      '/coupons?view=records&q=WELCOME&sort=ending-soon',
    );
    expect(couponViewLabel('scheduled')).toBe('Scheduled');
    expect(couponViewLabel('paused')).toBe('Paused');
    expect(couponViewLabel('expired')).toBe('Expired');
  });
});
