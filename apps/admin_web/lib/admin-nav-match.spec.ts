import { hrefMatchesPath } from './admin-nav-match';

describe('hrefMatchesPath', () => {
  it('keeps the customer reviews nav item separate from partner customer evaluations', () => {
    expect(hrefMatchesPath('/reviews', '/reviews', '')).toBe(true);
    expect(hrefMatchesPath('/reviews', '/reviews/partner-customer-evaluations', '')).toBe(false);
    expect(hrefMatchesPath('/reviews/partner-customer-evaluations', '/reviews/partner-customer-evaluations', '')).toBe(
      true,
    );
  });

  it('keeps filtered Partner directory separate while matching static Partner analytics pages', () => {
    expect(hrefMatchesPath('/partners', '/partners', 'review=kyc')).toBe(false);
    expect(hrefMatchesPath('/partners/overview', '/partners/overview', 'range=7d')).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners/overview', 'range=7d')).toBe(false);
  });

  it('keeps hub routes from swallowing deeper finance and notification pages', () => {
    expect(hrefMatchesPath('/finance-tax', '/finance-tax', '')).toBe(true);
    expect(hrefMatchesPath('/finance-tax', '/finance-tax/monthly-tax-closing', '')).toBe(false);
    expect(hrefMatchesPath('/finance-tax/monthly-tax-closing', '/finance-tax/monthly-tax-closing', '')).toBe(true);
    expect(hrefMatchesPath('/finance-tax/bank-reconciliation', '/finance-tax/bank-reconciliation/bank-1', '')).toBe(
      true,
    );

    expect(hrefMatchesPath('/notifications', '/notifications', '')).toBe(true);
    expect(hrefMatchesPath('/notifications', '/notifications/templates', '')).toBe(false);
    expect(hrefMatchesPath('/notifications/templates', '/notifications/templates', '')).toBe(true);
  });
});
