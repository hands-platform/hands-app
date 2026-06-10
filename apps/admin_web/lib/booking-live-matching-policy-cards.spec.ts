import { buildBookingLiveMatchingPolicyCards } from './booking-live-matching-policy-cards';
import type { AdminLiveOperationsPolicy } from './operations-policy';

function policy(overrides: Partial<AdminLiveOperationsPolicy> = {}): AdminLiveOperationsPolicy {
  return {
    backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
    cashSettlementClearance: 'DEPOSIT_OR_ADMIN_OFFSET_REQUIRED',
    marketplaceInvitationLimit: 50,
    marketplaceLocationFreshnessMinutes: 30,
    marketplaceOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
    marketplaceRadiusMeters: 10_000,
    payoutBatchCycle: 'WEEKLY_OR_MONTHLY_BATCH',
    preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
    providerResponseWindowMinutes: 10,
    travelBufferMinutes: 30,
    walletNegativeGate: 'BLOCK_MARKETPLACE_PARTICIPATION',
    ...overrides,
  };
}

describe('buildBookingLiveMatchingPolicyCards', () => {
  it('summarizes first-pick and marketplace policy values for the booking monitor', () => {
    const cards = buildBookingLiveMatchingPolicyCards(
      policy({
        marketplaceInvitationLimit: 25,
        marketplaceLocationFreshnessMinutes: 12,
        marketplaceRadiusMeters: 8500,
        providerResponseWindowMinutes: 8,
        travelBufferMinutes: 20,
      }),
    );

    expect(cards.map((card) => [card.label, card.value])).toEqual([
      ['First-pick window', '8m'],
      ['Travel buffer', '20m'],
      ['Marketplace radius', '8.5km'],
      ['Location freshness', '12m'],
      ['Invitation cap', '25'],
      ['Wallet gate', 'Block Marketplace Participation'],
    ]);
    expect(cards[5].helper).toContain('Negative Partner wallet blocks final acceptance');
  });
});
