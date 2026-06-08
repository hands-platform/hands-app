import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import type { PartnerListQueryDeps } from './partner-list-query';
import { buildPartnerAcceptanceBlockerBoard } from './partner-acceptance-blocker-board';

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-ready',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: new Date().toISOString(),
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    documents: [
      { id: 'doc-front', type: 'CCCD_FRONT', status: 'APPROVED' },
      { id: 'doc-back', type: 'CCCD_BACK', status: 'APPROVED' },
      { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED' },
    ],
    bankAccounts: [{ id: 'bank-1', status: 'APPROVED' }],
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
  marketplaceEligibility: (item) => ({ eligible: item.id === 'partner-ready' }),
};

describe('partner acceptance blocker board', () => {
  it('separates ready partners from cash debt and onboarding blockers', () => {
    const board = buildPartnerAcceptanceBlockerBoard(
      [
        partner(),
        partner({
          id: 'partner-cash-debt',
          displayName: 'Cash Debt Partner',
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
        partner({
          id: 'partner-onboarding',
          displayName: 'Onboarding Partner',
          verification: { id: 'verification-2', status: 'PENDING' },
          kyc: { id: 'kyc-2', status: 'PENDING' },
          documents: [],
        }),
      ],
      DEFAULT_PROVIDER_OPS_POLICY,
      deps,
    );

    expect(board.eligibleNow).toBe(1);
    expect(board.hardBlocked).toBe(0);
    expect(board.marketplaceBlocked).toBe(2);
    expect(board.cards.find((item) => item.title === 'Cash fee settlement')).toMatchObject({
      count: 1,
      status: 'Blocks marketplace',
      tone: 'danger',
      href: '/partners?review=cash-debt',
      samples: ['Cash Debt Partner'],
    });
    expect(board.cards.find((item) => item.title === 'Identity and onboarding')).toMatchObject({
      count: 1,
      status: 'Review needed',
      tone: 'warn',
      href: '/partners?review=kyc',
      samples: ['Onboarding Partner'],
    });
  });
});
