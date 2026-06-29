import { Injectable } from '@nestjs/common';
import { PaymentFeePayer, PaymentFeeTreatment, PaymentMethod, Prisma } from '@prisma/client';
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
  occurredAt: Date;
  timeZone?: string | null;
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
    });
    const sourceKey = bookingSettlementSourceKey(input.bookingId);
    const monthlyPeriod = settlementMonthlyPeriod(input.occurredAt, input.timeZone ?? undefined);
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
}

export function bookingSettlementSourceKey(bookingId: string) {
  return `booking-settlement:${bookingId}`;
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
