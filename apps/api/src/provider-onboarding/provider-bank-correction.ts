import { ProviderBankAccountStatus } from '@prisma/client';

export const PROVIDER_BANK_CORRECTION_ACTION = 'UPDATE_BANK_ACCOUNT';
export const PROVIDER_BANK_CORRECTION_MESSAGE = '입금 정보가 정확하지 않아 입금이 되지 않습니다.';

type ProviderBankCorrectionAccount = {
  readonly id: string;
  readonly status: ProviderBankAccountStatus;
  readonly rejectionReason?: string | null;
  readonly reviewedAt?: Date | null;
  readonly updatedAt?: Date | null;
  readonly deletedAt?: Date | null;
};

export function providerBankCorrectionRequest(
  bankAccounts: readonly ProviderBankCorrectionAccount[] | null | undefined,
) {
  const rejectedAccount = bankAccounts?.find(
    (account) => !account.deletedAt && account.status === ProviderBankAccountStatus.REJECTED,
  );
  if (!rejectedAccount) {
    return null;
  }

  return {
    required: true,
    action: PROVIDER_BANK_CORRECTION_ACTION,
    bankAccountId: rejectedAccount.id,
    message: PROVIDER_BANK_CORRECTION_MESSAGE,
    reason: rejectedAccount.rejectionReason?.trim() || PROVIDER_BANK_CORRECTION_MESSAGE,
    reviewedAt: rejectedAccount.reviewedAt ?? null,
    updatedAt: rejectedAccount.updatedAt ?? null,
  };
}
