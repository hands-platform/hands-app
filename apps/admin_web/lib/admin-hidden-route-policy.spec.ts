import {
  adminHiddenRoutePolicy,
  adminHiddenRoutePolicyDetails,
  adminHiddenRouteRoutes,
} from './admin-hidden-route-policy';

describe('admin hidden route policy', () => {
  it('keeps intentionally unlisted routes classified by operating purpose', () => {
    expect(adminHiddenRoutePolicyDetails('/files')).toMatchObject({
      kind: 'LEGACY_ALIAS',
      primaryRoutes: ['/partners/[id]'],
    });
    expect(adminHiddenRoutePolicyDetails('/providers')).toMatchObject({
      kind: 'LEGACY_ALIAS',
      primaryRoutes: ['/partners'],
    });
    expect(adminHiddenRoutePolicyDetails('/referrals')).toMatchObject({
      kind: 'HIDDEN_HUB',
      primaryRoutes: ['/referrals/customers', '/referrals/partners', '/referrals/cashouts'],
    });
  });

  it('keeps every hidden route policy explainable without changing existing reason lookups', () => {
    const routes = adminHiddenRouteRoutes();

    expect(routes.length).toBeGreaterThan(10);
    for (const route of routes) {
      const details = adminHiddenRoutePolicyDetails(route);

      expect(details?.reason).toEqual(adminHiddenRoutePolicy(route));
      expect(details?.kind).toMatch(/^[A-Z_]+$/u);
      expect(details?.primaryRoutes.length).toBeGreaterThan(0);
    }
  });
});
