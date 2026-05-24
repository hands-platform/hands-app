import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  EarningStatus,
  PayoutBatchStatus,
  Prisma,
  ProviderBankAccountStatus,
  ProviderSanctionStatus,
  ProviderSanctionType,
  ProviderTaxProfileStatus,
  TaxPolicyStatus,
  TaxRuleScope,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PAYOUT_AGREEMENTS } from '../provider-onboarding/provider-onboarding.policy';

const DEFAULT_PLATFORM_FEE_RATE = 0.2;

type TaxPolicyWithRules = Prisma.TaxPolicyVersionGetPayload<{ include: { rules: true } }>;
type TaxRuleRecord = TaxPolicyWithRules['rules'][number];
type TxClient = Prisma.TransactionClient;

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
      throw new BadRequestException('Provider is not selected for this booking');
    }

    const grossAmount =
      booking.payment?.amount ??
      booking.services.reduce((total, service) => total + service.price * service.quantity, 0);
    const tipAmount = booking.review?.tipAmount ?? 0;
    const platformFee = Math.round(grossAmount * DEFAULT_PLATFORM_FEE_RATE);
    const availableAt = new Date(Date.now() + 24 * 60 * 60_000);
    const currency = booking.payment?.currency ?? 'VND';
    const serviceTypes = booking.services.flatMap((item) =>
      [item.serviceId, item.service?.name].filter(Boolean),
    );

    return this.prisma.$transaction(async (tx) => {
      const tax = await this.calculateWithholding(tx, {
        providerProfileId,
        bookingId,
        grossAmount,
        currency,
        serviceTypes,
        occurredAt: booking.updatedAt ?? new Date(),
      });
      const netAmount = grossAmount - platformFee - tax.withholdingAmount + tipAmount;
      const earning = await tx.providerEarning.upsert({
        where: { bookingId },
        update: {
          providerProfileId,
          grossAmount,
          platformFee,
          withholdingAmount: tax.withholdingAmount,
          tipAmount,
          netAmount,
          currency,
          status: EarningStatus.PENDING,
          availableAt,
        },
        create: {
          bookingId,
          providerProfileId,
          grossAmount,
          platformFee,
          withholdingAmount: tax.withholdingAmount,
          tipAmount,
          netAmount,
          currency,
          status: EarningStatus.PENDING,
          availableAt,
        },
      });

      await this.upsertTaxLog(tx, earning, tax);
      return earning;
    });
  }

  async applyTip(bookingId: string, tipAmount: number) {
    if (tipAmount <= 0) {
      return null;
    }

    const earning = await this.prisma.providerEarning.findUnique({ where: { bookingId } });
    if (!earning) {
      return null;
    }

    return this.prisma.providerEarning.update({
      where: { bookingId },
      data: {
        tipAmount,
        netAmount: earning.grossAmount - earning.platformFee - earning.withholdingAmount + tipAmount,
      },
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
    return {
      ...summary,
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
        booking: { include: { payment: true, review: true } },
        taxLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  adminSummary() {
    return this.summaryWhere({});
  }

  async markPaid(earningId: string) {
    const earning = await this.prisma.providerEarning.findUnique({ where: { id: earningId } });
    if (!earning) {
      throw new NotFoundException('Earning not found');
    }

    return this.prisma.providerEarning.update({
      where: { id: earningId },
      data: {
        status: EarningStatus.PAID,
        paidAt: new Date(),
      },
    });
  }

  async createProviderPayoutBatch(input: {
    providerProfileId: string;
    transferRef?: string;
    notes?: string;
  }) {
    const provider = await this.prisma.providerProfile.findUnique({ where: { id: input.providerProfileId } });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
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
            include: { taxLogs: { orderBy: { createdAt: 'desc' } } },
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
          include: { taxLogs: { orderBy: { createdAt: 'desc' } } },
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

    return this.prisma.$transaction(async (tx) => {
      if (nextStatus === PayoutBatchStatus.PROCESSING || nextStatus === PayoutBatchStatus.PAID) {
        await this.ensureNoActivePayoutHold(tx, existing.providerProfileId);
      }
      const paidAt = nextStatus === PayoutBatchStatus.PAID ? (existing.paidAt ?? new Date()) : undefined;
      const batch = await tx.providerPayoutBatch.update({
        where: { id: payoutBatchId },
        data: {
          status: nextStatus,
          transferRef: input.transferRef === undefined ? undefined : normalizeNullable(input.transferRef),
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
      }

      return tx.providerPayoutBatch.findUniqueOrThrow({
        where: { id: payoutBatchId },
        include: {
          providerProfile: { include: this.providerPayoutInclude() },
          earnings: {
            orderBy: { createdAt: 'desc' },
            include: { taxLogs: { orderBy: { createdAt: 'desc' } } },
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

    const cancelled = await this.prisma.providerEarning.update({
      where: { bookingId },
      data: {
        status: EarningStatus.CANCELLED,
        netAmount: 0,
      },
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
          tipAmount: true,
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
      tipAmount: total._sum.tipAmount ?? 0,
      netAmount: total._sum.netAmount ?? 0,
      pendingNetAmount: pending._sum.netAmount ?? 0,
      availableNetAmount: available._sum.netAmount ?? 0,
      paidNetAmount: paid._sum.netAmount ?? 0,
      currency: 'VND',
    };
  }

  private async requireProviderProfile(userId: string) {
    const provider = await this.prisma.providerProfile.findUnique({ where: { userId } });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
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
      throw new NotFoundException('Provider profile not found');
    }

    await this.ensureNoActivePayoutHold(tx, providerProfileId);

    const completedBookingCount = await tx.booking.count({
      where: { selectedProviderId: providerProfileId, status: BookingStatus.COMPLETED },
    });
    const acceptedAgreementTypes = new Set(provider.agreements.map((agreement) => agreement.type));
    const missingAgreements = REQUIRED_PAYOUT_AGREEMENTS.filter((type) => !acceptedAgreementTypes.has(type));

    if (completedBookingCount < 1) {
      throw new BadRequestException('Provider must complete at least one booking before payout');
    }
    if (!provider.taxProfile || provider.taxProfile.status !== ProviderTaxProfileStatus.APPROVED) {
      throw new BadRequestException('Provider tax profile must be approved before payout');
    }
    if (!provider.residentialAddress?.trim()) {
      throw new BadRequestException('Provider residential address is required before payout');
    }
    if (provider.bankAccounts.length === 0) {
      throw new BadRequestException('Provider needs an approved bank account before payout');
    }
    if (missingAgreements.length > 0) {
      throw new BadRequestException(
        `Provider must accept payout agreements: ${missingAgreements.join(', ')}`,
      );
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
      throw new BadRequestException(`Provider payout is blocked by active sanction: ${payoutHold.reason}`);
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
}

function normalizeNullable(value: string | null) {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
