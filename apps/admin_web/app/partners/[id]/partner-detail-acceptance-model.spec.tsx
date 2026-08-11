import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../../lib/operations-policy';
import {
  buildPartnerAcceptanceRepairCommand,
  buildPartnerAcceptanceUnblockPlaybook,
  buildPartnerDetailOpsBadges,
  buildProviderBookingAcceptance,
} from './partner-detail-acceptance-model';
import { buildProviderPayoutOps } from './partner-detail-payout-security-model';
import type { PartnerDispatchPolicy, ProviderDetail } from './partner-detail-types';

const dispatchPolicy: PartnerDispatchPolicy = {
  backupRadiusMeters: 10000,
  locationFreshnessMinutes: 90,
  responseWindowMinutes: 10,
};

describe('partner detail acceptance model', () => {
  it('keeps a fully ready Partner eligible for direct and marketplace work', () => {
    const provider = readyProvider();
    const acceptance = buildProviderBookingAcceptance(
      provider,
      { readyCount: 1, rows: [{}] },
      dispatchPolicy,
    );
    const payoutOps = buildProviderPayoutOps(provider);
    const command = buildPartnerAcceptanceRepairCommand(
      provider,
      acceptance,
      payoutOps,
      dispatchPolicy,
    );

    expect(acceptance).toMatchObject({
      bookableServices: '1/1',
      canDirectFirstPick: true,
      canJoinMarketplace: true,
      cashDebt: 0,
      status: 'CAN ACCEPT',
      tone: 'done',
    });
    expect(command).toMatchObject({
      customerImpact: expect.stringContaining('Can appear'),
      partnerAppMessage: 'Partner is clear for direct first-pick and marketplace participation.',
      status: 'MARKETPLACE READY',
      tone: 'done',
    });
    expect(command.steps).toEqual([
      expect.objectContaining({ blocker: 'No active blocker', tone: 'done' }),
    ]);
    expect(buildPartnerAcceptanceUnblockPlaybook(provider, acceptance, payoutOps)).toEqual([]);
    expect(buildPartnerDetailOpsBadges(provider, acceptance, dispatchPolicy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Direct first-pick ready', tone: 'done' }),
        expect.objectContaining({ label: 'Marketplace participation ready', tone: 'done' }),
      ]),
    );
  });

  it('treats cash debt as a settlement warning while keeping marketplace participation open', () => {
    const provider = readyProvider({
      earnings: [
        {
          booking: {
            payment: { method: 'CASH' },
          },
          bookingId: 'booking-cash-1',
          currency: 'VND',
          grossAmount: 420000,
          id: 'earning-cash-1',
          netAmount: -85000,
          platformFee: 70000,
          providerProfileId: 'partner-1',
          status: 'AVAILABLE',
          withholdingAmount: 15000,
        },
      ],
    });
    const acceptance = buildProviderBookingAcceptance(
      provider,
      { readyCount: 1, rows: [{}] },
      dispatchPolicy,
    );
    const payoutOps = buildProviderPayoutOps(provider);
    const command = buildPartnerAcceptanceRepairCommand(
      provider,
      acceptance,
      payoutOps,
      dispatchPolicy,
    );
    const unblockSteps = buildPartnerAcceptanceUnblockPlaybook(provider, acceptance, payoutOps);

    expect(acceptance).toMatchObject({
      canDirectFirstPick: true,
      canJoinMarketplace: true,
      cashDebt: 85000,
      status: 'SETTLEMENT WARNING',
      tone: 'pending',
    });
    expect(command).toMatchObject({
      operatorDecision: expect.stringContaining('Finance must clear cash debt'),
      status: 'SETTLEMENT WARNING',
      tone: 'pending',
    });
    expect(command.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker: 'Wallet and cash debt', tone: 'pending' }),
        expect.objectContaining({ blocker: 'Payout-only withdrawal profile', tone: 'pending' }),
      ]),
    );
    expect(unblockSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'cash-debt', bookingBlocked: false, tone: 'pending' }),
        expect.objectContaining({ id: 'tax-after-first-earning', tone: 'pending' }),
      ]),
    );
  });

  it('returns operator repair steps for identity, reachability, location, and pricing blockers', () => {
    const provider = providerFixture({
      currentLocationUpdatedAt: '2020-01-01T00:00:00.000Z',
      id: 'partner-blocked',
      kyc: { id: 'kyc-blocked', status: 'PENDING' },
      status: 'OFFLINE',
      user: { pushDevices: [] },
      verification: { id: 'verification-blocked', status: 'PENDING' },
    });
    const acceptance = buildProviderBookingAcceptance(
      provider,
      { readyCount: 0, rows: [] },
      dispatchPolicy,
    );
    const command = buildPartnerAcceptanceRepairCommand(
      provider,
      acceptance,
      buildProviderPayoutOps(provider),
      dispatchPolicy,
    );

    expect(acceptance.canJoinMarketplace).toBe(false);
    expect(acceptance.status).toContain('BLOCKER');
    expect(command.tone).toBe('blocked');
    expect(command.partnerAppMessage).toBe(
      'Identity verification must be approved before receiving paid work.',
    );
    expect(command.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blocker: 'Identity and approval', owner: 'KYC' }),
        expect.objectContaining({ blocker: 'Online and reachable', owner: 'Ops' }),
        expect.objectContaining({ blocker: 'Location freshness', owner: 'Dispatch' }),
        expect.objectContaining({ blocker: 'Bookable services', owner: 'Ops' }),
      ]),
    );
  });
});

function readyProvider(overrides: Record<string, unknown> = {}): ProviderDetail {
  return providerFixture({
    currentLocationUpdatedAt: new Date().toISOString(),
    documents: ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((type, index) => ({
      id: `document-${index}`,
      status: 'APPROVED',
      type,
    })),
    id: 'partner-1',
    kyc: { id: 'kyc-1', status: 'APPROVED' },
    status: 'ONLINE_AVAILABLE',
    user: {
      pushDevices: [{ enabled: true, id: 'push-1' }],
    },
    verification: { id: 'verification-1', status: 'APPROVED' },
    ...overrides,
  });
}

function providerFixture(overrides: Record<string, unknown>): ProviderDetail {
  return overrides as ProviderDetail;
}
