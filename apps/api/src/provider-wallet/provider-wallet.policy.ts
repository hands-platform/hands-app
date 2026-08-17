import { BadRequestException } from '@nestjs/common';

const DEFAULT_WALLET_CURRENCY = 'VND';
const SETTLEMENT_REFERENCE_SUFFIX_LENGTH = 8;

export const PROVIDER_WALLET_BLOCK_CODE = 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT';
export const PROVIDER_WALLET_BLOCK_REASON =
  'Outstanding HANDS fee settlement must be completed before final booking acceptance, service start, or payout release.';
export const PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE =
  'Phí HANDS chưa được thanh toán nên bạn chưa thể xác nhận nhận lịch này.';
export const PROVIDER_WALLET_SETTLEMENT_METHOD = 'PROVIDER_DEPOSIT_OR_ADMIN_OFFSET';
export const PROVIDER_WALLET_SETTLEMENT_INSTRUCTION =
  'Các công việc thanh toán bằng tiền mặt đã tạo ra khoản phí HANDS chưa thanh toán. Bạn vẫn có thể xem và tham gia yêu cầu đặt lịch, nhưng không thể xác nhận nhận lịch, bắt đầu dịch vụ hoặc nhận tiền chi trả cho đến khi HANDS xác nhận khoản nộp hoặc bù trừ.';

export function providerWalletSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-SETTLEMENT_REFERENCE_SUFFIX_LENGTH).toUpperCase()}`;
}

export function providerWalletSettlementSteps(amount: number, currency: string, providerProfileId: string) {
  return [
    `Thanh toán ${amount.toLocaleString('vi-VN')} ${currency} phí HANDS còn thiếu.`,
    `Dùng mã ${providerWalletSettlementReference(providerProfileId)} khi báo cáo khoản nộp.`,
    'Sau khi quản trị viên xác nhận khoản nộp hoặc bù trừ, hãy làm mới trạng thái ví.',
    'Quyền xác nhận nhận lịch, bắt đầu dịch vụ và nhận tiền chi trả sẽ được khôi phục khi số dư ví không còn âm.',
  ];
}

export function providerWalletBlockedResponse(input: {
  providerProfileId: string;
  walletBalance: number;
  currency?: string;
}) {
  const walletDebtAmount = Math.abs(input.walletBalance);
  const currency = input.currency ?? DEFAULT_WALLET_CURRENCY;
  return {
    code: PROVIDER_WALLET_BLOCK_CODE,
    message: PROVIDER_WALLET_BLOCK_REASON,
    displayMessage: PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE,
    walletBlocked: true,
    marketplaceVisibilityBlocked: false,
    marketplaceJoinBlocked: false,
    directFirstPickBlocked: true,
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
