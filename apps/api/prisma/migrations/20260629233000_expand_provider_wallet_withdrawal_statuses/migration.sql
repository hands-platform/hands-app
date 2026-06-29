ALTER TYPE "ProviderWalletWithdrawalRequestStatus" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER_PENDING';
ALTER TYPE "ProviderWalletWithdrawalRequestStatus" ADD VALUE IF NOT EXISTS 'REVIEW_REQUIRED';
ALTER TYPE "ProviderWalletWithdrawalRequestStatus" ADD VALUE IF NOT EXISTS 'HOLD';
ALTER TYPE "ProviderWalletWithdrawalRequestStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "ProviderWalletWithdrawalRequestStatus" ADD VALUE IF NOT EXISTS 'REVERSED';
