import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import type { PartnerListQueryDeps } from './partner-list-query';
import { buildPartnerCommandCenter } from './partner-command-center';

const now = new Date();

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    legalName: 'Nguyen Thi Linh',
    status: 'ONLINE_AVAILABLE',
    currentLocationUpdatedAt: now.toISOString(),
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    documents: [
      { id: 'doc-front', type: 'CCCD_FRONT', status: 'APPROVED' },
      { id: 'doc-back', type: 'CCCD_BACK', status: 'APPROVED' },
      { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED' },
    ],
    bankAccounts: [{ id: 'bank-1', status: 'APPROVED', bankName: 'VCB' }],
    user: {
      id: 'user-1',
      supabaseUserId: 'supabase-user-1',
      pushDevices: [{ id: 'push-1', platform: 'android', enabled: true }],
    },
    ...input,
  } as AdminProvider;
}

const deps: PartnerListQueryDeps = {
  canAcceptBookingNow: (item) => item.id === 'partner-001',
  dispatchReady: (item) => item.id === 'partner-001',
  displayName: (item) => item.displayName ?? item.id,
  hasHardAcceptanceBlocker: (item) => Boolean(item.blockedAt),
  marketplaceEligibility: (item) => ({ eligible: item.id === 'partner-001' }),
};

describe('partner command center', () => {
  it('summarizes onboarding, dispatch, finance, and control lanes', () => {
    const lanes = buildPartnerCommandCenter(
      [
        partner(),
        partner({
          id: 'partner-kyc',
          verification: { id: 'verification-2', status: 'PENDING' },
          kyc: { id: 'kyc-2', status: 'PENDING' },
          documents: [{ id: 'doc-pending', type: 'CCCD_FRONT', status: 'PENDING_REVIEW' }],
        }),
        partner({
          id: 'partner-debt',
          earnings: [
            {
              id: 'earning-debt',
              providerProfileId: 'partner-debt',
              bookingId: 'booking-cash',
              grossAmount: 450000,
              platformFee: 120000,
              withholdingAmount: 0,
              netAmount: -120000,
              currency: 'VND',
              status: 'PENDING',
              createdAt: now.toISOString(),
            },
          ],
        }),
      ],
      DEFAULT_PROVIDER_OPS_POLICY,
      deps,
    );

    expect(lanes).toHaveLength(4);
    expect(lanes[0]).toMatchObject({ title: 'Onboarding pipeline', status: 'Review needed' });
    expect(lanes[1]).toMatchObject({ title: 'Dispatch readiness', status: '1/3 ready' });
    expect(lanes[2]).toMatchObject({ title: 'Withdrawal profile', status: 'Finance action', tone: 'danger' });
    expect(lanes[3]).toMatchObject({ title: 'Reports and devices' });
  });
});
