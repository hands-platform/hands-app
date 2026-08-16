import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  AccountingJournalEntrySide,
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  EarningStatus,
  MonthlyTaxClosingStatus,
  PaymentFeePayer,
  PaymentFeeTreatment,
  PaymentMethod,
  PayoutBatchStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { customerWalletPaymentSourceKey as walletPaymentSourceKey } from '../payments/customer-wallet-payment';
import { calculateBookingSettlementAmounts, SettlementPaymentMethod } from './settlement-calculator';
import { settlementReversalEvidencePolicy } from './settlement-audit-health';
import { buildBookingSettlementJournal } from './settlement-journal';
import { immutableFinancialReplayMatches } from './immutable-financial-replay';

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

  previewBookingSettlementSnapshot(input: UpsertBookingSettlementSnapshotInput) {
    const currency = input.currency ?? 'VND';
    const monthlyPeriod = settlementMonthlyPeriod(input.occurredAt, input.timeZone ?? undefined);
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
    const metadata = settlementSnapshotMetadata(input.metadata, amounts.partnerTaxableRevenue);
    const journal = buildBookingSettlementJournal({
      bookingId: input.bookingId,
      companyOutputVat: amounts.companyOutputVat,
      currency,
      customerPaymentAmount: input.customerPaymentAmount,
      metadata,
      partnerPayoutAmount: input.partnerPayoutAmount,
      partnerWithholdingTotal: amounts.partnerWithholdingTotal,
      paymentMethod: input.paymentMethod as SettlementPaymentMethod,
      paymentProcessingFee: amounts.paymentProcessingFee,
      platformFeeNetRevenue: amounts.platformFeeNetRevenue,
    });

    return {
      amounts,
      currency,
      customerPaymentAmount: input.customerPaymentAmount,
      journal,
      metadata,
      monthlyPeriod,
      partnerPayoutAmount: input.partnerPayoutAmount,
      paymentFeeFixedAmount,
      paymentFeePayer: input.paymentFeePayer ?? PaymentFeePayer.HANDS,
      paymentFeePolicyVersionId: input.paymentFeePolicyVersionId ?? null,
      paymentFeeRateBps,
      paymentFeeRuleSnapshot: input.paymentFeeRuleSnapshot ?? null,
      paymentFeeTreatment: input.paymentFeeTreatment ?? PaymentFeeTreatment.OPERATING_EXPENSE,
      platformFeeGross: input.platformFeeGross,
      platformFeePolicyVersionId: input.platformFeePolicyVersionId ?? null,
      platformFeeRuleSnapshot: input.platformFeeRuleSnapshot ?? null,
      platformVatRateBps: input.platformVatRateBps,
    };
  }

  async upsertBookingSettlementSnapshot(
    input: UpsertBookingSettlementSnapshotInput,
    client: SettlementPrismaClient = this.prisma,
  ) {
    const preview = this.previewBookingSettlementSnapshot(input);
    const { amounts, currency, metadata, monthlyPeriod, paymentFeeFixedAmount, paymentFeeRateBps } = preview;
    if (client !== this.prisma) {
      await lockSettlementMonthlyPeriodsInTransaction(client as Prisma.TransactionClient, [
        { period: monthlyPeriod, currency },
      ]);
    }
    await this.ensureSnapshotIsEditable(input.bookingId, monthlyPeriod, currency, client);
    const sourceKey = bookingSettlementSourceKey(input.bookingId);
    const customerWalletLedgerEntryIds = await this.customerWalletLedgerEntryIdsForSettlement(
      input,
      amounts.customerWalletDebitAmount,
      monthlyPeriod,
      client,
    );
    const data = {
      sourceKey,
      customerProfileId: input.customerProfileId,
      providerProfileId: input.providerProfileId,
      paymentId: input.paymentId ?? null,
      providerEarningId: input.providerEarningId ?? null,
      paymentMethod: input.paymentMethod as PaymentMethod,
      currency,
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
      customerWalletLedgerEntryIds,
      metadata,
      monthlyPeriod,
      postedAt: input.occurredAt,
    };

    const createData = {
      ...data,
      bookingId: input.bookingId,
    };
    const snapshot = await client.bookingSettlementSnapshot.upsert({
      where: { bookingId: input.bookingId },
      update: {},
      create: createData,
    });
    if (!immutableFinancialReplayMatches(snapshot, createData, BOOKING_SETTLEMENT_REPLAY_FIELDS)) {
      throw new ConflictException(
        'A settlement snapshot already exists with different financial evidence.',
      );
    }

    await this.upsertBookingSettlementAccountingRecords(input, amounts, snapshot, client);

    return snapshot;
  }

  private async ensureSnapshotIsEditable(
    bookingId: string,
    monthlyPeriod: string,
    currency: string,
    client: SettlementPrismaClient,
  ) {
    const bookingSettlementSnapshot = client.bookingSettlementSnapshot as unknown as {
      findUnique?: (args: {
        where: { bookingId: string };
        select: {
          monthlyClosingId: true;
          monthlyClosing: { select: { status: true } };
        };
      }) => Promise<{
        monthlyClosingId: string | null;
        monthlyClosing: { status: MonthlyTaxClosingStatus } | null;
      } | null>;
    };
    if (!bookingSettlementSnapshot.findUnique) {
      return;
    }

    const existing = await bookingSettlementSnapshot.findUnique({
      where: { bookingId },
      select: {
        monthlyClosingId: true,
        monthlyClosing: { select: { status: true } },
      },
    });
    if (existing?.monthlyClosing?.status === MonthlyTaxClosingStatus.CLOSED) {
      throw new BadRequestException(
        'Closed monthly periods require reversal entries, not direct settlement snapshot edits.',
      );
    }
    if (
      existing?.monthlyClosing?.status === MonthlyTaxClosingStatus.DECLARED ||
      existing?.monthlyClosing?.status === MonthlyTaxClosingStatus.PAID
    ) {
      throw new BadRequestException(
        'Finalized monthly periods require reversal entries, not direct settlement snapshot edits.',
      );
    }

    const monthlyTaxClosing = client.monthlyTaxClosing as unknown as
      | {
      findUnique?: (args: {
        where: { period_currency: { period: string; currency: string } };
        select: { status: true };
      }) => Promise<{ status: MonthlyTaxClosingStatus } | null>;
        }
      | undefined;
    if (!monthlyTaxClosing?.findUnique) {
      return;
    }

    const targetClosing = await monthlyTaxClosing.findUnique({
      where: { period_currency: { period: monthlyPeriod, currency } },
      select: { status: true },
    });
    if (targetClosing?.status === MonthlyTaxClosingStatus.CLOSED) {
      throw new BadRequestException(
        'Closed monthly periods require reversal entries, not direct settlement snapshot edits.',
      );
    }
    if (
      targetClosing?.status === MonthlyTaxClosingStatus.DECLARED ||
      targetClosing?.status === MonthlyTaxClosingStatus.PAID
    ) {
      throw new BadRequestException(
        'Finalized monthly periods require reversal entries, not direct settlement snapshot edits.',
      );
    }
  }

  async reverseBookingSettlementSnapshotForRefund(
    input: ReverseBookingSettlementSnapshotInput,
    client: SettlementPrismaClient = this.prisma,
  ) {
    let existing = await client.bookingSettlementSnapshot.findUnique({
      include: {
        providerEarning: {
          select: {
            id: true,
            payoutBatch: {
              select: {
                id: true,
                status: true,
              },
            },
            payoutBatchId: true,
            status: true,
          },
        },
      },
      where: { bookingId: input.bookingId },
    });
    if (!existing) {
      return { skipped: true, reason: 'NO_SETTLEMENT_SNAPSHOT' };
    }
    if (client !== this.prisma) {
      await lockSettlementMonthlyPeriodsInTransaction(client as Prisma.TransactionClient, [
        { period: existing.monthlyPeriod, currency: existing.currency },
        { period: settlementMonthlyPeriod(input.occurredAt), currency: existing.currency },
      ]);
      existing = await client.bookingSettlementSnapshot.findUnique({
        include: {
          providerEarning: {
            select: {
              id: true,
              payoutBatch: {
                select: {
                  id: true,
                  status: true,
                },
              },
              payoutBatchId: true,
              status: true,
            },
          },
        },
        where: { bookingId: input.bookingId },
      });
      if (!existing) {
        return { skipped: true, reason: 'NO_SETTLEMENT_SNAPSHOT' };
      }
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

    const reversedSnapshot = await client.bookingSettlementSnapshot.update({
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
    await this.upsertBookingSettlementReversalAccountingRecords(existing, input, client);
    return reversedSnapshot;
  }

  private async upsertClosedSettlementReversalEntry(
    snapshot: ClosedSettlementSnapshot,
    input: ReverseBookingSettlementSnapshotInput,
    client: SettlementPrismaClient,
  ) {
    const metadata = {
      ...settlementRefundReversalMetadata(snapshot.metadata, input.occurredAt),
      ...settlementPaymentFeeEvidenceFromSnapshot(snapshot),
    } satisfies Prisma.InputJsonObject;
    const reversalEntry = await client.bookingSettlementReversalEntry.upsert({
      where: { originalSettlementSnapshotId: snapshot.id },
      update: {},
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
    await this.upsertBookingSettlementReversalAccountingRecords(snapshot, input, client, reversalEntry.id);
    return reversalEntry;
  }

  private async upsertBookingSettlementReversalAccountingRecords(
    snapshot: SettlementSnapshotForReversal,
    input: ReverseBookingSettlementSnapshotInput,
    client: SettlementPrismaClient,
    reversalEntryId?: string | null,
  ) {
    const metadata = jsonRecord(snapshot.metadata);
    const paymentFeeEvidence = settlementPaymentFeeEvidenceFromSnapshot(snapshot);
    const journal = buildBookingSettlementJournal({
      bookingId: snapshot.bookingId,
      companyOutputVat: snapshot.companyOutputVat,
      currency: snapshot.currency,
      customerPaymentAmount: snapshot.customerPaymentAmount,
      metadata,
      partnerPayoutAmount: snapshot.partnerPayoutAmount,
      partnerWithholdingTotal: snapshot.partnerWithholdingTotal,
      paymentMethod: snapshot.paymentMethod,
      paymentProcessingFee: snapshot.paymentProcessingFee,
      platformFeeNetRevenue: snapshot.platformFeeNetRevenue,
    });
    const sourceKey = accountingJournalReversalSourceKey(snapshot.id);
    const sourceId = reversalEntryId ?? snapshot.id;
    const refundAfterPartnerPayout = settlementSnapshotHasPaidPartnerPayout(snapshot);
    let partnerRefundReceivableAmount = 0;
    const journalEntries = journal.entries.map((entry) => {
      const side = reverseJournalSide(entry.side);
      const movesPaidPayoutToReceivable =
        refundAfterPartnerPayout &&
        entry.accountCode === 'partner_wallet_liability' &&
        side === AccountingJournalEntrySide.DEBIT;
      if (movesPaidPayoutToReceivable) {
        partnerRefundReceivableAmount += entry.amount;
      }

      return {
        accountCode: movesPaidPayoutToReceivable
          ? 'partner_receivable_negative_wallet'
          : entry.accountCode,
        accountName: movesPaidPayoutToReceivable
          ? 'Partner receivable / negative wallet'
          : entry.accountName,
        amount: entry.amount,
        currency: entry.currency,
        memo: movesPaidPayoutToReceivable
          ? `Refund after partner payout: ${entry.memo}`
          : `Refund reversal: ${entry.memo}`,
        metadata: {
          bookingId: snapshot.bookingId,
          originalSettlementSnapshotId: snapshot.id,
          partnerRefundReceivableAmount: movesPaidPayoutToReceivable ? entry.amount : 0,
          refundAfterPartnerPayout,
          ...paymentFeeEvidence,
          settlementReversalEntryId: reversalEntryId ?? null,
        } satisfies Prisma.InputJsonObject,
        side,
        sourceId,
        sourceType: 'BOOKING_SETTLEMENT_REVERSAL' as const,
      };
    });
    const journalMetadata = {
      bookingId: snapshot.bookingId,
      originalSettlementSnapshotId: snapshot.id,
      partnerRefundReceivableAmount,
      ...paymentFeeEvidence,
      reason: input.reason?.trim() || 'Payment refund',
      refundAfterPartnerPayout,
      settlementReversalEntryId: reversalEntryId ?? null,
    } satisfies Prisma.InputJsonObject;

    await client.accountingJournalBatch.upsert({
      where: { sourceKey },
      update: {},
      create: {
        bookingId: snapshot.bookingId,
        currency: snapshot.currency,
        customerProfileId: snapshot.customerProfileId,
        entries: {
          create: journalEntries,
        },
        metadata: journalMetadata,
        monthlyPeriod: settlementMonthlyPeriod(input.occurredAt),
        paymentId: snapshot.paymentId ?? null,
        postedAt: input.occurredAt,
        providerProfileId: snapshot.providerProfileId,
        settlementReversalEntryId: reversalEntryId ?? null,
        settlementSnapshotId: snapshot.id,
        sourceId,
        sourceKey,
        sourceType: 'BOOKING_SETTLEMENT_REVERSAL',
        status: 'POSTED',
        totalCredit: journal.totalDebit,
        totalDebit: journal.totalCredit,
      },
    });

    if (!settlementReversalEvidencePolicy(snapshot.paymentMethod).externalClearingRequired) {
      return;
    }

    await client.bookingPaymentClearingEntry.upsert({
      where: { sourceKey: bookingPaymentClearingRefundReversalSourceKey(snapshot.bookingId) },
      update: {
        amount: -snapshot.customerPaymentAmount,
        currency: snapshot.currency,
        metadata: {
          bookingId: snapshot.bookingId,
          journalBatchSourceKey: sourceKey,
          originalSettlementSnapshotId: snapshot.id,
          ...paymentFeeEvidence,
          settlementReversalEntryId: reversalEntryId ?? null,
        } satisfies Prisma.InputJsonObject,
        occurredAt: input.occurredAt,
        paymentId: snapshot.paymentId ?? null,
        settlementReversalEntryId: reversalEntryId ?? null,
        settlementSnapshotId: snapshot.id,
        status: 'REVERSED',
      },
      create: {
        amount: -snapshot.customerPaymentAmount,
        bookingId: snapshot.bookingId,
        currency: snapshot.currency,
        metadata: {
          bookingId: snapshot.bookingId,
          journalBatchSourceKey: sourceKey,
          originalSettlementSnapshotId: snapshot.id,
          ...paymentFeeEvidence,
          settlementReversalEntryId: reversalEntryId ?? null,
        } satisfies Prisma.InputJsonObject,
        occurredAt: input.occurredAt,
        paymentId: snapshot.paymentId ?? null,
        settlementReversalEntryId: reversalEntryId ?? null,
        settlementSnapshotId: snapshot.id,
        sourceKey: bookingPaymentClearingRefundReversalSourceKey(snapshot.bookingId),
        status: 'REVERSED',
        type: 'REFUND_REVERSAL',
      },
    });
  }

  private async upsertBookingSettlementAccountingRecords(
    input: UpsertBookingSettlementSnapshotInput,
    amounts: ReturnType<typeof calculateBookingSettlementAmounts>,
    snapshot: BookingSettlementSnapshotRecord,
    client: SettlementPrismaClient,
  ) {
    const currency = snapshot.currency ?? input.currency ?? 'VND';
    const paymentFeeEvidence = settlementPaymentFeeEvidence(input, amounts);
    const journal = buildBookingSettlementJournal({
      bookingId: input.bookingId,
      companyOutputVat: amounts.companyOutputVat,
      currency,
      customerPaymentAmount: input.customerPaymentAmount,
      metadata:
        snapshot.metadata && typeof snapshot.metadata === 'object' && !Array.isArray(snapshot.metadata)
          ? (snapshot.metadata as Record<string, unknown>)
          : {},
      partnerPayoutAmount: input.partnerPayoutAmount,
      partnerWithholdingTotal: amounts.partnerWithholdingTotal,
      paymentMethod: input.paymentMethod as SettlementPaymentMethod,
      paymentProcessingFee: amounts.paymentProcessingFee,
      platformFeeNetRevenue: amounts.platformFeeNetRevenue,
    });
    const journalSourceKey = `accounting-journal:booking-settlement:${input.bookingId}`;
    const journalEntries = journal.entries.map((entry) => ({
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      amount: entry.amount,
      currency: entry.currency,
      memo: entry.memo,
      metadata: {
        bookingId: input.bookingId,
        ...paymentFeeEvidence,
        settlementSnapshotId: snapshot.id,
      } satisfies Prisma.InputJsonObject,
      side: entry.side,
      sourceId: snapshot.id,
      sourceType: 'BOOKING_SETTLEMENT' as const,
    }));
    const journalMetadata = {
      bookingId: input.bookingId,
      ...paymentFeeEvidence,
      reconciliationDelta: journal.reconciliationDelta,
      settlementSnapshotId: snapshot.id,
    } satisfies Prisma.InputJsonObject;

    await client.accountingJournalBatch.upsert({
      where: { sourceKey: journalSourceKey },
      update: {},
      create: {
        bookingId: input.bookingId,
        currency,
        customerProfileId: input.customerProfileId,
        entries: {
          create: journalEntries,
        },
        metadata: journalMetadata,
        monthlyPeriod: snapshot.monthlyPeriod,
        paymentId: input.paymentId ?? null,
        postedAt: snapshot.postedAt,
        providerProfileId: input.providerProfileId,
        settlementSnapshotId: snapshot.id,
        sourceId: snapshot.id,
        sourceKey: journalSourceKey,
        sourceType: 'BOOKING_SETTLEMENT',
        status: 'POSTED',
        totalCredit: journal.totalCredit,
        totalDebit: journal.totalDebit,
      },
    });

    if (input.paymentMethod === 'CASH' || input.paymentMethod === PaymentMethod.CUSTOMER_WALLET) {
      return;
    }

    await client.bookingPaymentClearingEntry.upsert({
      where: { sourceKey: bookingPaymentClearingSourceKey(input.bookingId) },
      update: {},
      create: {
        amount: input.customerPaymentAmount,
        bookingId: input.bookingId,
        currency,
        metadata: {
          bookingId: input.bookingId,
          journalBatchSourceKey: journalSourceKey,
          ...paymentFeeEvidence,
          settlementSnapshotId: snapshot.id,
        } satisfies Prisma.InputJsonObject,
        occurredAt: snapshot.postedAt,
        paymentId: input.paymentId ?? null,
        settlementSnapshotId: snapshot.id,
        sourceKey: bookingPaymentClearingSourceKey(input.bookingId),
        status: 'OPEN',
        type: 'SETTLEMENT_POSTED',
      },
    });
  }

  private async customerWalletLedgerEntryIdsForSettlement(
    input: UpsertBookingSettlementSnapshotInput,
    customerWalletDebitAmount: number,
    monthlyPeriod: string,
    client: SettlementPrismaClient,
  ) {
    const existingIds = input.customerWalletLedgerEntryIds ?? [];
    if (input.paymentMethod !== PaymentMethod.CUSTOMER_WALLET || customerWalletDebitAmount <= 0) {
      return existingIds.length > 0 ? existingIds : undefined;
    }

    const ledgerData = {
      amount: -customerWalletDebitAmount,
      bookingId: input.bookingId,
      currency: input.currency ?? 'VND',
      customerProfileId: input.customerProfileId,
      metadata: {
        bookingId: input.bookingId,
        customerPaymentAmount: input.customerPaymentAmount,
        monthlyPeriod,
        paymentId: input.paymentId ?? null,
        paymentMethod: PaymentMethod.CUSTOMER_WALLET,
        providerProfileId: input.providerProfileId,
      } satisfies Prisma.InputJsonObject,
      notes: 'Customer wallet payment debited for completed booking settlement.',
      reference: input.paymentId ?? input.bookingId,
      type: customerWalletLedgerType('CUSTOMER_WALLET_PAYMENT'),
    };
    const ledger = await client.customerWalletLedgerEntry.upsert({
      where: { sourceKey: customerWalletPaymentSourceKey(input.bookingId) },
      update: {},
      create: {
        ...ledgerData,
        sourceKey: customerWalletPaymentSourceKey(input.bookingId),
      },
    });
    if (!immutableFinancialReplayMatches(ledger, ledgerData, CUSTOMER_WALLET_REPLAY_FIELDS)) {
      throw new ConflictException(
        'A customer wallet payment entry already exists with different financial evidence.',
      );
    }

    return [...new Set([...existingIds, ledger.id])];
  }
}

const BOOKING_SETTLEMENT_REPLAY_FIELDS = [
  'bookingId',
  'sourceKey',
  'customerProfileId',
  'providerProfileId',
  'paymentId',
  'providerEarningId',
  'paymentMethod',
  'currency',
  'customerPaymentAmount',
  'partnerPayoutAmount',
  'partnerTaxableRevenue',
  'partnerVatRateBps',
  'partnerVatAmount',
  'partnerPitRateBps',
  'partnerPitAmount',
  'partnerWithholdingTotal',
  'platformFeeGross',
  'platformVatRateBps',
  'platformFeeNetRevenue',
  'companyOutputVat',
  'paymentFeePolicyVersionId',
  'paymentFeeRateBps',
  'paymentFeeFixedAmount',
  'paymentProcessingFee',
  'paymentFeePayer',
  'paymentFeeTreatment',
  'taxPolicyVersionId',
  'platformFeePolicyVersionId',
  'taxRuleSnapshot',
  'platformFeeRuleSnapshot',
  'paymentFeeRuleSnapshot',
  'providerTaxLogIds',
  'providerPlatformFeeLogId',
  'providerWalletLedgerEntryIds',
  'customerWalletLedgerEntryIds',
  'metadata',
  'monthlyPeriod',
  'postedAt',
] as const;

const CUSTOMER_WALLET_REPLAY_FIELDS = [
  'amount',
  'bookingId',
  'currency',
  'customerProfileId',
  'metadata',
  'notes',
  'reference',
  'type',
] as const;

export function bookingSettlementSourceKey(bookingId: string) {
  return `booking-settlement:${bookingId}`;
}

export function bookingSettlementReversalSourceKey(snapshotId: string) {
  return `booking-settlement-reversal:${snapshotId}`;
}

export function accountingJournalReversalSourceKey(snapshotId: string) {
  return `accounting-journal:booking-settlement-reversal:${snapshotId}`;
}

export function bookingPaymentClearingSourceKey(bookingId: string) {
  return `booking-payment-clearing:${bookingId}:settlement`;
}

export function bookingPaymentClearingRefundReversalSourceKey(bookingId: string) {
  return `booking-payment-clearing:${bookingId}:refund-reversal`;
}

export function customerWalletPaymentSourceKey(bookingId: string) {
  return walletPaymentSourceKey(bookingId);
}

export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export async function lockSettlementMonthlyPeriodsInTransaction(
  client: Prisma.TransactionClient,
  periods: Array<{ period: string; currency: string }>,
) {
  const keys = [...new Set(periods.map(({ period, currency }) => `${period}:${currency}`))].sort();
  for (const key of keys) {
    await client.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`settlement-month:${key}`}, 0))::text AS "lockResult"`,
    );
  }
}

export function settlementMonthlyPeriod(date: Date, timeZone = VIETNAM_TIME_ZONE) {
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
    couponReversalStatus:
      couponDiscountAmount > 0 || companyCouponExpense > 0 ? 'REVERSED' : record.couponReversalStatus,
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

function customerWalletLedgerType(value: string): Prisma.CustomerWalletLedgerEntryCreateInput['type'] {
  return value as Prisma.CustomerWalletLedgerEntryCreateInput['type'];
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

function settlementPaymentFeeEvidence(
  input: UpsertBookingSettlementSnapshotInput,
  amounts: ReturnType<typeof calculateBookingSettlementAmounts>,
) {
  return {
    paymentFeeFixedAmount: input.paymentFeeFixedAmount ?? 0,
    paymentFeePayer: input.paymentFeePayer ?? PaymentFeePayer.HANDS,
    paymentFeePolicyVersionId: input.paymentFeePolicyVersionId ?? null,
    paymentFeeRateBps: input.paymentFeeRateBps ?? 0,
    paymentFeeTreatment: input.paymentFeeTreatment ?? PaymentFeeTreatment.OPERATING_EXPENSE,
    paymentProcessingFee: amounts.paymentProcessingFee,
  } satisfies Prisma.InputJsonObject;
}

function settlementPaymentFeeEvidenceFromSnapshot(snapshot: {
  paymentFeeFixedAmount?: number | null;
  paymentFeePayer?: PaymentFeePayer | null;
  paymentFeePolicyVersionId?: string | null;
  paymentFeeRateBps?: number | null;
  paymentFeeTreatment?: PaymentFeeTreatment | null;
  paymentProcessingFee?: number | null;
}) {
  return {
    paymentFeeFixedAmount: snapshot.paymentFeeFixedAmount ?? 0,
    paymentFeePayer: snapshot.paymentFeePayer ?? PaymentFeePayer.HANDS,
    paymentFeePolicyVersionId: snapshot.paymentFeePolicyVersionId ?? null,
    paymentFeeRateBps: snapshot.paymentFeeRateBps ?? 0,
    paymentFeeTreatment: snapshot.paymentFeeTreatment ?? PaymentFeeTreatment.OPERATING_EXPENSE,
    paymentProcessingFee: snapshot.paymentProcessingFee ?? 0,
  } satisfies Prisma.InputJsonObject;
}

type ClosedSettlementSnapshot = NonNullable<
  Awaited<ReturnType<SettlementPrismaClient['bookingSettlementSnapshot']['findUnique']>>
> & {
  monthlyClosingId: string;
};

type SettlementSnapshotForReversal = NonNullable<
  Awaited<ReturnType<SettlementPrismaClient['bookingSettlementSnapshot']['findUnique']>>
>;

type BookingSettlementSnapshotRecord = Awaited<
  ReturnType<SettlementPrismaClient['bookingSettlementSnapshot']['upsert']>
>;

type SettlementSnapshotWithPartnerPayoutState = SettlementSnapshotForReversal & {
  providerEarning?: {
    payoutBatch?: {
      status?: PayoutBatchStatus | string | null;
    } | null;
    status?: EarningStatus | string | null;
  } | null;
};

function settlementSnapshotHasPaidPartnerPayout(snapshot: SettlementSnapshotForReversal) {
  const providerEarning = (snapshot as SettlementSnapshotWithPartnerPayoutState).providerEarning;
  return providerEarning?.status === EarningStatus.PAID || providerEarning?.payoutBatch?.status === PayoutBatchStatus.PAID;
}

function reverseJournalSide(side: 'DEBIT' | 'CREDIT') {
  return side === 'DEBIT' ? AccountingJournalEntrySide.CREDIT : AccountingJournalEntrySide.DEBIT;
}

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
