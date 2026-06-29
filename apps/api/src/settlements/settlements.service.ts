import { Injectable } from '@nestjs/common';
import {
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  PaymentFeePayer,
  PaymentFeeTreatment,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateBookingSettlementAmounts,
  SettlementPaymentMethod,
} from './settlement-calculator';

export type UpsertBookingSettlementSnapshotInput = {
  bookingId: string;
  customerProfileId: string;
  providerProfileId: string;
  paymentId?: string | null;
  providerEarningId?: string | null;
  paymentMethod: PaymentMethod | SettlementPaymentMethod;
  currency?: string | null;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  partnerTaxableRevenueAmount?: number | null;
  platformFeeGross: number;
  partnerVatRateBps: number;
  partnerPitRateBps: number;
  platformVatRateBps: number;
  paymentFeeRateBps?: number | null;
  paymentFeeFixedAmount?: number | null;
  paymentFeePayer?: PaymentFeePayer | null;
  paymentFeeTreatment?: PaymentFeeTreatment | null;
  taxPolicyVersionId?: string | null;
  platformFeePolicyVersionId?: string | null;
  paymentFeePolicyVersionId?: string | null;
  taxRuleSnapshot?: Prisma.InputJsonValue | null;
  platformFeeRuleSnapshot?: Prisma.InputJsonValue | null;
  paymentFeeRuleSnapshot?: Prisma.InputJsonValue | null;
  providerTaxLogIds?: string[] | null;
  providerPlatformFeeLogId?: string | null;
  providerWalletLedgerEntryIds?: string[] | null;
  customerWalletLedgerEntryIds?: string[] | null;
  metadata?: Prisma.InputJsonObject | null;
  occurredAt: Date;
  timeZone?: string | null;
};
export type ReverseBookingSettlementSnapshotInput = {
  actorId: string;
  bookingId: string;
  occurredAt: Date;
  reason?: string | null;
};
type SettlementPrismaClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  upsertBookingSettlementSnapshot(
    input: UpsertBookingSettlementSnapshotInput,
    client: SettlementPrismaClient = this.prisma,
  ) {
    const paymentFeeRateBps = input.paymentFeeRateBps ?? 0;
    const paymentFeeFixedAmount = input.paymentFeeFixedAmount ?? 0;
    const amounts = calculateBookingSettlementAmounts({
      paymentMethod: input.paymentMethod,
      customerPaymentAmount: input.customerPaymentAmount,
      partnerPayoutAmount: input.partnerPayoutAmount,
      platformFeeGross: input.platformFeeGross,
      partnerVatRateBps: input.partnerVatRateBps,
      partnerPitRateBps: input.partnerPitRateBps,
      platformVatRateBps: input.platformVatRateBps,
      paymentFeeRateBps,
      paymentFeeFixedAmount,
      partnerTaxableRevenueAmount: input.partnerTaxableRevenueAmount ?? undefined,
    });
    const sourceKey = bookingSettlementSourceKey(input.bookingId);
    const monthlyPeriod = settlementMonthlyPeriod(input.occurredAt, input.timeZone ?? undefined);
    const metadata = settlementSnapshotMetadata(input.metadata, amounts.partnerTaxableRevenue);
    const data = {
      sourceKey,
      customerProfileId: input.customerProfileId,
      providerProfileId: input.providerProfileId,
      paymentId: input.paymentId ?? null,
      providerEarningId: input.providerEarningId ?? null,
      paymentMethod: input.paymentMethod as PaymentMethod,
      currency: input.currency ?? 'VND',
      customerPaymentAmount: input.customerPaymentAmount,
      partnerPayoutAmount: input.partnerPayoutAmount,
      partnerTaxableRevenue: amounts.partnerTaxableRevenue,
      partnerVatRateBps: input.partnerVatRateBps,
      partnerVatAmount: amounts.partnerVatAmount,
      partnerPitRateBps: input.partnerPitRateBps,
      partnerPitAmount: amounts.partnerPitAmount,
      partnerWithholdingTotal: amounts.partnerWithholdingTotal,
      platformFeeGross: input.platformFeeGross,
      platformVatRateBps: input.platformVatRateBps,
      platformFeeNetRevenue: amounts.platformFeeNetRevenue,
      companyOutputVat: amounts.companyOutputVat,
      paymentFeePolicyVersionId: input.paymentFeePolicyVersionId ?? null,
      paymentFeeRateBps,
      paymentFeeFixedAmount,
      paymentProcessingFee: amounts.paymentProcessingFee,
      paymentFeePayer: input.paymentFeePayer ?? PaymentFeePayer.HANDS,
      paymentFeeTreatment: input.paymentFeeTreatment ?? PaymentFeeTreatment.OPERATING_EXPENSE,
      taxPolicyVersionId: input.taxPolicyVersionId ?? null,
      platformFeePolicyVersionId: input.platformFeePolicyVersionId ?? null,
      taxRuleSnapshot: input.taxRuleSnapshot ?? undefined,
      platformFeeRuleSnapshot: input.platformFeeRuleSnapshot ?? undefined,
      paymentFeeRuleSnapshot: input.paymentFeeRuleSnapshot ?? undefined,
      providerTaxLogIds: input.providerTaxLogIds ?? undefined,
      providerPlatformFeeLogId: input.providerPlatformFeeLogId ?? null,
      providerWalletLedgerEntryIds: input.providerWalletLedgerEntryIds ?? undefined,
      customerWalletLedgerEntryIds: input.customerWalletLedgerEntryIds ?? undefined,
      metadata,
      monthlyPeriod,
      postedAt: input.occurredAt,
    };

    return client.bookingSettlementSnapshot.upsert({
      where: { bookingId: input.bookingId },
      update: data,
      create: {
        ...data,
        bookingId: input.bookingId,
      },
    });
  }

  async reverseBookingSettlementSnapshotForRefund(
    input: ReverseBookingSettlementSnapshotInput,
    client: SettlementPrismaClient = this.prisma,
  ) {
    const existing = await client.bookingSettlementSnapshot.findUnique({
      where: { bookingId: input.bookingId },
    });
    if (!existing) {
      return { skipped: true, reason: 'NO_SETTLEMENT_SNAPSHOT' };
    }
    if (existing.settlementStatus === BookingSettlementStatus.REVERSED) {
      return existing;
    }
    if (existing.monthlyClosingId) {
      return this.upsertClosedSettlementReversalEntry(
        { ...existing, monthlyClosingId: existing.monthlyClosingId },
        input,
        client,
      );
    }

    return client.bookingSettlementSnapshot.update({
      where: { bookingId: input.bookingId },
      data: {
        closedAt: input.occurredAt,
        metadata: settlementRefundReversalMetadata(existing.metadata, input.occurredAt),
        reversalReason: input.reason?.trim() || 'Payment refund',
        reversedById: input.actorId,
        settlementStatus: BookingSettlementStatus.REVERSED,
        taxStatus: BookingSettlementTaxStatus.REVERSED,
      },
    });
  }

  private upsertClosedSettlementReversalEntry(
    snapshot: ClosedSettlementSnapshot,
    input: ReverseBookingSettlementSnapshotInput,
    client: SettlementPrismaClient,
  ) {
    const metadata = settlementRefundReversalMetadata(snapshot.metadata, input.occurredAt);
    return client.bookingSettlementReversalEntry.upsert({
      where: { originalSettlementSnapshotId: snapshot.id },
      update: {
        metadata: closedSettlementReversalMetadata(metadata, snapshot.id),
        occurredAt: input.occurredAt,
        reason: input.reason?.trim() || 'Payment refund',
      },
      create: {
        bookingId: snapshot.bookingId,
        companyOutputVat: -snapshot.companyOutputVat,
        createdById: input.actorId,
        currency: snapshot.currency,
        customerPaymentAmount: -snapshot.customerPaymentAmount,
        customerProfileId: snapshot.customerProfileId,
        metadata: closedSettlementReversalMetadata(metadata, snapshot.id),
        monthlyPeriod: settlementMonthlyPeriod(input.occurredAt),
        occurredAt: input.occurredAt,
        originalMonthlyClosingId: snapshot.monthlyClosingId,
        originalMonthlyPeriod: snapshot.monthlyPeriod,
        originalSettlementSnapshotId: snapshot.id,
        partnerPitAmount: -snapshot.partnerPitAmount,
        partnerPayoutAmount: -snapshot.partnerPayoutAmount,
        partnerTaxableRevenue: -snapshot.partnerTaxableRevenue,
        partnerVatAmount: -snapshot.partnerVatAmount,
        partnerWithholdingTotal: -snapshot.partnerWithholdingTotal,
        paymentId: snapshot.paymentId,
        paymentMethod: snapshot.paymentMethod,
        paymentProcessingFee: -snapshot.paymentProcessingFee,
        platformFeeGross: -snapshot.platformFeeGross,
        platformFeeNetRevenue: -snapshot.platformFeeNetRevenue,
        providerEarningId: snapshot.providerEarningId,
        providerProfileId: snapshot.providerProfileId,
        reason: input.reason?.trim() || 'Payment refund',
        settlementStatus: BookingSettlementStatus.REVERSED,
        sourceKey: bookingSettlementReversalSourceKey(snapshot.id),
        taxStatus: BookingSettlementTaxStatus.REVERSED,
      },
    });
  }
}

export function bookingSettlementSourceKey(bookingId: string) {
  return `booking-settlement:${bookingId}`;
}

export function bookingSettlementReversalSourceKey(snapshotId: string) {
  return `booking-settlement-reversal:${snapshotId}`;
}

export function settlementMonthlyPeriod(date: Date, timeZone = 'Asia/Bangkok') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

function settlementRefundReversalMetadata(metadata: Prisma.JsonValue | null, occurredAt: Date) {
  const record = jsonRecord(metadata);
  const couponDiscountAmount = numberValue(record.couponDiscountAmount);
  const companyCouponExpense = numberValue(record.companyCouponExpense);

  return {
    ...record,
    couponReversalStatus: couponDiscountAmount > 0 || companyCouponExpense > 0 ? 'REVERSED' : record.couponReversalStatus,
    reversedAt: occurredAt.toISOString(),
    reversedCompanyCouponExpense: companyCouponExpense,
    reversedCouponDiscountAmount: couponDiscountAmount,
    reversalAffectsBookingPaymentClearing: true,
    reversalAffectsCompanyOutputVat: true,
    reversalAffectsCouponMarketingExpense: companyCouponExpense > 0,
    reversalAffectsPartnerPayout: true,
    reversalAffectsPartnerReceivable: true,
    reversalAffectsPartnerTaxPayable: true,
    reversalAffectsPlatformFeeRevenue: true,
  } satisfies Prisma.InputJsonObject;
}

function closedSettlementReversalMetadata(
  metadata: Prisma.InputJsonObject,
  originalSettlementSnapshotId: string,
) {
  return {
    ...metadata,
    originalSettlementSnapshotId,
    reversalEntryType: 'CLOSED_MONTHLY_PERIOD_REFUND',
  } satisfies Prisma.InputJsonObject;
}

function settlementSnapshotMetadata(
  metadata: Prisma.InputJsonObject | null | undefined,
  settlementBaseAmount: number,
) {
  if (!metadata) {
    return undefined;
  }

  const record = metadata as Record<string, unknown>;
  return {
    ...metadata,
    settlementBaseAmount: numberValue(record.settlementBaseAmount) || settlementBaseAmount,
  } satisfies Prisma.InputJsonObject;
}

type ClosedSettlementSnapshot = NonNullable<
  Awaited<ReturnType<SettlementPrismaClient['bookingSettlementSnapshot']['findUnique']>>
> & {
  monthlyClosingId: string;
};

function jsonRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Prisma.JsonValue>;
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
