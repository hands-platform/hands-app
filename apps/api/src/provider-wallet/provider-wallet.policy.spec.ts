import {
  PROVIDER_WALLET_BLOCK_CODE,
  PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE,
  PROVIDER_WALLET_SETTLEMENT_METHOD,
  providerWalletBlockedResponse,
  providerWalletSettlementReference,
} from './provider-wallet.policy';

describe('provider wallet settlement gate policy', () => {
  it('blocks final acceptance, service start, and payout without hiding visible demand', () => {
    const response = providerWalletBlockedResponse({
      providerProfileId: 'provider-profile-abc12345',
      walletBalance: -145000,
      currency: 'VND',
    });

    expect(response.code).toBe(PROVIDER_WALLET_BLOCK_CODE);
    expect(response.displayMessage).toBe(PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE);
    expect(response.walletBlocked).toBe(true);
    expect(response.marketplaceVisibilityBlocked).toBe(false);
    expect(response.marketplaceJoinBlocked).toBe(false);
    expect(response.directFirstPickBlocked).toBe(false);
    expect(response.alreadyMatchedServiceBlocked).toBe(true);
    expect(response.payoutReleaseBlocked).toBe(true);
    expect(response.walletDebtAmount).toBe(145000);
    expect(response.walletSettlementMethod).toBe(PROVIDER_WALLET_SETTLEMENT_METHOD);
    expect(response.walletSettlementReference).toBe('HANDS-WALLET-ABC12345');
    expect(response.message).toContain('final acceptance');
    expect(response.walletBlockReason).toContain('service start');
    expect(response.walletSettlementInstruction).toContain('Marketplace requests stay visible');
    expect(response.walletSettlementInstruction).toContain('participation is allowed');
    expect(response.walletSettlementSteps.join(' ')).toContain(
      'Final acceptance, service start, and payout release resume',
    );
  });

  it('builds a stable settlement reference from the partner profile id', () => {
    expect(providerWalletSettlementReference('partner-00000042')).toBe('HANDS-WALLET-00000042');
  });
});
