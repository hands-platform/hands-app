import { BadRequestException } from '@nestjs/common';

export const PROVIDER_WALLET_BLOCK_CODE = 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT';
export const PROVIDER_WALLET_BLOCK_REASON =
  'Outstanding HANDS fee settlement must be completed before final acceptance, service start, or payout release.';
export const PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE =
  'Unpaid HANDS fees must be settled before final acceptance or service start.';
export const PROVIDER_WALLET_SETTLEMENT_METHOD = 'PROVIDER_DEPOSIT_OR_ADMIN_OFFSET';
export const PROVIDER_WALLET_SETTLEMENT_INSTRUCTION =
  'Cash bookings created unpaid HANDS platform fee or tax settlement debt. Marketplace requests stay visible and participation is allowed, but final acceptance, service start, and payout release are blocked until HANDS confirms the deposit or admin offset.';

export function providerWalletSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}

export function providerWalletSettlementSteps(amount: number, currency: string, providerProfileId: string) {
  return [
    `Settle ${amount.toLocaleString('vi-VN')} ${currency} for unpaid HANDS fees.`,
    `Use reference ${providerWalletSettlementReference(providerProfileId)} when reporting the deposit.`,
    'After admin confirms the deposit or offset, refresh wallet status.',
    'Final acceptance, service start, and payout release resume when the wallet is no longer negative.',
  ];
}

export function providerWalletBlockedResponse(input: {
  providerProfileId: string;
  walletBalance: number;
  currency?: string;
}) {
  const walletDebtAmount = Math.abs(input.walletBalance);
  const currency = input.currency ?? 'VND';
  return {
    code: PROVIDER_WALLET_BLOCK_CODE,
    message: PROVIDER_WALLET_BLOCK_REASON,
    displayMessage: PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE,
    walletBlocked: true,
    marketplaceVisibilityBlocked: false,
    marketplaceJoinBlocked: false,
    directFirstPickBlocked: false,
    alreadyMatchedServiceBlocked: true,
    payoutReleaseBlocked: true,
    walletBalance: input.walletBalance,
    walletDebtAmount,
    walletBlockReason: PROVIDER_WALLET_BLOCK_REASON,
    walletSettlementRequired: true,
    walletSettlementMethod: PROVIDER_WALLET_SETTLEMENT_METHOD,
    walletSettlementReference: providerWalletSettlementReference(input.providerProfileId),
    walletSettlementInstruction: PROVIDER_WALLET_SETTLEMENT_INSTRUCTION,
    walletSettlementSteps: providerWalletSettlementSteps(walletDebtAmount, currency, input.providerProfileId),
  };
}

export function throwProviderWalletBlocked(input: {
  providerProfileId: string;
  walletBalance: number;
  currency?: string;
}): never {
  throw new BadRequestException(providerWalletBlockedResponse(input));
}
