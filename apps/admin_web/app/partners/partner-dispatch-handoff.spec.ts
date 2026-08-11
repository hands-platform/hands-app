import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import type { PartnerListQueryDeps } from './partner-list-query';
import { buildPartnerDispatchHandoff } from './partner-dispatch-handoff';

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-ready',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: new Date().toISOString(),
    user: {
      id: 'user-1',
      phone: '+84900000000',
      pushDevices: [{ id: 'push-1', platform: 'android', enabled: true }],
    },
    ...input,
  } as AdminProvider;
}

const deps: PartnerListQueryDeps = {
  canAcceptBookingNow: (item) => item.id === 'partner-ready',
  dispatchReady: (item) => item.id === 'partner-ready',
  displayName: (item) => item.displayName ?? item.id,
  hasHardAcceptanceBlocker: (item) => Boolean(item.blockedAt),
  marketplaceEligibility: (item) => ({ eligible: item.id !== 'partner-cash-debt' }),
};

describe('partner dispatch handoff', () => {
  it('builds operations links for direct, marketplace, cash-debt, and alert repair lanes', () => {
    const handoff = buildPartnerDispatchHandoff(
      [
        partner(),
        partner({
          id: 'partner-cash-debt',
          displayName: 'Cash Debt Partner',
          user: { id: 'user-2', phone: '+84900000001', pushDevices: [] },
          earnings: [
            {
              id: 'earning-debt',
              providerProfileId: 'partner-cash-debt',
              bookingId: 'booking-cash',
              grossAmount: 450000,
              platformFee: 120000,
              withholdingAmount: 0,
              netAmount: -120000,
              currency: 'VND',
              status: 'PENDING',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      ],
      DEFAULT_PROVIDER_OPS_POLICY,
      deps,
    );

    expect(handoff.policyLabel).toBe('Edit dispatch policy');
    expect(handoff.detail).toContain('marketplace radius 10 km');
    expect(handoff.links.find((item) => item.title === 'Direct ready')).toMatchObject({
      value: '1',
      tone: 'ok',
      href: '/partners?review=ready-now',
    });
    expect(handoff.links.find((item) => item.title === 'Marketplace ready')).toMatchObject({
      value: '1',
      tone: 'ok',
      href: '/partners?review=ready-now',
    });
    expect(handoff.links.find((item) => item.title === 'Acceptance blocked')).toMatchObject({
      detail:
        'Partners blocked from direct requests by KYC, location, push, control, or wallet settlement gates.',
      href: '/partners?review=available-blocked',
      tone: 'danger',
      value: '1',
    });
    expect(handoff.links.find((item) => item.title === 'Cash fee debt')).toMatchObject({
      detail:
        'Negative wallet Partners can view marketplace requests, but final acceptance, service start, and payout release wait until company fee settlement.',
      value: '1',
      tone: 'danger',
      href: '/cash-settlements',
    });
    expect(handoff.links.find((item) => item.title === 'Push repair')).toMatchObject({
      value: '1',
      tone: 'warn',
      href: '/partners?review=push',
    });
  });
});
