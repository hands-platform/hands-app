import { hrefMatchesPath } from '../lib/admin-nav-match';

describe('admin shell navigation', () => {
  it('matches route links, detail pages, and query-specific entries', () => {
    expect(hrefMatchesPath('/', '/', '')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings/cmq123', '')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings', 'view=attention')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings', 'view=marketplace')).toBe(true);
    expect(hrefMatchesPath('/bookings?view=attention', '/bookings', 'view=attention')).toBe(true);
    expect(hrefMatchesPath('/bookings?view=attention', '/bookings', 'view=marketplace')).toBe(false);
    expect(hrefMatchesPath('/bookings', '/bookings/completed', '')).toBe(false);
    expect(hrefMatchesPath('/bookings/completed', '/bookings/completed', '')).toBe(true);
    expect(hrefMatchesPath('/bookings/completed', '/bookings/completed', 'view=closeout')).toBe(true);
    expect(hrefMatchesPath('/bookings/post-match-cancellations', '/bookings/post-match-cancellations', '')).toBe(true);
    expect(
      hrefMatchesPath(
        '/bookings/post-match-cancellations',
        '/bookings/post-match-cancellations',
        'view=no-show',
      ),
    ).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners', 'review=kyc')).toBe(false);
  });
});
