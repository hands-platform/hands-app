import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import {
  buildPartnerFilterSummary,
  buildPartnerReviewQueue,
  buildPartnerSummary,
} from './partner-list-summary';
import type { PartnerListQueryDeps } from './partner-list-query';

const now = new Date();

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    legalName: 'Nguyen Thi Linh',
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
    bankAccounts: [{ id: 'bank-1', status: 'APPROVED', bankName: 'VCB' }],
    user: {
      id: 'user-1',
      phone: '+84900000000',
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

describe('partner list summary', () => {
  it('builds partner operation summary counts from factual partner state', () => {
    const providers = [
      partner(),
      partner({
        id: 'partner-blocked',
        blockedAt: now.toISOString(),
        user: {
          id: 'user-blocked',
          pushDevices: [{ id: 'push-disabled', platform: 'android', enabled: false }],
        },
      }),
      partner({
        id: 'partner-cash-debt',
        currentLocationUpdatedAt: new Date(
          now.getTime() - (DEFAULT_PROVIDER_OPS_POLICY.staleLocationMinutes + 5) * 60_000,
        ).toISOString(),
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
            createdAt: now.toISOString(),
          },
        ],
      }),
    ];

    const summary = Object.fromEntries(buildPartnerSummary(providers, DEFAULT_PROVIDER_OPS_POLICY, deps));

    expect(summary['Total partners']).toBe('3');
    expect(summary['Account blocked']).toBe('1');
    expect(summary['Approved']).toBe('3');
    expect(summary['Online now']).toBe('3');
    expect(summary['Push ready']).toBe('2');
    expect(summary['Push needs review']).toBe('1');
    expect(summary['Wallet debt']).toBe('1');
    expect(summary['Location needs review']).toBe('1');
    expect(summary['First earning profile']).toBeDefined();
    expect(summary['First earning setup']).toBeUndefined();
  });

  it('builds filter summary cards for visible rows and current policy gates', () => {
    const providers = [
      partner(),
      partner({
        id: 'partner-stale',
        currentLocationUpdatedAt: new Date(
          now.getTime() - (DEFAULT_PROVIDER_OPS_POLICY.staleLocationMinutes + 5) * 60_000,
        ).toISOString(),
      }),
      partner({
        id: 'partner-doc-work',
        documents: [{ id: 'doc-pending', type: 'CCCD_FRONT', status: 'PENDING_REVIEW' }],
      }),
    ];

    const summary = buildPartnerFilterSummary(
      providers.slice(0, 2),
      providers,
      DEFAULT_PROVIDER_OPS_POLICY,
      1,
      deps,
    );

    expect(summary[0]).toMatchObject({
      label: 'Filtered rows',
      value: '2/3',
      detail: '1 active filter is narrowing the partner list',
    });
    expect(summary.find((item) => item.label === 'Direct ready')?.value).toBe('1');
    expect(summary.find((item) => item.label === 'Marketplace ready')?.value).toBe('1');
    expect(summary.find((item) => item.label === 'Approval review')).toMatchObject({
      href: '/partners?review=unapproved',
      value: '0',
      detail:
        'Partners waiting on registration, KYC, required documents, public media, or hold review',
    });
    expect(summary.find((item) => item.label === 'Location refresh')?.value).toBe('1');
  });

  it('builds review queue totals from activity facts only', () => {
    const review = buildPartnerReviewQueue(
      [
        partner(),
        partner({ id: 'partner-blocked', blockedAt: now.toISOString() }),
        partner({
          id: 'partner-document',
          documents: [{ id: 'doc-rejected', type: 'CCCD_BACK', status: 'REJECTED' }],
        }),
      ],
      DEFAULT_PROVIDER_OPS_POLICY,
      deps,
    );

    expect(review.items.find((item) => item.label === 'Account blocks')?.count).toBe(1);
    expect(review.items.find((item) => item.label === 'Direct request held')?.detail).toBe(
      'Partners who cannot receive direct requests now because identity, device, location, push, or control gates are not satisfied.',
    );
    expect(review.items.find((item) => item.label === 'Document review')?.count).toBe(1);
    expect(review.items.find((item) => item.label === 'Withdrawal detail review')?.detail).toContain(
      'not Level 2 matching approval',
    );
    expect(review.items.find((item) => item.label === 'First earning payout profile')?.detail).toContain(
      'payout profile',
    );
    expect(review.items.find((item) => item.label === 'First earning payout setup')).toBeUndefined();
    expect(review.items.find((item) => item.label === 'Tax profile optional')?.detail).toContain(
      'not required for Vietnam MVP',
    );
    expect(review.items.find((item) => item.label === 'Cash fee debt')?.href).toBe(
      '/partners?review=unsettled',
    );
    expect(review.items.find((item) => item.label === 'Direct request ready')?.count).toBe(1);
    expect(review.items.find((item) => item.label === 'Marketplace ready')?.count).toBe(1);
    expect(review.totalOpen).toBeGreaterThanOrEqual(2);
  });
});
