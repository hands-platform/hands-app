import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  CashFeeSettlementMethod,
  EarningStatus,
  PaymentMethod,
  PayoutBatchStatus,
  Prisma,
  ProviderWalletLedgerType,
  ProviderBankAccountStatus,
  ProviderSanctionStatus,
  ProviderSanctionType,
  ProviderTaxProfileStatus,
  TaxPolicyStatus,
  TaxRuleScope,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PAYOUT_AGREEMENTS } from '../provider-onboarding/provider-onboarding.policy';
import { calculateProviderWalletDelta, calculateServicePayoutFeeFromRules } from './earnings.policy';
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
type TxClient = Prisma.TransactionClient;
type PricedBookingService = {
  serviceId: string;
  serviceName?: string | null;
  price: number;
  quantity: number;
};

@Injectable()
export class EarningsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForCompletedBooking(bookingId: string, providerProfileId: string) {
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

    const grossAmount =
      booking.payment?.amount ??
      booking.services.reduce((total, service) => total + service.price * service.quantity, 0);
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
      const netAmount = calculateProviderWalletDelta({
        paymentMethod: booking.payment?.method,
        grossAmount,
        platformFee: platformFee.platformFeeAmount,
        withholdingAmount: tax.withholdingAmount,
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
          status: EarningStatus.PENDING,
          availableAt,
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

      await this.upsertPlatformFeeLog(tx, earning, platformFee);
      await this.upsertTaxLog(tx, earning, tax);
      await this.upsertEarningWalletLedger(tx, earning, booking.payment?.method);
      return earning;
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
    const [summary, payoutHold] = await Promise.all([
      this.summaryWhere({ providerProfileId: provider.id }),
      this.activePayoutHoldForProvider(this.prisma, provider.id),
    ]);
    const walletBalance = summary.pendingNetAmount + summary.availableNetAmount;
    const walletBlocked = walletBalance < 0;
    const walletDebtAmount = walletBlocked ? Math.abs(walletBalance) : 0;
    return {
      ...summary,
      walletBalance,
      walletBlocked,
      marketplaceVisibilityBlocked: false,
      marketplaceJoinBlocked: walletBlocked,
      directFirstPickBlocked: false,
      alreadyMatchedServiceBlocked: false,
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
    };
  }

  listForAdmin() {
    return this.prisma.providerEarning.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        providerProfile: { include: { user: { select: { id: true, phone: true, fullName: true } } } },
        booking: { include: { payment: true, review: true, services: { include: { service: true } } } },
        platformFeeLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        taxLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        walletLedgerEntries: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  listCashSettlementDebtForAdmin() {
    return this.prisma.providerEarning.findMany({
      where: {
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
        netAmount: { lt: 0 },
      },
      orderBy: [{ createdAt: 'asc' }, { netAmount: 'asc' }],
      take: 500,
      include: {
        providerProfile: { include: { user: { select: { id: true, phone: true, fullName: true } } } },
        booking: { include: { payment: true, review: true, services: { include: { service: true } } } },
        platformFeeLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        taxLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
        walletLedgerEntries: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  async cashSettlementSummaryForAdmin() {
    const debtRows = await this.prisma.providerEarning.findMany({
      where: {
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
        netAmount: { lt: 0 },
      },
      orderBy: [{ createdAt: 'asc' }, { netAmount: 'asc' }],
      select: {
        id: true,
        providerProfileId: true,
        bookingId: true,
        grossAmount: true,
        platformFee: true,
        withholdingAmount: true,
        netAmount: true,
        currency: true,
        createdAt: true,
        booking: { select: { payment: { select: { id: true, method: true, amount: true, status: true } } } },
        providerProfile: {
          select: {
            id: true,
            displayName: true,
            user: { select: { phone: true, fullName: true } },
          },
        },
      },
    });
    const now = Date.now();
    const providerGroups = new Map<
      string,
      {
        providerProfileId: string;
        providerName: string;
        providerPhone: string | null;
        rowCount: number;
        debtAmount: number;
        platformFee: number;
        taxAmount: number;
        currency: string;
        oldestOpenAt: Date;
        latestOpenAt: Date;
        settlementReference: string;
      }
    >();

    for (const row of debtRows) {
      const providerName =
        row.providerProfile.displayName ?? row.providerProfile.user?.fullName ?? 'Unknown partner';
      const existing = providerGroups.get(row.providerProfileId);
      const group = existing ?? {
        providerProfileId: row.providerProfileId,
        providerName,
        providerPhone: row.providerProfile.user?.phone ?? null,
        rowCount: 0,
        debtAmount: 0,
        platformFee: 0,
        taxAmount: 0,
        currency: row.currency,
        oldestOpenAt: row.createdAt,
        latestOpenAt: row.createdAt,
        settlementReference: providerWalletSettlementReference(row.providerProfileId),
      };

      group.rowCount += 1;
      group.debtAmount += Math.abs(row.netAmount);
      group.platformFee += row.platformFee;
      group.taxAmount += row.withholdingAmount;
      if (row.createdAt < group.oldestOpenAt) {
        group.oldestOpenAt = row.createdAt;
      }
      if (row.createdAt > group.latestOpenAt) {
        group.latestOpenAt = row.createdAt;
      }
      providerGroups.set(row.providerProfileId, group);
    }

    const sortedProviderGroups = [...providerGroups.values()].sort(
      (left, right) => right.debtAmount - left.debtAmount,
    );
    const oldestOpenAt = debtRows[0]?.createdAt ?? null;
    const staleCutoffMs = 24 * 60 * 60 * 1000;
    const highDebtThreshold = 500_000;

    return {
      generatedAt: new Date(),
      currency: debtRows[0]?.currency ?? 'VND',
      rowCount: debtRows.length,
      providerCount: providerGroups.size,
      totalDebtAmount: debtRows.reduce((sum, row) => sum + Math.abs(row.netAmount), 0),
      totalPlatformFee: debtRows.reduce((sum, row) => sum + row.platformFee, 0),
      totalTaxAmount: debtRows.reduce((sum, row) => sum + row.withholdingAmount, 0),
      oldestOpenAt,
      oldestOpenAgeMinutes: oldestOpenAt
        ? Math.max(0, Math.round((now - oldestOpenAt.getTime()) / 60_000))
        : 0,
      staleDebtRowCount: debtRows.filter((row) => now - row.createdAt.getTime() > staleCutoffMs).length,
      highDebtProviderCount: sortedProviderGroups.filter((group) => group.debtAmount >= highDebtThreshold)
        .length,
      missingPaymentEvidenceCount: debtRows.filter((row) => !row.booking?.payment).length,
      cashPaymentRowCount: debtRows.filter((row) => row.booking?.payment?.method === PaymentMethod.CASH)
        .length,
      topProviderGroups: sortedProviderGroups.slice(0, 20),
    };
  }

  adminSummary() {
    return this.summaryWhere({});
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
    const settlementRef = cleanOptionalText(input.settlementRef);
    const settlementNotes = cleanOptionalText(input.settlementNotes);
    const settlementMethod = normalizeCashFeeSettlementMethod(input.settlementMethod);
    if (earning.netAmount >= 0) {
      throw new BadRequestException('Positive partner earnings must be paid through payout batches');
    }
    if (earning.netAmount < 0 && !settlementRef) {
      throw new BadRequestException('Settlement reference is required for cash fee debt settlement');
    }
    if (earning.netAmount < 0 && !settlementMethod) {
      throw new BadRequestException('Settlement method is required for cash fee debt settlement');
    }

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

  listPayoutBatchesForAdmin() {
    return this.prisma.providerPayoutBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
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

    const nextStatus = input.status;
    if (nextStatus && !Object.values(PayoutBatchStatus).includes(nextStatus)) {
      throw new BadRequestException('Invalid payout batch status');
    }
    if (existing.status === PayoutBatchStatus.PAID && nextStatus && nextStatus !== PayoutBatchStatus.PAID) {
      throw new BadRequestException('Paid payout batches cannot be moved back to an unpaid status');
    }
    const nextTransferRef =
      input.transferRef === undefined
        ? normalizeNullable(existing.transferRef)
        : normalizeNullable(input.transferRef);
    if (nextStatus === PayoutBatchStatus.PAID && !nextTransferRef) {
      throw new BadRequestException('Transfer reference is required before marking a payout batch paid');
    }

    return this.prisma.$transaction(async (tx) => {
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

  async cancelForRefund(bookingId: string) {
    const earning = await this.prisma.providerEarning.findUnique({ where: { bookingId } });
    if (!earning) {
      return { skipped: true, reason: 'NO_EARNING' };
    }
    if (earning.status === EarningStatus.PAID) {
      return { skipped: true, reason: 'ALREADY_PAID', earningId: earning.id };
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
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
    });

    return { skipped: false, earning: cancelled };
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
  ) {
    return tx.providerWalletLedgerEntry.upsert({
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
        notes:
          paymentMethod === PaymentMethod.CASH
            ? 'Cash booking created HANDS fee/tax wallet debt'
            : 'Completed booking created partner wallet credit',
        metadata: this.earningLedgerMetadata(earning, paymentMethod),
      },
    });
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
    const platformFeeAmount = Math.max(
      0,
      Math.min(input.grossAmount, Math.round((input.grossAmount * rateBps) / 10_000) + fixedAmount),
    );

    return {
      platformFeeAmount,
      currency: input.currency,
      policyVersionId: policy.id,
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
    return calculateServicePayoutFeeFromRules({
      grossAmount: input.grossAmount,
      currency: input.currency,
      services: input.services,
      payoutRules,
    });
  }

  private async requireProviderProfile(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider) {
      throw new NotFoundException('Partner profile not found');
    }
    return provider;
  }

  private async ensurePayoutEligible(tx: TxClient, providerProfileId: string) {
    const provider = await tx.providerProfile.findUnique({
      where: { id: providerProfileId },
      include: {
        taxProfile: true,
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
    if (!provider.taxProfile || provider.taxProfile.status !== ProviderTaxProfileStatus.APPROVED) {
      throw new BadRequestException('Partner tax profile must be approved before payout');
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
    return {
      user: { select: { id: true, phone: true, fullName: true } },
      sanctions: {
        where: activePayoutHoldWhere(),
        orderBy: { startsAt: 'desc' as const },
        take: 3,
      },
    };
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
    const wallet = await client.providerEarning.aggregate({
      where: {
        providerProfileId,
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
      },
      _sum: { netAmount: true },
    });
    const walletBalance = wallet._sum.netAmount ?? 0;
    if (walletBalance < 0) {
      throwProviderWalletBlocked({ providerProfileId, walletBalance });
    }
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
        currency: input.currency,
        policyVersionId: policy?.id,
        taxProfileId: taxProfile?.id,
        ruleSnapshot: {
          reason: !policy ? 'NO_ACTIVE_POLICY' : 'NO_APPROVED_TAX_PROFILE',
        },
      };
    }

    const rule = selectTaxRule(policy.rules, {
      grossAmount: input.grossAmount,
      serviceTypes: input.serviceTypes,
    });
    const rateBps = rule?.rateBps ?? 0;
    const fixedAmount = rule?.fixedAmount ?? 0;
    const withholdingAmount = Math.max(
      0,
      Math.min(taxableAmount, Math.round((taxableAmount * rateBps) / 10_000) + fixedAmount),
    );

    return {
      taxableAmount,
      withholdingAmount,
      currency: input.currency,
      policyVersionId: policy.id,
      taxProfileId: taxProfile.id,
      ruleSnapshot: {
        policyName: policy.name,
        ruleId: rule?.id ?? null,
        scope: rule?.scope ?? 'NONE',
        serviceType: rule?.serviceType ?? null,
        minGrossAmount: rule?.minGrossAmount ?? null,
        maxGrossAmount: rule?.maxGrossAmount ?? null,
        rateBps,
        fixedAmount,
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

function normalizeCashFeeSettlementMethod(
  value: string | null | undefined,
): CashFeeSettlementMethod | null {
  const clean = cleanOptionalText(value);
  if (!clean) {
    return null;
  }
  if (
    clean === CashFeeSettlementMethod.PARTNER_DEPOSIT ||
    clean === CashFeeSettlementMethod.ADMIN_OFFSET
  ) {
    return clean;
  }
  throw new BadRequestException('Invalid cash fee settlement method');
}

function activePayoutHoldWhere(providerProfileId?: string): Prisma.ProviderSanctionWhereInput {
  return {
    ...(providerProfileId ? { providerProfileId } : {}),
    type: ProviderSanctionType.PAYOUT_HOLD,
    status: ProviderSanctionStatus.ACTIVE,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

function selectTaxRule(rules: TaxRuleRecord[], input: { grossAmount: number; serviceTypes: string[] }) {
  const serviceTypes = new Set(input.serviceTypes.map((value) => value.toLowerCase()));
  const prioritized = [...rules].sort(
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
