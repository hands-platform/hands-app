import { renderToStaticMarkup } from 'react-dom/server';

import { CouponFilterBoard } from './coupon-filter-board';

describe('CouponFilterBoard', () => {
  it('renders operational views, DB-backed search, and a clear action', () => {
    const markup = renderToStaticMarkup(
      <CouponFilterBoard
        filters={{ q: 'WELCOME', view: 'live' }}
        matchingCount={2}
        summary={{
          expiredCount: 3,
          filteredCount: 2,
          liveCount: 4,
          pausedCount: 1,
          scheduledCount: 2,
          totalCount: 10,
        }}
      />,
    );

    expect(markup).toContain('Coupon filters');
    expect(markup).toContain('Live 4');
    expect(markup).toContain('Scheduled 2');
    expect(markup).toContain('Records 4');
    expect(markup).toContain('All 10');
    expect(markup).toContain('name="q"');
    expect(markup).toContain('Clear search');
    expect(markup).toContain('2 matching');
  });
});
