import { BadRequestException } from '@nestjs/common';

export const PROVIDER_WALLET_BLOCK_CODE = 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT';
export const PROVIDER_WALLET_BLOCK_REASON = '수수료 정산이 완료되지 않아 예약을 받을 수 없습니다.';
export const PROVIDER_WALLET_SETTLEMENT_METHOD = 'PROVIDER_DEPOSIT_OR_ADMIN_OFFSET';
export const PROVIDER_WALLET_SETTLEMENT_INSTRUCTION =
  '현금 예약으로 발생한 HANDS 수수료와 원천징수 금액이 미정산 상태입니다. 회사 계좌로 입금하거나 관리자 정산/상계가 완료되면 예약 수락이 다시 가능합니다.';

export function providerWalletSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}

export function providerWalletSettlementSteps(amount: number, currency: string, providerProfileId: string) {
  return [
    `Settle ${amount.toLocaleString('vi-VN')} ${currency} for unpaid HANDS fees.`,
    `Use reference ${providerWalletSettlementReference(providerProfileId)} when reporting the deposit.`,
    'After admin confirms the deposit or offset, refresh wallet status.',
    'New booking acceptance unlocks only when the wallet is no longer negative.',
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
    walletBlocked: true,
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
