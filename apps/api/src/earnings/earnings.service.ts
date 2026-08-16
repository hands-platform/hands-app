import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AccountingJournalBatchStatus,
  AccountingJournalEntrySide,
  AccountingJournalSourceType,
  BankReconciliationStatus,
  PartnerBankDepositRequestStatus,
  PartnerTaxLineKind,
  BookingStatus,
  EarningStatus,
  PaymentFeePayer,
  PaymentFeeRuleType,
  PaymentFeeTreatment,
  PaymentMethod,
  PayoutBatchStatus,
  Prisma,
  MonthlyTaxClosingStatus,
  ProviderWalletLedgerType,
  ProviderWalletWithdrawalRequestStatus,
  Role,
  ProviderBankAccountStatus,
  ProviderSanctionStatus,
  ProviderSanctionType,
  ProviderTaxProfileStatus,
  TaxPolicyStatus,
  TaxRuleScope,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { providerBankCorrectionRequest } from '../provider-onboarding/provider-bank-correction';
import {
  adminQueueAgeDateWhere,
  adminQueueSlaDateWhere,
  adminQueueSlaWindow,
  normalizeAdminQueueSlaFilter,
} from '../admin/admin-queue-list';
import { adminBookingProductionDataWhere } from '../admin/admin-booking-list-query';
import {
  adminPayoutBankOutflowReconciliationCteSql,
  type AdminPayoutBankOutflowCandidateRow,
} from '../admin/admin-payout-bank-reconciliation-query';
import {
  DEFAULT_START_SHIFT_ACTION_SLA_MINUTES,
  START_SHIFT_ACTION_SLA_POLICY_KEYS,
} from '../matching/matching.policy';
import { POST_MATCH_CANCELLATION_HELD_REASON } from '../bookings/post-match-cancellation';
import { REQUIRED_PAYOUT_AGREEMENTS } from '../provider-onboarding/provider-onboarding.policy';
import { bookingServiceAmount, buildCouponSettlementContext } from '../settlements/coupon-settlement';
import { analyzeHistoricalSettlementEvidence } from '../settlements/historical-settlement-reconstruction';
import { settlementMonthlyPeriod, SettlementsService } from '../settlements/settlements.service';
import {
  immutableFinancialReplayMatches,
  PROVIDER_WALLET_LEDGER_REPLAY_FIELDS,
} from '../settlements/immutable-financial-replay';
import {
  allocatePartnerBankDeposit,
  calculateCashBookingPartnerDue,
  calculateProviderWalletDelta,
  calculateServicePayoutFeeFromRules,
  normalizePartnerBankDepositInput,
  normalizeProviderWalletWithdrawalRequestInput,
  normalizeProviderWalletWithdrawalRequestUpdateInput,
  normalizePayoutBatchUpdateStatus,
  type PartnerBankDepositInput,
  type ProviderWalletWithdrawalRequestInput,
  type ProviderWalletWithdrawalRequestUpdateInput,
} from './earnings.policy';
import {
  PROVIDER_WALLET_BLOCK_CODE,
  PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE,
  PROVIDER_WALLET_BLOCK_REASON,
  PROVIDER_WALLET_SETTLEMENT_INSTRUCTION,
  PROVIDER_WALLET_SETTLEMENT_METHOD,
  providerWalletSettlementReference,
  providerWalletSettlementSteps,
  throwProviderWalletBlocked,
} from '../provider-wallet/provider-wallet.policy';
import {
  CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
  CASH_SETTLEMENT_STALE_MS,
  cashSettlementDebtCteSql,
  cashSettlementDebtFilterSql,
  type CashSettlementDebtFilter,
} from './cash-settlement-query';
import {
  calculateCappedBpsAmount,
  calculatePartnerTaxLine,
  calculatePartnerTaxWithholding,
} from './tax-policy-withholding';

type PlatformFeePolicyWithRules = Prisma.PlatformFeePolicyVersionGetPayload<{ include: { rules: true } }>;
type PlatformFeeRuleRecord = PlatformFeePolicyWithRules['rules'][number];
type PaymentFeePolicyWithRules = Prisma.PaymentFeePolicyVersionGetPayload<{ include: { rules: true } }>;
type PaymentFeeRuleRecord = PaymentFeePolicyWithRules['rules'][number];
type TxClient = Prisma.TransactionClient;
type PricedBookingService = {
  serviceId: string;
  serviceName?: string | null;
  price: number;
  quantity: number;
  payoutRuleIdSnapshot?: string | null;
  providerPayoutAmountSnapshot?: number | null;
  payoutRuleSnapshot?: Prisma.JsonValue | null;
};

function bookingServicePayoutSnapshot(service: PricedBookingService) {
  const snapshot =
    service.payoutRuleSnapshot &&
    typeof service.payoutRuleSnapshot === 'object' &&
    !Array.isArray(service.payoutRuleSnapshot)
      ? service.payoutRuleSnapshot
      : null;
  const ruleId = snapshot && typeof snapshot.id === 'string' ? snapshot.id : service.payoutRuleIdSnapshot;
  const customerPrice = snapshot && typeof snapshot.customerPrice === 'number' ? snapshot.customerPrice : null;
  const providerPayoutAmount = service.providerPayoutAmountSnapshot;
  const vatBps = snapshot && typeof snapshot.vatBps === 'number' ? snapshot.vatBps : null;
  const otherCostAmount =
    snapshot && typeof snapshot.otherCostAmount === 'number' ? snapshot.otherCostAmount : null;
  const currency = snapshot && typeof snapshot.currency === 'string' ? snapshot.currency : null;

  if (
    !ruleId ||
    customerPrice !== service.price ||
    !Number.isInteger(providerPayoutAmount) ||
    (providerPayoutAmount ?? -1) < 0 ||
    providerPayoutAmount! > service.price ||
    !Number.isInteger(vatBps) ||
    (vatBps ?? -1) < 0 ||
    !Number.isInteger(otherCostAmount) ||
    (otherCostAmount ?? -1) < 0 ||
    !currency
  ) {
    throw new BadRequestException(
      `Booking payout snapshot is missing or invalid for service ${service.serviceId}`,
    );
  }

  return {
    id: ruleId,
    serviceId: service.serviceId,
    customerPrice,
    providerPayoutAmount: providerPayoutAmount!,
    vatBps: vatBps!,
    otherCostAmount: otherCostAmount!,
    currency,
  };
}

const historicalPaidSettlementBookingSelect = {
  id: true,
  status: true,
  customerProfileId: true,
  selectedProviderId: true,
  updatedAt: true,
  closedAt: true,
  services: { select: { price: true, quantity: true } },
  payment: {
    select: {
      id: true,
      status: true,
      method: true,
      amount: true,
      currency: true,
      rawMeta: true,
    },
  },
  settlementSnapshot: { select: { id: true } },
  earning: {
    select: {
      id: true,
      providerProfileId: true,
      status: true,
      grossAmount: true,
      platformFee: true,
      withholdingAmount: true,
      netAmount: true,
      currency: true,
      paidAt: true,
      platformFeeLogs: {
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: {
          id: true,
          grossAmount: true,
          platformFeeAmount: true,
          currency: true,
          policyVersionId: true,
          ruleSnapshot: true,
          policyVersion: { select: { vatRateBps: true } },
        },
      },
      taxLogs: {
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: {
          id: true,
          grossAmount: true,
          taxableAmount: true,
          withholdingAmount: true,
          currency: true,
          policyVersionId: true,
          ruleSnapshot: true,
        },
      },
      walletLedgerEntries: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, amount: true },
      },
    },
  },
} satisfies Prisma.BookingSelect;

type AdminFinanceListQuery = {
  readonly age?: string | null;
  readonly evidence?: string | null;
  readonly period?: string | null;
  readonly q?: string | null;
  readonly queue?: string | null;
  readonly range?: string | null;
  readonly review?: string | null;
  readonly skip?: number | string | null;
  readonly sort?: string | null;
  readonly sla?: string | null;
  readonly status?: string | null;
  readonly take?: number | string | null;
  readonly view?: string | null;
};

const PAYOUT_BANK_MATCH_INCOMPLETE_EVIDENCE = 'bank-match-incomplete';

type AdminWithdrawalRequestListQuery = AdminFinanceListQuery & {
  readonly providerProfileId?: string | null;
  readonly reconciliation?: string | null;
  readonly status?: ProviderWalletWithdrawalRequestStatus | string | null;
};

type PayoutBatchPostPaymentEvidence = {
  readonly currency: string;
  readonly id: string;
  readonly status: PayoutBatchStatus;
  readonly totalNetAmount: number;
  readonly transferRef: string | null;
  readonly earnings: readonly {
    readonly withholdingAmount: number;
  }[];
  readonly withholdingLogs: readonly {
    readonly status: string;
  }[];
};

const payoutBatchPostPaymentEvidenceSelect = {
  currency: true,
  id: true,
  status: true,
  totalNetAmount: true,
  transferRef: true,
  earnings: { select: { withholdingAmount: true } },
  withholdingLogs: { select: { status: true } },
} satisfies Prisma.ProviderPayoutBatchSelect;

const ADMIN_FINANCE_LIST_DEFAULT_LIMIT = 50;
const ADMIN_FINANCE_LIST_MAX_LIMIT = 100;
const ACTIVE_WITHDRAWAL_REQUEST_STATUSES = [
  ProviderWalletWithdrawalRequestStatus.REQUESTED,
  ProviderWalletWithdrawalRequestStatus.NEEDS_BANK_CORRECTION,
  ProviderWalletWithdrawalRequestStatus.APPROVED,
  ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
  ProviderWalletWithdrawalRequestStatus.REVIEW_REQUIRED,
  ProviderWalletWithdrawalRequestStatus.HOLD,
] as const;
const RELEASED_WITHDRAWAL_REQUEST_STATUSES = [
  ProviderWalletWithdrawalRequestStatus.REJECTED,
  ProviderWalletWithdrawalRequestStatus.CANCELLED,
  ProviderWalletWithdrawalRequestStatus.FAILED,
  ProviderWalletWithdrawalRequestStatus.REVERSED,
] as const;
const ACTIVE_BANK_RECONCILIATION_STATUSES = [
  BankReconciliationStatus.MATCHED,
  BankReconciliationStatus.PARTIALLY_MATCHED,
] as const;

function cashSettlementDebtWhere(): Prisma.ProviderEarningWhereInput {
  return {
    booking: { is: adminBookingProductionDataWhere() },
    status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
    payoutBatchId: null,
    netAmount: { lt: 0 },
    NOT: {
      booking: {
        is: {
          status: BookingStatus.CANCELLED,
          OR: [{ matchedAt: { not: null } }, { selectedProviderId: { not: null } }],
        },
      },
    },
  };
}

function mergeProviderEarningWhere(
  base: Prisma.ProviderEarningWhereInput,
  next: Prisma.ProviderEarningWhereInput,
): Prisma.ProviderEarningWhereInput {
  return { AND: [base, next] };
}

function adminEarningListWhere(options: AdminFinanceListQuery): Prisma.ProviderEarningWhereInput | undefined {
  const productionWhere: Prisma.ProviderEarningWhereInput = {
    booking: { is: adminBookingProductionDataWhere() },
  };
  const reviewWhere = adminEarningReviewWhere(options.review);
  const where = reviewWhere ? mergeProviderEarningWhere(productionWhere, reviewWhere) : productionWhere;
  const dateRange = adminFinanceDateRangeWhere(options.range);

  if (dateRange) {
    where.createdAt = dateRange;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function adminPayoutBatchListWhere(
  options: AdminFinanceListQuery,
): Prisma.ProviderPayoutBatchWhereInput | undefined {
  const fixtureIdentifiers: Prisma.ProviderPayoutBatchWhereInput[] = ['smoke', 'seed-'].flatMap((prefix) => [
    { id: { startsWith: prefix, mode: Prisma.QueryMode.insensitive } },
    { providerProfileId: { startsWith: prefix, mode: Prisma.QueryMode.insensitive } },
  ]);
  const productionWhere: Prisma.ProviderPayoutBatchWhereInput = {
    NOT: { OR: fixtureIdentifiers },
    earnings: { every: { booking: { is: adminBookingProductionDataWhere() } } },
  };
  const reviewWhere = adminPayoutBatchReviewWhere(options.review);
  let where = reviewWhere ? mergePayoutBatchWhere(productionWhere, reviewWhere) : productionWhere;
  const dateRange = adminFinanceDateRangeWhere(options.range);
  const status = normalizePayoutBatchStatus(options.status);
  const queueWhere = adminPayoutBatchQueueWhere(options.queue);
  const evidenceWhere = adminPayoutBatchEvidenceWhere(options.evidence);
  const searchWhere = adminPayoutBatchSearchWhere(options.q);

  if (dateRange) {
    where.createdAt = dateRange;
  }
  if (status) {
    where = mergePayoutBatchWhere(where, { status });
  }
  for (const next of [queueWhere, evidenceWhere, searchWhere]) {
    if (next) where = mergePayoutBatchWhere(where, next);
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function adminWithdrawalRequestListWhere(
  options: AdminWithdrawalRequestListQuery,
): Prisma.ProviderWalletWithdrawalRequestWhereInput | undefined {
  let where: Prisma.ProviderWalletWithdrawalRequestWhereInput = {};
  const providerProfileId = cleanQueryText(options.providerProfileId);
  const reconciliation = normalizeOptionalQuery(options.reconciliation);
  const status = normalizeWithdrawalRequestStatus(options.status);
  const dateRange = adminFinanceDateRangeWhere(options.range);

  if (providerProfileId) {
    where.providerProfileId = providerProfileId;
  }
  if (status) {
    where.status = status;
  }
  if (dateRange) {
    where.createdAt = dateRange;
  }
  const searchWhere = adminWithdrawalRequestSearchWhere(options.q);
  if (searchWhere) {
    where = mergeWithdrawalRequestWhere(where, searchWhere);
  }
  if (reconciliation === 'unmatched') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { status: ProviderWalletWithdrawalRequestStatus.PAID },
      {
        bankReconciliationMatches: {
          none: { status: { in: [...ACTIVE_BANK_RECONCILIATION_STATUSES] } },
        },
      },
    ];
  } else if (reconciliation === 'matched') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { status: ProviderWalletWithdrawalRequestStatus.PAID },
      {
        bankReconciliationMatches: {
          some: { status: { in: [...ACTIVE_BANK_RECONCILIATION_STATUSES] } },
        },
      },
    ];
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function normalizePayoutBatchStatus(value: string | null | undefined) {
  if (!value) return null;
  const status = String(value).trim().toUpperCase() as PayoutBatchStatus;
  return Object.values(PayoutBatchStatus).includes(status) ? status : null;
}

function adminPayoutBatchQueueWhere(
  queue: string | null | undefined,
): Prisma.ProviderPayoutBatchWhereInput | null {
  switch (normalizeOptionalQuery(queue)) {
    case 'open':
      return { status: { notIn: [PayoutBatchStatus.PAID, PayoutBatchStatus.CANCELLED] } };
    case 'review':
      return { status: { in: [PayoutBatchStatus.DRAFT, PayoutBatchStatus.FAILED] } };
    case 'transfer':
      return { status: PayoutBatchStatus.PROCESSING };
    case 'paid':
      return { status: PayoutBatchStatus.PAID };
    case 'repair':
      return {
        status: PayoutBatchStatus.PAID,
        OR: [
          { transferRef: null },
          { withholdingLogs: { some: { status: { not: 'PAID' } } } },
        ],
      };
    case 'archived':
      return { status: PayoutBatchStatus.CANCELLED };
    default:
      return null;
  }
}

function adminPayoutBatchEvidenceWhere(
  evidence: string | null | undefined,
): Prisma.ProviderPayoutBatchWhereInput | null {
  switch (normalizeOptionalQuery(evidence)) {
    case 'missing-transfer-ref':
      return { transferRef: null };
    case 'withholding-review':
      return { withholdingLogs: { some: { status: { not: 'PAID' } } } };
    case 'complete':
      return {
        transferRef: { not: null },
        withholdingLogs: { none: { status: { not: 'PAID' } } },
      };
    default:
      return null;
  }
}

function adminPayoutBankReconciliationPeriod(value: string | null | undefined) {
  const period = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  throw new BadRequestException('Payout bank reconciliation period must use YYYY-MM');
}

function adminPayoutBatchSearchWhere(
  q: string | null | undefined,
): Prisma.ProviderPayoutBatchWhereInput | null {
  const query = cleanQueryText(q);
  if (!query) return null;
  const textFilter = { contains: query, mode: Prisma.QueryMode.insensitive };
  return {
    OR: [
      { id: textFilter },
      { providerProfileId: textFilter },
      { transferRef: textFilter },
      { providerProfile: { is: { displayName: textFilter } } },
      { providerProfile: { is: { user: { is: { fullName: textFilter } } } } },
      { providerProfile: { is: { user: { is: { phone: textFilter } } } } },
    ],
  };
}

function adminWithdrawalRequestSearchWhere(
  q: string | null | undefined,
): Prisma.ProviderWalletWithdrawalRequestWhereInput | null {
  const query = cleanQueryText(q);
  if (!query) return null;
  const textFilter = { contains: query, mode: Prisma.QueryMode.insensitive };
  return {
    OR: [
      { id: textFilter },
      { providerProfileId: textFilter },
      { transferRef: textFilter },
      { providerProfile: { is: { displayName: textFilter } } },
      { providerProfile: { is: { user: { is: { fullName: textFilter } } } } },
      { providerProfile: { is: { user: { is: { phone: textFilter } } } } },
    ],
  };
}

function mergeWithdrawalRequestWhere(
  base: Prisma.ProviderWalletWithdrawalRequestWhereInput | undefined,
  next: Prisma.ProviderWalletWithdrawalRequestWhereInput,
): Prisma.ProviderWalletWithdrawalRequestWhereInput {
  return base ? { AND: [base, next] } : next;
}

function withdrawalRequestCountArgs(
  where: Prisma.ProviderWalletWithdrawalRequestWhereInput | undefined,
): Prisma.ProviderWalletWithdrawalRequestCountArgs {
  return where ? { where } : {};
}

function withdrawalRequestAmountAggregateArgs(
  where: Prisma.ProviderWalletWithdrawalRequestWhereInput | undefined,
): Prisma.ProviderWalletWithdrawalRequestAggregateArgs {
  return {
    ...(where ? { where } : {}),
    _sum: { amount: true },
  };
}

function cleanQueryText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mergePayoutBatchWhere(
  base: Prisma.ProviderPayoutBatchWhereInput | undefined,
  next: Prisma.ProviderPayoutBatchWhereInput,
): Prisma.ProviderPayoutBatchWhereInput {
  return base ? { AND: [base, next] } : next;
}

function payoutBatchCountArgs(
  where: Prisma.ProviderPayoutBatchWhereInput | undefined,
): Prisma.ProviderPayoutBatchCountArgs {
  return where ? { where } : {};
}

function withholdingLogWhereForPayoutBatchSummary(
  where: Prisma.ProviderPayoutBatchWhereInput | undefined,
): Prisma.WithholdingLogWhereInput {
  return where ? { payoutBatch: { is: where } } : { payoutBatchId: { not: null } };
}

function adminEarningReviewWhere(
  review: string | null | undefined,
): Prisma.ProviderEarningWhereInput | undefined {
  switch (normalizeOptionalQuery(review)) {
    case 'ready':
      return adminEarningReadyWhere();
    case 'closeout-review':
      return adminEarningCloseoutReviewWhere();
    case 'cash-debt':
      return cashSettlementDebtWhere();
    case 'batched':
      return { payoutBatchId: { not: null } };
    case 'paid':
      return { status: EarningStatus.PAID };
    case 'pending':
      return { status: EarningStatus.PENDING };
    case 'available':
      return { status: EarningStatus.AVAILABLE };
    case 'cancelled':
      return { status: EarningStatus.CANCELLED };
    default:
      return undefined;
  }
}

function adminEarningReadyWhere(): Prisma.ProviderEarningWhereInput {
  return {
    booking: { is: { status: BookingStatus.COMPLETED } },
    netAmount: { gt: 0 },
    payoutBatchId: null,
    status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
  };
}

function adminEarningCloseoutReviewWhere(): Prisma.ProviderEarningWhereInput {
  return {
    AND: [
      {
        OR: [{ netAmount: { lte: 0 } }, { booking: { is: { status: { not: BookingStatus.COMPLETED } } } }],
      },
      { NOT: cashSettlementDebtWhere() },
    ],
    payoutBatchId: null,
    status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
  };
}

function adminPayoutBatchReviewWhere(
  review: string | null | undefined,
): Prisma.ProviderPayoutBatchWhereInput | undefined {
  switch (normalizeOptionalQuery(review)) {
    case 'needs-review':
      return { status: { in: [PayoutBatchStatus.DRAFT, PayoutBatchStatus.FAILED] } };
    case 'in-progress':
      return { status: PayoutBatchStatus.PROCESSING };
    case 'settled':
    case 'paid':
      return { status: PayoutBatchStatus.PAID };
    case 'draft':
      return { status: PayoutBatchStatus.DRAFT };
    case 'failed':
      return { status: PayoutBatchStatus.FAILED };
    case 'cancelled':
      return { status: PayoutBatchStatus.CANCELLED };
    default:
      return undefined;
  }
}

function adminFinanceDateRangeWhere(range: string | null | undefined): Prisma.DateTimeFilter | undefined {
  const normalized = normalizeOptionalQuery(range);
  if (!normalized || normalized === 'all') {
    return undefined;
  }

  const nowMs = Date.now();
  const todayStartMs = startOfLocalDay(nowMs);
  const todayEndMs = endOfLocalDay(todayStartMs);

  if (normalized === '7d') {
    return { gte: new Date(addLocalDays(todayStartMs, -6)), lte: new Date(todayEndMs) };
  }
  if (normalized === '30d') {
    return { gte: new Date(addLocalDays(todayStartMs, -29)), lte: new Date(todayEndMs) };
  }
  if (normalized === 'today') {
    return { gte: new Date(todayStartMs), lte: new Date(todayEndMs) };
  }

  return undefined;
}

const adminEarningBookingSelect = {
  closedAt: true,
  closedNote: true,
  closedReason: true,
  matchedAt: true,
  payment: { select: { amount: true, currency: true, method: true, rawMeta: true, status: true } },
  scheduledStartAt: true,
  selectedProviderId: true,
  services: {
    select: {
      id: true,
      price: true,
      quantity: true,
      service: {
        select: {
          basePrice: true,
          durationMin: true,
          id: true,
          name: true,
          serviceGroupKey: true,
        },
      },
      serviceId: true,
    },
  },
  status: true,
  updatedAt: true,
} satisfies Prisma.BookingSelect;

const adminEarningPlatformFeeLogSelect = {
  createdAt: true,
  currency: true,
  grossAmount: true,
  id: true,
  platformFeeAmount: true,
  ruleSnapshot: true,
} satisfies Prisma.ProviderPlatformFeeLogSelect;

const adminEarningTaxLogSelect = {
  createdAt: true,
  currency: true,
  grossAmount: true,
  id: true,
  ruleSnapshot: true,
  taxableAmount: true,
  withholdingAmount: true,
} satisfies Prisma.ProviderTaxLogSelect;

const adminEarningWalletLedgerSelect = {
  amount: true,
  createdAt: true,
  currency: true,
  id: true,
  metadata: true,
  notes: true,
  reference: true,
  sourceKey: true,
  type: true,
} satisfies Prisma.ProviderWalletLedgerEntrySelect;

const adminEarningRelationInclude = {
  booking: { select: adminEarningBookingSelect },
  platformFeeLogs: {
    orderBy: { createdAt: 'desc' as const },
    select: adminEarningPlatformFeeLogSelect,
    take: 1,
  },
  taxLogs: { orderBy: { createdAt: 'desc' as const }, select: adminEarningTaxLogSelect, take: 1 },
  walletLedgerEntries: {
    orderBy: { createdAt: 'desc' as const },
    select: adminEarningWalletLedgerSelect,
    take: 5,
  },
} satisfies Prisma.ProviderEarningInclude;

const adminEarningListInclude = {
  providerProfile: {
    include: {
      user: { select: { fullName: true, id: true, phone: true } },
    },
  },
  ...adminEarningRelationInclude,
} satisfies Prisma.ProviderEarningInclude;

const adminCashSettlementEarningListInclude = {
  booking: { select: adminEarningBookingSelect },
  providerProfile: {
    include: {
      user: { select: { fullName: true, id: true, phone: true } },
    },
  },
  walletLedgerEntries: {
    orderBy: { createdAt: 'desc' as const },
    select: adminEarningWalletLedgerSelect,
    take: 5,
  },
  bankDepositCashDebtAllocations: {
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    select: {
      id: true,
      amount: true,
      currency: true,
      createdAt: true,
      partnerBankDepositRequest: {
        select: {
          id: true,
          bankTransactionId: true,
          status: true,
          ledgerEntryId: true,
          journalBatchId: true,
          executedAt: true,
        },
      },
    },
  },
} satisfies Prisma.ProviderEarningInclude;

function adminProviderPayoutInclude() {
  return {
    bankAccounts: {
      orderBy: [{ isPrimary: 'desc' as const }, { updatedAt: 'desc' as const }],
      take: 3,
      select: {
        id: true,
        bankName: true,
        accountNumberMasked: true,
        accountNumberLast4: true,
        accountHolderName: true,
        status: true,
        isPrimary: true,
        reviewedAt: true,
        rejectionReason: true,
        deletedAt: true,
      },
    },
    sanctions: {
      orderBy: { startsAt: 'desc' as const },
      take: 3,
      where: activePayoutHoldWhere(),
    },
    user: { select: { fullName: true, id: true, phone: true } },
    walletLedgerEntries: {
      orderBy: { createdAt: 'desc' as const },
      take: 5,
      select: {
        id: true,
        type: true,
        sourceKey: true,
        amount: true,
        currency: true,
        reference: true,
        notes: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  } satisfies Prisma.ProviderProfileInclude;
}

function adminPayoutBatchListInclude() {
  return {
    providerProfile: { include: adminProviderPayoutInclude() },
    earnings: {
      include: adminEarningRelationInclude,
      orderBy: { createdAt: 'desc' as const },
    },
    withholdingLogs: true,
  } satisfies Prisma.ProviderPayoutBatchInclude;
}

function adminPayoutBatchSummaryListInclude() {
  return {
    providerProfile: { include: adminProviderPayoutInclude() },
    earnings: {
      orderBy: { createdAt: 'desc' as const },
      select: {
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
        settlementMethod: true,
        createdAt: true,
        booking: {
          select: {
            status: true,
            scheduledStartAt: true,
            selectedProviderId: true,
            matchedAt: true,
            closedAt: true,
            updatedAt: true,
            payment: {
              select: {
                amount: true,
                currency: true,
                method: true,
                status: true,
              },
            },
            services: {
              select: {
                id: true,
                price: true,
                quantity: true,
                serviceId: true,
                service: {
                  select: {
                    durationMin: true,
                    id: true,
                    name: true,
                    serviceGroupKey: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    withholdingLogs: {
      orderBy: { createdAt: 'desc' as const },
      select: {
        id: true,
        providerTaxLogId: true,
        payoutBatchId: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    },
  } satisfies Prisma.ProviderPayoutBatchInclude;
}

function adminFinanceListTake(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return ADMIN_FINANCE_LIST_DEFAULT_LIMIT;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_FINANCE_LIST_DEFAULT_LIMIT;
  }

  return Math.min(Math.trunc(parsed), ADMIN_FINANCE_LIST_MAX_LIMIT);
}

function adminFinanceListSkip(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(Math.trunc(parsed), 10_000);
}

function normalizeOptionalQuery(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

type CashSettlementDebtListSqlRow = {
  readonly allocatedAmount: bigint | number;
  readonly id: string;
  readonly originalDebtAmount: bigint | number;
  readonly remainingDebtAmount: bigint | number;
};

type CashSettlementSummarySqlRow = {
  readonly allocatedAmount: bigint | number;
  readonly cashPaymentRowCount: bigint | number;
  readonly currency: string | null;
  readonly highDebtProviderCount: bigint | number;
  readonly globalAllocatedAmount: bigint | number;
  readonly globalMissingSettlementEvidenceCount: bigint | number;
  readonly globalOriginalDebtAmount: bigint | number;
  readonly globalProviderCount: bigint | number;
  readonly globalRemainingDebtAmount: bigint | number;
  readonly globalRowCount: bigint | number;
  readonly globalStaleDebtRowCount: bigint | number;
  readonly missingPaymentEvidenceCount: bigint | number;
  readonly missingSettlementEvidenceCount: bigint | number;
  readonly oldestOpenAt: Date | null;
  readonly originalDebtAmount: bigint | number;
  readonly providerCount: bigint | number;
  readonly queueAgeAll: bigint | number;
  readonly queueAgeFourToTwentyFourHours: bigint | number;
  readonly queueAgeOneToFourHours: bigint | number;
  readonly queueAgeOverTwentyFourHours: bigint | number;
  readonly queueAgeUnderOneHour: bigint | number;
  readonly queueAll: bigint | number;
  readonly queueHighDebt: bigint | number;
  readonly queueMissingEvidence: bigint | number;
  readonly queuePaymentCheck: bigint | number;
  readonly queueStale: bigint | number;
  readonly queueSlaOverdue: bigint | number;
  readonly remainingDebtAmount: bigint | number;
  readonly rowCount: bigint | number;
  readonly staleDebtRowCount: bigint | number;
  readonly totalCompanyCouponOffset: bigint | number;
  readonly totalPlatformFee: bigint | number;
  readonly totalTaxAmount: bigint | number;
};

function cashSettlementSqlFilter(
  options: AdminFinanceListQuery,
  sla: Prisma.DateTimeFilter | undefined,
  now: Date,
): CashSettlementDebtFilter {
  return {
    age: cashSettlementDateBounds(adminQueueAgeDateWhere(options.age, now)),
    createdAt: cashSettlementDateBounds(adminFinanceDateRangeWhere(options.range)),
    now,
    period: options.period,
    q: options.q,
    queue: options.queue,
    sla: cashSettlementDateBounds(sla),
  };
}

function cashSettlementDateBounds(value: Prisma.DateTimeFilter | undefined) {
  if (!value) return undefined;
  return {
    ...(value.gt instanceof Date ? { gt: value.gt } : {}),
    ...(value.gte instanceof Date ? { gte: value.gte } : {}),
    ...(value.lt instanceof Date ? { lt: value.lt } : {}),
    ...(value.lte instanceof Date ? { lte: value.lte } : {}),
  };
}

function cashSettlementNumber(value: bigint | number | null | undefined) {
  const amount = typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeWithdrawalRequestStatus(
  value: ProviderWalletWithdrawalRequestStatus | string | null | undefined,
) {
  if (!value) {
    return null;
  }
  const status = String(value).trim().toUpperCase() as ProviderWalletWithdrawalRequestStatus;
  return Object.values(ProviderWalletWithdrawalRequestStatus).includes(status) ? status : null;
}

function payoutBatchOrderBy(sort: string | null | undefined): Prisma.ProviderPayoutBatchOrderByWithRelationInput {
  switch (normalizeOptionalQuery(sort)) {
    case 'oldest':
      return { createdAt: 'asc' };
    case 'amount-asc':
      return { totalNetAmount: 'asc' };
    case 'amount-desc':
      return { totalNetAmount: 'desc' };
    default:
      return { createdAt: 'desc' };
  }
}

function withdrawalRequestOrderBy(
  sort: string | null | undefined,
): Prisma.ProviderWalletWithdrawalRequestOrderByWithRelationInput {
  switch (normalizeOptionalQuery(sort)) {
    case 'oldest':
      return { createdAt: 'asc' };
    case 'amount-asc':
      return { amount: 'asc' };
    case 'amount-desc':
      return { amount: 'desc' };
    default:
      return { createdAt: 'desc' };
  }
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfLocalDay(startMs: number) {
  return addLocalDays(startMs, 1) - 1;
}

function addLocalDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

@Injectable()
export class EarningsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly notifications?: NotificationsService,
    @Optional()
    private readonly settlements?: SettlementsService,
  ) {}

  async createForCompletedBooking(
    bookingId: string,
    providerProfileId: string,
    _options?: { preserveExistingLifecycle?: boolean },
    transactionClient?: TxClient,
  ) {
    void _options;
    if (transactionClient) {
      return this.createForCompletedBookingWithClient(transactionClient, bookingId, providerProfileId);
    }
    return this.prisma.$transaction((tx) =>
      this.createForCompletedBookingWithClient(tx, bookingId, providerProfileId),
    );
  }

  private async createForCompletedBookingWithClient(
    tx: TxClient,
    bookingId: string,
    providerProfileId: string,
  ) {
    await this.lockBookingSettlement(tx, bookingId);
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        services: { include: { service: true } },
        payment: true,
        review: true,
      },
    });

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Earnings can be created only for completed bookings');
    }
    if (booking.selectedProviderId !== providerProfileId) {
      throw new BadRequestException('Partner is not selected for this booking');
    }

    const existingEarning = await tx.providerEarning.findUnique({
      where: { bookingId },
    });
    if (existingEarning) {
      if (existingEarning.providerProfileId !== providerProfileId) {
        throw new BadRequestException('Completed booking earning belongs to another Partner');
      }
      return existingEarning;
    }

    const bookingServiceGrossAmount = bookingServiceAmount(booking.services);
    const customerPaymentAmount = booking.payment?.amount ?? bookingServiceGrossAmount;
    const couponSettlement = buildCouponSettlementContext({
      bookingServiceAmount: bookingServiceGrossAmount,
      customerPaymentAmount,
      paymentRawMeta: booking.payment?.rawMeta,
    });
    const grossAmount = couponSettlement.settlementBaseAmount;
    const availableAt = new Date(Date.now() + 24 * 60 * 60_000);
    const currency = booking.payment?.currency ?? 'VND';
    const serviceTypes = booking.services.flatMap((item) =>
      [item.serviceId, item.service?.name].filter(Boolean),
    );
    const pricedServices = booking.services.map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.service?.name,
      price: item.price,
      quantity: item.quantity,
      payoutRuleIdSnapshot: item.payoutRuleIdSnapshot,
      providerPayoutAmountSnapshot: item.providerPayoutAmountSnapshot,
      payoutRuleSnapshot: item.payoutRuleSnapshot,
    }));

    const platformFee = await this.calculatePlatformFee(tx, {
      grossAmount,
      currency,
      serviceTypes,
      services: pricedServices,
      occurredAt: booking.updatedAt ?? new Date(),
    });
    const tax = await this.calculateWithholding(tx, {
      providerProfileId,
      bookingId,
      grossAmount,
      currency,
      serviceTypes,
      occurredAt: booking.updatedAt ?? new Date(),
    });
    const walletDeltaPlatformFee =
      booking.payment?.method === PaymentMethod.CASH
        ? Math.max(0, platformFee.platformFeeAmount - tax.withholdingAmount)
        : platformFee.platformFeeAmount;
    const netAmount = calculateProviderWalletDelta({
      paymentMethod: booking.payment?.method,
      grossAmount,
      platformFee: walletDeltaPlatformFee,
      withholdingAmount: tax.withholdingAmount,
      companyCouponExpense: couponSettlement.companyCouponExpense,
    });
    const earning = await tx.providerEarning.upsert({
      where: { bookingId },
      update: {},
      create: {
        bookingId,
        providerProfileId,
        grossAmount,
        platformFee: platformFee.platformFeeAmount,
        withholdingAmount: tax.withholdingAmount,
        netAmount,
        currency,
        status: EarningStatus.PENDING,
        availableAt,
      },
    });

    const platformFeeLog = await this.upsertPlatformFeeLog(tx, earning, platformFee);
    const taxLog = await this.upsertTaxLog(tx, earning, tax);
    const walletLedgerEntries = await this.upsertEarningWalletLedger(
      tx,
      earning,
      booking.payment?.method,
      platformFee.vatRateBps,
      { companyCouponExpense: couponSettlement.companyCouponExpense },
    );
    const paymentMethod = booking.payment?.method ?? PaymentMethod.MANUAL;
    const partnerPayoutAmount =
      paymentMethod === PaymentMethod.CASH
        ? Math.max(0, grossAmount - platformFee.platformFeeAmount)
        : Math.max(0, netAmount);
    const paymentFee = await this.calculatePaymentFee(tx, {
      customerPaymentAmount: couponSettlement.customerPaymentAmount,
      occurredAt: booking.updatedAt ?? new Date(),
      paymentMethod,
    });
    const platformFeeGross = Math.max(0, grossAmount - partnerPayoutAmount - tax.withholdingAmount);

    await this.settlements?.upsertBookingSettlementSnapshot(
      {
        bookingId,
        customerProfileId: booking.customerProfileId,
        providerProfileId,
        paymentId: booking.payment?.id ?? null,
        providerEarningId: earning.id,
        paymentMethod,
        currency,
        customerPaymentAmount: couponSettlement.customerPaymentAmount,
        partnerPayoutAmount,
        partnerTaxableRevenueAmount: couponSettlement.partnerTaxableRevenueAmount,
        platformFeeGross,
        partnerVatRateBps: tax.partnerVatRateBps,
        partnerPitRateBps: tax.partnerPitRateBps,
        platformVatRateBps: platformFee.vatRateBps,
        paymentFeeRateBps: paymentFee.rateBps,
        paymentFeeFixedAmount: paymentFee.fixedAmount,
        paymentFeePayer: paymentFee.payer,
        paymentFeeTreatment: paymentFee.treatment,
        taxPolicyVersionId: tax.policyVersionId ?? null,
        platformFeePolicyVersionId: platformFee.policyVersionId ?? null,
        paymentFeePolicyVersionId: paymentFee.policyVersionId ?? null,
        taxRuleSnapshot: tax.ruleSnapshot,
        platformFeeRuleSnapshot: platformFee.ruleSnapshot,
        paymentFeeRuleSnapshot: paymentFee.ruleSnapshot,
        providerTaxLogIds: taxLog?.id ? [taxLog.id] : [],
        providerPlatformFeeLogId: platformFeeLog?.id ?? null,
        providerWalletLedgerEntryIds: walletLedgerEntries.map((entry) => entry.id),
        metadata: couponSettlement.metadata,
        occurredAt: booking.updatedAt ?? new Date(),
      },
      tx,
    );
    return earning;
  }

  async previewPaidBookingSettlementReconstruction(bookingId: string, providerProfileId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: historicalPaidSettlementBookingSelect,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    const analysis = analyzeHistoricalSettlementEvidence(booking, providerProfileId);
    if (!analysis.canReconstruct || !analysis.evidence || !this.settlements) {
      return { ...analysis, settlementDryRun: null };
    }

    const paymentFee = await this.calculatePaymentFee(this.prisma, {
      customerPaymentAmount: analysis.evidence.customerPaymentAmount,
      occurredAt: analysis.evidence.occurredAt,
      paymentMethod: analysis.evidence.paymentMethod,
    });
    const settlementDryRun = this.settlements.previewBookingSettlementSnapshot({
      ...analysis.evidence,
      paymentFeeFixedAmount: paymentFee.fixedAmount,
      paymentFeePayer: paymentFee.payer,
      paymentFeePolicyVersionId: paymentFee.policyVersionId ?? null,
      paymentFeeRateBps: paymentFee.rateBps,
      paymentFeeRuleSnapshot: paymentFee.ruleSnapshot,
      paymentFeeTreatment: paymentFee.treatment,
    });

    return { ...analysis, settlementDryRun };
  }

  async reconstructPaidBookingSettlement(
    bookingId: string,
    providerProfileId: string,
    context: { actorId: string; approvalAdminId: string; reason: string },
  ) {
    const settlements = this.settlements;
    if (!settlements) {
      throw new BadRequestException('Settlement service is unavailable.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockBookingSettlement(tx, bookingId);
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: historicalPaidSettlementBookingSelect,
      });
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }
      const analysis = analyzeHistoricalSettlementEvidence(booking, providerProfileId);
      if (!analysis.canReconstruct || !analysis.evidence) {
        throw new BadRequestException(
          analysis.blockers.map((blocker) => blocker.message).join(' ') ||
            'Historical settlement evidence is incomplete.',
        );
      }

      const evidence = analysis.evidence;
      const paymentFee = await this.calculatePaymentFee(tx, {
        customerPaymentAmount: evidence.customerPaymentAmount,
        occurredAt: evidence.occurredAt,
        paymentMethod: evidence.paymentMethod,
      });
      const settlementSnapshot = await settlements.upsertBookingSettlementSnapshot(
        {
          ...evidence,
          paymentFeeRateBps: paymentFee.rateBps,
          paymentFeeFixedAmount: paymentFee.fixedAmount,
          paymentFeePayer: paymentFee.payer,
          paymentFeeTreatment: paymentFee.treatment,
          paymentFeePolicyVersionId: paymentFee.policyVersionId ?? null,
          paymentFeeRuleSnapshot: paymentFee.ruleSnapshot,
          metadata: {
            ...evidence.metadata,
            historicalReconstructionActorId: context.actorId,
            historicalReconstructionApprovalAdminId: context.approvalAdminId,
            historicalReconstructionReason: context.reason,
          },
        },
        tx,
      );

      return {
        earningId: evidence.providerEarningId,
        settlementSnapshot,
      };
    });
  }

  async listForProviderUser(userId: string) {
    const provider = await this.requireProviderProfile(userId);
    return this.prisma.providerEarning.findMany({
      where: { providerProfileId: provider.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        booking: {
          include: {
            services: { include: { service: true } },
            customerProfile: { include: { user: { select: { id: true, phone: true, fullName: true } } } },
          },
        },
      },
    });
  }

  async summaryForProviderUser(userId: string) {
    const provider = await this.requireProviderProfile(userId);
    const bankCorrectionRequest = providerBankCorrectionRequest(provider.bankAccounts);
    const [summary, payoutHold, walletBalance] = await Promise.all([
      this.summaryWhere({ providerProfileId: provider.id }),
      this.activePayoutHoldForProvider(this.prisma, provider.id),
      this.providerWalletLedgerBalance(this.prisma, provider.id),
    ]);
    const walletBlocked = walletBalance < 0;
    const walletDebtAmount = walletBlocked ? Math.abs(walletBalance) : 0;
    return {
      ...summary,
      walletBalance,
      walletBlocked,
      marketplaceVisibilityBlocked: false,
      marketplaceJoinBlocked: walletBlocked,
      directFirstPickBlocked: false,
      alreadyMatchedServiceBlocked: walletBlocked,
      payoutReleaseBlocked: walletBlocked,
      walletDebtAmount,
      walletBlockCode: walletBlocked ? PROVIDER_WALLET_BLOCK_CODE : null,
      walletBlockReason: walletBlocked ? PROVIDER_WALLET_BLOCK_REASON : null,
      walletBlockDisplayMessage: walletBlocked ? PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE : null,
      walletSettlementRequired: walletBlocked,
      walletSettlementMethod: walletBlocked ? PROVIDER_WALLET_SETTLEMENT_METHOD : null,
      walletSettlementReference: walletBlocked ? providerWalletSettlementReference(provider.id) : null,
      walletSettlementInstruction: walletBlocked ? PROVIDER_WALLET_SETTLEMENT_INSTRUCTION : null,
      walletSettlementSteps: walletBlocked
        ? providerWalletSettlementSteps(walletDebtAmount, summary.currency, provider.id)
        : [],
      payoutBlocked: Boolean(payoutHold),
      payoutHold,
      bankCorrectionRequest,
    };
  }

  listForAdmin(options: AdminFinanceListQuery = {}) {
    const where = adminEarningListWhere(options);
    const skip = adminFinanceListSkip(options.skip);

    return this.prisma.providerEarning.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminFinanceListTake(options.take),
      include: adminEarningListInclude,
    });
  }

  async listCashSettlementDebtForAdmin(options: AdminFinanceListQuery = {}) {
    const now = new Date();
    const selectedSla = normalizeAdminQueueSlaFilter(options.sla);
    const slaWindow = selectedSla !== 'all' ? await this.cashSettlementQueueSlaWindow() : undefined;
    const slaDateWhere = slaWindow ? adminQueueSlaDateWhere(selectedSla, slaWindow, now) : undefined;
    const filter = cashSettlementDebtFilterSql(cashSettlementSqlFilter(options, slaDateWhere, now));
    const skip = adminFinanceListSkip(options.skip);
    const take = adminFinanceListTake(options.take);
    const orderBy =
      options.sort === 'newest'
        ? Prisma.sql`debt."createdAt" DESC, debt.id DESC`
        : options.sort === 'highest-debt'
          ? Prisma.sql`debt."remainingDebtAmount" DESC, debt."createdAt" ASC, debt.id ASC`
          : Prisma.sql`debt."createdAt" ASC, debt.id ASC`;
    const debtRows = await this.prisma.$queryRaw<CashSettlementDebtListSqlRow[]>(Prisma.sql`
      WITH ${cashSettlementDebtCteSql()}
      SELECT
        debt.id,
        debt."originalDebtAmount",
        debt."allocatedAmount",
        debt."remainingDebtAmount"
      FROM cash_settlement_debt debt
      WHERE ${filter}
      ORDER BY ${orderBy}
      LIMIT ${take}
      OFFSET ${skip}
    `);
    if (debtRows.length === 0) return [];

    const earnings = await this.prisma.providerEarning.findMany({
      where: { id: { in: debtRows.map((row) => row.id) } },
      include: adminCashSettlementEarningListInclude,
    });
    const earningById = new Map(earnings.map((earning) => [earning.id, earning]));

    return debtRows.flatMap((debt) => {
      const earning = earningById.get(debt.id);
      return earning
        ? [
            {
              ...earning,
              allocatedAmount: cashSettlementNumber(debt.allocatedAmount),
              originalDebtAmount: cashSettlementNumber(debt.originalDebtAmount),
              remainingDebtAmount: cashSettlementNumber(debt.remainingDebtAmount),
            },
          ]
        : [];
    });
  }

  async cashSettlementSummaryForAdmin(options: AdminFinanceListQuery = {}) {
    const nowDate = new Date();
    const now = nowDate.getTime();
    const slaWindow = await this.cashSettlementQueueSlaWindow();
    const selectedSla = adminQueueSlaDateWhere(options.sla, slaWindow, nowDate);
    const selectedFilter = cashSettlementDebtFilterSql(
      cashSettlementSqlFilter(options, selectedSla, nowDate),
    );
    const queueBaseFilter = cashSettlementDebtFilterSql(
      cashSettlementSqlFilter({ ...options, queue: 'all' }, selectedSla, nowDate),
    );
    const ageBaseFilter = cashSettlementDebtFilterSql(
      cashSettlementSqlFilter({ ...options, age: 'all' }, selectedSla, nowDate),
    );
    const slaBaseFilter = cashSettlementDebtFilterSql(
      cashSettlementSqlFilter({ ...options, age: 'all', sla: 'all' }, undefined, nowDate),
    );
    const staleCutoffAt = new Date(now - CASH_SETTLEMENT_STALE_MS);
    const oneHourAt = new Date(now - 60 * 60_000);
    const fourHoursAt = new Date(now - 4 * 60 * 60_000);
    const twentyFourHoursAt = new Date(now - 24 * 60 * 60_000);
    const [amountSummary] = await this.prisma.$queryRaw<CashSettlementSummarySqlRow[]>(Prisma.sql`
      WITH ${cashSettlementDebtCteSql()},
      selected AS (
        SELECT debt.* FROM cash_settlement_debt debt WHERE ${selectedFilter}
      ),
      global_open AS (
        SELECT debt.* FROM cash_settlement_debt debt WHERE debt."remainingDebtAmount" > 0
      ),
      queue_base AS (
        SELECT debt.* FROM cash_settlement_debt debt WHERE ${queueBaseFilter}
      ),
      age_base AS (
        SELECT debt.* FROM cash_settlement_debt debt WHERE ${ageBaseFilter}
      ),
      sla_base AS (
        SELECT debt.* FROM cash_settlement_debt debt WHERE ${slaBaseFilter}
      )
      SELECT
        COUNT(*)::bigint AS "rowCount",
        COUNT(DISTINCT selected."providerProfileId")::bigint AS "providerCount",
        COALESCE(MIN(selected.currency), 'VND') AS currency,
        MIN(selected."createdAt") AS "oldestOpenAt",
        COALESCE(SUM(selected."originalDebtAmount"), 0)::bigint AS "originalDebtAmount",
        COALESCE(SUM(selected."allocatedAmount"), 0)::bigint AS "allocatedAmount",
        COALESCE(SUM(selected."remainingDebtAmount"), 0)::bigint AS "remainingDebtAmount",
        (SELECT COUNT(*)::bigint FROM global_open) AS "globalRowCount",
        (SELECT COUNT(DISTINCT "providerProfileId")::bigint FROM global_open) AS "globalProviderCount",
        (
          SELECT COALESCE(SUM("originalDebtAmount"), 0)::bigint FROM global_open
        ) AS "globalOriginalDebtAmount",
        (
          SELECT COALESCE(SUM("allocatedAmount"), 0)::bigint FROM global_open
        ) AS "globalAllocatedAmount",
        (
          SELECT COALESCE(SUM("remainingDebtAmount"), 0)::bigint FROM global_open
        ) AS "globalRemainingDebtAmount",
        (
          SELECT COUNT(*)::bigint FROM global_open WHERE "createdAt" <= ${staleCutoffAt}
        ) AS "globalStaleDebtRowCount",
        (
          SELECT COUNT(*)::bigint FROM global_open WHERE "allocationCount" = 0
        ) AS "globalMissingSettlementEvidenceCount",
        COALESCE(SUM(selected."platformFee"), 0)::bigint AS "totalPlatformFee",
        COALESCE(SUM(selected."withholdingAmount"), 0)::bigint AS "totalTaxAmount",
        COALESCE(SUM(selected."companyCouponOffset"), 0)::bigint AS "totalCompanyCouponOffset",
        COUNT(*) FILTER (WHERE selected."createdAt" <= ${staleCutoffAt})::bigint AS "staleDebtRowCount",
        COUNT(*) FILTER (WHERE selected."paymentMethod" IS NULL)::bigint AS "missingPaymentEvidenceCount",
        COUNT(*) FILTER (WHERE selected."allocationCount" = 0)::bigint AS "missingSettlementEvidenceCount",
        COUNT(*) FILTER (WHERE selected."paymentMethod" = ${PaymentMethod.CASH})::bigint AS "cashPaymentRowCount",
        (
          SELECT COUNT(*)::bigint
          FROM (
            SELECT queue_partner."providerProfileId"
            FROM selected queue_partner
            GROUP BY queue_partner."providerProfileId"
            HAVING SUM(queue_partner."remainingDebtAmount") >= ${CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD}
          ) high_debt_partners
        ) AS "highDebtProviderCount",
        (SELECT COUNT(*)::bigint FROM queue_base) AS "queueAll",
        (SELECT COUNT(*)::bigint FROM queue_base WHERE "createdAt" <= ${staleCutoffAt}) AS "queueStale",
        (
          SELECT COUNT(*)::bigint FROM queue_base
          WHERE "remainingDebtAmount" >= ${CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD}
        ) AS "queueHighDebt",
        (SELECT COUNT(*)::bigint FROM queue_base WHERE "allocationCount" = 0) AS "queueMissingEvidence",
        (
          SELECT COUNT(*)::bigint FROM queue_base
          WHERE "paymentMethod" IS NULL OR "paymentMethod" <> ${PaymentMethod.CASH}
        ) AS "queuePaymentCheck",
        (SELECT COUNT(*)::bigint FROM age_base) AS "queueAgeAll",
        (
          SELECT COUNT(*)::bigint FROM age_base
          WHERE "createdAt" >= ${oneHourAt} AND "createdAt" <= ${nowDate}
        ) AS "queueAgeUnderOneHour",
        (
          SELECT COUNT(*)::bigint FROM age_base
          WHERE "createdAt" >= ${fourHoursAt} AND "createdAt" < ${oneHourAt}
        ) AS "queueAgeOneToFourHours",
        (
          SELECT COUNT(*)::bigint FROM age_base
          WHERE "createdAt" >= ${twentyFourHoursAt} AND "createdAt" < ${fourHoursAt}
        ) AS "queueAgeFourToTwentyFourHours",
        (
          SELECT COUNT(*)::bigint FROM age_base WHERE "createdAt" < ${twentyFourHoursAt}
        ) AS "queueAgeOverTwentyFourHours",
        (
          SELECT COUNT(*)::bigint FROM sla_base WHERE "createdAt" <= ${slaWindow.cutoffAt}
        ) AS "queueSlaOverdue"
      FROM selected
    `);
    const oldestOpenAt = amountSummary?.oldestOpenAt ?? null;

    return {
      generatedAt: nowDate,
      currency: amountSummary?.currency ?? 'VND',
      global: {
        allocatedAmount: cashSettlementNumber(amountSummary?.globalAllocatedAmount),
        missingSettlementEvidenceCount: cashSettlementNumber(
          amountSummary?.globalMissingSettlementEvidenceCount,
        ),
        originalDebtAmount: cashSettlementNumber(amountSummary?.globalOriginalDebtAmount),
        providerCount: cashSettlementNumber(amountSummary?.globalProviderCount),
        remainingDebtAmount: cashSettlementNumber(amountSummary?.globalRemainingDebtAmount),
        rowCount: cashSettlementNumber(amountSummary?.globalRowCount),
        staleDebtRowCount: cashSettlementNumber(amountSummary?.globalStaleDebtRowCount),
      },
      rowCount: cashSettlementNumber(amountSummary?.rowCount),
      providerCount: cashSettlementNumber(amountSummary?.providerCount),
      queueCounts: {
        all: cashSettlementNumber(amountSummary?.queueAll),
        highDebt: cashSettlementNumber(amountSummary?.queueHighDebt),
        missingEvidence: cashSettlementNumber(amountSummary?.queueMissingEvidence),
        paymentCheck: cashSettlementNumber(amountSummary?.queuePaymentCheck),
        stale: cashSettlementNumber(amountSummary?.queueStale),
      },
      queueAgeCounts: {
        all: cashSettlementNumber(amountSummary?.queueAgeAll),
        'under-1h': cashSettlementNumber(amountSummary?.queueAgeUnderOneHour),
        '1-4h': cashSettlementNumber(amountSummary?.queueAgeOneToFourHours),
        '4-24h': cashSettlementNumber(amountSummary?.queueAgeFourToTwentyFourHours),
        'over-24h': cashSettlementNumber(amountSummary?.queueAgeOverTwentyFourHours),
      },
      queueSla: {
        overdueCount: cashSettlementNumber(amountSummary?.queueSlaOverdue),
        thresholdMinutes: slaWindow.thresholdMinutes,
      },
      totalCompanyCouponOffset: cashSettlementNumber(amountSummary?.totalCompanyCouponOffset),
      totalOriginalDebtAmount: cashSettlementNumber(amountSummary?.originalDebtAmount),
      totalAllocatedAmount: cashSettlementNumber(amountSummary?.allocatedAmount),
      totalDebtAmount: cashSettlementNumber(amountSummary?.remainingDebtAmount),
      totalPlatformFee: cashSettlementNumber(amountSummary?.totalPlatformFee),
      totalTaxAmount: cashSettlementNumber(amountSummary?.totalTaxAmount),
      oldestOpenAt,
      oldestOpenAgeMinutes: oldestOpenAt
        ? Math.max(0, Math.round((now - oldestOpenAt.getTime()) / 60_000))
        : 0,
      staleDebtRowCount: cashSettlementNumber(amountSummary?.staleDebtRowCount),
      highDebtProviderCount: cashSettlementNumber(amountSummary?.highDebtProviderCount),
      missingPaymentEvidenceCount: cashSettlementNumber(amountSummary?.missingPaymentEvidenceCount),
      missingSettlementEvidenceCount: cashSettlementNumber(
        amountSummary?.missingSettlementEvidenceCount,
      ),
      cashPaymentRowCount: cashSettlementNumber(amountSummary?.cashPaymentRowCount),
      topProviderGroups: [],
    };
  }

  async cashSettlementDebtDetailForAdmin(earningId: string) {
    const earning = await this.prisma.providerEarning.findFirst({
      where: mergeProviderEarningWhere(cashSettlementDebtWhere(), { id: earningId }),
      include: adminCashSettlementEarningListInclude,
    });
    if (!earning) {
      throw new NotFoundException(`Open cash settlement earning ${earningId} was not found`);
    }

    const originalDebtAmount = Math.abs(earning.netAmount);
    const allocatedAmount = earning.bankDepositCashDebtAllocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );
    const remainingDebtAmount = Math.max(0, originalDebtAmount - allocatedAmount);
    if (remainingDebtAmount === 0) {
      throw new NotFoundException(`Open cash settlement earning ${earningId} was not found`);
    }

    const linkedRequestIds = earning.bankDepositCashDebtAllocations.map(
      (allocation) => allocation.partnerBankDepositRequest.id,
    );
    const [depositRequests, walletBalance, auditLogs] = await Promise.all([
      this.prisma.partnerBankDepositRequest.findMany({
        where: {
          providerProfileId: earning.providerProfileId,
          currency: earning.currency,
          status: PartnerBankDepositRequestStatus.EXECUTED,
          ledgerEntryId: { not: null },
          journalBatchId: { not: null },
          requestedReceivableRecovery: { gt: 0 },
        },
        orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        take: 50,
        include: {
          cashDebtAllocations: { select: { amount: true } },
        },
      }),
      this.prisma.providerWalletBalanceSummary.findUnique({
        where: {
          providerProfileId_currency: {
            providerProfileId: earning.providerProfileId,
            currency: earning.currency,
          },
        },
      }),
      this.prisma.adminAuditLog.findMany({
        where: {
          OR: [
            { target: `earning:${earning.id}` },
            ...linkedRequestIds.map((id) => ({ target: `partner_bank_deposit_request:${id}` })),
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
    ]);

    const availableDeposits = depositRequests
      .map(({ cashDebtAllocations, ...request }) => {
        const allocatedAmount = cashDebtAllocations.reduce(
          (sum, allocation) => sum + allocation.amount,
          0,
        );
        return {
          ...request,
          allocatedAmount,
          remainingReceivableRecovery: Math.max(
            0,
            request.requestedReceivableRecovery - allocatedAmount,
          ),
        };
      })
      .filter((request) => request.remainingReceivableRecovery > 0);
    return {
      earning,
      allocatedAmount,
      originalDebtAmount,
      remainingDebtAmount,
      walletBalance: Number(walletBalance?.balance ?? 0),
      availableDeposits,
      auditLogs,
    };
  }

  private cashSettlementQueueSlaWindow() {
    return adminQueueSlaWindow({
      defaultThresholdMinutes: DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.cashReconciliation,
      readPolicyValue: async () =>
        (
          await this.prisma.operationalPolicySetting.findUnique({
            where: { key: START_SHIFT_ACTION_SLA_POLICY_KEYS.cashReconciliation },
            select: { value: true },
          })
        )?.value,
    });
  }

  adminSummary(options: AdminFinanceListQuery = {}) {
    return this.summaryWhere(adminEarningListWhere(options) ?? {});
  }

  async markPaid(
    earningId: string,
    _input: {
      settlementRef?: string | null;
      settlementNotes?: string | null;
      settlementMethod?: string | null;
    } = {},
  ) {
    void _input;
    const earning = await this.prisma.providerEarning.findUnique({ where: { id: earningId } });
    if (!earning) {
      throw new NotFoundException('Earning not found');
    }
    if (earning.netAmount < 0) {
      throw new BadRequestException(
        'Cash fee debt can only be settled by allocating approved evidence',
      );
    }
    throw new BadRequestException('Positive partner earnings must be paid through payout batches');
  }

  async recordPartnerBankDeposit(input: PartnerBankDepositInput, transaction?: Prisma.TransactionClient) {
    const deposit = normalizePartnerBankDepositInput(input);
    const sourceKey = partnerBankDepositSourceKey(deposit.providerProfileId, deposit.bankTransactionId);

    const recordDeposit = async (tx: Prisma.TransactionClient) => {
      await this.lockProviderWallet(tx, deposit.providerProfileId, 'VND');
      const provider = await tx.providerProfile.findUnique({
        where: { id: deposit.providerProfileId },
        select: { id: true },
      });
      if (!provider) {
        throw new NotFoundException('Partner profile not found');
      }

      const existing = await tx.providerWalletLedgerEntry.findUnique({ where: { sourceKey } });
      if (existing) {
        if (existing.amount !== deposit.amount) {
          throw new BadRequestException(
            'Partner bank deposit reference already exists with a different amount',
          );
        }
        return existing;
      }

      const currentWalletBalance = await this.providerWalletLedgerBalance(tx, deposit.providerProfileId);
      const allocation = allocatePartnerBankDeposit(currentWalletBalance, deposit.amount);
      const metadata: Prisma.InputJsonObject = {
        source: 'ADMIN_PARTNER_BANK_DEPOSIT',
        accountingTreatment: 'NEGATIVE_WALLET_FIRST_THEN_PREPAID_PARTNER_WALLET_LIABILITY',
        isPlatformRevenue: false,
        isTaxableRevenue: false,
        bankAccount: deposit.bankAccount,
        bankTransactionId: deposit.bankTransactionId,
        depositDate: deposit.depositDate.toISOString(),
        attachmentFileId: deposit.attachmentFileId,
        attachmentUrl: deposit.attachmentUrl,
        adminId: deposit.adminId,
        allocation,
      };

      return tx.providerWalletLedgerEntry.create({
        data: {
          providerProfileId: deposit.providerProfileId,
          type: ProviderWalletLedgerType.PARTNER_BANK_DEPOSIT_RECEIVED,
          sourceKey,
          amount: deposit.amount,
          currency: 'VND',
          reference: deposit.bankTransactionId,
          notes: deposit.notes,
          metadata,
        },
      });
    };

    return transaction ? recordDeposit(transaction) : this.prisma.$transaction(recordDeposit);
  }

  async createProviderPayoutBatch(input: {
    providerProfileId: string;
    transferRef?: string;
    notes?: string;
  }, beforeCommit?: (
    tx: TxClient,
    batch: {
      id: string;
      providerProfileId: string;
      totalNetAmount: number;
      transferRef: string | null;
      earnings: unknown[];
    },
  ) => Promise<void>) {
    const provider = await this.prisma.providerProfile.findUnique({ where: { id: input.providerProfileId } });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockProviderPayoutAssignment(tx, input.providerProfileId);
      await this.ensurePayoutEligible(tx, input.providerProfileId);
      const earnings = await tx.providerEarning.findMany({
        where: {
          providerProfileId: input.providerProfileId,
          payoutBatchId: null,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
          netAmount: { gt: 0 },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (earnings.length === 0) {
        throw new BadRequestException('No unpaid earnings are eligible for payout');
      }

      const totalNetAmount = earnings.reduce((sum, earning) => sum + earning.netAmount, 0);
      const batch = await tx.providerPayoutBatch.create({
        data: {
          providerProfileId: input.providerProfileId,
          totalNetAmount,
          currency: earnings[0]?.currency ?? 'VND',
          status: PayoutBatchStatus.DRAFT,
          transferRef: input.transferRef ? normalizeNullable(input.transferRef) : null,
          notes: input.notes ? normalizeNullable(input.notes) : null,
        },
      });

      const assignment = await tx.providerEarning.updateMany({
        where: {
          id: { in: earnings.map((earning) => earning.id) },
          payoutBatchId: null,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        },
        data: {
          payoutBatchId: batch.id,
        },
      });
      if (assignment.count !== earnings.length) {
        throw new ConflictException(
          'Partner earnings changed while the payout batch was being created. Reload and try again.',
        );
      }
      const taxLogs = await tx.providerTaxLog.findMany({
        where: { earningId: { in: earnings.map((earning) => earning.id) }, withholdingAmount: { gt: 0 } },
      });
      if (taxLogs.length > 0) {
        await tx.withholdingLog.createMany({
          data: taxLogs.map((taxLog) => ({
            providerTaxLogId: taxLog.id,
            payoutBatchId: batch.id,
            amount: taxLog.withholdingAmount,
            status: 'PENDING',
            metadata: {
              bookingId: taxLog.bookingId,
              earningId: taxLog.earningId,
              policyVersionId: taxLog.policyVersionId,
            },
          })),
        });
      }

      const result = await tx.providerPayoutBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: {
          providerProfile: { include: this.providerPayoutInclude() },
          earnings: {
            orderBy: { createdAt: 'desc' },
            include: {
              booking: { include: { services: { include: { service: true } }, payment: true } },
              taxLogs: { orderBy: { createdAt: 'desc' } },
              platformFeeLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
              walletLedgerEntries: { orderBy: { createdAt: 'desc' }, take: 5 },
            },
          },
          withholdingLogs: true,
        },
      });
      await beforeCommit?.(tx, result);
      return result;
    });
  }

  private async payoutBankOutflowCandidatesForAdmin(options: AdminFinanceListQuery) {
    if (normalizeOptionalQuery(options.evidence) !== PAYOUT_BANK_MATCH_INCOMPLETE_EVIDENCE) {
      return null;
    }

    const period = adminPayoutBankReconciliationPeriod(options.period);
    const rows = await this.prisma.$queryRaw<AdminPayoutBankOutflowCandidateRow[]>(Prisma.sql`
      WITH ${adminPayoutBankOutflowReconciliationCteSql(period)}
      SELECT "id", "paidAt", "targetAmount", "matchedAmount", "remainingAmount"
      FROM "openPayoutBankOutflows"
      ORDER BY "paidAt" ASC NULLS FIRST, "id" ASC
    `);

    return rows.map((row) => ({
      id: row.id,
      matchedAmount: Number(row.matchedAmount),
      paidAt: row.paidAt,
      period,
      remainingAmount: Number(row.remainingAmount),
      targetAmount: Number(row.targetAmount),
    }));
  }

  private async payoutBatchListWhereForAdmin(
    options: AdminFinanceListQuery,
    bankOutflowCandidateIds?: readonly string[] | null,
  ) {
    if (bankOutflowCandidateIds) {
      let where: Prisma.ProviderPayoutBatchWhereInput = { id: { in: [...bankOutflowCandidateIds] } };
      const status = normalizePayoutBatchStatus(options.status);
      const searchWhere = adminPayoutBatchSearchWhere(options.q);
      if (status) where = mergePayoutBatchWhere(where, { status });
      if (searchWhere) where = mergePayoutBatchWhere(where, searchWhere);
      return where;
    }

    if (normalizeOptionalQuery(options.queue) !== 'repair') {
      return adminPayoutBatchListWhere(options);
    }

    const candidateWhere = adminPayoutBatchListWhere({
      ...options,
      queue: null,
      status: PayoutBatchStatus.PAID,
    });
    const candidates = await this.prisma.providerPayoutBatch.findMany({
      ...(candidateWhere ? { where: candidateWhere } : {}),
      select: payoutBatchPostPaymentEvidenceSelect,
    });
    const repairIds = await this.payoutBatchPostPaymentRepairIds(candidates);
    return mergePayoutBatchWhere(candidateWhere, { id: { in: [...repairIds] } });
  }

  private async payoutBatchPostPaymentRepairIds(
    paidBatchEvidence: readonly PayoutBatchPostPaymentEvidence[],
  ) {
    const paidBatchIds = paidBatchEvidence.map((batch) => batch.id);
    if (paidBatchIds.length === 0) {
      return new Set<string>();
    }

    const paidBatchEvidenceById = new Map(paidBatchEvidence.map((batch) => [batch.id, batch]));
    const [paidLedgerEvidence, paidJournalEvidence] = await Promise.all([
      this.prisma.providerWalletLedgerEntry.findMany({
        where: { payoutBatchId: { in: paidBatchIds } },
        select: { amount: true, payoutBatchId: true },
      }),
      this.prisma.accountingJournalBatch.findMany({
        where: {
          sourceId: { in: paidBatchIds },
          sourceType: AccountingJournalSourceType.PROVIDER_PAYOUT_BATCH,
        },
        select: {
          sourceId: true,
          sourceKey: true,
          status: true,
          totalCredit: true,
          totalDebit: true,
        },
      }),
    ]);
    const paidLedgerAmountByBatchId = new Map<string, number>();
    for (const entry of paidLedgerEvidence) {
      if (!entry.payoutBatchId) continue;
      paidLedgerAmountByBatchId.set(
        entry.payoutBatchId,
        (paidLedgerAmountByBatchId.get(entry.payoutBatchId) ?? 0) + entry.amount,
      );
    }
    const postedPaidJournalBatchIds = new Set(
      paidJournalEvidence
        .filter((journal) => {
          const batch = paidBatchEvidenceById.get(journal.sourceId);
          return (
            batch &&
            journal.sourceKey === `accounting-journal:provider-payout-batch:${batch.id}:paid` &&
            journal.status === AccountingJournalBatchStatus.POSTED &&
            journal.totalCredit === batch.totalNetAmount &&
            journal.totalDebit === batch.totalNetAmount
          );
        })
        .map((journal) => journal.sourceId),
    );

    return new Set(
      paidBatchEvidence
        .filter((batch) => {
          const withholdingAmount = batch.earnings.reduce(
            (sum, earning) => sum + earning.withholdingAmount,
            0,
          );
          const withholdingIncomplete =
            withholdingAmount > 0 &&
            (batch.withholdingLogs.length === 0 ||
              batch.withholdingLogs.some((log) => log.status !== 'PAID'));
          return (
            !batch.transferRef?.trim() ||
            withholdingIncomplete ||
            (paidLedgerAmountByBatchId.get(batch.id) ?? 0) !== -batch.totalNetAmount ||
            !postedPaidJournalBatchIds.has(batch.id)
          );
        })
        .map((batch) => batch.id),
    );
  }

  async listPayoutBatchesForAdmin(options: AdminFinanceListQuery = {}) {
    const bankOutflowCandidates = await this.payoutBankOutflowCandidatesForAdmin(options);
    const where = await this.payoutBatchListWhereForAdmin(
      options,
      bankOutflowCandidates?.map((candidate) => candidate.id),
    );
    const skip = adminFinanceListSkip(options.skip);

    const batches = await this.prisma.providerPayoutBatch.findMany({
      ...(where ? { where } : {}),
      orderBy: payoutBatchOrderBy(options.sort),
      ...(skip > 0 ? { skip } : {}),
      take: adminFinanceListTake(options.take),
      include:
        normalizeOptionalQuery(options.view) === 'summary'
          ? adminPayoutBatchSummaryListInclude()
          : adminPayoutBatchListInclude(),
    });
    if (!bankOutflowCandidates) return batches;

    const candidateById = new Map(bankOutflowCandidates.map((candidate) => [candidate.id, candidate]));
    return batches.map((batch) => ({
      ...batch,
      bankReconciliation: candidateById.get(batch.id) ?? null,
    }));
  }

  async payoutBatchSummaryForAdmin(options: AdminFinanceListQuery = {}) {
    const bankOutflowCandidates = await this.payoutBankOutflowCandidatesForAdmin(options);
    const where = await this.payoutBatchListWhereForAdmin(
      options,
      bankOutflowCandidates?.map((candidate) => candidate.id),
    );
    if (bankOutflowCandidates) {
      const filteredRows = await this.prisma.providerPayoutBatch.findMany({
        ...(where ? { where } : {}),
        select: { id: true },
      });
      const filteredIds = new Set(filteredRows.map((row) => row.id));
      const visibleCandidates = bankOutflowCandidates.filter((candidate) => filteredIds.has(candidate.id));
      const total = visibleCandidates.length;
      return {
        currency: 'VND',
        generatedAt: new Date().toISOString(),
        range: normalizeOptionalQuery(options.range) ?? 'all',
        timeZone: 'Asia/Ho_Chi_Minh',
        scopeCount: total,
        total,
        needsReview: 0,
        inProgress: 0,
        payoutHolds: 0,
        missingTransferRefs: 0,
        settled: total,
        open: 0,
        totalNetAmount: visibleCandidates.reduce((sum, candidate) => sum + candidate.targetAmount, 0),
        withholdingAmount: 0,
        postPaymentRepairCount: 0,
        bankReconciliationCandidateCount: total,
        bankReconciliationRemainingAmount: visibleCandidates.reduce(
          (sum, candidate) => sum + candidate.remainingAmount,
          0,
        ),
        bankReconciliationPeriod: visibleCandidates[0]?.period ?? adminPayoutBankReconciliationPeriod(options.period),
      };
    }
    const allProductionWhere = adminPayoutBatchListWhere({ range: 'all' });
    const [
      total,
      needsReview,
      inProgress,
      payoutHolds,
      missingTransferRefs,
      settled,
      open,
      totalNet,
      withholding,
      totalBatchCount,
      moneyFlowEvidence,
    ] = await Promise.all([
      this.prisma.providerPayoutBatch.count(payoutBatchCountArgs(where)),
      this.prisma.providerPayoutBatch.count(
        payoutBatchCountArgs(
          mergePayoutBatchWhere(where, {
            status: { in: [PayoutBatchStatus.DRAFT, PayoutBatchStatus.FAILED] },
          }),
        ),
      ),
      this.prisma.providerPayoutBatch.count(
        payoutBatchCountArgs(mergePayoutBatchWhere(where, { status: PayoutBatchStatus.PROCESSING })),
      ),
      this.prisma.providerPayoutBatch.count(
        payoutBatchCountArgs(
          mergePayoutBatchWhere(where, {
            providerProfile: { sanctions: { some: activePayoutHoldWhere() } },
          }),
        ),
      ),
      this.prisma.providerPayoutBatch.count(
        payoutBatchCountArgs(
          mergePayoutBatchWhere(where, {
            status: { notIn: [PayoutBatchStatus.PAID, PayoutBatchStatus.CANCELLED] },
            transferRef: null,
          }),
        ),
      ),
      this.prisma.providerPayoutBatch.count(
        payoutBatchCountArgs(mergePayoutBatchWhere(where, { status: PayoutBatchStatus.PAID })),
      ),
      this.prisma.providerPayoutBatch.count(
        payoutBatchCountArgs(
          mergePayoutBatchWhere(where, {
            status: { notIn: [PayoutBatchStatus.PAID, PayoutBatchStatus.CANCELLED] },
          }),
        ),
      ),
      this.prisma.providerPayoutBatch.aggregate({
        ...(where ? { where } : {}),
        _sum: { totalNetAmount: true },
      }),
      this.prisma.withholdingLog.aggregate({
        where: withholdingLogWhereForPayoutBatchSummary(where),
        _sum: { amount: true },
      }),
      this.prisma.providerPayoutBatch.count(payoutBatchCountArgs(allProductionWhere)),
      this.prisma.providerPayoutBatch.findMany({
        ...(where ? { where } : {}),
        select: {
          currency: true,
          id: true,
          status: true,
          totalNetAmount: true,
          transferRef: true,
          earnings: {
            select: {
              currency: true,
              grossAmount: true,
              netAmount: true,
              platformFee: true,
              withholdingAmount: true,
            },
          },
          withholdingLogs: { select: { status: true } },
        },
      }),
    ]);

    const postPaymentRepairCount = (
      await this.payoutBatchPostPaymentRepairIds(
        moneyFlowEvidence.filter((batch) => batch.status === PayoutBatchStatus.PAID),
      )
    ).size;

    const evidenceBatchCount = moneyFlowEvidence.filter((batch) => batch.earnings.length > 0).length;
    const grossAmount = moneyFlowEvidence.reduce(
      (batchSum, batch) => batchSum + batch.earnings.reduce((sum, earning) => sum + earning.grossAmount, 0),
      0,
    );
    const platformFeeAmount = moneyFlowEvidence.reduce(
      (batchSum, batch) => batchSum + batch.earnings.reduce((sum, earning) => sum + earning.platformFee, 0),
      0,
    );
    const evidenceWithholdingAmount = moneyFlowEvidence.reduce(
      (batchSum, batch) =>
        batchSum + batch.earnings.reduce((sum, earning) => sum + earning.withholdingAmount, 0),
      0,
    );
    const evidenceNetAmount = moneyFlowEvidence.reduce(
      (batchSum, batch) => batchSum + batch.earnings.reduce((sum, earning) => sum + earning.netAmount, 0),
      0,
    );
    const cashDebtAmount = moneyFlowEvidence.reduce(
      (batchSum, batch) =>
        batchSum + batch.earnings.reduce((sum, earning) => sum + Math.abs(Math.min(0, earning.netAmount)), 0),
      0,
    );
    const currenciesMatch = moneyFlowEvidence.every((batch) =>
      batch.earnings.every((earning) => earning.currency === batch.currency),
    );
    const completeness =
      total === 0 ? 'UNAVAILABLE' : evidenceBatchCount === total && currenciesMatch ? 'COMPLETE' : 'PARTIAL';
    const payoutNetAmount = totalNet._sum.totalNetAmount ?? 0;
    const netGap = payoutNetAmount - evidenceNetAmount;

    return {
      generatedAt: new Date().toISOString(),
      range: normalizeOptionalQuery(options.range) ?? 'all',
      timeZone: 'Asia/Ho_Chi_Minh',
      scopeCount: total,
      total,
      needsReview,
      inProgress,
      payoutHolds,
      missingTransferRefs,
      settled,
      open,
      totalNetAmount: totalNet._sum.totalNetAmount ?? 0,
      withholdingAmount: withholding._sum.amount ?? 0,
      currency: 'VND',
      postPaymentRepairCount,
      moneyFlow: {
        scope: normalizeOptionalQuery(options.range) ?? 'all',
        scopeBatchCount: total,
        totalBatchCount,
        evidenceBatchCount,
        grossAmount,
        payoutNetAmount,
        evidenceNetAmount,
        platformFeeAmount,
        withholdingAmount: evidenceWithholdingAmount,
        cashDebtAmount,
        netGap,
        completeness,
        verdict:
          completeness !== 'COMPLETE' ? 'NOT_EVALUATED' : netGap === 0 ? 'MATCHED' : 'MISMATCH',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async updatePayoutBatch(
    payoutBatchId: string,
    input: {
      actorId?: string | null;
      status?: PayoutBatchStatus;
      transferRef?: string | null;
      notes?: string | null;
      expectedStatus?: PayoutBatchStatus;
      expectedTransferRef?: string | null;
      expectedNotes?: string | null;
    },
    beforeCommit?: (
      tx: TxClient,
      batch: {
        id: string;
        providerProfileId: string;
        status: PayoutBatchStatus;
        transferRef: string | null;
        notes: string | null;
        earnings: unknown[];
      },
    ) => Promise<void>,
  ) {
    const existing = await this.prisma.providerPayoutBatch.findUnique({
      where: { id: payoutBatchId },
      include: { earnings: true },
    });
    if (!existing) {
      throw new NotFoundException('Payout batch not found');
    }

    const nextTransferRef =
      input.transferRef === undefined
        ? normalizeNullable(existing.transferRef)
        : normalizeNullable(input.transferRef);
    const nextStatus = normalizePayoutBatchUpdateStatus({
      currentStatus: existing.status,
      requestedStatus: input.status,
      nextTransferRef,
    });
    const shouldStartProcessing =
      nextStatus === PayoutBatchStatus.PROCESSING && existing.status !== PayoutBatchStatus.PROCESSING;
    const shouldMarkPaid =
      nextStatus === PayoutBatchStatus.PAID && existing.status !== PayoutBatchStatus.PAID;

    const updated = await this.prisma.$transaction(async (tx) => {
      let executionEarnings = existing.earnings;
      if (shouldStartProcessing || shouldMarkPaid) {
        await this.lockProviderWallet(tx, existing.providerProfileId, existing.currency);
        executionEarnings = await tx.providerEarning.findMany({
          where: { payoutBatchId },
        });
        await this.ensureNoActivePayoutHold(tx, existing.providerProfileId);
        await this.ensurePayoutBatchExecutionReady(tx, {
          ...existing,
          earnings: executionEarnings,
        });
      }
      const paidAt = shouldMarkPaid ? new Date() : undefined;
      if (shouldMarkPaid && paidAt) {
        await this.ensureFinancePostingPeriodOpen(tx, paidAt, existing.currency, 'Payout paid closeout');
      }
      const mutation = await tx.providerPayoutBatch.updateMany({
        where: {
          id: payoutBatchId,
          status: input.expectedStatus ?? existing.status,
          ...(input.expectedTransferRef !== undefined
            ? { transferRef: normalizeNullable(input.expectedTransferRef) }
            : {}),
          ...(input.expectedNotes !== undefined ? { notes: normalizeNullable(input.expectedNotes) } : {}),
        },
        data: {
          status: nextStatus,
          transferRef: input.transferRef === undefined ? undefined : nextTransferRef,
          notes: input.notes === undefined ? undefined : normalizeNullable(input.notes),
          paidAt,
        },
      });
      if (mutation.count !== 1) {
        throw new ConflictException(
          'Payout batch changed while this action was running. Reload and review the latest status.',
        );
      }
      const batch = {
        ...existing,
        status: nextStatus,
        transferRef: input.transferRef === undefined ? existing.transferRef : nextTransferRef,
        notes: input.notes === undefined ? existing.notes : normalizeNullable(input.notes),
        paidAt: paidAt ?? existing.paidAt,
      };

      if (shouldMarkPaid) {
        const earningMutation = await tx.providerEarning.updateMany({
          where: {
            id: { in: executionEarnings.map((earning) => earning.id) },
            payoutBatchId,
            status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
          },
          data: {
            status: EarningStatus.PAID,
            paidAt: batch.paidAt,
          },
        });
        if (earningMutation.count !== executionEarnings.length) {
          throw new ConflictException(
            'Payout earnings changed while this action was running. Reload and review the latest status.',
          );
        }
        await tx.withholdingLog.updateMany({
          where: { payoutBatchId },
          data: { status: 'PAID' },
        });
        for (const earning of executionEarnings) {
          await this.upsertPaidWalletLedger(tx, earning, {
            payoutBatchId,
            reference: batch.transferRef,
            notes: batch.notes ?? `Payout batch ${batch.id} paid`,
          });
        }
        await upsertProviderPayoutBatchJournal(tx, {
          actorId: input.actorId ?? null,
          amount: batch.totalNetAmount,
          currency: batch.currency,
          occurredAt: batch.paidAt ?? new Date(),
          payoutBatchId: batch.id,
          providerProfileId: batch.providerProfileId,
          transferRef: batch.transferRef,
        });
      }

      const result = await tx.providerPayoutBatch.findUniqueOrThrow({
        where: { id: payoutBatchId },
        include: {
          providerProfile: { include: this.providerPayoutInclude() },
          earnings: {
            orderBy: { createdAt: 'desc' },
            include: {
              booking: { include: { services: { include: { service: true } }, payment: true } },
              taxLogs: { orderBy: { createdAt: 'desc' } },
              platformFeeLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
              walletLedgerEntries: { orderBy: { createdAt: 'desc' }, take: 5 },
            },
          },
          withholdingLogs: true,
        },
      });
      await beforeCommit?.(tx, result);
      return result;
    });
    const changedStatus = payoutStatusChanged(existing.status, nextStatus) ? nextStatus : undefined;
    await this.notifyPayoutBatchUpdated(updated, changedStatus);
    return updated;
  }

  async reversePaidPayoutBatchForAdmin(
    payoutBatchId: string,
    input: PaidDisbursementReversalInput,
    beforeCommit?: (
      tx: TxClient,
      result: {
        payoutBatch: { id: string; totalNetAmount: number; currency: string };
        reversalJournalBatch: { id: string };
        reversalWalletLedgerEntry: { id: string };
      },
    ) => Promise<void>,
  ) {
    const existing = await this.prisma.providerPayoutBatch.findUnique({
      where: { id: payoutBatchId },
    });
    if (!existing) {
      throw new NotFoundException('Payout batch not found');
    }
    if (existing.status !== PayoutBatchStatus.PAID) {
      throw new BadRequestException('Only a paid payout batch can be reversed');
    }
    assertPaidDisbursementReversalEvidence(input);
    const occurredAt = normalizeFinanceReversalOccurredAt(input.occurredAt);

    return this.prisma.$transaction(async (tx) => {
      await this.lockFinanceMutation(tx, `provider-payout-reversal:${payoutBatchId}`);
      const existing = await tx.providerPayoutBatch.findUnique({
        where: { id: payoutBatchId },
      });
      if (!existing) {
        throw new NotFoundException('Payout batch not found');
      }
      if (existing.status !== PayoutBatchStatus.PAID) {
        throw new BadRequestException('Only a paid payout batch can be reversed');
      }
      await this.ensureFinancePostingPeriodOpen(tx, occurredAt, existing.currency, 'Payout batch reversal');
      const originalJournal = await requirePostedFinanceJournalForReversal(
        tx,
        `accounting-journal:provider-payout-batch:${existing.id}:paid`,
        existing.totalNetAmount,
        existing.currency,
      );
      const originalLedger = await tx.providerWalletLedgerEntry.aggregate({
        where: { payoutBatchId: existing.id },
        _sum: { amount: true },
        _count: { _all: true },
      });
      if (originalLedger._count._all < 1 || (originalLedger._sum.amount ?? 0) !== -existing.totalNetAmount) {
        throw new ConflictException('Payout reversal requires complete original paid wallet-ledger evidence');
      }

      const reversalSourceKey = providerPayoutBatchReversalLedgerSourceKey(existing.id);
      const reversalJournalSourceKey = providerPayoutBatchReversalJournalSourceKey(existing.id);
      const [existingReversalLedger, existingReversalJournal] = await Promise.all([
        tx.providerWalletLedgerEntry.findUnique({ where: { sourceKey: reversalSourceKey } }),
        tx.accountingJournalBatch.findUnique({
          where: { sourceKey: reversalJournalSourceKey },
          include: { entries: true },
        }),
      ]);
      if (existingReversalLedger || existingReversalJournal) {
        if (
          existingReversalLedger &&
          existingReversalJournal &&
          existingReversalLedger.amount === existing.totalNetAmount &&
          financeJournalIsBalancedForAmount(existingReversalJournal, existing.totalNetAmount)
        ) {
          const result = {
            payoutBatch: existing,
            reversalJournalBatch: existingReversalJournal,
            reversalWalletLedgerEntry: existingReversalLedger,
          };
          await beforeCommit?.(tx, result);
          return result;
        }
        throw new ConflictException('Payout reversal evidence is incomplete or inconsistent');
      }

      const metadata = financeDisbursementReversalMetadata({
        ...input,
        occurredAt,
        operation: 'PROVIDER_PAYOUT_BATCH_REVERSAL',
        originalJournalBatchIds: [originalJournal.id],
      });
      const reversalWalletLedgerEntry = await tx.providerWalletLedgerEntry.create({
        data: {
          providerProfileId: existing.providerProfileId,
          type: ProviderWalletLedgerType.ADMIN_ADJUSTMENT,
          sourceKey: reversalSourceKey,
          amount: existing.totalNetAmount,
          currency: existing.currency,
          reference: input.reversalReference.trim(),
          notes: input.reason.trim(),
          metadata: {
            ...metadata,
            payoutBatchId: existing.id,
          },
        },
      });
      const reversalJournalBatch = await createFinanceDisbursementReversalJournal(tx, {
        actorId: input.actorId,
        currency: existing.currency,
        metadata,
        occurredAt,
        originalJournals: [originalJournal],
        providerProfileId: existing.providerProfileId,
        sourceId: existing.id,
        sourceKey: reversalJournalSourceKey,
        sourceType: AccountingJournalSourceType.PROVIDER_PAYOUT_BATCH,
      });

      const result = {
        payoutBatch: existing,
        reversalJournalBatch,
        reversalWalletLedgerEntry,
      };
      await beforeCommit?.(tx, result);
      return result;
    });
  }

  async listPayoutBatchesForProviderUser(userId: string) {
    const provider = await this.requireProviderProfile(userId);
    return this.prisma.providerPayoutBatch.findMany({
      where: { providerProfileId: provider.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { earnings: { orderBy: { createdAt: 'desc' } } },
    });
  }

  async listProviderWalletWithdrawalRequestsForProviderUser(userId: string) {
    const provider = await this.requireProviderProfile(userId);
    return this.prisma.providerWalletWithdrawalRequest.findMany({
      where: { providerProfileId: provider.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { bankAccount: true },
    });
  }

  async listProviderWalletWithdrawalRequestsForAdmin(options: AdminWithdrawalRequestListQuery = {}) {
    const skip = adminFinanceListSkip(options.skip);

    const requests = await this.prisma.providerWalletWithdrawalRequest.findMany({
      where: adminWithdrawalRequestListWhere(options),
      orderBy: withdrawalRequestOrderBy(options.sort),
      ...(skip > 0 ? { skip } : {}),
      take: adminFinanceListTake(options.take),
      include: {
        providerProfile: {
          include: {
            user: { select: { id: true, phone: true, fullName: true } },
          },
        },
        bankAccount: true,
        bankReconciliationMatches: {
          where: { status: { in: [...ACTIVE_BANK_RECONCILIATION_STATUSES] } },
          orderBy: { matchedAt: 'desc' },
          take: 1,
          select: {
            bankTransactionId: true,
            id: true,
            matchedAt: true,
            status: true,
          },
        },
      },
    });

    return requests.map((request) => ({
      ...request,
      reconciliationState:
        request.status === ProviderWalletWithdrawalRequestStatus.PAID
          ? request.bankReconciliationMatches.length > 0
            ? 'MATCHED'
            : 'UNMATCHED'
          : 'NOT_APPLICABLE',
      bankReconciliationMatch: request.bankReconciliationMatches[0] ?? null,
    }));
  }

  async providerWalletWithdrawalRequestSummaryForAdmin(
    options: Omit<AdminWithdrawalRequestListQuery, 'take'> = {},
  ) {
    const filteredWhere = adminWithdrawalRequestListWhere(options);
    const where = adminWithdrawalRequestListWhere({
      ...options,
      reconciliation: null,
      status: null,
    });
    const requestedWhere = mergeWithdrawalRequestWhere(where, {
      status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
    });
    const reviewRequiredWhere = mergeWithdrawalRequestWhere(where, {
      status: ProviderWalletWithdrawalRequestStatus.REVIEW_REQUIRED,
    });
    const bankTransferPendingWhere = mergeWithdrawalRequestWhere(where, {
      status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
    });
    const activeWhere = mergeWithdrawalRequestWhere(where, {
      status: { in: [...ACTIVE_WITHDRAWAL_REQUEST_STATUSES] },
    });
    const returnedWhere = mergeWithdrawalRequestWhere(where, {
      status: { in: [...RELEASED_WITHDRAWAL_REQUEST_STATUSES] },
    });
    const paidWhere = mergeWithdrawalRequestWhere(where, {
      status: ProviderWalletWithdrawalRequestStatus.PAID,
    });
    const paidUnreconciledWhere = mergeWithdrawalRequestWhere(paidWhere, {
      bankReconciliationMatches: {
        none: { status: { in: [...ACTIVE_BANK_RECONCILIATION_STATUSES] } },
      },
    });
    const paidReconciledWhere = mergeWithdrawalRequestWhere(paidWhere, {
      bankReconciliationMatches: {
        some: { status: { in: [...ACTIVE_BANK_RECONCILIATION_STATUSES] } },
      },
    });
    const [
      filteredTotal,
      total,
      requested,
      reviewRequired,
      bankTransferPending,
      lockReleased,
      totalAmount,
      requestedAmount,
      pendingWithdrawalPayableAmount,
      bankTransferPendingAmount,
      paidAmount,
      returnedAmount,
      paidUnreconciled,
      paidUnreconciledAmount,
      paidReconciled,
      paidReconciledAmount,
    ] = await Promise.all([
      this.prisma.providerWalletWithdrawalRequest.count(withdrawalRequestCountArgs(filteredWhere)),
      this.prisma.providerWalletWithdrawalRequest.count(withdrawalRequestCountArgs(where)),
      this.prisma.providerWalletWithdrawalRequest.count(withdrawalRequestCountArgs(requestedWhere)),
      this.prisma.providerWalletWithdrawalRequest.count(withdrawalRequestCountArgs(reviewRequiredWhere)),
      this.prisma.providerWalletWithdrawalRequest.count(withdrawalRequestCountArgs(bankTransferPendingWhere)),
      this.prisma.providerWalletWithdrawalRequest.count(
        withdrawalRequestCountArgs(
          mergeWithdrawalRequestWhere(where, {
            metadata: {
              equals: true,
              path: ['lastStatusChange', 'lockedAmountReleased'],
            },
          }),
        ),
      ),
      this.prisma.providerWalletWithdrawalRequest.aggregate(withdrawalRequestAmountAggregateArgs(where)),
      this.prisma.providerWalletWithdrawalRequest.aggregate(
        withdrawalRequestAmountAggregateArgs(requestedWhere),
      ),
      this.prisma.providerWalletWithdrawalRequest.aggregate(
        withdrawalRequestAmountAggregateArgs(activeWhere),
      ),
      this.prisma.providerWalletWithdrawalRequest.aggregate(
        withdrawalRequestAmountAggregateArgs(bankTransferPendingWhere),
      ),
      this.prisma.providerWalletWithdrawalRequest.aggregate(withdrawalRequestAmountAggregateArgs(paidWhere)),
      this.prisma.providerWalletWithdrawalRequest.aggregate(
        withdrawalRequestAmountAggregateArgs(returnedWhere),
      ),
      this.prisma.providerWalletWithdrawalRequest.count(withdrawalRequestCountArgs(paidUnreconciledWhere)),
      this.prisma.providerWalletWithdrawalRequest.aggregate(
        withdrawalRequestAmountAggregateArgs(paidUnreconciledWhere),
      ),
      this.prisma.providerWalletWithdrawalRequest.count(withdrawalRequestCountArgs(paidReconciledWhere)),
      this.prisma.providerWalletWithdrawalRequest.aggregate(
        withdrawalRequestAmountAggregateArgs(paidReconciledWhere),
      ),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      range: normalizeOptionalQuery(options.range) ?? 'all',
      timeZone: 'Asia/Ho_Chi_Minh',
      scopeCount: total,
      filteredTotal,
      total,
      requested,
      reviewRequired,
      bankTransferPending,
      lockReleased,
      totalAmount: aggregateAmount(totalAmount),
      requestedAmount: aggregateAmount(requestedAmount),
      pendingWithdrawalPayableAmount: aggregateAmount(pendingWithdrawalPayableAmount),
      bankTransferPendingAmount: aggregateAmount(bankTransferPendingAmount),
      paidAmount: aggregateAmount(paidAmount),
      returnedAmount: aggregateAmount(returnedAmount),
      paidUnreconciled,
      paidUnreconciledAmount: aggregateAmount(paidUnreconciledAmount),
      paidReconciled,
      paidReconciledAmount: aggregateAmount(paidReconciledAmount),
      currency: 'VND',
    };
  }

  async createProviderWalletWithdrawalRequestForProviderUser(
    userId: string,
    input: ProviderWalletWithdrawalRequestInput,
  ) {
    const provider = await this.requireProviderProfile(userId);
    const request = normalizeProviderWalletWithdrawalRequestInput(input);

    return this.prisma.$transaction(async (tx) => {
      await this.lockProviderWallet(tx, provider.id, 'VND');
      const replay = await tx.providerWalletWithdrawalRequest.findUnique({
        where: {
          providerProfileId_idempotencyKey: {
            providerProfileId: provider.id,
            idempotencyKey: request.idempotencyKey,
          },
        },
      });
      if (replay) {
        const replayMetadata = jsonObjectOrEmpty(replay.metadata);
        const replayRequestedBankAccountId =
          typeof replayMetadata.requestedBankAccountId === 'string'
            ? replayMetadata.requestedBankAccountId
            : null;
        if (
          replay.amount !== request.amount ||
          replay.requestNote !== (request.requestNote ?? null) ||
          replayRequestedBankAccountId !== (request.bankAccountId ?? null)
        ) {
          throw new ConflictException(
            'Idempotency key was already used for a different withdrawal request',
          );
        }
        return replay;
      }
      const bankAccount = await tx.providerBankAccount.findFirst({
        where: {
          ...(request.bankAccountId ? { id: request.bankAccountId } : {}),
          providerProfileId: provider.id,
          status: ProviderBankAccountStatus.APPROVED,
          deletedAt: null,
        },
        ...(request.bankAccountId
          ? {}
          : { orderBy: [{ isPrimary: 'desc' as const }, { updatedAt: 'desc' as const }] }),
      });
      if (!bankAccount) {
        throw new BadRequestException('Partner needs an approved bank account before withdrawal');
      }

      const currentWalletBalance = await this.providerWalletLedgerBalance(tx, provider.id);
      if (request.amount > currentWalletBalance) {
        throw new BadRequestException('Withdrawal amount exceeds partner wallet balance');
      }
      const pendingWithdrawalAmount = await this.providerPendingWithdrawalAmount(tx, provider.id);
      const pendingPayoutAmount = await this.providerPendingPayoutAmount(tx, provider.id);
      const availableWalletBalance = currentWalletBalance - pendingWithdrawalAmount - pendingPayoutAmount;
      if (request.amount > availableWalletBalance) {
        throw new BadRequestException('Withdrawal amount exceeds available partner wallet balance');
      }

      const created = await tx.providerWalletWithdrawalRequest.create({
        data: {
          providerProfileId: provider.id,
          idempotencyKey: request.idempotencyKey,
          bankAccountId: bankAccount.id,
          amount: request.amount,
          currency: 'VND',
          status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
          requestNote: request.requestNote,
          metadata: {
            currentWalletBalance,
            pendingWithdrawalAmount,
            pendingPayoutAmount,
            availableWalletBalance,
            requestedBankAccountId: request.bankAccountId ?? null,
            source: 'PARTNER_APP_WALLET_WITHDRAWAL_REQUEST',
          },
        },
      });
      await upsertProviderWithdrawalJournal(tx, {
        actorId: userId,
        amount: created.amount,
        currency: created.currency,
        occurredAt: created.createdAt ?? new Date(),
        phase: 'LOCK',
        providerProfileId: created.providerProfileId,
        requestId: created.id,
      });
      return created;
    });
  }

  async updateProviderWalletWithdrawalRequestForAdmin(
    requestId: string,
    input: ProviderWalletWithdrawalRequestUpdateInput,
    adminId: string,
    beforeCommit?: (
      tx: TxClient,
      request: {
        id: string;
        providerProfileId: string;
        amount: number;
        currency: string;
        status: ProviderWalletWithdrawalRequestStatus;
        transferRef: string | null;
        metadata: Prisma.JsonValue | null;
      },
    ) => Promise<void>,
  ) {
    const existing = await this.prisma.providerWalletWithdrawalRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) {
      throw new NotFoundException('Partner wallet withdrawal request not found');
    }
    const existingMetadata = jsonObjectOrEmpty(existing.metadata);
    const existingTransferEvidence = jsonObjectOrEmpty(
      (existingMetadata.bankTransferEvidence as Prisma.JsonValue) ?? null,
    );
    const paidApprovalInput =
      input.status === ProviderWalletWithdrawalRequestStatus.PAID
        ? {
            ...input,
            transferRef: input.transferRef ?? existing.transferRef,
            bankTransferDate:
              input.bankTransferDate ??
              (typeof existingTransferEvidence.bankTransferDate === 'string'
                ? existingTransferEvidence.bankTransferDate
                : null),
            attachmentFileId:
              input.attachmentFileId ??
              (typeof existingTransferEvidence.attachmentFileId === 'string'
                ? existingTransferEvidence.attachmentFileId
                : null),
            attachmentUrl:
              input.attachmentUrl ??
              (typeof existingTransferEvidence.attachmentUrl === 'string'
                ? existingTransferEvidence.attachmentUrl
                : null),
          }
        : input;
    const update = normalizeProviderWalletWithdrawalRequestUpdateInput({
      ...paidApprovalInput,
      currentStatus: existing.status,
    });
    const shouldMarkPaid =
      update.status === ProviderWalletWithdrawalRequestStatus.PAID &&
      existing.status !== ProviderWalletWithdrawalRequestStatus.PAID;
    const activeMembershipChanges = Boolean(
      update.status &&
        isActiveWithdrawalRequestStatus(existing.status) !==
          isActiveWithdrawalRequestStatus(update.status),
    );
    const reviewedAt = new Date();
    const nextTransferRef = update.transferRef ?? existing.transferRef;
    const nextAdminNote = update.adminNote ?? existing.adminNote;
    const shouldRecordTransferEvidence =
      update.status === ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING;
    const bankTransferEvidenceMetadata = shouldRecordTransferEvidence
      ? {
          transferRef: nextTransferRef,
          bankTransferDate:
            update.bankTransferDate?.toISOString() ??
            (typeof existingTransferEvidence.bankTransferDate === 'string'
              ? existingTransferEvidence.bankTransferDate
              : null),
          attachmentFileId:
            update.attachmentFileId ??
            (typeof existingTransferEvidence.attachmentFileId === 'string'
              ? existingTransferEvidence.attachmentFileId
              : null),
          attachmentUrl:
            update.attachmentUrl ??
            (typeof existingTransferEvidence.attachmentUrl === 'string'
              ? existingTransferEvidence.attachmentUrl
              : null),
          submittedByAdminId: adminId,
          submittedAt: reviewedAt.toISOString(),
        }
      : undefined;
    const bankPayoutMetadata = shouldMarkPaid
      ? {
          transferRef: nextTransferRef,
          bankTransferDate:
            update.bankTransferDate?.toISOString() ??
            (typeof existingTransferEvidence.bankTransferDate === 'string'
              ? existingTransferEvidence.bankTransferDate
              : null),
          attachmentFileId:
            update.attachmentFileId ??
            (typeof existingTransferEvidence.attachmentFileId === 'string'
              ? existingTransferEvidence.attachmentFileId
              : null),
          attachmentUrl:
            update.attachmentUrl ??
            (typeof existingTransferEvidence.attachmentUrl === 'string'
              ? existingTransferEvidence.attachmentUrl
              : null),
          preparedByAdminId:
            typeof existingTransferEvidence.submittedByAdminId === 'string'
              ? existingTransferEvidence.submittedByAdminId
              : null,
          completedByAdminId: adminId,
        }
      : undefined;
    const statusChangeMetadata =
      update.status && update.status !== existing.status
        ? providerWalletWithdrawalRequestStatusChangeMetadata({
            adminId,
            amount: existing.amount,
            changedAt: reviewedAt,
            currency: existing.currency,
            nextStatus: update.status,
            previousStatus: existing.status,
          })
        : undefined;
    const nextMetadata =
      bankPayoutMetadata || bankTransferEvidenceMetadata || statusChangeMetadata
        ? {
            ...existingMetadata,
            ...(bankPayoutMetadata ? { bankPayout: bankPayoutMetadata } : {}),
            ...(bankTransferEvidenceMetadata ? { bankTransferEvidence: bankTransferEvidenceMetadata } : {}),
            ...(statusChangeMetadata ? { lastStatusChange: statusChangeMetadata } : {}),
          }
        : undefined;
    const requestUpdateData = {
      ...(update.status ? { status: update.status } : {}),
      transferRef: nextTransferRef,
      adminNote: nextAdminNote,
      correctionReason: update.correctionReason ?? existing.correctionReason,
      reviewedByAdminId: adminId,
      reviewedAt,
      ...(shouldMarkPaid ? { paidAt: reviewedAt } : {}),
      ...(nextMetadata ? { metadata: nextMetadata } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      if (shouldMarkPaid) {
        await this.lockProviderWallet(tx, existing.providerProfileId, existing.currency);
        const approvedBankAccount = existing.bankAccountId
          ? await tx.providerBankAccount.findFirst({
              where: {
                id: existing.bankAccountId,
                providerProfileId: existing.providerProfileId,
                status: ProviderBankAccountStatus.APPROVED,
                deletedAt: null,
              },
              select: { id: true },
            })
          : null;
        if (!approvedBankAccount) {
          throw new BadRequestException(
            'Partner needs an approved bank account before withdrawal paid closeout',
          );
        }
        const existingPaidLedger = await tx.providerWalletLedgerEntry.findUnique({
          where: { sourceKey: partnerWalletWithdrawalPaidSourceKey(existing.id) },
          select: { id: true },
        });
        if (existingPaidLedger) {
          throw new BadRequestException(
            'Withdrawal paid wallet ledger evidence already exists while the request is still open',
          );
        }
        const currentWalletBalance = await this.providerWalletLedgerBalance(tx, existing.providerProfileId);
        if (existing.amount > currentWalletBalance) {
          throw new BadRequestException('Withdrawal amount exceeds partner wallet balance');
        }
        const pendingWithdrawalAmount = await this.providerPendingWithdrawalAmount(
          tx,
          existing.providerProfileId,
          existing.id,
        );
        const pendingPayoutAmount = await this.providerPendingPayoutAmount(tx, existing.providerProfileId);
        const availableWalletBalance = currentWalletBalance - pendingWithdrawalAmount - pendingPayoutAmount;
        if (existing.amount > availableWalletBalance) {
          throw new BadRequestException('Withdrawal amount exceeds available partner wallet balance');
        }
        await this.ensureFinancePostingPeriodOpen(
          tx,
          update.bankTransferDate ?? reviewedAt,
          existing.currency,
          'Partner wallet withdrawal paid closeout',
        );
        const claimedRequest = await tx.providerWalletWithdrawalRequest.updateMany({
          where: {
            id: existing.id,
            status: existing.status,
          },
          data: requestUpdateData,
        });
        if (claimedRequest.count !== 1) {
          throw new ConflictException(
            'Partner wallet withdrawal changed while paid closeout was running. Reload and review the latest status.',
          );
        }
        await this.upsertImmutableProviderWalletLedger(tx, {
          providerProfileId: existing.providerProfileId,
          type: ProviderWalletLedgerType.PARTNER_WALLET_WITHDRAWAL_PAID,
          sourceKey: partnerWalletWithdrawalPaidSourceKey(existing.id),
          amount: -existing.amount,
          currency: existing.currency,
          reference: nextTransferRef,
          notes: nextAdminNote,
          metadata: {
            withdrawalRequestId: existing.id,
            adminId,
            bankPayout: bankPayoutMetadata,
          },
        });
        await upsertProviderWithdrawalJournal(tx, {
          actorId: adminId,
          amount: existing.amount,
          currency: existing.currency,
          occurredAt: reviewedAt,
          phase: 'LOCK',
          providerProfileId: existing.providerProfileId,
          requestId: existing.id,
        });
        await upsertProviderWithdrawalJournal(tx, {
          actorId: adminId,
          amount: existing.amount,
          currency: existing.currency,
          occurredAt: update.bankTransferDate ?? reviewedAt,
          phase: 'PAID',
          providerProfileId: existing.providerProfileId,
          requestId: existing.id,
          transferRef: nextTransferRef,
        });
      } else if (activeMembershipChanges) {
        await this.lockProviderWallet(tx, existing.providerProfileId, existing.currency);
      }

      if (!shouldMarkPaid && statusChangeMetadata?.lockedAmountReleased) {
        await upsertProviderWithdrawalJournal(tx, {
          actorId: adminId,
          amount: existing.amount,
          currency: existing.currency,
          occurredAt: reviewedAt,
          phase: 'LOCK',
          providerProfileId: existing.providerProfileId,
          requestId: existing.id,
        });
        await upsertProviderWithdrawalJournal(tx, {
          actorId: adminId,
          amount: existing.amount,
          currency: existing.currency,
          occurredAt: reviewedAt,
          phase: 'RELEASE',
          providerProfileId: existing.providerProfileId,
          requestId: existing.id,
        });
      }

      if (!shouldMarkPaid) {
        const claimedRequest = await tx.providerWalletWithdrawalRequest.updateMany({
          where: { id: existing.id, status: existing.status },
          data: requestUpdateData,
        });
        if (claimedRequest.count !== 1) {
          throw new ConflictException(
            'Partner wallet withdrawal changed while this action was running. Reload and review the latest status.',
          );
        }
      }

      const result = await tx.providerWalletWithdrawalRequest.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          providerProfile: {
            include: {
              user: { select: { id: true, phone: true, fullName: true } },
            },
          },
          bankAccount: true,
        },
      });
      await beforeCommit?.(tx, result);
      return result;
    });
  }

  async reversePaidProviderWalletWithdrawalForAdmin(
    requestId: string,
    input: PaidDisbursementReversalInput,
    beforeCommit?: (
      tx: TxClient,
      result: {
        withdrawalRequest: { id: string; amount: number; currency: string };
        reversalJournalBatch: { id: string };
        reversalWalletLedgerEntry: { id: string };
      },
    ) => Promise<void>,
  ) {
    const existing = await this.prisma.providerWalletWithdrawalRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) {
      throw new NotFoundException('Partner wallet withdrawal request not found');
    }
    if (
      existing.status !== ProviderWalletWithdrawalRequestStatus.PAID &&
      existing.status !== ProviderWalletWithdrawalRequestStatus.REVERSED
    ) {
      throw new BadRequestException('Only a paid partner wallet withdrawal can be reversed');
    }
    assertPaidDisbursementReversalEvidence(input);
    const occurredAt = normalizeFinanceReversalOccurredAt(input.occurredAt);

    return this.prisma.$transaction(async (tx) => {
      await this.lockFinanceMutation(tx, `provider-withdrawal-reversal:${requestId}`);
      const existing = await tx.providerWalletWithdrawalRequest.findUnique({
        where: { id: requestId },
      });
      if (!existing) {
        throw new NotFoundException('Partner wallet withdrawal request not found');
      }
      if (
        existing.status !== ProviderWalletWithdrawalRequestStatus.PAID &&
        existing.status !== ProviderWalletWithdrawalRequestStatus.REVERSED
      ) {
        throw new BadRequestException('Only a paid partner wallet withdrawal can be reversed');
      }
      await this.ensureFinancePostingPeriodOpen(
        tx,
        occurredAt,
        existing.currency,
        'Partner wallet withdrawal reversal',
      );
      const originalLockJournal = await requirePostedFinanceJournalForReversal(
        tx,
        `accounting-journal:provider-withdrawal:${existing.id}:lock`,
        existing.amount,
        existing.currency,
      );
      const originalPaidJournal = await requirePostedFinanceJournalForReversal(
        tx,
        `accounting-journal:provider-withdrawal:${existing.id}:paid`,
        existing.amount,
        existing.currency,
      );
      const originalPaidLedger = await tx.providerWalletLedgerEntry.findUnique({
        where: { sourceKey: partnerWalletWithdrawalPaidSourceKey(existing.id) },
      });
      if (!originalPaidLedger || originalPaidLedger.amount !== -existing.amount) {
        throw new ConflictException(
          'Withdrawal reversal requires complete original paid wallet-ledger evidence',
        );
      }

      const reversalSourceKey = providerWithdrawalReversalLedgerSourceKey(existing.id);
      const reversalJournalSourceKey = providerWithdrawalReversalJournalSourceKey(existing.id);
      const [existingReversalLedger, existingReversalJournal] = await Promise.all([
        tx.providerWalletLedgerEntry.findUnique({ where: { sourceKey: reversalSourceKey } }),
        tx.accountingJournalBatch.findUnique({
          where: { sourceKey: reversalJournalSourceKey },
          include: { entries: true },
        }),
      ]);
      const expectedJournalAmount = existing.amount * 2;
      if (existingReversalLedger || existingReversalJournal) {
        if (
          existingReversalLedger &&
          existingReversalJournal &&
          existingReversalLedger.amount === existing.amount &&
          financeJournalIsBalancedForAmount(existingReversalJournal, expectedJournalAmount)
        ) {
          const result = {
            withdrawalRequest: existing,
            reversalJournalBatch: existingReversalJournal,
            reversalWalletLedgerEntry: existingReversalLedger,
          };
          await beforeCommit?.(tx, result);
          return result;
        }
        throw new ConflictException('Withdrawal reversal evidence is incomplete or inconsistent');
      }
      if (existing.status !== ProviderWalletWithdrawalRequestStatus.PAID) {
        throw new ConflictException('Reversed withdrawal is missing its reversal evidence');
      }

      const metadata = financeDisbursementReversalMetadata({
        ...input,
        occurredAt,
        operation: 'PROVIDER_WALLET_WITHDRAWAL_REVERSAL',
        originalJournalBatchIds: [originalLockJournal.id, originalPaidJournal.id],
      });
      const reversalWalletLedgerEntry = await tx.providerWalletLedgerEntry.create({
        data: {
          providerProfileId: existing.providerProfileId,
          type: ProviderWalletLedgerType.ADMIN_ADJUSTMENT,
          sourceKey: reversalSourceKey,
          amount: existing.amount,
          currency: existing.currency,
          reference: input.reversalReference.trim(),
          notes: input.reason.trim(),
          metadata: {
            ...metadata,
            withdrawalRequestId: existing.id,
          },
        },
      });
      const reversalJournalBatch = await createFinanceDisbursementReversalJournal(tx, {
        actorId: input.actorId,
        currency: existing.currency,
        metadata,
        occurredAt,
        originalJournals: [originalLockJournal, originalPaidJournal],
        providerProfileId: existing.providerProfileId,
        sourceId: existing.id,
        sourceKey: reversalJournalSourceKey,
        sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL,
      });
      const statusMutation = await tx.providerWalletWithdrawalRequest.updateMany({
        where: {
          id: existing.id,
          status: ProviderWalletWithdrawalRequestStatus.PAID,
        },
        data: {
          status: ProviderWalletWithdrawalRequestStatus.REVERSED,
          correctionReason: input.reason.trim(),
          reviewedByAdminId: input.actorId,
          reviewedAt: occurredAt,
          metadata: {
            ...jsonObjectOrEmpty(existing.metadata),
            reversal: {
              ...metadata,
              reversalJournalBatchId: reversalJournalBatch.id,
              reversalWalletLedgerEntryId: reversalWalletLedgerEntry.id,
            },
          },
        },
      });
      if (statusMutation.count !== 1) {
        throw new ConflictException(
          'Withdrawal changed while this reversal was running. Reload and review the latest status.',
        );
      }
      const withdrawalRequest = await tx.providerWalletWithdrawalRequest.findUniqueOrThrow({
        where: { id: existing.id },
      });

      const result = {
        withdrawalRequest,
        reversalJournalBatch,
        reversalWalletLedgerEntry,
      };
      await beforeCommit?.(tx, result);
      return result;
    });
  }

  async cancelForRefund(bookingId: string, transactionClient?: TxClient) {
    return transactionClient
      ? this.cancelForRefundInTransaction(bookingId, transactionClient)
      : this.prisma.$transaction((tx) => this.cancelForRefundInTransaction(bookingId, tx));
  }

  private async cancelForRefundInTransaction(bookingId: string, transactionClient: TxClient) {
    const locator = await transactionClient.providerEarning.findUnique({
      where: { bookingId },
      select: {
        currency: true,
        providerProfileId: true,
      },
    });
    if (!locator) {
      return { skipped: true, reason: 'NO_EARNING' };
    }

    await this.lockProviderWallet(
      transactionClient,
      locator.providerProfileId,
      locator.currency,
    );
    const earning = await transactionClient.providerEarning.findUnique({
      where: { bookingId },
      include: {
        booking: {
          select: {
            closedReason: true,
          },
        },
        payoutBatch: {
          select: {
            id: true,
            paidAt: true,
            status: true,
            transferRef: true,
          },
        },
      },
    });
    if (!earning) {
      return { skipped: true, reason: 'NO_EARNING' };
    }
    if (earning.status === EarningStatus.CANCELLED && earning.netAmount === 0) {
      return { skipped: true, reason: 'ALREADY_CANCELLED', earningId: earning.id };
    }
    if (earning.booking?.closedReason === POST_MATCH_CANCELLATION_HELD_REASON && earning.netAmount < 0) {
      return {
        skipped: true,
        reason: 'POST_MATCH_CANCELLATION_FEE_HELD',
        earningId: earning.id,
        retainedFeeAmount: -earning.netAmount,
      };
    }
    if (earning.status === EarningStatus.PAID) {
      const receivableAmount = Math.max(0, earning.netAmount);
      if (receivableAmount === 0) {
        return { skipped: true, reason: 'ALREADY_PAID', earningId: earning.id };
      }

      const payoutEvidence = paidRefundReceivablePayoutEvidence(earning);
      const metadata = {
        previousNetAmount: earning.netAmount,
        previousStatus: earning.status,
        refundAfterPayout: true,
        partnerReceivableAmount: receivableAmount,
        ...payoutEvidence.metadata,
      } satisfies Prisma.InputJsonObject;
      const createReceivableLedger = async (tx: TxClient | PrismaService) => {
        await this.upsertImmutableProviderWalletLedger(tx, {
          providerProfileId: earning.providerProfileId,
          bookingId: earning.bookingId,
          earningId: earning.id,
          ...(payoutEvidence.payoutBatchId ? { payoutBatchId: payoutEvidence.payoutBatchId } : {}),
          type: ProviderWalletLedgerType.REFUND_REVERSAL,
          sourceKey: `earning:${earning.id}:paid-refund-receivable`,
          amount: -receivableAmount,
          currency: earning.currency,
          ...(payoutEvidence.reference ? { reference: payoutEvidence.reference } : {}),
          notes: 'Paid earning converted to partner receivable by refund workflow',
          metadata,
        });
      };
      await createReceivableLedger(transactionClient);

      return {
        skipped: false,
        reason: 'PAID_REFUND_RECEIVABLE_CREATED',
        earning,
        receivableAmount,
      };
    }

    const cancelUnpaidEarning = async (tx: TxClient | PrismaService) => {
      const mutation = await tx.providerEarning.updateMany({
        where: {
          bookingId,
          status: earning.status,
          netAmount: earning.netAmount,
        },
        data: {
          status: EarningStatus.CANCELLED,
          netAmount: 0,
        },
      });
      if (mutation.count !== 1) {
        throw new ConflictException(
          'Partner earning changed while the refund was being finalized. Reload and try again.',
        );
      }
      await this.upsertImmutableProviderWalletLedger(tx, {
        providerProfileId: earning.providerProfileId,
        bookingId: earning.bookingId,
        earningId: earning.id,
        type: ProviderWalletLedgerType.REFUND_REVERSAL,
        sourceKey: `earning:${earning.id}:refund-reversal`,
        amount: -earning.netAmount,
        currency: earning.currency,
        notes: 'Unpaid earning cancelled by refund workflow',
        metadata: { previousNetAmount: earning.netAmount },
      });
      return tx.providerEarning.findUniqueOrThrow({ where: { bookingId } });
    };
    const cancelled = await cancelUnpaidEarning(transactionClient);

    return { skipped: false, earning: cancelled };
  }

  private async notifyPayoutBatchUpdated(
    batch: {
      id: string;
      providerProfileId: string;
      status: PayoutBatchStatus;
      providerProfile?: { user?: { id?: string | null } | null } | null;
    },
    requestedStatus?: PayoutBatchStatus,
  ) {
    if (!this.notifications || !requestedStatus) {
      return;
    }
    const userId = batch.providerProfile?.user?.id;
    if (!userId) {
      return;
    }

    await this.notifications.create({
      userId,
      targetRole: Role.PROVIDER,
      type: 'provider.payout_batch.updated',
      title: 'Payout batch updated',
      body: payoutBatchNotificationBody(batch.status),
      data: { payoutBatchId: batch.id, providerProfileId: batch.providerProfileId },
    });
  }

  private async summaryWhere(where: Prisma.ProviderEarningWhereInput) {
    const [total, pending, available, paid, count] = await Promise.all([
      this.prisma.providerEarning.aggregate({
        where,
        _sum: {
          grossAmount: true,
          platformFee: true,
          withholdingAmount: true,
          netAmount: true,
        },
      }),
      this.prisma.providerEarning.aggregate({
        where: { ...where, status: EarningStatus.PENDING },
        _sum: { netAmount: true },
      }),
      this.prisma.providerEarning.aggregate({
        where: { ...where, status: EarningStatus.AVAILABLE },
        _sum: { netAmount: true },
      }),
      this.prisma.providerEarning.aggregate({
        where: { ...where, status: EarningStatus.PAID },
        _sum: { netAmount: true },
      }),
      this.prisma.providerEarning.count({ where }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      count,
      grossAmount: total._sum.grossAmount ?? 0,
      platformFee: total._sum.platformFee ?? 0,
      withholdingAmount: total._sum.withholdingAmount ?? 0,
      netAmount: total._sum.netAmount ?? 0,
      pendingNetAmount: pending._sum.netAmount ?? 0,
      availableNetAmount: available._sum.netAmount ?? 0,
      paidNetAmount: paid._sum.netAmount ?? 0,
      currency: 'VND',
    };
  }

  private async upsertEarningWalletLedger(
    tx: TxClient,
    earning: {
      id: string;
      providerProfileId: string;
      bookingId: string;
      grossAmount: number;
      platformFee: number;
      withholdingAmount: number;
      netAmount: number;
      currency: string;
    },
    paymentMethod?: PaymentMethod | null,
    platformFeeVatRateBps = 0,
    options: { companyCouponExpense?: number | null } = {},
  ) {
    if (paymentMethod === PaymentMethod.CASH) {
      return this.upsertCashBookingWalletLedgerEntries(tx, earning, platformFeeVatRateBps, options);
    }

    const ledger = await tx.providerWalletLedgerEntry.upsert({
      where: { sourceKey: `earning:${earning.id}:booking` },
      update: {},
      create: {
        providerProfileId: earning.providerProfileId,
        bookingId: earning.bookingId,
        earningId: earning.id,
        type: ProviderWalletLedgerType.BOOKING_EARNING,
        sourceKey: `earning:${earning.id}:booking`,
        amount: earning.netAmount,
        currency: earning.currency,
        notes: 'Completed booking created partner wallet credit',
        metadata: this.earningLedgerMetadata(earning, paymentMethod),
      },
    });
    return [ledger];
  }

  private upsertCashBookingWalletLedgerEntries(
    tx: TxClient,
    earning: {
      id: string;
      providerProfileId: string;
      bookingId: string;
      grossAmount: number;
      platformFee: number;
      withholdingAmount: number;
      currency: string;
    },
    platformFeeVatRateBps: number,
    options: { companyCouponExpense?: number | null } = {},
  ) {
    const platformFeeGross = Math.max(0, earning.platformFee - earning.withholdingAmount);
    const partnerDue = calculateCashBookingPartnerDue(
      platformFeeGross,
      platformFeeVatRateBps,
      earning.withholdingAmount,
      { companyCouponExpense: options.companyCouponExpense },
    );
    const base = {
      providerProfileId: earning.providerProfileId,
      bookingId: earning.bookingId,
      earningId: earning.id,
      currency: earning.currency,
    };
    const metadataBase = {
      ...this.earningLedgerMetadata(earning, PaymentMethod.CASH),
      platformFeeGross: partnerDue.platformFeeGross,
      platformFeeVatRateBps: partnerDue.platformFeeVatRateBps,
      cashBookingCompanyCouponExpense: partnerDue.companyCouponExpense,
      totalPartnerDueToCompany: partnerDue.totalPartnerDueToCompany,
      walletDeductionCompanyOutputVat: partnerDue.walletDeductionCompanyOutputVat,
      walletDeductionPartnerTaxPayable: partnerDue.walletDeductionPartnerTaxPayable,
      walletDeductionPlatformFeeNetRevenue: partnerDue.walletDeductionPlatformFeeNetRevenue,
      partnerCouponSubsidyPayable: partnerDue.partnerCouponSubsidyPayable,
    } satisfies Prisma.InputJsonObject;

    const ledgerWrites = [
      tx.providerWalletLedgerEntry.upsert({
        where: { sourceKey: `earning:${earning.id}:cash-platform-fee-net` },
        update: {},
        create: {
          ...base,
          type: providerWalletLedgerType('CASH_BOOKING_PLATFORM_FEE_DEDUCTED'),
          sourceKey: `earning:${earning.id}:cash-platform-fee-net`,
          amount: -partnerDue.walletDeductionPlatformFeeNetRevenue,
          notes: 'Cash booking prepaid wallet deduction for HANDS platform fee net revenue',
          metadata: {
            ...metadataBase,
            accountingComponent: 'PLATFORM_FEE_NET_REVENUE',
            accountingComponentAmount: partnerDue.platformFeeNetRevenue,
          },
        },
      }),
      tx.providerWalletLedgerEntry.upsert({
        where: { sourceKey: `earning:${earning.id}:cash-company-output-vat` },
        update: {},
        create: {
          ...base,
          type: providerWalletLedgerType('CASH_BOOKING_COMPANY_OUTPUT_VAT_DEDUCTED'),
          sourceKey: `earning:${earning.id}:cash-company-output-vat`,
          amount: -partnerDue.walletDeductionCompanyOutputVat,
          notes: 'Cash booking prepaid wallet deduction for HANDS company output VAT',
          metadata: {
            ...metadataBase,
            accountingComponent: 'COMPANY_OUTPUT_VAT_PAYABLE',
            accountingComponentAmount: partnerDue.companyOutputVat,
          },
        },
      }),
      tx.providerWalletLedgerEntry.upsert({
        where: { sourceKey: `earning:${earning.id}:cash-partner-tax` },
        update: {},
        create: {
          ...base,
          type: providerWalletLedgerType('CASH_BOOKING_PARTNER_TAX_DEDUCTED'),
          sourceKey: `earning:${earning.id}:cash-partner-tax`,
          amount: -partnerDue.walletDeductionPartnerTaxPayable,
          notes: 'Cash booking prepaid wallet deduction for Partner VAT/PIT payable',
          metadata: {
            ...metadataBase,
            accountingComponent: 'PARTNER_VAT_PIT_PAYABLE',
            accountingComponentAmount: partnerDue.partnerTaxPayable,
          },
        },
      }),
    ];
    if (partnerDue.partnerCouponSubsidyPayable > 0) {
      ledgerWrites.push(
        tx.providerWalletLedgerEntry.upsert({
          where: { sourceKey: `earning:${earning.id}:cash-company-coupon-subsidy` },
          update: {},
          create: {
            ...base,
            type: ProviderWalletLedgerType.BOOKING_EARNING,
            sourceKey: `earning:${earning.id}:cash-company-coupon-subsidy`,
            amount: partnerDue.partnerCouponSubsidyPayable,
            notes: 'Company-funded coupon subsidy payable to Partner for a CASH booking',
            metadata: {
              ...metadataBase,
              accountingComponent: 'PARTNER_COUPON_SUBSIDY_PAYABLE',
              accountingComponentAmount: partnerDue.partnerCouponSubsidyPayable,
            },
          },
        }),
      );
    }
    return Promise.all(ledgerWrites);
  }

  private async upsertPaidWalletLedger(
    tx: TxClient,
    earning: {
      id: string;
      providerProfileId: string;
      bookingId: string;
      netAmount: number;
      currency: string;
    },
    input: { payoutBatchId?: string | null; reference?: string | null; notes?: string | null } = {},
  ) {
    if (earning.netAmount === 0) {
      return null;
    }
    const isDebtSettlement = earning.netAmount < 0;
    const sourceKey = input.payoutBatchId
      ? `earning:${earning.id}:payout:${input.payoutBatchId}`
      : `earning:${earning.id}:paid`;
    return this.upsertImmutableProviderWalletLedger(tx, {
      providerProfileId: earning.providerProfileId,
      bookingId: earning.bookingId,
      earningId: earning.id,
      payoutBatchId: input.payoutBatchId ?? null,
      type: isDebtSettlement
        ? ProviderWalletLedgerType.CASH_FEE_DEBT_SETTLED
        : ProviderWalletLedgerType.PAYOUT_PAID,
      sourceKey,
      amount: -earning.netAmount,
      currency: earning.currency,
      reference: cleanOptionalText(input.reference),
      notes: cleanOptionalText(input.notes),
      metadata: {
        earningNetAmount: earning.netAmount,
        payoutBatchId: input.payoutBatchId ?? null,
      },
    });
  }

  private async upsertImmutableProviderWalletLedger(
    client: TxClient | PrismaService,
    data: Prisma.ProviderWalletLedgerEntryUncheckedCreateInput,
  ) {
    const ledger = await client.providerWalletLedgerEntry.upsert({
      where: { sourceKey: data.sourceKey },
      update: {},
      create: data,
    });
    if (!immutableFinancialReplayMatches(ledger, data, PROVIDER_WALLET_LEDGER_REPLAY_FIELDS)) {
      throw new ConflictException(
        'A Partner wallet entry already exists with different financial evidence.',
      );
    }
    return ledger;
  }

  private earningLedgerMetadata(
    earning: {
      grossAmount: number;
      platformFee: number;
      withholdingAmount: number;
    },
    paymentMethod?: PaymentMethod | null,
  ): Prisma.InputJsonObject {
    return {
      paymentMethod: paymentMethod ?? null,
      grossAmount: earning.grossAmount,
      platformFee: earning.platformFee,
      withholdingAmount: earning.withholdingAmount,
    };
  }

  private async calculatePlatformFee(
    tx: TxClient,
    input: {
      grossAmount: number;
      currency: string;
      serviceTypes: string[];
      services: PricedBookingService[];
      occurredAt: Date;
    },
  ) {
    const servicePayoutFee = await this.calculateServicePayoutFee(tx, input);
    if (servicePayoutFee) {
      return servicePayoutFee;
    }

    const policy = await tx.platformFeePolicyVersion.findFirst({
      where: {
        status: TaxPolicyStatus.ACTIVE,
        effectiveFrom: { lte: input.occurredAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.occurredAt } }],
      },
      include: { rules: { where: { active: true }, orderBy: { createdAt: 'desc' } } },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!policy) {
      throw new BadRequestException('No active platform fee policy configured');
    }

    const rule = selectPlatformFeeRule(policy.rules, {
      grossAmount: input.grossAmount,
      serviceTypes: input.serviceTypes,
    });
    if (!rule) {
      throw new BadRequestException('Active platform fee policy has no matching rule');
    }

    const rateBps = rule.rateBps ?? 0;
    const fixedAmount = rule.fixedAmount ?? 0;
    const platformFeeAmount = calculateCappedBpsAmount(input.grossAmount, rateBps, fixedAmount);

    return {
      platformFeeAmount,
      currency: input.currency,
      policyVersionId: policy.id,
      vatRateBps: policy.vatRateBps,
      ruleSnapshot: {
        policyName: policy.name,
        ruleId: rule.id,
        scope: rule.scope,
        serviceType: rule.serviceType,
        minGrossAmount: rule.minGrossAmount,
        maxGrossAmount: rule.maxGrossAmount,
        rateBps,
        fixedAmount,
      },
    };
  }

  private async calculatePaymentFee(
    tx: TxClient,
    input: {
      customerPaymentAmount: number;
      occurredAt: Date;
      paymentMethod: PaymentMethod;
    },
  ) {
    const paymentFeePolicyVersion = transactionPaymentFeePolicyVersion(tx);
    if (!paymentFeePolicyVersion) {
      return defaultPaymentFee({
        method: input.paymentMethod,
        reason: 'PAYMENT_FEE_POLICY_CLIENT_UNAVAILABLE',
      });
    }

    const policy = await paymentFeePolicyVersion.findFirst({
      where: {
        status: TaxPolicyStatus.ACTIVE,
        effectiveFrom: { lte: input.occurredAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.occurredAt } }],
      },
      include: {
        rules: {
          where: { active: true, method: input.paymentMethod },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!policy) {
      return defaultPaymentFee({
        method: input.paymentMethod,
        reason: 'NO_ACTIVE_PAYMENT_FEE_POLICY',
      });
    }

    const rule = policy.rules[0] ?? null;
    if (!rule) {
      return defaultPaymentFee({
        method: input.paymentMethod,
        policyName: policy.name,
        policyVersionId: policy.id,
        reason: 'NO_MATCHING_PAYMENT_FEE_RULE',
      });
    }

    const { fixedAmount, rateBps } = paymentFeeRuleAmounts(rule);
    return {
      fixedAmount,
      payer: rule.payer,
      policyVersionId: policy.id,
      rateBps,
      ruleSnapshot: {
        feeType: rule.feeType,
        fixedAmount,
        method: rule.method,
        payer: rule.payer,
        policyName: policy.name,
        rateBps,
        ruleId: rule.id,
        treatment: rule.treatment,
      },
      treatment: rule.treatment,
    };
  }

  private async calculateServicePayoutFee(
    tx: TxClient,
    input: {
      grossAmount: number;
      currency: string;
      services: PricedBookingService[];
    },
  ) {
    if (input.services.length === 0) {
      return null;
    }

    const payoutRules = input.services.map((service) => bookingServicePayoutSnapshot(service));
    const servicePayoutFee = calculateServicePayoutFeeFromRules({
      grossAmount: input.grossAmount,
      currency: input.currency,
      services: input.services,
      payoutRules,
    });
    if (!servicePayoutFee) {
      throw new BadRequestException('Booking payout snapshot does not match the booked service price');
    }
    return {
      ...servicePayoutFee,
      vatRateBps: servicePayoutVatRateBps(servicePayoutFee.ruleSnapshot),
    };
  }

  private async requireProviderProfile(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        bankAccounts: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            status: true,
            rejectionReason: true,
            reviewedAt: true,
            updatedAt: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }
    return provider;
  }

  private async ensurePayoutEligible(tx: TxClient, providerProfileId: string) {
    const provider = await tx.providerProfile.findUnique({
      where: { id: providerProfileId },
      include: {
        bankAccounts: { where: { status: ProviderBankAccountStatus.APPROVED, deletedAt: null }, take: 1 },
        agreements: true,
      },
    });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }

    await this.ensureNoActivePayoutHold(tx, providerProfileId);
    await this.ensureProviderWalletNonNegative(tx, providerProfileId);

    const completedBookingCount = await tx.booking.count({
      where: { selectedProviderId: providerProfileId, status: BookingStatus.COMPLETED },
    });
    const acceptedAgreementTypes = new Set(provider.agreements.map((agreement) => agreement.type));
    const missingAgreements = REQUIRED_PAYOUT_AGREEMENTS.filter((type) => !acceptedAgreementTypes.has(type));

    if (completedBookingCount < 1) {
      throw new BadRequestException('Partner must complete at least one booking before payout');
    }
    if (!provider.residentialAddress?.trim()) {
      throw new BadRequestException('Partner residential address is required before payout');
    }
    if (provider.bankAccounts.length === 0) {
      throw new BadRequestException('Partner needs an approved bank account before payout');
    }
    if (missingAgreements.length > 0) {
      throw new BadRequestException(`Partner must accept payout agreements: ${missingAgreements.join(', ')}`);
    }
  }

  private providerPayoutInclude() {
    return adminProviderPayoutInclude();
  }

  private async activePayoutHoldForProvider(client: PrismaService | TxClient, providerProfileId: string) {
    return client.providerSanction.findFirst({
      where: activePayoutHoldWhere(providerProfileId),
      orderBy: { startsAt: 'desc' },
    });
  }

  private async ensureNoActivePayoutHold(client: TxClient, providerProfileId: string) {
    const payoutHold = await this.activePayoutHoldForProvider(client, providerProfileId);
    if (payoutHold) {
      throw new BadRequestException(`Partner payout is blocked by active sanction: ${payoutHold.reason}`);
    }
  }

  private async ensureProviderWalletNonNegative(client: TxClient, providerProfileId: string) {
    const walletBalance = await this.providerWalletLedgerBalance(client, providerProfileId);
    if (walletBalance < 0) {
      throwProviderWalletBlocked({ providerProfileId, walletBalance });
    }
  }

  private async ensurePayoutBatchExecutionReady(
    client: TxClient,
    batch: {
      id: string;
      providerProfileId: string;
      totalNetAmount: number;
      currency: string;
      status: PayoutBatchStatus;
      earnings: Array<{
        id: string;
        currency: string;
        netAmount: number;
        status: EarningStatus;
      }>;
    },
  ) {
    const approvedBankAccount = await client.providerBankAccount.findFirst({
      where: {
        providerProfileId: batch.providerProfileId,
        status: ProviderBankAccountStatus.APPROVED,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!approvedBankAccount) {
      throw new BadRequestException('Partner needs an approved bank account before payout');
    }

    if (batch.earnings.length === 0) {
      throw new BadRequestException('Payout batch has no linked earnings');
    }
    if (batch.earnings.some((earning) => earning.status === EarningStatus.CANCELLED)) {
      throw new BadRequestException('Payout batch contains a cancelled earning');
    }
    const payableAmount = batch.earnings.reduce((sum, earning) => sum + earning.netAmount, 0);
    if (
      payableAmount !== batch.totalNetAmount ||
      batch.earnings.some((earning) => earning.currency !== batch.currency)
    ) {
      throw new BadRequestException('Payout batch earning total or currency no longer matches');
    }

    const walletBalance = await this.providerWalletLedgerBalance(client, batch.providerProfileId);
    const pendingWithdrawalAmount = await this.providerPendingWithdrawalAmount(client, batch.providerProfileId);
    const pendingPayoutAmount = await this.providerPendingPayoutAmount(
      client,
      batch.providerProfileId,
      batch.id,
    );
    const availableWalletBalance = walletBalance - pendingWithdrawalAmount - pendingPayoutAmount;
    if (availableWalletBalance < batch.totalNetAmount) {
      throw new BadRequestException('Partner wallet ledger balance cannot cover payout batch');
    }

    if (batch.status !== PayoutBatchStatus.PAID) {
      const existingPaidLedger = await client.providerWalletLedgerEntry.findFirst({
        where: { payoutBatchId: batch.id },
        select: { id: true },
      });
      if (existingPaidLedger) {
        throw new BadRequestException(
          'Payout wallet ledger evidence already exists while the batch is still open',
        );
      }
    }
  }

  private async ensureFinancePostingPeriodOpen(
    client: TxClient,
    occurredAt: Date,
    currency: string,
    actionLabel: string,
  ) {
    const period = settlementMonthlyPeriod(occurredAt);
    const closing = await client.monthlyTaxClosing.findUnique({
      where: { period_currency: { period, currency } },
      select: { status: true },
    });
    if (
      closing?.status === MonthlyTaxClosingStatus.DECLARED ||
      closing?.status === MonthlyTaxClosingStatus.PAID ||
      closing?.status === MonthlyTaxClosingStatus.CLOSED
    ) {
      throw new BadRequestException(
        `${actionLabel} cannot post directly to finalized monthly period ${period}; use a reversal entry in an open period.`,
      );
    }
  }

  private async providerWalletLedgerBalance(client: TxClient, providerProfileId: string) {
    const wallet = await client.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId },
      _sum: { amount: true },
    });
    return wallet._sum.amount ?? 0;
  }

  private async lockProviderWallet(
    client: TxClient,
    providerProfileId: string,
    currency: string,
  ) {
    await client.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${providerProfileId}:${currency}`}, 0))`,
    );
  }

  private async lockProviderPayoutAssignment(client: TxClient, providerProfileId: string) {
    await client.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`provider-payout-assignment:${providerProfileId}`}, 0))`,
    );
  }

  private async lockBookingSettlement(client: TxClient, bookingId: string) {
    await client.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-settlement:${bookingId}`}, 0))`,
    );
  }

  private async lockFinanceMutation(client: TxClient, key: string) {
    await client.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    );
  }

  private async providerPendingPayoutAmount(
    client: TxClient,
    providerProfileId: string,
    excludedPayoutBatchId?: string,
  ) {
    const pending = await client.providerPayoutBatch.aggregate({
      where: {
        providerProfileId,
        status: PayoutBatchStatus.PROCESSING,
        ...(excludedPayoutBatchId ? { id: { not: excludedPayoutBatchId } } : {}),
      },
      _sum: { totalNetAmount: true },
    });
    return pending._sum.totalNetAmount ?? 0;
  }

  private async providerPendingWithdrawalAmount(
    client: TxClient,
    providerProfileId: string,
    excludeRequestId?: string,
  ) {
    const pending = await client.providerWalletWithdrawalRequest.aggregate({
      where: {
        providerProfileId,
        status: { in: [...ACTIVE_WITHDRAWAL_REQUEST_STATUSES] },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      _sum: { amount: true },
    });
    return pending._sum.amount ?? 0;
  }

  private async calculateWithholding(
    tx: TxClient,
    input: {
      providerProfileId: string;
      bookingId: string;
      grossAmount: number;
      currency: string;
      serviceTypes: string[];
      occurredAt: Date;
    },
  ) {
    const [policy, taxProfile] = await Promise.all([
      tx.taxPolicyVersion.findFirst({
        where: {
          status: TaxPolicyStatus.ACTIVE,
          effectiveFrom: { lte: input.occurredAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.occurredAt } }],
        },
        include: { rules: { where: { active: true }, orderBy: { createdAt: 'desc' } } },
        orderBy: { effectiveFrom: 'desc' },
      }),
      tx.providerTaxProfile.findUnique({ where: { providerProfileId: input.providerProfileId } }),
    ]);

    const taxableAmount = input.grossAmount;
    if (!policy || !taxProfile || taxProfile.status !== ProviderTaxProfileStatus.APPROVED) {
      return {
        taxableAmount,
        withholdingAmount: 0,
        partnerVatRateBps: 0,
        partnerPitRateBps: 0,
        partnerVatAmount: 0,
        partnerPitAmount: 0,
        currency: input.currency,
        policyVersionId: policy?.id,
        taxProfileId: taxProfile?.id,
        ruleSnapshot: {
          reason: !policy ? 'NO_ACTIVE_POLICY' : 'NO_APPROVED_TAX_PROFILE',
        },
      };
    }

    const calculation = calculatePartnerTaxWithholding(policy.rules, input);
    const partnerVatLine = calculation.vat;
    const partnerPitLine = calculation.pit;
    const combinedLine = calculation.combined;
    const withholdingAmount = calculation.amount;

    return {
      taxableAmount,
      withholdingAmount,
      partnerVatRateBps: partnerVatLine.rateBps,
      partnerPitRateBps: partnerPitLine.rateBps || combinedLine?.rateBps || 0,
      partnerVatAmount: partnerVatLine.amount,
      partnerPitAmount: partnerPitLine.amount || combinedLine?.amount || 0,
      currency: input.currency,
      policyVersionId: policy.id,
      taxProfileId: taxProfile.id,
      ruleSnapshot: {
        policyName: policy.name,
        lines:
          combinedLine === null
            ? [
                partnerTaxLineSnapshot(PartnerTaxLineKind.PARTNER_VAT, partnerVatLine),
                partnerTaxLineSnapshot(PartnerTaxLineKind.PARTNER_PIT, partnerPitLine),
              ]
            : [partnerTaxLineSnapshot(PartnerTaxLineKind.PARTNER_WITHHOLDING_COMBINED, combinedLine)],
      },
    };
  }

  private async upsertTaxLog(
    tx: TxClient,
    earning: {
      id: string;
      bookingId: string;
      providerProfileId: string;
      grossAmount: number;
    },
    tax: {
      taxableAmount: number;
      withholdingAmount: number;
      currency: string;
      policyVersionId?: string | null;
      taxProfileId?: string | null;
      ruleSnapshot: Prisma.InputJsonValue;
    },
  ) {
    const existing = await tx.providerTaxLog.findFirst({ where: { earningId: earning.id } });
    const data = {
      providerProfileId: earning.providerProfileId,
      bookingId: earning.bookingId,
      earningId: earning.id,
      taxProfileId: tax.taxProfileId ?? null,
      policyVersionId: tax.policyVersionId ?? null,
      grossAmount: earning.grossAmount,
      taxableAmount: tax.taxableAmount,
      withholdingAmount: tax.withholdingAmount,
      currency: tax.currency,
      ruleSnapshot: tax.ruleSnapshot,
    };

    if (existing) {
      return tx.providerTaxLog.update({ where: { id: existing.id }, data });
    }
    return tx.providerTaxLog.create({ data });
  }

  private async upsertPlatformFeeLog(
    tx: TxClient,
    earning: {
      id: string;
      bookingId: string;
      providerProfileId: string;
      grossAmount: number;
    },
    platformFee: {
      platformFeeAmount: number;
      currency: string;
      policyVersionId?: string | null;
      ruleSnapshot: Prisma.InputJsonValue;
    },
  ) {
    const existing = await tx.providerPlatformFeeLog.findFirst({ where: { earningId: earning.id } });
    const data = {
      providerProfileId: earning.providerProfileId,
      bookingId: earning.bookingId,
      earningId: earning.id,
      policyVersionId: platformFee.policyVersionId ?? null,
      grossAmount: earning.grossAmount,
      platformFeeAmount: platformFee.platformFeeAmount,
      currency: platformFee.currency,
      ruleSnapshot: platformFee.ruleSnapshot,
    };

    if (existing) {
      return tx.providerPlatformFeeLog.update({ where: { id: existing.id }, data });
    }
    return tx.providerPlatformFeeLog.create({ data });
  }
}

type PaidDisbursementReversalInput = {
  actorId: string;
  approvalAdminId: string;
  reason: string;
  reversalReference: string;
  occurredAt?: string | Date;
  attachmentFileId?: string | null;
  attachmentUrl?: string | null;
};

type FinanceJournalForReversal = Prisma.AccountingJournalBatchGetPayload<{
  include: { entries: true };
}>;

function assertPaidDisbursementReversalEvidence(input: PaidDisbursementReversalInput) {
  if (input.reason.trim().length < 10) {
    throw new BadRequestException('Disbursement reversal requires a reason of at least 10 characters');
  }
  if (!input.reversalReference.trim()) {
    throw new BadRequestException('Disbursement reversal requires a reversal reference');
  }
  if (!cleanOptionalText(input.attachmentFileId) && !cleanOptionalText(input.attachmentUrl)) {
    throw new BadRequestException('Disbursement reversal requires attached bank evidence');
  }
}

function normalizeFinanceReversalOccurredAt(value?: string | Date) {
  const occurredAt = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw new BadRequestException('Disbursement reversal occurredAt must be a valid date');
  }
  return occurredAt;
}

function providerPayoutBatchReversalLedgerSourceKey(payoutBatchId: string) {
  return `provider-payout-batch:${payoutBatchId}:reversal`;
}

function providerPayoutBatchReversalJournalSourceKey(payoutBatchId: string) {
  return `accounting-journal:provider-payout-batch:${payoutBatchId}:reversal`;
}

function providerWithdrawalReversalLedgerSourceKey(requestId: string) {
  return `provider-wallet-withdrawal:${requestId}:reversal`;
}

function providerWithdrawalReversalJournalSourceKey(requestId: string) {
  return `accounting-journal:provider-withdrawal:${requestId}:reversal`;
}

function financeJournalIsBalancedForAmount(
  journal: FinanceJournalForReversal | null,
  expectedAmount: number,
) {
  if (
    !journal ||
    journal.status !== AccountingJournalBatchStatus.POSTED ||
    journal.totalDebit !== expectedAmount ||
    journal.totalCredit !== expectedAmount
  ) {
    return false;
  }
  const debit = journal.entries
    .filter((entry) => entry.side === AccountingJournalEntrySide.DEBIT)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const credit = journal.entries
    .filter((entry) => entry.side === AccountingJournalEntrySide.CREDIT)
    .reduce((sum, entry) => sum + entry.amount, 0);
  return debit === expectedAmount && credit === expectedAmount;
}

async function requirePostedFinanceJournalForReversal(
  tx: Pick<Prisma.TransactionClient, 'accountingJournalBatch'>,
  sourceKey: string,
  expectedAmount: number,
  currency: string,
) {
  const journal = await tx.accountingJournalBatch.findUnique({
    where: { sourceKey },
    include: { entries: true },
  });
  if (
    !financeJournalIsBalancedForAmount(journal, expectedAmount) ||
    journal?.currency !== currency ||
    journal.entries.some((entry) => entry.currency !== currency)
  ) {
    throw new ConflictException(`Disbursement reversal requires a complete posted journal: ${sourceKey}`);
  }
  return journal;
}

function financeDisbursementReversalMetadata(
  input: PaidDisbursementReversalInput & {
    occurredAt: Date;
    operation: string;
    originalJournalBatchIds: string[];
  },
) {
  return {
    operation: input.operation,
    actorId: input.actorId,
    approvalAdminId: input.approvalAdminId,
    reason: input.reason.trim(),
    reversalReference: input.reversalReference.trim(),
    occurredAt: input.occurredAt.toISOString(),
    originalJournalBatchIds: input.originalJournalBatchIds,
    ...(cleanOptionalText(input.attachmentFileId)
      ? { attachmentFileId: cleanOptionalText(input.attachmentFileId) }
      : {}),
    ...(cleanOptionalText(input.attachmentUrl)
      ? { attachmentUrl: cleanOptionalText(input.attachmentUrl) }
      : {}),
  } satisfies Prisma.InputJsonObject;
}

async function createFinanceDisbursementReversalJournal(
  tx: Pick<Prisma.TransactionClient, 'accountingJournalBatch'>,
  input: {
    actorId: string;
    currency: string;
    metadata: Prisma.InputJsonObject;
    occurredAt: Date;
    originalJournals: FinanceJournalForReversal[];
    providerProfileId: string;
    sourceId: string;
    sourceKey: string;
    sourceType: AccountingJournalSourceType;
  },
) {
  const totalAmount = input.originalJournals.reduce((sum, journal) => sum + journal.totalDebit, 0);
  const entries = input.originalJournals.flatMap((journal) =>
    journal.entries.map((entry) => ({
      side:
        entry.side === AccountingJournalEntrySide.DEBIT
          ? AccountingJournalEntrySide.CREDIT
          : AccountingJournalEntrySide.DEBIT,
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      amount: entry.amount,
      currency: input.currency,
      memo: `Reversal of ${journal.sourceKey}`,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: {
        ...input.metadata,
        reversalOfJournalBatchId: journal.id,
        reversalOfJournalEntryId: entry.id,
      },
    })),
  );
  return tx.accountingJournalBatch.create({
    data: {
      sourceKey: input.sourceKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      providerProfileId: input.providerProfileId,
      currency: input.currency,
      status: AccountingJournalBatchStatus.POSTED,
      totalDebit: totalAmount,
      totalCredit: totalAmount,
      postedAt: input.occurredAt,
      monthlyPeriod: settlementMonthlyPeriod(input.occurredAt),
      createdById: input.actorId,
      metadata: input.metadata,
      entries: { create: entries },
    },
    include: { entries: true },
  });
}

type ProviderWithdrawalJournalPhase = 'LOCK' | 'PAID' | 'RELEASE';

async function upsertProviderPayoutBatchJournal(
  tx: Pick<Prisma.TransactionClient, 'accountingJournalBatch'>,
  input: {
    actorId: string | null;
    amount: number;
    currency: string;
    occurredAt: Date;
    payoutBatchId: string;
    providerProfileId: string;
    transferRef?: string | null;
  },
) {
  const sourceType = AccountingJournalSourceType.PROVIDER_PAYOUT_BATCH;
  const sourceKey = `accounting-journal:provider-payout-batch:${input.payoutBatchId}:paid`;
  const metadata = {
    payoutBatchId: input.payoutBatchId,
    providerProfileId: input.providerProfileId,
    payoutPhase: 'PAID',
    ...(input.transferRef ? { transferRef: input.transferRef } : {}),
  } satisfies Prisma.InputJsonObject;
  const memo = `Partner payout batch paid ${input.payoutBatchId}`;

  return tx.accountingJournalBatch.upsert({
    where: { sourceKey },
    update: {},
    create: {
      sourceKey,
      sourceType,
      sourceId: input.payoutBatchId,
      providerProfileId: input.providerProfileId,
      currency: input.currency,
      status: AccountingJournalBatchStatus.POSTED,
      totalDebit: input.amount,
      totalCredit: input.amount,
      postedAt: input.occurredAt,
      monthlyPeriod: settlementMonthlyPeriod(input.occurredAt),
      createdById: input.actorId,
      metadata,
      entries: {
        create: [
          {
            side: AccountingJournalEntrySide.DEBIT,
            accountCode: 'partner_wallet_liability',
            accountName: 'Partner wallet liability',
            amount: input.amount,
            currency: input.currency,
            memo,
            sourceType,
            sourceId: input.payoutBatchId,
            metadata,
          },
          {
            side: AccountingJournalEntrySide.CREDIT,
            accountCode: 'company_bank_cash',
            accountName: 'Company bank / cash',
            amount: input.amount,
            currency: input.currency,
            memo,
            sourceType,
            sourceId: input.payoutBatchId,
            metadata,
          },
        ],
      },
    },
  });
}

async function upsertProviderWithdrawalJournal(
  tx: Pick<Prisma.TransactionClient, 'accountingJournalBatch'>,
  input: {
    actorId: string;
    amount: number;
    currency: string;
    occurredAt: Date;
    phase: ProviderWithdrawalJournalPhase;
    providerProfileId: string;
    requestId: string;
    transferRef?: string | null;
  },
) {
  const sourceType = AccountingJournalSourceType.PROVIDER_WITHDRAWAL;
  const sourceKey = `accounting-journal:provider-withdrawal:${input.requestId}:${input.phase.toLowerCase()}`;
  const metadata = {
    providerProfileId: input.providerProfileId,
    withdrawalRequestId: input.requestId,
    withdrawalPhase: input.phase,
    ...(input.transferRef ? { transferRef: input.transferRef } : {}),
  } satisfies Prisma.InputJsonObject;
  const [debitAccountCode, debitAccountName, creditAccountCode, creditAccountName] =
    input.phase === 'LOCK'
      ? [
          'partner_wallet_liability',
          'Partner wallet liability',
          'partner_withdrawal_payable',
          'Partner withdrawal payable',
        ]
      : input.phase === 'PAID'
        ? [
            'partner_withdrawal_payable',
            'Partner withdrawal payable',
            'company_bank_cash',
            'Company bank / cash',
          ]
        : [
            'partner_withdrawal_payable',
            'Partner withdrawal payable',
            'partner_wallet_liability',
            'Partner wallet liability',
          ];
  const memo = `Partner withdrawal ${input.phase.toLowerCase()} ${input.requestId}`;
  const entries = [
    {
      accountCode: debitAccountCode,
      accountName: debitAccountName,
      amount: input.amount,
      currency: input.currency,
      memo,
      metadata,
      side: AccountingJournalEntrySide.DEBIT,
      sourceId: input.requestId,
      sourceType,
    },
    {
      accountCode: creditAccountCode,
      accountName: creditAccountName,
      amount: input.amount,
      currency: input.currency,
      memo,
      metadata,
      side: AccountingJournalEntrySide.CREDIT,
      sourceId: input.requestId,
      sourceType,
    },
  ];
  const batch = {
    createdById: input.actorId,
    currency: input.currency,
    entries: { create: entries },
    metadata,
    monthlyPeriod: settlementMonthlyPeriod(input.occurredAt),
    postedAt: input.occurredAt,
    providerProfileId: input.providerProfileId,
    sourceId: input.requestId,
    sourceType,
    status: AccountingJournalBatchStatus.POSTED,
    totalCredit: input.amount,
    totalDebit: input.amount,
  };

  return tx.accountingJournalBatch.upsert({
    where: { sourceKey },
    update: {},
    create: { ...batch, sourceKey },
  });
}

function normalizeNullable(value: string | null) {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 240) : null;
}

function paidRefundReceivablePayoutEvidence(earning: {
  payoutBatchId?: string | null;
  payoutBatch?: {
    id: string;
    paidAt: Date | null;
    status: PayoutBatchStatus;
    transferRef: string | null;
  } | null;
}) {
  const payoutBatchId = earning.payoutBatch?.id ?? earning.payoutBatchId ?? null;
  const reference = cleanOptionalText(earning.payoutBatch?.transferRef ?? null);
  const metadata: Record<string, Prisma.InputJsonValue> = {};

  if (payoutBatchId) {
    metadata.payoutBatchId = payoutBatchId;
  }
  if (earning.payoutBatch?.status) {
    metadata.payoutBatchStatus = earning.payoutBatch.status;
  }
  if (reference) {
    metadata.payoutTransferRef = reference;
  }
  if (earning.payoutBatch?.paidAt) {
    metadata.payoutPaidAt = earning.payoutBatch.paidAt.toISOString();
  }

  return {
    metadata: metadata as Prisma.InputJsonObject,
    payoutBatchId,
    reference,
  };
}

function payoutStatusChanged(
  currentStatus: PayoutBatchStatus,
  nextStatus: PayoutBatchStatus | undefined,
): nextStatus is PayoutBatchStatus {
  return nextStatus !== undefined && currentStatus !== nextStatus;
}

function payoutBatchNotificationBody(status: PayoutBatchStatus) {
  if (status === PayoutBatchStatus.PAID) {
    return 'Your payout batch was marked paid. Check the payout screen for details.';
  }
  if (status === PayoutBatchStatus.FAILED) {
    return 'Your payout batch needs follow-up. Check the payout screen for details.';
  }
  if (status === PayoutBatchStatus.CANCELLED) {
    return 'Your payout batch was cancelled. Check the payout screen for details.';
  }
  if (status === PayoutBatchStatus.PROCESSING) {
    return 'Your payout batch is being processed.';
  }
  return 'Your payout batch was updated.';
}

function activePayoutHoldWhere(providerProfileId?: string): Prisma.ProviderSanctionWhereInput {
  return {
    ...(providerProfileId ? { providerProfileId } : {}),
    type: ProviderSanctionType.PAYOUT_HOLD,
    status: ProviderSanctionStatus.ACTIVE,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

function servicePayoutVatRateBps(ruleSnapshot: Prisma.InputJsonValue) {
  if (!ruleSnapshot || typeof ruleSnapshot !== 'object' || Array.isArray(ruleSnapshot)) {
    return 0;
  }
  const lines = (ruleSnapshot as { lines?: Array<{ vatBps?: number }> }).lines;
  const firstLine = Array.isArray(lines) ? lines.find((line) => typeof line.vatBps === 'number') : null;
  return firstLine?.vatBps ?? 0;
}

function transactionPaymentFeePolicyVersion(tx: TxClient) {
  return (
    tx as TxClient & {
      paymentFeePolicyVersion?: TxClient['paymentFeePolicyVersion'];
    }
  ).paymentFeePolicyVersion;
}

function defaultPaymentFee(input: {
  method: PaymentMethod;
  policyName?: string | null;
  policyVersionId?: string | null;
  reason: string;
}) {
  return {
    fixedAmount: 0,
    payer: PaymentFeePayer.HANDS,
    policyVersionId: input.policyVersionId ?? null,
    rateBps: 0,
    ruleSnapshot: {
      method: input.method,
      policyName: input.policyName ?? null,
      reason: input.reason,
    },
    treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
  };
}

function paymentFeeRuleAmounts(rule: PaymentFeeRuleRecord) {
  if (rule.feeType === PaymentFeeRuleType.FIXED) {
    return { fixedAmount: rule.fixedAmount ?? 0, rateBps: 0 };
  }
  if (rule.feeType === PaymentFeeRuleType.RATE) {
    return { fixedAmount: 0, rateBps: rule.rateBps ?? 0 };
  }
  return {
    fixedAmount: rule.fixedAmount ?? 0,
    rateBps: rule.rateBps ?? 0,
  };
}

function providerWalletLedgerType(value: string): ProviderWalletLedgerType {
  return value as ProviderWalletLedgerType;
}

function jsonObjectOrEmpty(value: Prisma.JsonValue | null | undefined): Prisma.InputJsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.InputJsonObject;
  }
  return {};
}

function aggregateAmount(result: { _sum?: { amount?: number | null } | null }) {
  return result._sum?.amount ?? 0;
}

function providerWalletWithdrawalRequestStatusChangeMetadata(input: {
  adminId: string;
  amount: number;
  changedAt: Date;
  currency: string;
  nextStatus: ProviderWalletWithdrawalRequestStatus;
  previousStatus: ProviderWalletWithdrawalRequestStatus;
}): Prisma.InputJsonObject {
  const previousStatusWasActive = isActiveWithdrawalRequestStatus(input.previousStatus);
  const nextStatusKeepsLock = isActiveWithdrawalRequestStatus(input.nextStatus);
  const lockedAmountReleased = previousStatusWasActive && isReleasedWithdrawalRequestStatus(input.nextStatus);

  return {
    previousStatus: input.previousStatus,
    nextStatus: input.nextStatus,
    changedAt: input.changedAt.toISOString(),
    changedByAdminId: input.adminId,
    amount: input.amount,
    currency: input.currency,
    lockedAmountReleased,
    lockedAmountRetained: previousStatusWasActive && nextStatusKeepsLock,
    releasedAmount: lockedAmountReleased ? input.amount : 0,
  };
}

function isActiveWithdrawalRequestStatus(status: ProviderWalletWithdrawalRequestStatus) {
  return ACTIVE_WITHDRAWAL_REQUEST_STATUSES.includes(
    status as (typeof ACTIVE_WITHDRAWAL_REQUEST_STATUSES)[number],
  );
}

function isReleasedWithdrawalRequestStatus(status: ProviderWalletWithdrawalRequestStatus) {
  return RELEASED_WITHDRAWAL_REQUEST_STATUSES.includes(
    status as (typeof RELEASED_WITHDRAWAL_REQUEST_STATUSES)[number],
  );
}

function partnerBankDepositSourceKey(providerProfileId: string, bankTransactionId: string) {
  return `partner-bank-deposit:${providerProfileId}:${bankTransactionId}`;
}

function partnerWalletWithdrawalPaidSourceKey(requestId: string) {
  return `partner-wallet-withdrawal:${requestId}:paid`;
}

function partnerTaxLineSnapshot(
  taxKind: PartnerTaxLineKind,
  line: ReturnType<typeof calculatePartnerTaxLine> | null,
) {
  return {
    taxKind,
    amount: line?.amount ?? 0,
    ruleId: line?.rule?.id ?? null,
    scope: line?.rule?.scope ?? 'NONE',
    serviceType: line?.rule?.serviceType ?? null,
    minGrossAmount: line?.rule?.minGrossAmount ?? null,
    maxGrossAmount: line?.rule?.maxGrossAmount ?? null,
    rateBps: line?.rateBps ?? 0,
    fixedAmount: line?.fixedAmount ?? 0,
  };
}

function selectPlatformFeeRule(
  rules: PlatformFeeRuleRecord[],
  input: { grossAmount: number; serviceTypes: string[] },
) {
  const serviceTypes = new Set(input.serviceTypes.map((value) => value.toLowerCase()));
  const prioritized = [...rules].sort(
    (left, right) =>
      platformFeeRulePriority(right, serviceTypes, input.grossAmount) -
      platformFeeRulePriority(left, serviceTypes, input.grossAmount),
  );
  return (
    prioritized.find((rule) => platformFeeRulePriority(rule, serviceTypes, input.grossAmount) > 0) ?? null
  );
}

function platformFeeRulePriority(
  rule: PlatformFeeRuleRecord,
  serviceTypes: Set<string>,
  grossAmount: number,
) {
  if (rule.scope === TaxRuleScope.SERVICE_TYPE) {
    return rule.serviceType && serviceTypes.has(rule.serviceType.toLowerCase()) ? 30 : 0;
  }
  if (rule.scope === TaxRuleScope.AMOUNT_BAND) {
    const aboveMin = rule.minGrossAmount === null || grossAmount >= rule.minGrossAmount;
    const belowMax = rule.maxGrossAmount === null || grossAmount <= rule.maxGrossAmount;
    return aboveMin && belowMax ? 20 : 0;
  }
  if (rule.scope === TaxRuleScope.DEFAULT) {
    return 10;
  }
  return 0;
}
