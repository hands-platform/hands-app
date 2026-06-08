import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { buildPartnerMarketplaceEligibility } from './partner-marketplace-eligibility';

const now = new Date();

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: now.toISOString(),
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    documents: [
      { id: 'doc-front', type: 'CCCD_FRONT', status: 'APPROVED' },
      { id: 'doc-back', type: 'CCCD_BACK', status: 'APPROVED' },
      { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED' },
    ],
    bankAccounts: [
      {
        id: 'bank-1',
        bankName: 'VCB',
        accountHolderName: 'Linh Wellness',
        status: 'APPROVED',
        isPrimary: true,
      },
    ],
    user: {
      id: 'user-1',
      phone: '+84900000000',
      pushDevices: [{ id: 'push-1', platform: 'android', enabled: true }],
    },
    ...input,
  } as AdminProvider;
}

describe('partner marketplace eligibility', () => {
  it('lets negative-wallet partners view and join marketplace requests before final acceptance', () => {
    const result = buildPartnerMarketplaceEligibility(
      partner({
        earnings: [
          {
            id: 'earning-cash-fee',
            providerProfileId: 'partner-001',
            bookingId: 'booking-cash',
            grossAmount: 500000,
            platformFee: 120000,
            withholdingAmount: 0,
            netAmount: -120000,
            currency: 'VND',
            status: 'PENDING',
            createdAt: now.toISOString(),
          },
        ],
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
    );

    expect(result.canViewMarketplace).toBe(true);
    expect(result.canReceiveMarketplaceAlerts).toBe(false);
    expect(result.canParticipateInMarketplace).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.walletBalance).toBe(-120000);
    expect(result.blockers).toContainEqual({ label: 'cash fee debt', severity: 'hard' });
    expect(result.partnerAppMessage).toBe(
      'Unpaid HANDS fees must be settled before final acceptance or service start.',
    );
  });

  it('marks a fully prepared online partner as marketplace-ready', () => {
    const result = buildPartnerMarketplaceEligibility(partner(), DEFAULT_PROVIDER_OPS_POLICY);

    expect(result.eligible).toBe(true);
    expect(result.canReceiveMarketplaceAlerts).toBe(true);
    expect(result.canParticipateInMarketplace).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks marketplace participation when the location is stale', () => {
    const result = buildPartnerMarketplaceEligibility(
      partner({
        currentLocationUpdatedAt: new Date(
          now.getTime() - (DEFAULT_PROVIDER_OPS_POLICY.staleLocationMinutes + 5) * 60_000,
        ).toISOString(),
      }),
      DEFAULT_PROVIDER_OPS_POLICY,
    );

    expect(result.eligible).toBe(false);
    expect(result.canViewMarketplace).toBe(true);
    expect(result.canParticipateInMarketplace).toBe(false);
    expect(result.blockers).toContainEqual({ label: 'location stale', severity: 'soft' });
  });
});
