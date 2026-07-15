import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  AccountingJournalBatchStatus,
  AccountingJournalEntrySide,
  AccountingJournalSourceType,
  BankReconciliationStatus,
  PartnerTaxLineKind,
  BookingStatus,
  EarningStatus,
  PaymentFeePayer,
  PaymentFeeRuleType,
  PaymentFeeTreatment,
  PaymentMethod,
  PayoutBatchStatus,
  Prisma,
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
import { REQUIRED_PAYOUT_AGREEMENTS } from '../provider-onboarding/provider-onboarding.policy';
import { bookingServiceAmount, buildCouponSettlementContext } from '../settlements/coupon-settlement';
import { analyzeHistoricalSettlementEvidence } from '../settlements/historical-settlement-reconstruction';
import { settlementMonthlyPeriod, SettlementsService } from '../settlements/settlements.service';
import {
  allocatePartnerBankDeposit,
  calculateCashBookingPartnerDue,
  calculateProviderWalletDelta,
  calculateServicePayoutFeeFromRules,
  normalizePartnerBankDepositInput,
  normalizeProviderWalletWithdrawalRequestInput,
  normalizeProviderWalletWithdrawalRequestUpdateInput,
  normalizeCashFeeDebtSettlementInput,
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

type TaxPolicyWithRules = Prisma.TaxPolicyVersionGetPayload<{ include: { rules: true } }>;
type TaxRuleRecord = TaxPolicyWithRules['rules'][number];
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
};

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
  readonly q?: string | null;
  readonly queue?: string | null;
  readonly range?: string | null;
  readonly review?: string | null;
  readonly skip?: number | string | null;
  readonly take?: number | string | null;
};

type AdminWithdrawalRequestListQuery = AdminFinanceListQuery & {
  readonly providerProfileId?: string | null;
  readonly reconciliation?: string | null;
  readonly status?: ProviderWalletWithdrawalRequestStatus | string | null;
};

const ADMIN_FINANCE_LIST_DEFAULT_LIMIT = 50;
const ADMIN_FINANCE_LIST_MAX_LIMIT = 100;
const CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD = 500_000;
const CASH_SETTLEMENT_STALE_MS = 24 * 60 * 60 * 1000;
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

function cashSettlementDebtListWhere(options: AdminFinanceListQuery): Prisma.ProviderEarningWhereInput {
  const where = cashSettlementDebtWhere();
  const dateRange = adminFinanceDateRangeWhere(options.range);
  const queueWhere = cashSettlementQueueWhere(options.queue);
  const searchWhere = cashSettlementSearchWhere(options.q);

  if (dateRange) {
    where.createdAt = dateRange;
  }
  appendProviderEarningAndWhere(where, queueWhere);
  appendProviderEarningAndWhere(where, searchWhere);

  return where;
}

function appendProviderEarningAndWhere(
  where: Prisma.ProviderEarningWhereInput,
  next: Prisma.ProviderEarningWhereInput | null,
) {
  if (!next) {
    return;
  }

  const existing = where.AND;
  const existingItems = Array.isArray(existing) ? existing : existing ? [existing] : [];
  where.AND = [...existingItems, next];
}

function mergeProviderEarningWhere(
  base: Prisma.ProviderEarningWhereInput,
  next: Prisma.ProviderEarningWhereInput,
): Prisma.ProviderEarningWhereInput {
  return { AND: [base, next] };
}

function cashSettlementQueueWhere(queue: string | null | undefined): Prisma.ProviderEarningWhereInput | null {
  switch (normalizeOptionalQuery(queue)) {
    case 'stale':
      return { createdAt: { lte: new Date(Date.now() - CASH_SETTLEMENT_STALE_MS) } };
    case 'high-debt':
      return { netAmount: { lte: -CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD } };
    case 'missing-ref':
      return {
        settlementRef: null,
        walletLedgerEntries: { none: { reference: { not: null } } },
      };
    case 'payment-check':
      return {
        OR: [
          { booking: { is: { payment: { is: null } } } },
          { booking: { is: { payment: { is: { method: { not: PaymentMethod.CASH } } } } } },
        ],
      };
    default:
      return null;
  }
}

function cashSettlementSearchWhere(q: string | null | undefined): Prisma.ProviderEarningWhereInput | null {
  const query = cleanQueryText(q);
  if (!query) {
    return null;
  }

  const textFilter = { contains: query, mode: Prisma.QueryMode.insensitive };

  return {
    OR: [
      { id: textFilter },
      { bookingId: textFilter },
      { providerProfileId: textFilter },
      { settlementRef: textFilter },
      { settlementNotes: textFilter },
      { providerProfile: { is: { displayName: textFilter } } },
      { providerProfile: { is: { user: { is: { fullName: textFilter } } } } },
      { providerProfile: { is: { user: { is: { phone: textFilter } } } } },
      { walletLedgerEntries: { some: { reference: textFilter } } },
    ],
  };
}

function adminEarningListWhere(options: AdminFinanceListQuery): Prisma.ProviderEarningWhereInput | undefined {
  const where = adminEarningReviewWhere(options.review) ?? {};
  const dateRange = adminFinanceDateRangeWhere(options.range);

  if (dateRange) {
    where.createdAt = dateRange;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function adminPayoutBatchListWhere(
  options: AdminFinanceListQuery,
): Prisma.ProviderPayoutBatchWhereInput | undefined {
  const where = adminPayoutBatchReviewWhere(options.review) ?? {};
  const dateRange = adminFinanceDateRangeWhere(options.range);

  if (dateRange) {
    where.createdAt = dateRange;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

function adminWithdrawalRequestListWhere(
  options: AdminWithdrawalRequestListQuery,
): Prisma.ProviderWalletWithdrawalRequestWhereInput | undefined {
  const where: Prisma.ProviderWalletWithdrawalRequestWhereInput = {};
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
        OR: [
          { netAmount: { lte: 0 } },
          { booking: { is: { status: { not: BookingStatus.COMPLETED } } } },
        ],
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

function normalizeWithdrawalRequestStatus(
  value: ProviderWalletWithdrawalRequestStatus | string | null | undefined,
) {
  if (!value) {
    return null;
  }
  const status = String(value).trim().toUpperCase() as ProviderWalletWithdrawalRequestStatus;
  return Object.values(ProviderWalletWithdrawalRequestStatus).includes(status) ? status : null;
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
    options: { preserveExistingLifecycle?: boolean } = {},
  ) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
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
    }));

    return this.prisma.$transaction(async (tx) => {
      const existingEarning = options.preserveExistingLifecycle
        ? await tx.providerEarning.findUnique({
            where: { bookingId },
            select: { id: true },
          })
        : null;
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
        update: {
          providerProfileId,
          grossAmount,
          platformFee: platformFee.platformFeeAmount,
          withholdingAmount: tax.withholdingAmount,
          netAmount,
          currency,
          ...(!existingEarning
            ? {
                status: EarningStatus.PENDING,
                availableAt,
              }
            : {}),
        },
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
      const platformFeeGross = Math.max(
        0,
        grossAmount - partnerPayoutAmount - tax.withholdingAmount,
      );

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
    });
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
      marketplaceJoinBlocked: false,
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

  listCashSettlementDebtForAdmin(options: AdminFinanceListQuery = {}) {
    const where = cashSettlementDebtListWhere(options);
    const skip = adminFinanceListSkip(options.skip);

    return this.prisma.providerEarning.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { netAmount: 'asc' }],
      take: adminFinanceListTake(options.take),
      ...(skip > 0 ? { skip } : {}),
      include: adminCashSettlementEarningListInclude,
    });
  }

  async cashSettlementSummaryForAdmin(options: AdminFinanceListQuery = {}) {
    const where = cashSettlementDebtListWhere(options);
    const now = Date.now();
    const staleCutoffAt = new Date(now - CASH_SETTLEMENT_STALE_MS);
    const [
      amountSummary,
      rowCount,
      providerSummaryRows,
      staleDebtRowCount,
      missingPaymentEvidenceCount,
      cashPaymentRowCount,
      companyCouponOffsetEntries,
    ] = await Promise.all([
      this.prisma.providerEarning.aggregate({
        where,
        _min: { createdAt: true },
        _sum: { netAmount: true, platformFee: true, withholdingAmount: true },
      }),
      this.prisma.providerEarning.count({ where }),
      this.prisma.providerEarning.groupBy({
        by: ['providerProfileId', 'currency'],
        where,
        _count: { _all: true },
        _sum: { netAmount: true, platformFee: true, withholdingAmount: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      this.prisma.providerEarning.count({
        where: mergeProviderEarningWhere(where, { createdAt: { lte: staleCutoffAt } }),
      }),
      this.prisma.providerEarning.count({
        where: mergeProviderEarningWhere(where, { booking: { is: { payment: { is: null } } } }),
      }),
      this.prisma.providerEarning.count({
        where: mergeProviderEarningWhere(where, {
          booking: { is: { payment: { is: { method: PaymentMethod.CASH } } } },
        }),
      }),
      this.prisma.providerWalletLedgerEntry.findMany({
        where: {
          earning: { is: where },
          type: ProviderWalletLedgerType.CASH_BOOKING_PLATFORM_FEE_DEDUCTED,
          metadata: { path: ['cashBookingCompanyCouponExpense'], not: Prisma.JsonNull },
        },
        select: { metadata: true },
      }),
    ]);

    const sortedProviderSummaryRows = providerSummaryRows
      .map((row) => ({
        providerProfileId: row.providerProfileId,
        currency: row.currency,
        rowCount: row._count._all,
        debtAmount: Math.abs(row._sum.netAmount ?? 0),
        platformFee: row._sum.platformFee ?? 0,
        taxAmount: row._sum.withholdingAmount ?? 0,
        oldestOpenAt: row._min.createdAt ?? new Date(0),
        latestOpenAt: row._max.createdAt ?? new Date(0),
        settlementReference: providerWalletSettlementReference(row.providerProfileId),
      }))
      .sort((left, right) => right.debtAmount - left.debtAmount);
    const topProviderProfileIds = sortedProviderSummaryRows
      .slice(0, 20)
      .map((group) => group.providerProfileId);
    const providerProfiles = topProviderProfileIds.length
      ? await this.prisma.providerProfile.findMany({
          where: { id: { in: topProviderProfileIds } },
          select: {
            id: true,
            displayName: true,
            user: { select: { fullName: true, phone: true } },
          },
        })
      : [];
    const providerProfileById = new Map(providerProfiles.map((profile) => [profile.id, profile]));
    const sortedProviderGroups = sortedProviderSummaryRows.map((group) => {
      const profile = providerProfileById.get(group.providerProfileId);
      return {
        ...group,
        providerName: profile?.displayName ?? profile?.user?.fullName ?? 'Unknown partner',
        providerPhone: profile?.user?.phone ?? null,
      };
    });
    const oldestOpenAt = amountSummary._min.createdAt ?? null;
    const totalCompanyCouponOffset = companyCouponOffsetEntries.reduce(
      (sum, entry) =>
        sum + cashSettlementCompanyCouponOffset({ walletLedgerEntries: [{ metadata: entry.metadata }] }),
      0,
    );

    const highDebtProviderCount = sortedProviderGroups.filter(
      (group) => group.debtAmount >= CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
    ).length;

    return {
      generatedAt: new Date(),
      currency: sortedProviderSummaryRows[0]?.currency ?? 'VND',
      rowCount,
      providerCount: providerSummaryRows.length,
      totalCompanyCouponOffset,
      totalDebtAmount: Math.abs(amountSummary._sum.netAmount ?? 0),
      totalPlatformFee: amountSummary._sum.platformFee ?? 0,
      totalTaxAmount: amountSummary._sum.withholdingAmount ?? 0,
      oldestOpenAt,
      oldestOpenAgeMinutes: oldestOpenAt
        ? Math.max(0, Math.round((now - oldestOpenAt.getTime()) / 60_000))
        : 0,
      staleDebtRowCount,
      highDebtProviderCount,
      missingPaymentEvidenceCount,
      cashPaymentRowCount,
      topProviderGroups: sortedProviderGroups.slice(0, 20),
    };
  }

  adminSummary(options: AdminFinanceListQuery = {}) {
    return this.summaryWhere(adminEarningListWhere(options) ?? {});
  }

  async markPaid(
    earningId: string,
    input: {
      settlementRef?: string | null;
      settlementNotes?: string | null;
      settlementMethod?: string | null;
    } = {},
  ) {
    const earning = await this.prisma.providerEarning.findUnique({ where: { id: earningId } });
    if (!earning) {
      throw new NotFoundException('Earning not found');
    }
    const { settlementRef, settlementNotes, settlementMethod } = normalizeCashFeeDebtSettlementInput({
      netAmount: earning.netAmount,
      settlementRef: input.settlementRef,
      settlementNotes: input.settlementNotes,
      settlementMethod: input.settlementMethod,
    });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.providerEarning.update({
        where: { id: earningId },
        data: {
          status: EarningStatus.PAID,
          paidAt: new Date(),
          settlementRef,
          settlementNotes,
          settlementMethod,
        },
      });
      await this.upsertPaidWalletLedger(tx, updated, {
        reference: settlementRef,
        notes: settlementNotes,
      });
      return updated;
    });
  }

  async recordPartnerBankDeposit(
    input: PartnerBankDepositInput,
    transaction?: Prisma.TransactionClient,
  ) {
    const deposit = normalizePartnerBankDepositInput(input);
    const sourceKey = partnerBankDepositSourceKey(deposit.providerProfileId, deposit.bankTransactionId);

    const recordDeposit = async (tx: Prisma.TransactionClient) => {
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
  }) {
    const provider = await this.prisma.providerProfile.findUnique({ where: { id: input.providerProfileId } });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }

    return this.prisma.$transaction(async (tx) => {
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

      await tx.providerEarning.updateMany({
        where: { id: { in: earnings.map((earning) => earning.id) } },
        data: {
          payoutBatchId: batch.id,
        },
      });
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

      return tx.providerPayoutBatch.findUniqueOrThrow({
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
    });
  }

  listPayoutBatchesForAdmin(options: AdminFinanceListQuery = {}) {
    const where = adminPayoutBatchListWhere(options);
    const skip = adminFinanceListSkip(options.skip);

    return this.prisma.providerPayoutBatch.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: 'desc' },
      ...(skip > 0 ? { skip } : {}),
      take: adminFinanceListTake(options.take),
      include: adminPayoutBatchListInclude(),
    });
  }

  async payoutBatchSummaryForAdmin(options: AdminFinanceListQuery = {}) {
    const where = adminPayoutBatchListWhere(options);
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
    ]);

    return {
      generatedAt: new Date().toISOString(),
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
    };
  }

  async updatePayoutBatch(
    payoutBatchId: string,
    input: { status?: PayoutBatchStatus; transferRef?: string | null; notes?: string | null },
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

    const updated = await this.prisma.$transaction(async (tx) => {
      if (nextStatus === PayoutBatchStatus.PROCESSING || nextStatus === PayoutBatchStatus.PAID) {
        await this.ensureNoActivePayoutHold(tx, existing.providerProfileId);
        await this.ensureProviderWalletNonNegative(tx, existing.providerProfileId);
      }
      const paidAt = nextStatus === PayoutBatchStatus.PAID ? (existing.paidAt ?? new Date()) : undefined;
      const batch = await tx.providerPayoutBatch.update({
        where: { id: payoutBatchId },
        data: {
          status: nextStatus,
          transferRef: input.transferRef === undefined ? undefined : nextTransferRef,
          notes: input.notes === undefined ? undefined : normalizeNullable(input.notes),
          paidAt,
        },
      });

      if (nextStatus === PayoutBatchStatus.PAID) {
        await tx.providerEarning.updateMany({
          where: {
            payoutBatchId,
            status: { not: EarningStatus.CANCELLED },
          },
          data: {
            status: EarningStatus.PAID,
            paidAt: batch.paidAt,
          },
        });
        await tx.withholdingLog.updateMany({
          where: { payoutBatchId },
          data: { status: 'PAID' },
        });
        for (const earning of existing.earnings) {
          await this.upsertPaidWalletLedger(tx, earning, {
            payoutBatchId,
            reference: batch.transferRef,
            notes: batch.notes ?? `Payout batch ${batch.id} paid`,
          });
        }
      }

      return tx.providerPayoutBatch.findUniqueOrThrow({
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
    });
    const changedStatus = payoutStatusChanged(existing.status, nextStatus) ? nextStatus : undefined;
    await this.notifyPayoutBatchUpdated(updated, changedStatus);
    return updated;
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
      orderBy: { createdAt: 'desc' },
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
    options: Omit<AdminWithdrawalRequestListQuery, 'status' | 'take'> = {},
  ) {
    const where = adminWithdrawalRequestListWhere({ ...options, status: null });
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
      this.prisma.providerWalletWithdrawalRequest.count(
        withdrawalRequestCountArgs(paidUnreconciledWhere),
      ),
      this.prisma.providerWalletWithdrawalRequest.aggregate(
        withdrawalRequestAmountAggregateArgs(paidUnreconciledWhere),
      ),
      this.prisma.providerWalletWithdrawalRequest.count(
        withdrawalRequestCountArgs(paidReconciledWhere),
      ),
      this.prisma.providerWalletWithdrawalRequest.aggregate(
        withdrawalRequestAmountAggregateArgs(paidReconciledWhere),
      ),
    ]);

    return {
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
      const availableWalletBalance = currentWalletBalance - pendingWithdrawalAmount;
      if (request.amount > availableWalletBalance) {
        throw new BadRequestException('Withdrawal amount exceeds available partner wallet balance');
      }

      const created = await tx.providerWalletWithdrawalRequest.create({
        data: {
          providerProfileId: provider.id,
          bankAccountId: bankAccount.id,
          amount: request.amount,
          currency: 'VND',
          status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
          requestNote: request.requestNote,
          metadata: {
            currentWalletBalance,
            pendingWithdrawalAmount,
            availableWalletBalance,
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
  ) {
    const existing = await this.prisma.providerWalletWithdrawalRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) {
      throw new NotFoundException('Partner wallet withdrawal request not found');
    }
    const update = normalizeProviderWalletWithdrawalRequestUpdateInput({
      ...input,
      currentStatus: existing.status,
    });
    const shouldMarkPaid =
      update.status === ProviderWalletWithdrawalRequestStatus.PAID &&
      existing.status !== ProviderWalletWithdrawalRequestStatus.PAID;
    const reviewedAt = new Date();
    const nextTransferRef = update.transferRef ?? existing.transferRef;
    const nextAdminNote = update.adminNote ?? existing.adminNote;
    const bankPayoutMetadata = shouldMarkPaid
      ? {
          transferRef: nextTransferRef,
          bankTransferDate: update.bankTransferDate?.toISOString(),
          attachmentFileId: update.attachmentFileId,
          attachmentUrl: update.attachmentUrl,
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
      bankPayoutMetadata || statusChangeMetadata
        ? {
            ...jsonObjectOrEmpty(existing.metadata),
            ...(bankPayoutMetadata ? { bankPayout: bankPayoutMetadata } : {}),
            ...(statusChangeMetadata ? { lastStatusChange: statusChangeMetadata } : {}),
          }
        : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (shouldMarkPaid) {
        const currentWalletBalance = await this.providerWalletLedgerBalance(tx, existing.providerProfileId);
        if (existing.amount > currentWalletBalance) {
          throw new BadRequestException('Withdrawal amount exceeds partner wallet balance');
        }
        const pendingWithdrawalAmount = await this.providerPendingWithdrawalAmount(
          tx,
          existing.providerProfileId,
          existing.id,
        );
        const availableWalletBalance = currentWalletBalance - pendingWithdrawalAmount;
        if (existing.amount > availableWalletBalance) {
          throw new BadRequestException('Withdrawal amount exceeds available partner wallet balance');
        }
        await tx.providerWalletLedgerEntry.upsert({
          where: { sourceKey: partnerWalletWithdrawalPaidSourceKey(existing.id) },
          update: {
            amount: -existing.amount,
            currency: existing.currency,
            reference: nextTransferRef,
            notes: nextAdminNote,
            metadata: {
              withdrawalRequestId: existing.id,
              adminId,
              bankPayout: bankPayoutMetadata,
            },
          },
          create: {
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
      } else if (statusChangeMetadata?.lockedAmountReleased) {
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

      return tx.providerWalletWithdrawalRequest.update({
        where: { id: existing.id },
        data: {
          ...(update.status ? { status: update.status } : {}),
          transferRef: nextTransferRef,
          adminNote: nextAdminNote,
          correctionReason: update.correctionReason ?? existing.correctionReason,
          reviewedByAdminId: adminId,
          reviewedAt,
          ...(shouldMarkPaid ? { paidAt: reviewedAt } : {}),
          ...(nextMetadata ? { metadata: nextMetadata } : {}),
        },
        include: {
          providerProfile: {
            include: {
              user: { select: { id: true, phone: true, fullName: true } },
            },
          },
          bankAccount: true,
        },
      });
    });
  }

  async cancelForRefund(bookingId: string, transactionClient?: TxClient) {
    const client = transactionClient ?? this.prisma;
    const earning = await client.providerEarning.findUnique({
      where: { bookingId },
      include: {
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
        await tx.providerWalletLedgerEntry.upsert({
          where: { sourceKey: `earning:${earning.id}:paid-refund-receivable` },
          update: {
            amount: -receivableAmount,
            currency: earning.currency,
            ...(payoutEvidence.payoutBatchId ? { payoutBatchId: payoutEvidence.payoutBatchId } : {}),
            ...(payoutEvidence.reference ? { reference: payoutEvidence.reference } : {}),
            notes: 'Paid earning converted to partner receivable by refund workflow',
            metadata,
          },
          create: {
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
          },
        });
      };
      if (transactionClient) {
        await createReceivableLedger(transactionClient);
      } else {
        await this.prisma.$transaction(async (tx) => createReceivableLedger(tx));
      }

      return {
        skipped: false,
        reason: 'PAID_REFUND_RECEIVABLE_CREATED',
        earning,
        receivableAmount,
      };
    }

    const cancelUnpaidEarning = async (tx: TxClient | PrismaService) => {
      const updated = await tx.providerEarning.update({
        where: { bookingId },
        data: {
          status: EarningStatus.CANCELLED,
          netAmount: 0,
        },
      });
      await tx.providerWalletLedgerEntry.upsert({
        where: { sourceKey: `earning:${earning.id}:refund-reversal` },
        update: {
          amount: -earning.netAmount,
          currency: earning.currency,
          notes: 'Unpaid earning cancelled by refund workflow',
          metadata: { previousNetAmount: earning.netAmount },
        },
        create: {
          providerProfileId: earning.providerProfileId,
          bookingId: earning.bookingId,
          earningId: earning.id,
          type: ProviderWalletLedgerType.REFUND_REVERSAL,
          sourceKey: `earning:${earning.id}:refund-reversal`,
          amount: -earning.netAmount,
          currency: earning.currency,
          notes: 'Unpaid earning cancelled by refund workflow',
          metadata: { previousNetAmount: earning.netAmount },
        },
      });
      return updated;
    };
    const cancelled = transactionClient
      ? await cancelUnpaidEarning(transactionClient)
      : await this.prisma.$transaction(async (tx) => cancelUnpaidEarning(tx));

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
      update: {
        amount: earning.netAmount,
        currency: earning.currency,
        metadata: this.earningLedgerMetadata(earning, paymentMethod),
      },
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
    } satisfies Prisma.InputJsonObject;

    return Promise.all([
      tx.providerWalletLedgerEntry.upsert({
        where: { sourceKey: `earning:${earning.id}:cash-platform-fee-net` },
        update: {
          amount: -partnerDue.walletDeductionPlatformFeeNetRevenue,
          currency: earning.currency,
          metadata: {
            ...metadataBase,
            accountingComponent: 'PLATFORM_FEE_NET_REVENUE',
            accountingComponentAmount: partnerDue.platformFeeNetRevenue,
          },
        },
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
        update: {
          amount: -partnerDue.walletDeductionCompanyOutputVat,
          currency: earning.currency,
          metadata: {
            ...metadataBase,
            accountingComponent: 'COMPANY_OUTPUT_VAT_PAYABLE',
            accountingComponentAmount: partnerDue.companyOutputVat,
          },
        },
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
        update: {
          amount: -partnerDue.walletDeductionPartnerTaxPayable,
          currency: earning.currency,
          metadata: {
            ...metadataBase,
            accountingComponent: 'PARTNER_VAT_PIT_PAYABLE',
            accountingComponentAmount: partnerDue.partnerTaxPayable,
          },
        },
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
    ]);
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
    return tx.providerWalletLedgerEntry.upsert({
      where: { sourceKey },
      update: {
        amount: -earning.netAmount,
        currency: earning.currency,
        reference: cleanOptionalText(input.reference),
        notes: cleanOptionalText(input.notes),
        metadata: {
          earningNetAmount: earning.netAmount,
          payoutBatchId: input.payoutBatchId ?? null,
        },
      },
      create: {
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
      },
    });
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

    const payoutRules = await tx.servicePayoutRule.findMany({
      where: {
        active: true,
        OR: input.services.map((service) => ({
          serviceId: service.serviceId,
          customerPrice: service.price,
        })),
      },
    });
    const servicePayoutFee = calculateServicePayoutFeeFromRules({
      grossAmount: input.grossAmount,
      currency: input.currency,
      services: input.services,
      payoutRules,
    });
    if (!servicePayoutFee) {
      return null;
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

  private async providerWalletLedgerBalance(client: TxClient, providerProfileId: string) {
    const wallet = await client.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId },
      _sum: { amount: true },
    });
    return wallet._sum.amount ?? 0;
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

    const partnerVatLine = calculatePartnerTaxLine(policy.rules, input, PartnerTaxLineKind.PARTNER_VAT);
    const partnerPitLine = calculatePartnerTaxLine(policy.rules, input, PartnerTaxLineKind.PARTNER_PIT);
    const splitWithholdingAmount = partnerVatLine.amount + partnerPitLine.amount;
    const combinedLine =
      splitWithholdingAmount > 0
        ? null
        : calculatePartnerTaxLine(policy.rules, input, PartnerTaxLineKind.PARTNER_WITHHOLDING_COMBINED);
    const withholdingAmount =
      splitWithholdingAmount > 0 ? splitWithholdingAmount : (combinedLine?.amount ?? 0);

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
          splitWithholdingAmount > 0
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

type ProviderWithdrawalJournalPhase = 'LOCK' | 'PAID' | 'RELEASE';

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

function calculateCappedBpsAmount(baseAmount: number, rateBps: number, fixedAmount: number) {
  return Math.max(0, Math.min(baseAmount, Math.round((baseAmount * rateBps) / 10_000) + fixedAmount));
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

function cashSettlementCompanyCouponOffset(input: {
  walletLedgerEntries?: Array<{ metadata?: Prisma.JsonValue | null }>;
}) {
  const metadata =
    input.walletLedgerEntries
      ?.map((entry) => jsonObjectOrEmpty(entry.metadata))
      .find((entryMetadata) => jsonNumber(entryMetadata.cashBookingCompanyCouponExpense) > 0) ?? {};
  return jsonNumber(metadata.cashBookingCompanyCouponExpense);
}

function jsonNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function calculatePartnerTaxLine(
  rules: TaxRuleRecord[],
  input: { grossAmount: number; serviceTypes: string[] },
  taxKind: PartnerTaxLineKind,
) {
  const rule = selectTaxRule(rules, input, taxKind);
  const rateBps = rule?.rateBps ?? 0;
  const fixedAmount = rule?.fixedAmount ?? 0;
  const amount = rule ? calculateCappedBpsAmount(input.grossAmount, rateBps, fixedAmount) : 0;
  return { amount, fixedAmount, rateBps, rule };
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

function selectTaxRule(
  rules: TaxRuleRecord[],
  input: { grossAmount: number; serviceTypes: string[] },
  taxKind?: PartnerTaxLineKind,
) {
  const serviceTypes = new Set(input.serviceTypes.map((value) => value.toLowerCase()));
  const candidates = taxKind ? rules.filter((rule) => rule.taxKind === taxKind) : rules;
  const prioritized = [...candidates].sort(
    (left, right) =>
      taxRulePriority(right, serviceTypes, input.grossAmount) -
      taxRulePriority(left, serviceTypes, input.grossAmount),
  );
  return prioritized.find((rule) => taxRulePriority(rule, serviceTypes, input.grossAmount) > 0) ?? null;
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

function taxRulePriority(rule: TaxRuleRecord, serviceTypes: Set<string>, grossAmount: number) {
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
