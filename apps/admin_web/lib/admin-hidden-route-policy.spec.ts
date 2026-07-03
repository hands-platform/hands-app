import {
  adminHiddenRoutePolicy,
  adminHiddenRouteRoutes,
  intentionallyUnlistedPageRoutes,
} from './admin-hidden-route-policy';
import { adminNavSections } from './admin-navigation';

describe('admin hidden route policy', () => {
  it('documents intentionally hidden operational pages with stable reasons', () => {
    expect(adminHiddenRoutePolicy('/chat-archive')).toContain('Audit search');
    expect(adminHiddenRoutePolicy('/partner-controls')).toContain('deep operational evidence');
    expect(adminHiddenRoutePolicy('/providers')).toContain('Legacy provider alias');
    expect(adminHiddenRoutePolicy('/providers/[id]')).toContain('Legacy provider detail alias');
    expect(adminHiddenRoutePolicy('/referrals')).toContain('Referral hub');
  });

  it('keeps legacy providers aliases hidden while primary partner pages stay in navigation', () => {
    const menuRoutes = new Set(adminNavSections.flatMap((section) => section.links.map((link) => link.href)));

    expect(menuRoutes.has('/partners')).toBe(true);
    expect(menuRoutes.has('/providers')).toBe(false);
    expect(menuRoutes.has('/providers/[id]')).toBe(false);
    expect(adminHiddenRoutePolicy('/providers')).toBe(intentionallyUnlistedPageRoutes['/providers']);
  });

  it('returns sorted hidden route keys for inventory checks', () => {
    expect(adminHiddenRouteRoutes()).toEqual(Object.keys(intentionallyUnlistedPageRoutes).sort());
  });
});
