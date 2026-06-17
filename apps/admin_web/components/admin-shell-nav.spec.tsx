import { hrefMatchesPath } from '../lib/admin-nav-match';

describe('admin shell navigation', () => {
  it('matches route links, detail pages, and query-specific entries', () => {
    expect(hrefMatchesPath('/', '/', '')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings/cmq123', '')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings', 'view=attention')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings', 'view=marketplace')).toBe(true);
    expect(hrefMatchesPath('/bookings?view=attention', '/bookings', 'view=attention')).toBe(true);
    expect(hrefMatchesPath('/bookings?view=attention', '/bookings', 'view=marketplace')).toBe(false);
    expect(hrefMatchesPath('/partners', '/partners', 'review=kyc')).toBe(false);
  });
});
