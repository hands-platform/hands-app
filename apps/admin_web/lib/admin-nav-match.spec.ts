import { hrefMatchesPath } from './admin-nav-match';

describe('hrefMatchesPath', () => {
  it('keeps the customer reviews nav item separate from partner customer evaluations', () => {
    expect(hrefMatchesPath('/reviews', '/reviews', '')).toBe(true);
    expect(hrefMatchesPath('/reviews', '/reviews/partner-customer-evaluations', '')).toBe(false);
    expect(hrefMatchesPath('/reviews/partner-customer-evaluations', '/reviews/partner-customer-evaluations', '')).toBe(
      true,
    );
  });
});
