import { Prisma } from '@prisma/client';
import { adminProviderSummarySelect } from './admin-provider-selects';
import { adminUserSummarySelect } from './admin-user-selects';

export const adminRefundSummarySelect = {
  id: true,
  bookingId: true,
  paymentId: true,
  amount: true,
  currency: true,
  reason: true,
  status: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.RefundSelect;

export const adminRefundListSelect = {
  ...adminRefundSummarySelect,
  payment: {
    select: {
      id: true,
      bookingId: true,
      method: true,
      status: true,
      amount: true,
      currency: true,
      providerRef: true,
      callbackAttempts: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          outcome: true,
          signatureVerified: true,
          providerStatus: true,
          gatewayTransactionId: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
        },
      },
    },
  },
  booking: {
    select: {
      id: true,
      status: true,
      customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
      selectedProvider: { select: adminProviderSummarySelect },
    },
  },
} satisfies Prisma.RefundSelect;

export const adminPaymentSummarySelect = {
  id: true,
  bookingId: true,
  method: true,
  status: true,
  amount: true,
  currency: true,
  providerRef: true,
  refunds: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminRefundSummarySelect,
  },
} satisfies Prisma.PaymentSelect;

export const adminPaymentEvidenceSelect = {
  ...adminPaymentSummarySelect,
  rawMeta: true,
} satisfies Prisma.PaymentSelect;

export const adminPaymentCallbackAttemptSummarySelect = {
  id: true,
  paymentId: true,
  method: true,
  providerRef: true,
  outcome: true,
  signatureVerified: true,
  verificationMode: true,
  providerStatus: true,
  gatewayTransactionId: true,
  callbackAmount: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
} satisfies Prisma.PaymentCallbackAttemptSelect;

export const adminPaymentCallbackAttemptListSelect = {
  ...adminPaymentCallbackAttemptSummarySelect,
  payment: {
    select: {
      id: true,
      bookingId: true,
      method: true,
      status: true,
      amount: true,
      currency: true,
      providerRef: true,
      booking: {
        select: {
          id: true,
          status: true,
          customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
          selectedProvider: { select: adminProviderSummarySelect },
        },
      },
    },
  },
} satisfies Prisma.PaymentCallbackAttemptSelect;

export const adminPlatformFeeLogSummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  earningId: true,
  policyVersionId: true,
  grossAmount: true,
  platformFeeAmount: true,
  currency: true,
  ruleSnapshot: true,
  createdAt: true,
} satisfies Prisma.ProviderPlatformFeeLogSelect;

export const adminProviderTaxLogSummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  earningId: true,
  taxProfileId: true,
  policyVersionId: true,
  grossAmount: true,
  taxableAmount: true,
  withholdingAmount: true,
  currency: true,
  ruleSnapshot: true,
  createdAt: true,
} satisfies Prisma.ProviderTaxLogSelect;

export const adminProviderWalletLedgerEntrySummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  earningId: true,
  payoutBatchId: true,
  type: true,
  sourceKey: true,
  amount: true,
  currency: true,
  reference: true,
  notes: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderWalletLedgerEntrySelect;

export const adminRecentPlatformFeeLogsSelect = (take: number) =>
  ({
    orderBy: { createdAt: 'desc' },
    take,
    select: adminPlatformFeeLogSummarySelect,
  }) satisfies Prisma.ProviderPlatformFeeLogFindManyArgs;

export const adminRecentProviderTaxLogsSelect = (take: number) =>
  ({
    orderBy: { createdAt: 'desc' },
    take,
    select: adminProviderTaxLogSummarySelect,
  }) satisfies Prisma.ProviderTaxLogFindManyArgs;

export const adminRecentProviderWalletLedgerEntriesSelect = (take: number) =>
  ({
    orderBy: { createdAt: 'desc' },
    take,
    select: adminProviderWalletLedgerEntrySummarySelect,
  }) satisfies Prisma.ProviderWalletLedgerEntryFindManyArgs;

export const adminEarningSummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  grossAmount: true,
  platformFee: true,
  withholdingAmount: true,
  netAmount: true,
  currency: true,
  status: true,
  availableAt: true,
  paidAt: true,
  payoutBatchId: true,
  settlementRef: true,
  settlementNotes: true,
  settlementMethod: true,
  createdAt: true,
  platformFeeLogs: adminRecentPlatformFeeLogsSelect(3),
  taxLogs: adminRecentProviderTaxLogsSelect(3),
  walletLedgerEntries: adminRecentProviderWalletLedgerEntriesSelect(3),
} satisfies Prisma.ProviderEarningSelect;

export const adminEarningListSelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  netAmount: true,
  currency: true,
  status: true,
  createdAt: true,
  platformFeeLogs: adminRecentPlatformFeeLogsSelect(1),
  taxLogs: adminRecentProviderTaxLogsSelect(1),
  walletLedgerEntries: adminRecentProviderWalletLedgerEntriesSelect(1),
} satisfies Prisma.ProviderEarningSelect;

export const adminEarningDetailSelect = {
  ...adminEarningSummarySelect,
  platformFeeLogs: adminRecentPlatformFeeLogsSelect(5),
  taxLogs: adminRecentProviderTaxLogsSelect(5),
  walletLedgerEntries: adminRecentProviderWalletLedgerEntriesSelect(5),
} satisfies Prisma.ProviderEarningSelect;
