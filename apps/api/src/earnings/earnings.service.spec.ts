import {
  AccountingJournalBatchStatus,
  AccountingJournalEntrySide,
  AccountingJournalSourceType,
  BankReconciliationStatus,
  BookingStatus,
  CompanyBankTransactionType,
  EarningStatus,
  MonthlyTaxClosingStatus,
  PartnerTaxLineKind,
  PartnerBankDepositRequestStatus,
  PaymentFeePayer,
  PaymentFeeTreatment,
  PaymentMethod,
  PaymentStatus,
  PayoutBatchStatus,
  ProviderAgreementType,
  ProviderBankAccountStatus,
  ProviderTaxProfileStatus,
  ProviderWalletLedgerType,
  ProviderWalletWithdrawalRequestStatus,
  Role,
} from '@prisma/client';
import { adminBookingProductionDataWhere } from '../admin/admin-booking-list-query';
import { EarningsService } from './earnings.service';

type EarningsServiceWithWithdrawalRequests = EarningsService & {
  providerWalletWithdrawalRequestSummaryForAdmin: (options: {
    range?: string | null;
    providerProfileId?: string | null;
    reconciliation?: string | null;
  }) => Promise<unknown>;
  createProviderWalletWithdrawalRequestForProviderUser: (
    userId: string,
    input: { amount: number; bankAccountId?: string | null; requestNote?: string | null },
  ) => Promise<unknown>;
  updateProviderWalletWithdrawalRequestForAdmin: (
    requestId: string,
    input: {
      status?: ProviderWalletWithdrawalRequestStatus | string | null;
      transferRef?: string | null;
      bankTransferDate?: Date | string | null;
      attachmentFileId?: string | null;
      attachmentUrl?: string | null;
      adminNote?: string | null;
      correctionReason?: string | null;
    },
    adminId: string,
  ) => Promise<unknown>;
};

function cashSettlementSummarySqlRow(overrides: Record<string, unknown> = {}) {
  return {
    allocatedAmount: 0n,
    cashPaymentRowCount: 0n,
    currency: 'VND',
    globalAllocatedAmount: 0n,
    globalMissingSettlementEvidenceCount: 0n,
    globalOriginalDebtAmount: 0n,
    globalProviderCount: 0n,
    globalRemainingDebtAmount: 0n,
    globalRowCount: 0n,
    globalStaleDebtRowCount: 0n,
    highDebtProviderCount: 0n,
    missingPaymentEvidenceCount: 0n,
    missingSettlementEvidenceCount: 0n,
    oldestOpenAt: null,
    originalDebtAmount: 0n,
    providerCount: 0n,
    queueAgeAll: 0n,
    queueAgeFourToTwentyFourHours: 0n,
    queueAgeOneToFourHours: 0n,
    queueAgeOverTwentyFourHours: 0n,
    queueAgeUnderOneHour: 0n,
    queueAll: 0n,
    queueHighDebt: 0n,
    queueMissingEvidence: 0n,
    queuePaymentCheck: 0n,
    queueSlaOverdue: 0n,
    queueStale: 0n,
    remainingDebtAmount: 0n,
    rowCount: 0n,
    staleDebtRowCount: 0n,
    totalCompanyCouponOffset: 0n,
    totalPlatformFee: 0n,
    totalTaxAmount: 0n,
    ...overrides,
  };
}

function rawQueryText(mock: ReturnType<typeof vi.fn>, call = 0) {
  const query = mock.mock.calls[call]?.[0] as { strings?: readonly string[] } | undefined;
  return query?.strings?.join('?') ?? '';
}

function bookedPayoutSnapshot(
  customerPrice: number,
  providerPayoutAmount: number,
  vatBps = 800,
) {
  return {
    payoutRuleIdSnapshot: 'payout-rule-booked-1',
    providerPayoutAmountSnapshot: providerPayoutAmount,
    payoutRuleSnapshot: {
      id: 'payout-rule-booked-1',
      customerPrice,
      providerPayoutAmount,
      vatBps,
      otherCostAmount: 0,
      currency: 'VND',
    },
  };
}

describe('EarningsService booking payout snapshots', () => {
  type SnapshotCalculator = {
    calculateServicePayoutFee: (
      tx: unknown,
      input: {
        grossAmount: number;
        currency: string;
        services: Array<{
          serviceId: string;
          price: number;
          quantity: number;
          payoutRuleIdSnapshot?: string | null;
          providerPayoutAmountSnapshot?: number | null;
          payoutRuleSnapshot?: unknown;
        }>;
      },
    ) => Promise<{
      platformFeeAmount: number;
      ruleSnapshot: { providerPayoutAmount: number };
    }>;
  };

  it('uses the booked payout snapshot without reading a later catalog rule', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'payout-rule-changed-later',
        serviceId: 'service-1',
        customerPrice: 600_000,
        providerPayoutAmount: 100_000,
        vatBps: 800,
        otherCostAmount: 0,
        currency: 'VND',
      },
    ]);
    const service = new EarningsService({} as never) as unknown as SnapshotCalculator;

    const result = await service.calculateServicePayoutFee(
      { servicePayoutRule: { findMany } },
      {
        grossAmount: 600_000,
        currency: 'VND',
        services: [
          {
            serviceId: 'service-1',
            price: 600_000,
            quantity: 1,
            ...bookedPayoutSnapshot(600_000, 430_000),
          },
        ],
      },
    );

    expect(result.platformFeeAmount).toBe(170_000);
    expect(result.ruleSnapshot.providerPayoutAmount).toBe(430_000);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('fails closed when a completed booking has no payout snapshot', async () => {
    const findMany = vi.fn();
    const service = new EarningsService({} as never) as unknown as SnapshotCalculator;

    await expect(
      service.calculateServicePayoutFee(
        { servicePayoutRule: { findMany } },
        {
          grossAmount: 600_000,
          currency: 'VND',
          services: [{ serviceId: 'service-1', price: 600_000, quantity: 1 }],
        },
      ),
    ).rejects.toThrow('Booking payout snapshot is missing or invalid for service service-1');
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('EarningsService payout batches', () => {
  it('exposes a partner bank correction request on the wallet summary', async () => {
    const reviewedAt = new Date('2026-06-28T09:30:00.000Z');
    const updatedAt = new Date('2026-06-28T09:35:00.000Z');
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'provider-1',
          userId: 'provider-user-1',
          bankAccounts: [
            {
              id: 'bank-rejected',
              status: ProviderBankAccountStatus.REJECTED,
              isPrimary: true,
              rejectionReason: 'Account holder name does not match KYC.',
              reviewedAt,
              updatedAt,
              deletedAt: null,
            },
          ],
        }),
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: {} }),
        count: vi.fn().mockResolvedValue(0),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.summaryForProviderUser('provider-user-1')).resolves.toMatchObject({
      bankCorrectionRequest: {
        required: true,
        action: 'UPDATE_BANK_ACCOUNT',
        bankAccountId: 'bank-rejected',
        message: '입금 정보가 정확하지 않아 입금이 되지 않습니다.',
        reason: 'Account holder name does not match KYC.',
        reviewedAt,
        updatedAt,
      },
    });
  });

  it('uses the wallet ledger balance for partner wallet blocking in the summary', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'provider-1',
          userId: 'provider-user-1',
          bankAccounts: [],
        }),
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { grossAmount: 0, netAmount: 0, platformFeeAmount: 0, taxWithheldAmount: 0 },
        }),
        count: vi.fn().mockResolvedValue(0),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -225_000 } }),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.summaryForProviderUser('provider-user-1')).resolves.toMatchObject({
      walletBalance: -225_000,
      walletBlocked: true,
      marketplaceJoinBlocked: false,
      directFirstPickBlocked: true,
      walletDebtAmount: 225_000,
      walletSettlementRequired: true,
    });
    expect(prisma.providerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { providerProfileId: 'provider-1' },
      _sum: { amount: true },
    });
  });

  it('filters admin earnings by range, review state, and bounded limit', async () => {
    const prisma = {
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listForAdmin({
        range: 'today',
        review: 'ready',
        skip: '25',
        take: '500',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerEarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          AND: expect.arrayContaining([
            { booking: { is: adminBookingProductionDataWhere() } },
            expect.objectContaining({
              booking: { is: { status: BookingStatus.COMPLETED } },
              netAmount: { gt: 0 },
              payoutBatchId: null,
              status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
            }),
          ]),
        }),
        skip: 25,
        take: 100,
      }),
    );
  });

  it('filters admin closeout review earnings without hydrating non-action rows', async () => {
    const prisma = {
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listForAdmin({ range: 'today', review: 'closeout-review', take: '10' }),
    ).resolves.toEqual([]);

    expect(prisma.providerEarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { booking: { is: adminBookingProductionDataWhere() } },
            expect.objectContaining({
              AND: expect.arrayContaining([
                expect.objectContaining({
                  OR: expect.arrayContaining([
                    { netAmount: { lte: 0 } },
                    { booking: { is: { status: { not: BookingStatus.COMPLETED } } } },
                  ]),
                }),
                expect.objectContaining({ NOT: expect.any(Object) }),
              ]),
              payoutBatchId: null,
              status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
            }),
          ]),
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
        take: 10,
      }),
    );
  });

  it('uses compact selects for admin earning list relations', async () => {
    const prisma = {
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.listForAdmin({ range: 'today' })).resolves.toEqual([]);

    expect(prisma.providerEarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          booking: {
            select: expect.objectContaining({
              payment: { select: expect.objectContaining({ amount: true, method: true, status: true }) },
              services: expect.objectContaining({
                select: expect.objectContaining({
                  service: { select: expect.objectContaining({ durationMin: true, id: true, name: true }) },
                }),
              }),
            }),
          },
          platformFeeLogs: expect.objectContaining({
            select: expect.objectContaining({ id: true, ruleSnapshot: true }),
          }),
          taxLogs: expect.objectContaining({
            select: expect.objectContaining({ id: true, ruleSnapshot: true, withholdingAmount: true }),
          }),
          walletLedgerEntries: expect.objectContaining({
            select: expect.objectContaining({ id: true, metadata: true, reference: true, type: true }),
          }),
        }),
      }),
    );
    expect(prisma.providerEarning.findMany.mock.calls[0][0].include.booking).not.toHaveProperty('include');
    expect(prisma.providerEarning.findMany.mock.calls[0][0].include.booking.select).not.toHaveProperty(
      'review',
    );
  });

  it('filters admin earning summary by range without hydrating earning rows', async () => {
    const prisma = {
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: {} }),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn(),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.adminSummary({ range: 'today' })).resolves.toMatchObject({
      count: 0,
      generatedAt: expect.any(String),
      grossAmount: 0,
    });

    expect(prisma.providerEarning.findMany).not.toHaveBeenCalled();
    expect(prisma.providerEarning.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
    );
    expect(prisma.providerEarning.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
    );
  });

  it('filters admin payout batches by range, review state, and bounded limit', async () => {
    const prisma = {
      providerPayoutBatch: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listPayoutBatchesForAdmin({
        range: '7d',
        review: 'needs-review',
        skip: '25',
        take: '500',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerPayoutBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          AND: expect.arrayContaining([
            expect.objectContaining({
              earnings: {
                every: { booking: { is: adminBookingProductionDataWhere() } },
              },
            }),
            expect.objectContaining({
              status: { in: [PayoutBatchStatus.DRAFT, PayoutBatchStatus.FAILED] },
            }),
          ]),
        }),
        skip: 25,
        take: 100,
      }),
    );
    const payoutProductionScope = prisma.providerPayoutBatch.findMany.mock.calls[0]?.[0]?.where?.AND?.find(
      (entry: { earnings?: unknown }) => Boolean(entry.earnings),
    );
    expect(payoutProductionScope).not.toHaveProperty('NOT');
  });

  it('uses the Asia/Ho_Chi_Minh createdAt day boundary for payout range today', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T03:30:00.000Z'));
    try {
      const prisma = {
        providerPayoutBatch: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };
      const service = new EarningsService(prisma as never);

      await service.listPayoutBatchesForAdmin({ range: 'today' });

      expect(prisma.providerPayoutBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-08-25T17:00:00.000Z'),
              lte: new Date('2026-08-26T16:59:59.999Z'),
            },
          }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('separates open payout work from paid history at the database predicate', async () => {
    const prisma = {
      providerPayoutBatch: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await service.listPayoutBatchesForAdmin({ queue: 'open' });
    expect(prisma.providerPayoutBatch.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              status: { notIn: [PayoutBatchStatus.PAID, PayoutBatchStatus.CANCELLED] },
            }),
          ]),
        }),
      }),
    );

    await service.listPayoutBatchesForAdmin({ queue: 'paid' });
    expect(prisma.providerPayoutBatch.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ status: PayoutBatchStatus.PAID }),
          ]),
        }),
      }),
    );
  });

  it('uses the exact post-payment evidence predicate for the repair queue', async () => {
    const candidates = ['payout-1', 'payout-2'].map((id) => ({
      currency: 'VND',
      earnings: [{ withholdingAmount: 0 }],
      id,
      status: PayoutBatchStatus.PAID,
      totalNetAmount: 75_000,
      transferRef: `bank-${id}`,
      withholdingLogs: [],
    }));
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'payout-1',
          missingTransferRef: false,
          postedGlJournalMissing: false,
          walletLedgerMismatch: false,
          withholdingIncomplete: false,
        },
        {
          id: 'payout-2',
          missingTransferRef: false,
          postedGlJournalMissing: false,
          walletLedgerMismatch: true,
          withholdingIncomplete: false,
        },
      ]),
      providerPayoutBatch: {
        findMany: vi.fn().mockResolvedValueOnce(candidates).mockResolvedValueOnce([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.listPayoutBatchesForAdmin({ queue: 'repair', range: '7d' })).resolves.toEqual([]);

    expect(prisma.providerPayoutBatch.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ select: { id: true } }),
    );
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();

    expect(prisma.providerPayoutBatch.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ id: { in: ['payout-2'] } })]),
        }),
      }),
    );
  });

  it.each([
    ['missing-transfer-ref', 'missingTransferRef'],
    ['withholding-review', 'withholdingIncomplete'],
    ['wallet-ledger-mismatch', 'walletLedgerMismatch'],
    ['posted-gl-journal-missing', 'postedGlJournalMissing'],
  ] as const)('filters the repair queue by %s evidence', async (evidence, flag) => {
    const evidenceRow = {
      id: 'payout-matching-evidence',
      missingTransferRef: false,
      postedGlJournalMissing: false,
      walletLedgerMismatch: false,
      withholdingIncomplete: false,
      [flag]: true,
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        evidenceRow,
        {
          id: 'payout-other-evidence',
          missingTransferRef: false,
          postedGlJournalMissing: false,
          walletLedgerMismatch: false,
          withholdingIncomplete: false,
        },
      ]),
      providerPayoutBatch: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: 'payout-matching-evidence' }, { id: 'payout-other-evidence' }])
          .mockResolvedValueOnce([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listPayoutBatchesForAdmin({ evidence, queue: 'repair', range: 'all' }),
    ).resolves.toEqual([]);

    expect(prisma.providerPayoutBatch.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: { in: ['payout-matching-evidence'] } }),
          ]),
        }),
      }),
    );
  });

  it('rejects unsupported repair evidence before reading payout rows', async () => {
    const prisma = {
      providerPayoutBatch: { findMany: vi.fn() },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listPayoutBatchesForAdmin({ evidence: 'not-a-real-gap', queue: 'repair' }),
    ).rejects.toThrow('Unsupported payout repair evidence filter: not-a-real-gap');
    expect(prisma.providerPayoutBatch.findMany).not.toHaveBeenCalled();
  });

  it('lists the exact monthly paid payout bank-outflow candidates with remaining evidence amounts', async () => {
    const candidate = {
      id: 'payout-bank-gap-1',
      paidAt: new Date('2026-07-03T02:00:00.000Z'),
      targetAmount: 900_000n,
      matchedAmount: 250_000n,
      remainingAmount: 650_000n,
    };
    const payout = {
      id: candidate.id,
      status: PayoutBatchStatus.PAID,
      totalNetAmount: 900_000,
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([candidate]),
      providerPayoutBatch: {
        findMany: vi.fn().mockResolvedValue([payout]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listPayoutBatchesForAdmin({
        evidence: 'bank-match-incomplete',
        period: '2026-07',
        sort: 'oldest',
        status: PayoutBatchStatus.PAID,
        view: 'summary',
      }),
    ).resolves.toEqual([
      {
        ...payout,
        bankReconciliation: {
          id: candidate.id,
          matchedAmount: 250_000,
          paidAt: candidate.paidAt,
          period: '2026-07',
          remainingAmount: 650_000,
          targetAmount: 900_000,
        },
      },
    ]);
    expect(prisma.providerPayoutBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: { in: [candidate.id] } }),
            { status: PayoutBatchStatus.PAID },
          ]),
        }),
      }),
    );
  });

  it('summarizes the same monthly payout bank-outflow candidates and rejects a missing period', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'payout-bank-gap-1',
          paidAt: new Date('2026-07-03T02:00:00.000Z'),
          targetAmount: 900_000n,
          matchedAmount: 250_000n,
          remainingAmount: 650_000n,
        },
        {
          id: 'payout-bank-gap-2',
          paidAt: new Date('2026-07-04T02:00:00.000Z'),
          targetAmount: 400_000n,
          matchedAmount: 300_000n,
          remainingAmount: 100_000n,
        },
      ]),
      providerPayoutBatch: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'payout-bank-gap-1' },
          { id: 'payout-bank-gap-2' },
        ]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.payoutBatchSummaryForAdmin({
        evidence: 'bank-match-incomplete',
        period: '2026-07',
        status: PayoutBatchStatus.PAID,
      }),
    ).resolves.toMatchObject({
      bankReconciliationCandidateCount: 2,
      bankReconciliationPeriod: '2026-07',
      bankReconciliationRemainingAmount: 750_000,
      settled: 2,
      total: 2,
      totalNetAmount: 1_300_000,
    });

    await expect(
      service.payoutBatchSummaryForAdmin({ evidence: 'bank-match-incomplete' }),
    ).rejects.toThrow('Payout bank reconciliation period must use YYYY-MM');
  });

  it('summarizes admin payout batches with aggregate queries instead of loading full batches', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'payout-10',
          missingTransferRef: false,
          postedGlJournalMissing: true,
          walletLedgerMismatch: false,
          withholdingIncomplete: false,
        },
        {
          id: 'payout-11',
          missingTransferRef: false,
          postedGlJournalMissing: false,
          walletLedgerMismatch: true,
          withholdingIncomplete: false,
        },
      ]),
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 900000 } }),
        count: vi
          .fn()
          .mockResolvedValueOnce(12)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(20),
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 12 }, (_, index) => ({
            currency: 'VND',
            id: `payout-${index}`,
            status: PayoutBatchStatus.PAID,
            totalNetAmount: 75000,
            transferRef: `VCB-${index}`,
            earnings: [
              {
                currency: 'VND',
                grossAmount: 100000,
                netAmount: 70000,
                platformFee: 10000,
                withholdingAmount: 20000,
              },
            ],
            withholdingLogs: [{ status: 'PAID' }],
          })),
        ),
      },
      providerWalletLedgerEntry: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 10 }, (_, index) => ({
            amount: -75000,
            payoutBatchId: `payout-${index}`,
          })),
        ),
      },
      accountingJournalBatch: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 10 }, (_, index) => ({
            sourceId: `payout-${index}`,
            sourceKey: `accounting-journal:provider-payout-batch:payout-${index}:paid`,
            status: AccountingJournalBatchStatus.POSTED,
            totalCredit: 75000,
            totalDebit: 75000,
          })),
        ),
      },
      withholdingLog: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 75000 } }),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.payoutBatchSummaryForAdmin({ range: '7d' })).resolves.toEqual({
      currency: 'VND',
      generatedAt: expect.any(String),
      range: '7d',
      timeZone: 'Asia/Ho_Chi_Minh',
      scopeCount: 12,
      inProgress: 3,
      missingTransferRefs: 4,
      needsReview: 2,
      open: 6,
      payoutHolds: 1,
      settled: 5,
      total: 12,
      totalNetAmount: 900000,
      withholdingAmount: 75000,
      postPaymentRepairCount: 2,
      moneyFlow: {
        scope: '7d',
        scopeBatchCount: 12,
        totalBatchCount: 20,
        evidenceBatchCount: 12,
        grossAmount: 1_200_000,
        payoutNetAmount: 900_000,
        evidenceNetAmount: 840_000,
        platformFeeAmount: 120_000,
        withholdingAmount: 240_000,
        cashDebtAmount: 0,
        netGap: 60_000,
        completeness: 'COMPLETE',
        verdict: 'MISMATCH',
        generatedAt: expect.any(String),
      },
    });

    expect(prisma.providerPayoutBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ earnings: expect.any(Object), totalNetAmount: true }),
      }),
    );
    expect(prisma.providerPayoutBatch.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
    );
    expect(prisma.providerPayoutBatch.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { totalNetAmount: true },
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
    );
    expect(prisma.withholdingLog.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { amount: true },
      }),
    );
  });

  it('uses compact selects for admin payout batch nested earnings', async () => {
    const prisma = {
      providerPayoutBatch: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.listPayoutBatchesForAdmin({ range: '7d' })).resolves.toEqual([]);

    expect(prisma.providerPayoutBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          earnings: expect.objectContaining({
            include: expect.objectContaining({
              booking: {
                select: expect.objectContaining({
                  payment: { select: expect.objectContaining({ amount: true, method: true, status: true }) },
                  services: expect.objectContaining({
                    select: expect.objectContaining({
                      service: {
                        select: expect.objectContaining({ durationMin: true, id: true, name: true }),
                      },
                    }),
                  }),
                }),
              },
              platformFeeLogs: expect.objectContaining({
                select: expect.objectContaining({ id: true, ruleSnapshot: true }),
              }),
              taxLogs: expect.objectContaining({
                select: expect.objectContaining({ id: true, ruleSnapshot: true, withholdingAmount: true }),
              }),
              walletLedgerEntries: expect.objectContaining({
                select: expect.objectContaining({ id: true, reference: true, type: true }),
              }),
            }),
          }),
          providerProfile: expect.objectContaining({
            include: expect.objectContaining({
              bankAccounts: expect.objectContaining({
                take: 3,
              }),
              walletLedgerEntries: expect.objectContaining({
                take: 5,
              }),
            }),
          }),
        }),
      }),
    );
    expect(
      prisma.providerPayoutBatch.findMany.mock.calls[0][0].include.earnings.include.booking,
    ).not.toHaveProperty('include');
  });

  it('uses the lightweight payout list projection without raw payment or ledger metadata', async () => {
    const prisma = {
      providerPayoutBatch: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.listPayoutBatchesForAdmin({ range: '7d', view: 'summary' })).resolves.toEqual([]);

    const include = prisma.providerPayoutBatch.findMany.mock.calls[0][0].include;
    expect(include.earnings).toEqual(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          netAmount: true,
          status: true,
          booking: {
            select: expect.objectContaining({
              payment: {
                select: {
                  amount: true,
                  currency: true,
                  method: true,
                  status: true,
                },
              },
            }),
          },
        }),
      }),
    );
    expect(include.earnings).not.toHaveProperty('include');
    expect(include.earnings.select.booking.select.payment.select).not.toHaveProperty('rawMeta');
    expect(include.earnings.select).not.toHaveProperty('platformFeeLogs');
    expect(include.earnings.select).not.toHaveProperty('taxLogs');
    expect(include.earnings.select).not.toHaveProperty('walletLedgerEntries');
    expect(include.withholdingLogs.select).toEqual(expect.objectContaining({ amount: true, status: true }));
  });

  it('excludes post-match cancellation fee holds from cash settlement debt lists', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.listCashSettlementDebtForAdmin()).resolves.toEqual([]);

    const sql = rawQueryText(prisma.$queryRaw);
    expect(sql).toContain('booking.status::text =');
    expect(sql).toContain('booking."matchedAt" IS NOT NULL OR booking."selectedProviderId" IS NOT NULL');
    expect(sql).toContain('debt."remainingDebtAmount" > 0');
    expect(prisma.providerEarning.findMany).not.toHaveBeenCalled();
  });

  it('uses a compact include for cash settlement debt lists', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'earning-1', originalDebtAmount: 120_000n, allocatedAmount: 20_000n, remainingDebtAmount: 100_000n },
      ]),
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.listCashSettlementDebtForAdmin()).resolves.toEqual([]);

    const include = prisma.providerEarning.findMany.mock.calls[0][0].include;
    expect(include).toEqual(
      expect.objectContaining({
        booking: expect.objectContaining({ select: expect.any(Object) }),
        providerProfile: expect.objectContaining({ include: expect.any(Object) }),
        walletLedgerEntries: expect.objectContaining({
          select: expect.objectContaining({ metadata: true, reference: true, type: true }),
          take: 5,
        }),
      }),
    );
    expect(include).not.toHaveProperty('platformFeeLogs');
    expect(include).not.toHaveProperty('taxLogs');
  });

  it('filters cash settlement debt by range and clamps requested limits', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listCashSettlementDebtForAdmin({
        range: 'today',
        take: '500',
      }),
    ).resolves.toEqual([]);

    const query = prisma.$queryRaw.mock.calls[0][0] as { strings: readonly string[]; values: unknown[] };
    expect(query.strings.join('?')).toContain('debt."createdAt" >=');
    expect(query.strings.join('?')).toContain('LIMIT');
    expect(query.values).toContain(100);
    expect(prisma.providerEarning.findMany).not.toHaveBeenCalled();
  });

  it('uses the stored settlement month for cash debt list and summary filters', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([cashSettlementSummarySqlRow()]),
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 1_440 }),
      },
      providerEarning: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new EarningsService(prisma as never);

    await service.listCashSettlementDebtForAdmin({ period: '2026-08' });
    await service.cashSettlementSummaryForAdmin({ period: '2026-08' });

    const [listQuery, summaryQuery] = prisma.$queryRaw.mock.calls.map(
      ([query]) => query as { strings: readonly string[]; values: unknown[] },
    );
    expect(listQuery.strings.join('?')).toContain('debt."monthlyPeriod" =');
    expect(summaryQuery.strings.join('?')).toContain('debt."monthlyPeriod" =');
    expect(listQuery.values).toContain('2026-08');
    expect(summaryQuery.values).toContain('2026-08');
    expect(listQuery.values).not.toContain('2026-07');
  });

  it('applies server-side cash settlement search, queue, and pagination filters', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listCashSettlementDebtForAdmin({
        q: 'Mai +8490',
        queue: 'high-debt',
        skip: '25',
        take: '25',
      }),
    ).resolves.toEqual([]);

    const query = prisma.$queryRaw.mock.calls[0][0] as { strings: readonly string[]; values: unknown[] };
    const sql = query.strings.join('?');
    expect(sql).toContain('debt."remainingDebtAmount" >=');
    expect(sql).toContain('debt."providerDisplayName"');
    expect(sql).toContain('search_ledger.reference');
    expect(query.values).toContain('%Mai +8490%');
    expect(query.values).toContain(25);
    expect(prisma.providerEarning.findMany).not.toHaveBeenCalled();
  });

  it('sorts the full cash settlement queue by highest exposure before pagination', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 'earning-1', originalDebtAmount: 600_000n, allocatedAmount: 200_000n, remainingDebtAmount: 400_000n },
      ]),
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await service.listCashSettlementDebtForAdmin({ sort: 'highest-debt', skip: '10', take: '10' });

    expect(rawQueryText(prisma.$queryRaw)).toContain(
      'ORDER BY debt."remainingDebtAmount" DESC, debt."createdAt" ASC, debt.id ASC',
    );
    expect(prisma.providerEarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['earning-1'] } },
        include: expect.objectContaining({
          bankDepositCashDebtAllocations: expect.objectContaining({
            select: expect.objectContaining({ amount: true, partnerBankDepositRequest: expect.any(Object) }),
          }),
        }),
      }),
    );
  });

  it('returns authoritative original, allocated, and remaining amounts from the paged debt query', async () => {
    const earning = { id: 'earning-1', netAmount: -600_000 };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'earning-1',
          originalDebtAmount: 600_000n,
          allocatedAmount: 450_000n,
          remainingDebtAmount: 150_000n,
        },
      ]),
      providerEarning: { findMany: vi.fn().mockResolvedValue([earning]) },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.listCashSettlementDebtForAdmin({ sort: 'highest-debt' })).resolves.toEqual([
      {
        ...earning,
        allocatedAmount: 450_000,
        originalDebtAmount: 600_000,
        remainingDebtAmount: 150_000,
      },
    ]);
  });

  it('loads exact open debt evidence and only unallocated approved deposits', async () => {
    const earning = {
      id: 'earning-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      currency: 'VND',
      netAmount: -120_000,
      bankDepositCashDebtAllocations: [
        {
          amount: 20_000,
          partnerBankDepositRequest: { id: 'deposit-linked-1' },
        },
      ],
    };
    const prisma = {
      providerEarning: { findFirst: vi.fn().mockResolvedValue(earning) },
      partnerBankDepositRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'deposit-available-1',
            requestedReceivableRecovery: 150_000,
            cashDebtAllocations: [{ amount: 40_000 }],
          },
          {
            id: 'deposit-used-1',
            requestedReceivableRecovery: 50_000,
            cashDebtAllocations: [{ amount: 50_000 }],
          },
        ]),
      },
      providerWalletBalanceSummary: {
        findUnique: vi.fn().mockResolvedValue({ balance: -100_000n }),
      },
      adminAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cashSettlementDebtDetailForAdmin('earning-1')).resolves.toMatchObject({
      allocatedAmount: 20_000,
      remainingDebtAmount: 100_000,
      walletBalance: -100_000,
      availableDeposits: [
        expect.objectContaining({
          id: 'deposit-available-1',
          allocatedAmount: 40_000,
          remainingReceivableRecovery: 110_000,
        }),
      ],
    });
    expect(prisma.providerEarning.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.arrayContaining([{ id: 'earning-1' }]) }),
      }),
    );
    expect(prisma.partnerBankDepositRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerProfileId: 'partner-1',
          status: PartnerBankDepositRequestStatus.EXECUTED,
          ledgerEntryId: { not: null },
          journalBatchId: { not: null },
        }),
      }),
    );
  });

  it('rejects direct cash debt settlement before any transaction can mutate evidence', async () => {
    const prisma = {
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue({ id: 'earning-1', netAmount: -120_000 }),
      },
      $transaction: vi.fn(),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.markPaid('earning-1', {
        settlementMethod: 'PARTNER_DEPOSIT',
        settlementRef: 'HANDS-CASH-booking-1',
      }),
    ).rejects.toThrow('Cash fee debt can only be settled by allocating approved evidence');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the same post-match cancellation exclusion for cash settlement summaries', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([cashSettlementSummarySqlRow()]),
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 1_440 }),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cashSettlementSummaryForAdmin()).resolves.toMatchObject({
      rowCount: 0,
      totalDebtAmount: 0,
    });

    const sql = rawQueryText(prisma.$queryRaw);
    expect(sql).toContain('booking.status::text =');
    expect(sql).toContain('debt."remainingDebtAmount" > 0');
  });

  it('counts cash reconciliation debt overdue under the configured SLA', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T08:00:00.000Z'));
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([cashSettlementSummarySqlRow({ queueSlaOverdue: 3n })]),
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 90 }),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.cashSettlementSummaryForAdmin({ age: 'under-1h', sla: 'overdue' }),
    ).resolves.toMatchObject({
      queueSla: { overdueCount: 3, thresholdMinutes: 90 },
    });
    const query = prisma.$queryRaw.mock.calls[0][0] as { values: unknown[] };
    expect(query.values).toContainEqual(new Date('2026-07-19T06:30:00.000Z'));
    vi.useRealTimers();
  });

  it('opens the exact critical cash reconciliation subset from Start Shift', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T08:00:00.000Z'));
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 90 }),
      },
      providerEarning: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new EarningsService(prisma as never);

    await service.listCashSettlementDebtForAdmin({ sla: 'critical' });

    const query = prisma.$queryRaw.mock.calls[0][0] as { values: unknown[] };
    expect(query.values).toContainEqual(new Date('2026-07-18T08:00:00.000Z'));
    vi.useRealTimers();
  });

  it('summarizes company coupon offsets for cash settlement debt', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        cashSettlementSummarySqlRow({
          originalDebtAmount: 170_000n,
          allocatedAmount: 60_000n,
          remainingDebtAmount: 110_000n,
          rowCount: 1n,
          providerCount: 1n,
          totalCompanyCouponOffset: 60_000n,
          totalPlatformFee: 170_000n,
          totalTaxAmount: 42_000n,
        }),
      ]),
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 1_440 }),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cashSettlementSummaryForAdmin()).resolves.toMatchObject({
      rowCount: 1,
      totalCompanyCouponOffset: 60_000,
      totalDebtAmount: 110_000,
      totalOriginalDebtAmount: 170_000,
      totalAllocatedAmount: 60_000,
      totalPlatformFee: 170_000,
      totalTaxAmount: 42_000,
    });
    expect(rawQueryText(prisma.$queryRaw)).toContain('cashBookingCompanyCouponExpense');
  });

  it('filters cash settlement summaries by range and queue without hydrating unrelated earning rows', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([cashSettlementSummarySqlRow()]),
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 1_440 }),
      },
      providerEarning: { findMany: vi.fn() },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.cashSettlementSummaryForAdmin({ q: 'Mai', queue: 'missing-evidence', range: '7d' }),
    ).resolves.toMatchObject({
      rowCount: 0,
      totalDebtAmount: 0,
    });

    const query = prisma.$queryRaw.mock.calls[0][0] as { strings: readonly string[]; values: unknown[] };
    const sql = query.strings.join('?');
    expect(sql).toContain('debt."allocationCount" = 0');
    expect(sql).toContain('debt."createdAt" >=');
    expect(query.values).toContain('%Mai%');
    expect(prisma.providerEarning.findMany).not.toHaveBeenCalled();
  });

  it('returns all-date open backlog and filtered queue totals from one summary query', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        cashSettlementSummarySqlRow({
          globalAllocatedAmount: 70_000n,
          globalMissingSettlementEvidenceCount: 8n,
          globalOriginalDebtAmount: 1_070_000n,
          globalProviderCount: 7n,
          globalRemainingDebtAmount: 1_000_000n,
          globalRowCount: 9n,
          globalStaleDebtRowCount: 6n,
          remainingDebtAmount: 0n,
          rowCount: 0n,
        }),
      ]),
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 1_440 }),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cashSettlementSummaryForAdmin({ queue: 'payment-check' })).resolves.toMatchObject({
      global: {
        allocatedAmount: 70_000,
        missingSettlementEvidenceCount: 8,
        originalDebtAmount: 1_070_000,
        providerCount: 7,
        remainingDebtAmount: 1_000_000,
        rowCount: 9,
        staleDebtRowCount: 6,
      },
      rowCount: 0,
      totalDebtAmount: 0,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(rawQueryText(prisma.$queryRaw)).toContain('global_open');
  });

  it('blocks payout batches from ledger balance even when earning aggregate is positive', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      booking: {
        count: vi.fn().mockResolvedValue(1),
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: 600_000 } }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'earning-1',
            netAmount: 600_000,
            currency: 'VND',
          },
        ]),
        updateMany: vi.fn(),
      },
      providerPayoutBatch: {
        create: vi.fn().mockResolvedValue({ id: 'payout-batch-1' }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'payout-batch-1' }),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'provider-1',
          residentialAddress: 'Cau Giay, Hanoi',
          bankAccounts: [{ id: 'bank-account-1' }],
          agreements: [
            { type: ProviderAgreementType.TERMS },
            { type: ProviderAgreementType.PRIVACY },
            { type: ProviderAgreementType.LOCATION },
            { type: ProviderAgreementType.PAYOUT },
            { type: ProviderAgreementType.TAX },
          ],
        }),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerTaxLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -170_000 } }),
      },
      withholdingLog: {
        createMany: vi.fn(),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.createProviderPayoutBatch({
        providerProfileId: 'provider-1',
        transferRef: 'BANK-OUT-001',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT',
        walletBalance: -170_000,
      }),
    });

    expect(tx.providerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { providerProfileId: 'provider-1' },
      _sum: { amount: true },
    });
    expect(tx.providerEarning.aggregate).not.toHaveBeenCalled();
    expect(tx.providerPayoutBatch.create).not.toHaveBeenCalled();
  });

  it('creates partner receivable ledger when refund happens after payout was paid', async () => {
    const earning = {
      id: 'earning-paid-1',
      bookingId: 'booking-paid-refund-1',
      providerProfileId: 'provider-1',
      netAmount: 430_000,
      currency: 'VND',
      status: EarningStatus.PAID,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(earning),
        update: vi.fn(),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue({ id: 'refund-receivable-ledger-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cancelForRefund('booking-paid-refund-1')).resolves.toMatchObject({
      skipped: false,
      reason: 'PAID_REFUND_RECEIVABLE_CREATED',
      earning,
      receivableAmount: 430_000,
    });

    expect(tx.providerEarning.update).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'earning:earning-paid-1:paid-refund-receivable' },
      update: {},
      create: {
        providerProfileId: 'provider-1',
        bookingId: 'booking-paid-refund-1',
        earningId: 'earning-paid-1',
        type: ProviderWalletLedgerType.REFUND_REVERSAL,
        sourceKey: 'earning:earning-paid-1:paid-refund-receivable',
        amount: -430_000,
        currency: 'VND',
        notes: 'Paid earning converted to partner receivable by refund workflow',
        metadata: {
          previousNetAmount: 430_000,
          previousStatus: EarningStatus.PAID,
          refundAfterPayout: true,
          partnerReceivableAmount: 430_000,
        },
      },
    });
  });

  it('preserves a negative Partner fee when a post-match cancellation was held by admin', async () => {
    const earning = {
      id: 'earning-held-1',
      bookingId: 'booking-held-refund-1',
      providerProfileId: 'provider-1',
      netAmount: -30_000,
      currency: 'VND',
      status: EarningStatus.PENDING,
      booking: {
        closedReason: 'post_match_cancellation_fee_held',
      },
      payoutBatch: null,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(earning),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cancelForRefund('booking-held-refund-1')).resolves.toEqual({
      skipped: true,
      reason: 'POST_MATCH_CANCELLATION_FEE_HELD',
      earningId: 'earning-held-1',
      retainedFeeAmount: 30_000,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });

  it('does not create another reversal for an earning already cancelled by post-match approval', async () => {
    const earning = {
      id: 'earning-approved-1',
      bookingId: 'booking-approved-refund-1',
      providerProfileId: 'provider-1',
      netAmount: 0,
      currency: 'VND',
      status: EarningStatus.CANCELLED,
      booking: {
        closedReason: 'post_match_cancellation_approved',
      },
      payoutBatch: null,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(earning),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cancelForRefund('booking-approved-refund-1')).resolves.toEqual({
      skipped: true,
      reason: 'ALREADY_CANCELLED',
      earningId: 'earning-approved-1',
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });

  it('keeps payout evidence on partner receivable ledger when refund happens after a paid payout batch', async () => {
    const paidAt = new Date('2026-06-29T09:30:00.000Z');
    const earning = {
      id: 'earning-paid-batch-1',
      bookingId: 'booking-paid-batch-refund-1',
      providerProfileId: 'provider-1',
      payoutBatchId: 'payout-batch-paid-1',
      payoutBatch: {
        id: 'payout-batch-paid-1',
        status: PayoutBatchStatus.PAID,
        transferRef: 'VCB-PAID-001',
        paidAt,
      },
      netAmount: 430_000,
      currency: 'VND',
      status: EarningStatus.PAID,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(earning),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue({ id: 'refund-receivable-ledger-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await service.cancelForRefund('booking-paid-batch-refund-1');

    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'earning:earning-paid-batch-1:paid-refund-receivable' },
      update: {},
      create: expect.objectContaining({
        payoutBatchId: 'payout-batch-paid-1',
        reference: 'VCB-PAID-001',
        metadata: expect.objectContaining({
          payoutBatchId: 'payout-batch-paid-1',
          payoutBatchStatus: PayoutBatchStatus.PAID,
          payoutPaidAt: paidAt.toISOString(),
          payoutTransferRef: 'VCB-PAID-001',
        }),
      }),
    });
  });

  it('posts a split VAT/PIT settlement snapshot inside the completed booking transaction', async () => {
    const occurredAt = new Date('2026-06-13T03:02:00.000Z');
    const booking = {
      id: 'booking-1',
      customerProfileId: 'customer-1',
      selectedProviderId: 'provider-1',
      status: BookingStatus.COMPLETED,
      updatedAt: occurredAt,
      closedAt: occurredAt,
      payment: {
        id: 'payment-1',
        amount: 600_000,
        currency: 'VND',
        method: PaymentMethod.CARD,
      },
      review: null,
      services: [
        {
          serviceId: 'service-1',
          price: 600_000,
          quantity: 1,
          ...bookedPayoutSnapshot(600_000, 430_000),
          service: { id: 'service-1', name: 'Massage' },
        },
      ],
    };
    const earning = {
      id: 'earning-1',
      bookingId: 'booking-1',
      providerProfileId: 'provider-1',
      grossAmount: 600_000,
      platformFee: 170_000,
      withholdingAmount: 42_000,
      netAmount: 388_000,
      currency: 'VND',
      payoutBatchId: null,
      status: EarningStatus.AVAILABLE,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      platformFeePolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'platform-policy-1',
          name: 'Default platform fee',
          vatRateBps: 800,
          rules: [
            {
              id: 'platform-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              rateBps: 0,
              fixedAmount: 170_000,
            },
          ],
        }),
      },
      servicePayoutRule: { findMany: vi.fn().mockResolvedValue([]) },
      taxPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tax-policy-1',
          name: 'Default partner tax',
          rules: [
            {
              id: 'tax-vat-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_VAT,
              rateBps: 500,
              fixedAmount: 0,
            },
            {
              id: 'tax-pit-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_PIT,
              rateBps: 200,
              fixedAmount: 0,
            },
          ],
        }),
      },
      providerTaxProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tax-profile-1',
          status: ProviderTaxProfileStatus.APPROVED,
        }),
      },
      providerEarning: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(earning),
        upsert: vi.fn().mockResolvedValue(earning),
      },
      providerPlatformFeeLog: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue({ id: 'platform-log-1' }),
        create: vi.fn().mockResolvedValue({ id: 'platform-log-1' }),
        update: vi.fn().mockResolvedValue({ id: 'platform-log-1' }),
      },
      providerTaxLog: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'tax-log-1' }),
        create: vi.fn().mockResolvedValue({ id: 'tax-log-1' }),
        update: vi.fn().mockResolvedValue({ id: 'tax-log-1' }),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue({ id: 'wallet-ledger-1' }),
      },
    };
    const prisma = {
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const settlements = {
      upsertBookingSettlementSnapshot: vi.fn().mockResolvedValue({ id: 'settlement-1' }),
    };
    const service = new EarningsService(prisma as never, undefined, settlements as never);

    await expect(service.createForCompletedBooking('booking-1', 'provider-1')).resolves.toEqual(earning);

    const [bookingLock, settlementLock] = tx.$queryRaw.mock.calls.slice(0, 2).map(
      ([query]) => query as { strings: readonly string[]; values: unknown[] },
    );
    expect(bookingLock.strings.join('')).toContain('FROM "Booking"');
    expect(bookingLock.strings.join('')).toContain('FOR UPDATE');
    expect(bookingLock.values).toContain('booking-1');
    expect(settlementLock.values).toContain('booking-settlement:booking-1');
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[1],
    );

    expect(tx.providerEarning.findUnique).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
    });
    expect(tx.providerEarning.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking-1' },
        update: {},
      }),
    );
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'earning:earning-1:booking' },
        update: {},
      }),
    );
    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        customerProfileId: 'customer-1',
        providerProfileId: 'provider-1',
        paymentId: 'payment-1',
        providerEarningId: 'earning-1',
        paymentMethod: PaymentMethod.CARD,
        customerPaymentAmount: 600_000,
        partnerPayoutAmount: 388_000,
        platformFeeGross: 170_000,
        partnerVatRateBps: 500,
        partnerPitRateBps: 200,
        platformVatRateBps: 800,
        providerTaxLogIds: ['tax-log-1'],
        providerPlatformFeeLogId: 'platform-log-1',
        providerWalletLedgerEntryIds: ['wallet-ledger-1'],
        occurredAt,
      }),
      tx,
    );

    await service.createForCompletedBooking('booking-1', 'provider-1', {
      preserveExistingLifecycle: true,
    });

    expect(tx.providerEarning.upsert).toHaveBeenCalledTimes(2);
    expect(tx.providerPlatformFeeLog.create).toHaveBeenCalledTimes(1);
    expect(tx.providerPlatformFeeLog.update).toHaveBeenCalledTimes(1);
    expect(tx.providerTaxLog.create).toHaveBeenCalledTimes(1);
    expect(tx.providerTaxLog.update).toHaveBeenCalledTimes(1);
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledTimes(2);
    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledTimes(2);
  });

  it('rejects a new completed-booking settlement without authoritative completion time evidence', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-missing-completion-time',
          customerProfileId: 'customer-1',
          selectedProviderId: 'provider-1',
          status: BookingStatus.COMPLETED,
          closedAt: null,
          services: [],
          payment: null,
          review: null,
        }),
      },
      providerEarning: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.createForCompletedBooking('booking-missing-completion-time', 'provider-1'),
    ).rejects.toThrow('requires an authoritative completion time');
  });

  it('does not create an earning after a concurrent refund changed the locked booking state', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-refunded-before-closeout',
          selectedProviderId: 'provider-1',
          status: BookingStatus.REFUNDED,
          closedAt: new Date('2026-06-13T03:02:00.000Z'),
          services: [],
          payment: null,
          review: null,
        }),
      },
      providerEarning: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.createForCompletedBooking('booking-refunded-before-closeout', 'provider-1'),
    ).rejects.toThrow('Earnings can be created only for completed bookings');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.providerEarning.findUnique).not.toHaveBeenCalled();
    expect(tx.providerEarning.upsert).not.toHaveBeenCalled();
  });

  it('reconstructs paid settlement accounting from retained evidence without mutating earning or wallet rows', async () => {
    const occurredAt = new Date('2026-06-20T03:00:00.000Z');
    const booking = {
      id: 'booking-paid-gap-1',
      status: BookingStatus.COMPLETED,
      customerProfileId: 'customer-1',
      selectedProviderId: 'provider-1',
      updatedAt: occurredAt,
      closedAt: occurredAt,
      services: [{ price: 400_000, quantity: 1 }],
      payment: {
        id: 'payment-1',
        status: PaymentStatus.CAPTURED,
        method: PaymentMethod.MOMO,
        amount: 400_000,
        currency: 'VND',
        rawMeta: { provider: 'MOMO' },
      },
      settlementSnapshot: null,
      earning: {
        id: 'earning-paid-1',
        providerProfileId: 'provider-1',
        status: EarningStatus.PAID,
        grossAmount: 400_000,
        platformFee: 80_000,
        withholdingAmount: 20_000,
        netAmount: 300_000,
        currency: 'VND',
        paidAt: new Date('2026-06-21T03:00:00.000Z'),
        platformFeeLogs: [
          {
            id: 'fee-log-1',
            grossAmount: 400_000,
            platformFeeAmount: 80_000,
            currency: 'VND',
            policyVersionId: null,
            ruleSnapshot: { lines: [{ vatBps: 0 }] },
            policyVersion: null,
          },
        ],
        taxLogs: [
          {
            id: 'tax-log-1',
            grossAmount: 400_000,
            taxableAmount: 400_000,
            withholdingAmount: 20_000,
            currency: 'VND',
            policyVersionId: 'tax-policy-1',
            ruleSnapshot: { rateBps: 500 },
          },
        ],
        walletLedgerEntries: [
          { id: 'wallet-created', type: ProviderWalletLedgerType.BOOKING_EARNING, amount: 300_000 },
          { id: 'wallet-paid', type: ProviderWalletLedgerType.PAYOUT_PAID, amount: -300_000 },
        ],
      },
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      booking: { findUnique: vi.fn().mockResolvedValue(booking) },
      paymentFeePolicyVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const settlements = {
      previewBookingSettlementSnapshot: vi.fn().mockReturnValue({ source: 'caller-transaction-preview' }),
      upsertBookingSettlementSnapshot: vi.fn().mockResolvedValue({ id: 'settlement-1' }),
    };
    const service = new EarningsService(prisma as never, undefined, settlements as never);

    await expect(
      service.previewPaidBookingSettlementReconstruction(
        'booking-paid-gap-1',
        'provider-1',
        tx as never,
      ),
    ).resolves.toMatchObject({
      canReconstruct: true,
      settlementDryRun: { source: 'caller-transaction-preview' },
    });

    await expect(
      service.reconstructPaidBookingSettlement('booking-paid-gap-1', 'provider-1', {
        actorId: 'admin-1',
        approvalAdminId: 'admin-2',
        reason: 'Reconstruct paid evidence',
      }),
    ).resolves.toMatchObject({
      earningId: 'earning-paid-1',
      settlementSnapshot: { id: 'settlement-1' },
    });
    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-paid-gap-1',
        providerEarningId: 'earning-paid-1',
        providerPlatformFeeLogId: 'fee-log-1',
        providerTaxLogIds: ['tax-log-1'],
        providerWalletLedgerEntryIds: ['wallet-created', 'wallet-paid'],
        paymentMethod: PaymentMethod.MOMO,
        customerPaymentAmount: 400_000,
        partnerPayoutAmount: 300_000,
        platformFeeGross: 80_000,
        metadata: expect.objectContaining({
          historicalReconstruction: true,
          historicalReconstructionActorId: 'admin-1',
          historicalReconstructionApprovalAdminId: 'admin-2',
        }),
      }),
      tx,
    );
    expect(tx).not.toHaveProperty('providerEarning');
    expect(tx).not.toHaveProperty('providerWalletLedgerEntry');

    prisma.$transaction.mockClear();
    settlements.upsertBookingSettlementSnapshot.mockClear();
    await expect(
      service.reconstructPaidBookingSettlement(
        'booking-paid-gap-1',
        'provider-1',
        {
          actorId: 'admin-1',
          approvalAdminId: 'admin-2',
          reason: 'Recheck and reconstruct inside the caller transaction',
        },
        tx as never,
      ),
    ).resolves.toMatchObject({ earningId: 'earning-paid-1' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-paid-gap-1' }),
      tx,
    );
  });

  it('applies active payment fee policy to completed booking settlement snapshots', async () => {
    const occurredAt = new Date('2026-06-13T03:02:00.000Z');
    const booking = {
      id: 'booking-payment-fee-1',
      customerProfileId: 'customer-1',
      selectedProviderId: 'provider-1',
      status: BookingStatus.COMPLETED,
      updatedAt: occurredAt,
      closedAt: occurredAt,
      payment: {
        id: 'payment-payment-fee-1',
        amount: 600_000,
        currency: 'VND',
        method: PaymentMethod.CARD,
      },
      review: null,
      services: [
        {
          serviceId: 'service-1',
          price: 600_000,
          quantity: 1,
          ...bookedPayoutSnapshot(600_000, 430_000),
          service: { id: 'service-1', name: 'Massage' },
        },
      ],
    };
    const earning = {
      id: 'earning-payment-fee-1',
      bookingId: 'booking-payment-fee-1',
      providerProfileId: 'provider-1',
      grossAmount: 600_000,
      platformFee: 170_000,
      withholdingAmount: 42_000,
      netAmount: 388_000,
      currency: 'VND',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      paymentFeePolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'payment-fee-policy-1',
          name: 'Card processing fee',
          rules: [
            {
              id: 'payment-fee-rule-1',
              feeType: 'RATE_PLUS_FIXED',
              method: PaymentMethod.CARD,
              rateBps: 150,
              fixedAmount: 1_000,
              payer: PaymentFeePayer.HANDS,
              treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
            },
          ],
        }),
      },
      platformFeePolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'platform-policy-1',
          name: 'Default platform fee',
          vatRateBps: 800,
          rules: [
            {
              id: 'platform-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              rateBps: 0,
              fixedAmount: 170_000,
            },
          ],
        }),
      },
      servicePayoutRule: { findMany: vi.fn().mockResolvedValue([]) },
      taxPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tax-policy-1',
          name: 'Default partner tax',
          rules: [
            {
              id: 'tax-vat-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_VAT,
              rateBps: 500,
              fixedAmount: 0,
            },
            {
              id: 'tax-pit-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_PIT,
              rateBps: 200,
              fixedAmount: 0,
            },
          ],
        }),
      },
      providerTaxProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tax-profile-1',
          status: ProviderTaxProfileStatus.APPROVED,
        }),
      },
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(earning),
      },
      providerPlatformFeeLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'platform-log-1' }),
      },
      providerTaxLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'tax-log-1' }),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue({ id: 'wallet-ledger-1' }),
      },
    };
    const prisma = {
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const settlements = {
      upsertBookingSettlementSnapshot: vi.fn().mockResolvedValue({ id: 'settlement-1' }),
    };
    const service = new EarningsService(prisma as never, undefined, settlements as never);

    await expect(service.createForCompletedBooking('booking-payment-fee-1', 'provider-1')).resolves.toEqual(
      earning,
    );

    expect(tx.paymentFeePolicyVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          rules: expect.objectContaining({
            where: { active: true, method: PaymentMethod.CARD },
          }),
        }),
        where: expect.objectContaining({
          effectiveFrom: { lte: occurredAt },
          status: 'ACTIVE',
        }),
      }),
    );
    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-payment-fee-1',
        paymentFeeFixedAmount: 1_000,
        paymentFeePayer: PaymentFeePayer.HANDS,
        paymentFeePolicyVersionId: 'payment-fee-policy-1',
        paymentFeeRateBps: 150,
        paymentFeeRuleSnapshot: expect.objectContaining({
          method: PaymentMethod.CARD,
          policyName: 'Card processing fee',
          ruleId: 'payment-fee-rule-1',
        }),
        paymentFeeTreatment: PaymentFeeTreatment.OPERATING_EXPENSE,
        platformFeeGross: 170_000,
      }),
      tx,
    );
  });

  for (const scenario of [
    {
      expectedPlatformFeeGross: 170_000,
      fixedAmount: 1_500,
      paymentMethod: PaymentMethod.MOMO,
      policyName: 'Momo processing fee',
      rateBps: 200,
      ruleId: 'payment-fee-rule-momo',
    },
    {
      expectedPlatformFeeGross: 170_000,
      fixedAmount: 2_000,
      paymentMethod: PaymentMethod.VNPAY,
      policyName: 'VNPAY processing fee',
      rateBps: 120,
      ruleId: 'payment-fee-rule-vnpay',
    },
  ]) {
    it(`applies active ${scenario.paymentMethod} payment fee policy to completed booking settlement snapshots`, async () => {
      const occurredAt = new Date('2026-06-13T03:02:00.000Z');
      const booking = {
        id: `booking-payment-fee-${scenario.paymentMethod.toLowerCase()}`,
        customerProfileId: 'customer-1',
        selectedProviderId: 'provider-1',
        status: BookingStatus.COMPLETED,
        updatedAt: occurredAt,
        closedAt: occurredAt,
        payment: {
          id: `payment-payment-fee-${scenario.paymentMethod.toLowerCase()}`,
          amount: 600_000,
          currency: 'VND',
          method: scenario.paymentMethod,
        },
        review: null,
        services: [
          {
            serviceId: 'service-1',
            price: 600_000,
            quantity: 1,
            ...bookedPayoutSnapshot(600_000, 430_000),
            service: { id: 'service-1', name: 'Massage' },
          },
        ],
      };
      const earning = {
        id: `earning-payment-fee-${scenario.paymentMethod.toLowerCase()}`,
        bookingId: booking.id,
        providerProfileId: 'provider-1',
        grossAmount: 600_000,
        platformFee: 170_000,
        withholdingAmount: 42_000,
        netAmount: 388_000,
        currency: 'VND',
      };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
        booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
        paymentFeePolicyVersion: {
          findFirst: vi.fn().mockResolvedValue({
            id: `payment-fee-policy-${scenario.paymentMethod.toLowerCase()}`,
            name: scenario.policyName,
            rules: [
              {
                id: scenario.ruleId,
                feeType: 'RATE_PLUS_FIXED',
                method: scenario.paymentMethod,
                rateBps: scenario.rateBps,
                fixedAmount: scenario.fixedAmount,
                payer: PaymentFeePayer.HANDS,
                treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
              },
            ],
          }),
        },
        platformFeePolicyVersion: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'platform-policy-1',
            name: 'Default platform fee',
            vatRateBps: 800,
            rules: [
              {
                id: 'platform-rule-1',
                scope: 'DEFAULT',
                serviceType: null,
                minGrossAmount: null,
                maxGrossAmount: null,
                rateBps: 0,
                fixedAmount: 170_000,
              },
            ],
          }),
        },
        servicePayoutRule: { findMany: vi.fn().mockResolvedValue([]) },
        taxPolicyVersion: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'tax-policy-1',
            name: 'Default partner tax',
            rules: [
              {
                id: 'tax-vat-rule-1',
                scope: 'DEFAULT',
                serviceType: null,
                minGrossAmount: null,
                maxGrossAmount: null,
                taxKind: PartnerTaxLineKind.PARTNER_VAT,
                rateBps: 500,
                fixedAmount: 0,
              },
              {
                id: 'tax-pit-rule-1',
                scope: 'DEFAULT',
                serviceType: null,
                minGrossAmount: null,
                maxGrossAmount: null,
                taxKind: PartnerTaxLineKind.PARTNER_PIT,
                rateBps: 200,
                fixedAmount: 0,
              },
            ],
          }),
        },
        providerTaxProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'tax-profile-1',
            status: ProviderTaxProfileStatus.APPROVED,
          }),
        },
        providerEarning: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue(earning),
        },
        providerPlatformFeeLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'platform-log-1' }),
        },
        providerTaxLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'tax-log-1' }),
        },
        providerWalletLedgerEntry: {
          upsert: vi.fn().mockResolvedValue({ id: 'wallet-ledger-1' }),
        },
      };
      const prisma = {
        booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      };
      const settlements = {
        upsertBookingSettlementSnapshot: vi.fn().mockResolvedValue({ id: 'settlement-1' }),
      };
      const service = new EarningsService(prisma as never, undefined, settlements as never);

      await expect(service.createForCompletedBooking(booking.id, 'provider-1')).resolves.toEqual(earning);

      expect(tx.paymentFeePolicyVersion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            rules: expect.objectContaining({
              where: { active: true, method: scenario.paymentMethod },
            }),
          }),
        }),
      );
      expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: booking.id,
          paymentFeeFixedAmount: scenario.fixedAmount,
          paymentFeePayer: PaymentFeePayer.HANDS,
          paymentFeePolicyVersionId: `payment-fee-policy-${scenario.paymentMethod.toLowerCase()}`,
          paymentFeeRateBps: scenario.rateBps,
          paymentFeeRuleSnapshot: expect.objectContaining({
            method: scenario.paymentMethod,
            policyName: scenario.policyName,
            ruleId: scenario.ruleId,
          }),
          paymentFeeTreatment: PaymentFeeTreatment.OPERATING_EXPENSE,
          paymentMethod: scenario.paymentMethod,
          platformFeeGross: scenario.expectedPlatformFeeGross,
        }),
        tx,
      );
    });
  }

  it('settles company-funded coupon bookings from pre-coupon service amount while storing the paid amount', async () => {
    const occurredAt = new Date('2026-06-13T03:02:00.000Z');
    const booking = {
      id: 'booking-coupon-1',
      customerProfileId: 'customer-1',
      selectedProviderId: 'provider-1',
      status: BookingStatus.COMPLETED,
      updatedAt: occurredAt,
      closedAt: occurredAt,
      payment: {
        id: 'payment-coupon-1',
        amount: 540_000,
        currency: 'VND',
        method: PaymentMethod.CARD,
        rawMeta: {
          originalAmount: 600_000,
          discountAmount: 60_000,
          couponId: 'coupon-1',
          couponCode: 'WELCOME10',
          couponTypeSnapshot: 'percent',
          couponRateSnapshot: 10,
          couponFundingSourceSnapshot: 'COMPANY',
          couponAccountingTreatmentSnapshot: 'MARKETING_EXPENSE',
          settlementBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
          partnerTaxBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
          platformFeeBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
        },
      },
      review: null,
      services: [
        {
          serviceId: 'service-1',
          price: 600_000,
          quantity: 1,
          ...bookedPayoutSnapshot(600_000, 430_000),
          service: { id: 'service-1', name: 'Massage' },
        },
      ],
    };
    const earning = {
      id: 'earning-coupon-1',
      bookingId: 'booking-coupon-1',
      providerProfileId: 'provider-1',
      grossAmount: 600_000,
      platformFee: 170_000,
      withholdingAmount: 42_000,
      netAmount: 388_000,
      currency: 'VND',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      platformFeePolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'platform-policy-1',
          name: 'Default platform fee',
          vatRateBps: 800,
          rules: [
            {
              id: 'platform-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              rateBps: 0,
              fixedAmount: 170_000,
            },
          ],
        }),
      },
      servicePayoutRule: { findMany: vi.fn().mockResolvedValue([]) },
      taxPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tax-policy-1',
          name: 'Default partner tax',
          rules: [
            {
              id: 'tax-vat-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_VAT,
              rateBps: 500,
              fixedAmount: 0,
            },
            {
              id: 'tax-pit-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_PIT,
              rateBps: 200,
              fixedAmount: 0,
            },
          ],
        }),
      },
      providerTaxProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tax-profile-1',
          status: ProviderTaxProfileStatus.APPROVED,
        }),
      },
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(earning),
      },
      providerPlatformFeeLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'platform-log-1' }),
      },
      providerTaxLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'tax-log-1' }),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue({ id: 'wallet-ledger-1' }),
      },
    };
    const prisma = {
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const settlements = {
      upsertBookingSettlementSnapshot: vi.fn().mockResolvedValue({ id: 'settlement-coupon-1' }),
    };
    const service = new EarningsService(prisma as never, undefined, settlements as never);

    await expect(service.createForCompletedBooking('booking-coupon-1', 'provider-1')).resolves.toEqual(
      earning,
    );

    expect(tx.providerEarning.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          grossAmount: 600_000,
          platformFee: 170_000,
          withholdingAmount: 42_000,
          netAmount: 388_000,
        }),
      }),
    );
    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPaymentAmount: 540_000,
        partnerPayoutAmount: 388_000,
        partnerTaxableRevenueAmount: 600_000,
        platformFeeGross: 170_000,
        metadata: expect.objectContaining({
          couponId: 'coupon-1',
          couponCodeSnapshot: 'WELCOME10',
          couponDiscountAmount: 60_000,
          companyCouponExpense: 60_000,
          platformFeeDiscountAmount: 0,
          partnerFundedCouponAmount: 0,
          couponFundingSourceSnapshot: 'COMPANY',
          settlementBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
          settlementBaseAmount: 600_000,
        }),
      }),
      tx,
    );
  });

  it('posts cash booking wallet debt as split platform fee, output VAT, and partner tax ledger rows', async () => {
    const occurredAt = new Date('2026-06-13T03:02:00.000Z');
    const booking = {
      id: 'booking-cash-1',
      customerProfileId: 'customer-1',
      selectedProviderId: 'provider-1',
      status: BookingStatus.COMPLETED,
      updatedAt: occurredAt,
      closedAt: occurredAt,
      payment: {
        id: 'payment-cash-1',
        amount: 600_000,
        currency: 'VND',
        method: PaymentMethod.CASH,
      },
      review: null,
      services: [
        {
          serviceId: 'service-1',
          price: 600_000,
          quantity: 1,
          ...bookedPayoutSnapshot(600_000, 430_000),
          service: { id: 'service-1', name: 'Massage' },
        },
      ],
    };
    const earning = {
      id: 'earning-cash-1',
      bookingId: 'booking-cash-1',
      providerProfileId: 'provider-1',
      grossAmount: 600_000,
      platformFee: 170_000,
      withholdingAmount: 42_000,
      netAmount: -170_000,
      currency: 'VND',
    };
    const walletUpsert = vi.fn(async (input) => ({ id: `wallet-${input.where.sourceKey}` }));
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      platformFeePolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'platform-policy-1',
          name: 'Default platform fee',
          vatRateBps: 800,
          rules: [
            {
              id: 'platform-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              rateBps: 0,
              fixedAmount: 170_000,
            },
          ],
        }),
      },
      servicePayoutRule: { findMany: vi.fn().mockResolvedValue([]) },
      taxPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tax-policy-1',
          name: 'Default partner tax',
          rules: [
            {
              id: 'tax-vat-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_VAT,
              rateBps: 500,
              fixedAmount: 0,
            },
            {
              id: 'tax-pit-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_PIT,
              rateBps: 200,
              fixedAmount: 0,
            },
          ],
        }),
      },
      providerTaxProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tax-profile-1',
          status: ProviderTaxProfileStatus.APPROVED,
        }),
      },
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(earning),
      },
      providerPlatformFeeLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'platform-log-1' }),
      },
      providerTaxLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'tax-log-1' }),
      },
      providerWalletLedgerEntry: {
        upsert: walletUpsert,
      },
    };
    const prisma = {
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const settlements = {
      upsertBookingSettlementSnapshot: vi.fn().mockResolvedValue({ id: 'settlement-1' }),
    };
    const service = new EarningsService(prisma as never, undefined, settlements as never);

    await expect(service.createForCompletedBooking('booking-cash-1', 'provider-1')).resolves.toEqual(earning);

    expect(tx.providerEarning.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ netAmount: -170_000 }),
        update: {},
      }),
    );
    expect(walletUpsert).toHaveBeenCalledTimes(3);
    expect(walletUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          type: 'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
          amount: -118_519,
          sourceKey: 'earning:earning-cash-1:cash-platform-fee-net',
        }),
      }),
    );
    expect(walletUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          type: 'CASH_BOOKING_COMPANY_OUTPUT_VAT_DEDUCTED',
          amount: -9_481,
          sourceKey: 'earning:earning-cash-1:cash-company-output-vat',
        }),
      }),
    );
    expect(walletUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          type: 'CASH_BOOKING_PARTNER_TAX_DEDUCTED',
          amount: -42_000,
          sourceKey: 'earning:earning-cash-1:cash-partner-tax',
        }),
      }),
    );
    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        providerWalletLedgerEntryIds: [
          'wallet-earning:earning-cash-1:cash-platform-fee-net',
          'wallet-earning:earning-cash-1:cash-company-output-vat',
          'wallet-earning:earning-cash-1:cash-partner-tax',
        ],
      }),
      tx,
    );
  });

  it('reduces cash booking wallet debt by company-funded coupon while preserving settlement facts', async () => {
    const occurredAt = new Date('2026-06-13T03:02:00.000Z');
    const booking = {
      id: 'booking-cash-coupon-1',
      customerProfileId: 'customer-1',
      selectedProviderId: 'provider-1',
      status: BookingStatus.COMPLETED,
      updatedAt: occurredAt,
      closedAt: occurredAt,
      payment: {
        id: 'payment-cash-coupon-1',
        amount: 540_000,
        currency: 'VND',
        method: PaymentMethod.CASH,
        rawMeta: {
          originalAmount: 600_000,
          discountAmount: 60_000,
          couponId: 'coupon-1',
          couponCode: 'WELCOME10',
          couponFundingSourceSnapshot: 'COMPANY',
          couponAccountingTreatmentSnapshot: 'MARKETING_EXPENSE',
        },
      },
      review: null,
      services: [
        {
          serviceId: 'service-1',
          price: 600_000,
          quantity: 1,
          ...bookedPayoutSnapshot(600_000, 430_000),
          service: { id: 'service-1', name: 'Massage' },
        },
      ],
    };
    const earning = {
      id: 'earning-cash-coupon-1',
      bookingId: 'booking-cash-coupon-1',
      providerProfileId: 'provider-1',
      grossAmount: 600_000,
      platformFee: 170_000,
      withholdingAmount: 42_000,
      netAmount: -110_000,
      currency: 'VND',
    };
    const walletUpsert = vi.fn(async (input) => ({ id: `wallet-${input.where.sourceKey}` }));
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      platformFeePolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'platform-policy-1',
          name: 'Default platform fee',
          vatRateBps: 800,
          rules: [
            {
              id: 'platform-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              rateBps: 0,
              fixedAmount: 170_000,
            },
          ],
        }),
      },
      servicePayoutRule: { findMany: vi.fn().mockResolvedValue([]) },
      taxPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tax-policy-1',
          name: 'Default partner tax',
          rules: [
            {
              id: 'tax-vat-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_VAT,
              rateBps: 500,
              fixedAmount: 0,
            },
            {
              id: 'tax-pit-rule-1',
              scope: 'DEFAULT',
              serviceType: null,
              minGrossAmount: null,
              maxGrossAmount: null,
              taxKind: PartnerTaxLineKind.PARTNER_PIT,
              rateBps: 200,
              fixedAmount: 0,
            },
          ],
        }),
      },
      providerTaxProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tax-profile-1',
          status: ProviderTaxProfileStatus.APPROVED,
        }),
      },
      providerEarning: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(earning),
      },
      providerPlatformFeeLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'platform-log-1' }),
      },
      providerTaxLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'tax-log-1' }),
      },
      providerWalletLedgerEntry: {
        upsert: walletUpsert,
      },
    };
    const prisma = {
      booking: { findUniqueOrThrow: vi.fn().mockResolvedValue(booking) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const settlements = {
      upsertBookingSettlementSnapshot: vi.fn().mockResolvedValue({ id: 'settlement-cash-coupon-1' }),
    };
    const service = new EarningsService(prisma as never, undefined, settlements as never);

    await expect(service.createForCompletedBooking('booking-cash-coupon-1', 'provider-1')).resolves.toEqual(
      earning,
    );

    expect(tx.providerEarning.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ netAmount: -110_000 }),
        update: {},
      }),
    );
    expect(walletUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          amount: -58_519,
          sourceKey: 'earning:earning-cash-coupon-1:cash-platform-fee-net',
        }),
      }),
    );
    expect(walletUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          amount: -9_481,
          sourceKey: 'earning:earning-cash-coupon-1:cash-company-output-vat',
        }),
      }),
    );
    expect(walletUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          amount: -42_000,
          sourceKey: 'earning:earning-cash-coupon-1:cash-partner-tax',
        }),
      }),
    );
    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        customerPaymentAmount: 540_000,
        metadata: expect.objectContaining({
          companyCouponExpense: 60_000,
          couponDiscountAmount: 60_000,
          settlementBaseAmount: 600_000,
        }),
        providerWalletLedgerEntryIds: [
          'wallet-earning:earning-cash-coupon-1:cash-platform-fee-net',
          'wallet-earning:earning-cash-coupon-1:cash-company-output-vat',
          'wallet-earning:earning-cash-coupon-1:cash-partner-tax',
        ],
      }),
      tx,
    );
  });

  it('notifies the partner when a payout batch status changes', async () => {
    const existingBatch = {
      id: 'payout-batch-1',
      providerProfileId: 'provider-1',
      status: PayoutBatchStatus.PROCESSING,
      transferRef: 'BANK-001',
      paidAt: null,
      earnings: [],
    };
    const returnedBatch = {
      ...existingBatch,
      status: PayoutBatchStatus.FAILED,
      providerProfile: { user: { id: 'partner-user' } },
    };
    const tx = {
      providerPayoutBatch: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(returnedBatch),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const service = new EarningsService(prisma as never, notifications as never);

    await expect(
      service.updatePayoutBatch('payout-batch-1', { status: PayoutBatchStatus.FAILED }),
    ).resolves.toEqual(returnedBatch);

    expect(notifications.create).toHaveBeenCalledWith({
      userId: 'partner-user',
      targetRole: Role.PROVIDER,
      type: 'provider.payout_batch.updated',
      title: 'Payout batch updated',
      body: 'Your payout batch needs follow-up. Check the payout screen for details.',
      data: { payoutBatchId: 'payout-batch-1', providerProfileId: 'provider-1' },
    });
  });

  it('does not notify the partner for metadata-only payout batch updates', async () => {
    const existingBatch = {
      id: 'payout-batch-1',
      providerProfileId: 'provider-1',
      status: PayoutBatchStatus.DRAFT,
      transferRef: null,
      paidAt: null,
      earnings: [],
    };
    const returnedBatch = {
      ...existingBatch,
      notes: 'Bank reference pending',
      providerProfile: { user: { id: 'partner-user' } },
    };
    const tx = {
      providerPayoutBatch: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(returnedBatch),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const service = new EarningsService(prisma as never, notifications as never);

    await expect(
      service.updatePayoutBatch('payout-batch-1', {
        notes: 'Bank reference pending',
        expectedStatus: PayoutBatchStatus.DRAFT,
        expectedTransferRef: null,
        expectedNotes: null,
      }),
    ).resolves.toEqual(returnedBatch);

    expect(tx.providerPayoutBatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'payout-batch-1',
          status: PayoutBatchStatus.DRAFT,
          transferRef: null,
          notes: null,
        },
      }),
    );
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('records partner bank deposits with negative-wallet-first allocation metadata', async () => {
    const depositDate = new Date('2026-06-29T09:30:00.000Z');
    const createdLedger = {
      id: 'wallet-deposit-1',
      providerProfileId: 'provider-1',
      type: ProviderWalletLedgerType.PARTNER_BANK_DEPOSIT_RECEIVED,
      amount: 1000000,
      currency: 'VND',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -170000 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdLedger),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.recordPartnerBankDeposit({
        providerProfileId: ' provider-1 ',
        amount: 1000000,
        bankTransactionId: ' BIDV-20260629-001 ',
        depositDate,
        bankAccount: 'BIDV 123456789',
        attachmentFileId: 'file-deposit-proof-1',
        notes: 'Bank statement confirmed',
        adminId: 'admin-user-1',
      }),
    ).resolves.toEqual(createdLedger);

    expect(tx.providerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { providerProfileId: 'provider-1' },
      _sum: { amount: true },
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.providerWalletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerProfileId: 'provider-1',
        type: ProviderWalletLedgerType.PARTNER_BANK_DEPOSIT_RECEIVED,
        sourceKey: 'partner-bank-deposit:provider-1:BIDV-20260629-001',
        amount: 1000000,
        currency: 'VND',
        reference: 'BIDV-20260629-001',
        notes: 'Bank statement confirmed',
        metadata: expect.objectContaining({
          bankAccount: 'BIDV 123456789',
          attachmentFileId: 'file-deposit-proof-1',
          adminId: 'admin-user-1',
          allocation: {
            depositAmount: 1000000,
            currentWalletBalance: -170000,
            currentNegativeWalletAmount: 170000,
            amountAppliedToNegativeWallet: 170000,
            amountCreditedToWalletLiability: 830000,
            resultingWalletBalance: 830000,
          },
        }),
      }),
    });
  });

  it('does not duplicate partner bank deposits with the same bank transaction id', async () => {
    const existingLedger = {
      id: 'wallet-deposit-existing',
      providerProfileId: 'provider-1',
      sourceKey: 'partner-bank-deposit:provider-1:BIDV-20260629-001',
      amount: 1000000,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(existingLedger),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.recordPartnerBankDeposit({
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentUrl: 'https://storage.example/deposits/proof.jpg',
        adminId: 'admin-user-1',
      }),
    ).resolves.toEqual(existingLedger);

    expect(tx.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate partner bank deposit references when the amount does not match', async () => {
    const existingLedger = {
      id: 'wallet-deposit-existing',
      providerProfileId: 'provider-1',
      sourceKey: 'partner-bank-deposit:provider-1:BIDV-20260629-001',
      amount: 1000000,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(existingLedger),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.recordPartnerBankDeposit({
        providerProfileId: 'provider-1',
        amount: 900000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentUrl: 'https://storage.example/deposits/proof.jpg',
        adminId: 'admin-user-1',
      }),
    ).rejects.toThrow('Partner bank deposit reference already exists with a different amount');

    expect(tx.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('creates partner wallet withdrawal requests against approved bank accounts and prepaid balance', async () => {
    const createdRequest = {
      id: 'withdrawal-request-1',
      providerProfileId: 'provider-1',
      bankAccountId: 'bank-account-1',
      amount: 500000,
      currency: 'VND',
      status: 'REQUESTED',
      requestNote: 'Please send after the shift',
      metadata: {
        requestedBankAccountId: 'bank-account-1',
      },
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'withdrawal-lock-journal-1' }),
      },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-account-1' }),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 750000 } }),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdRequest),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1', userId: 'partner-user-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await expect(
      service.createProviderWalletWithdrawalRequestForProviderUser('partner-user-1', {
        idempotencyKey: 'withdrawal-request-1',
        amount: 500000,
        bankAccountId: ' bank-account-1 ',
        requestNote: ' Please send after the shift ',
      }),
    ).resolves.toEqual(createdRequest);

    expect(tx.providerBankAccount.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'bank-account-1',
        providerProfileId: 'provider-1',
        status: ProviderBankAccountStatus.APPROVED,
        deletedAt: null,
      },
    });
    expect(tx.providerWalletWithdrawalRequest.create).toHaveBeenCalledWith({
        data: {
          providerProfileId: 'provider-1',
          idempotencyKey: 'withdrawal-request-1',
          bankAccountId: 'bank-account-1',
        amount: 500000,
        currency: 'VND',
          status: 'REQUESTED',
          requestNote: 'Please send after the shift',
          createdAt: expect.any(Date),
        metadata: {
          currentWalletBalance: 750000,
          pendingWithdrawalAmount: 0,
          pendingPayoutAmount: 0,
            availableWalletBalance: 750000,
            requestedBankAccountId: 'bank-account-1',
            source: 'PARTNER_APP_WALLET_WITHDRAWAL_REQUEST',
        },
      },
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceKey: 'accounting-journal:provider-withdrawal:withdrawal-request-1:lock',
        },
        update: {},
        create: expect.objectContaining({
          sourceType: 'PROVIDER_WITHDRAWAL',
          sourceId: 'withdrawal-request-1',
          totalDebit: 500000,
          totalCredit: 500000,
          entries: {
            create: expect.arrayContaining([
              expect.objectContaining({
                side: 'DEBIT',
                accountCode: 'partner_wallet_liability',
                amount: 500000,
              }),
              expect.objectContaining({
                side: 'CREDIT',
                accountCode: 'partner_withdrawal_payable',
                amount: 500000,
              }),
            ]),
          },
        }),
      }),
    );
  });

  it('returns the existing withdrawal when the same partner replays the same idempotency key and payload', async () => {
    const existingRequest = {
      id: 'withdrawal-request-existing',
      providerProfileId: 'provider-1',
      idempotencyKey: 'withdrawal-request-replay-1',
      bankAccountId: 'bank-account-1',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
      requestNote: 'Please send after the shift',
      metadata: { requestedBankAccountId: 'bank-account-1' },
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(existingRequest),
        aggregate: vi.fn(),
        create: vi.fn(),
      },
      providerBankAccount: { findFirst: vi.fn() },
      providerWalletLedgerEntry: { aggregate: vi.fn() },
      providerPayoutBatch: { aggregate: vi.fn() },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1', userId: 'partner-user-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.createProviderWalletWithdrawalRequestForProviderUser('partner-user-1', {
        idempotencyKey: 'withdrawal-request-replay-1',
        amount: 500000,
        bankAccountId: 'bank-account-1',
        requestNote: ' Please send after the shift ',
      }),
    ).resolves.toEqual(existingRequest);

    expect(tx.providerBankAccount.findFirst).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(tx.providerWalletWithdrawalRequest.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a withdrawal idempotency key with a different payload', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'withdrawal-request-existing',
          providerProfileId: 'provider-1',
          amount: 500000,
          requestNote: null,
          metadata: { requestedBankAccountId: 'bank-account-1' },
        }),
        create: vi.fn(),
      },
      providerBankAccount: { findFirst: vi.fn() },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1', userId: 'partner-user-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.createProviderWalletWithdrawalRequestForProviderUser('partner-user-1', {
        idempotencyKey: 'withdrawal-request-replay-1',
        amount: 600000,
        bankAccountId: 'bank-account-1',
      }),
    ).rejects.toThrow('Idempotency key was already used for a different withdrawal request');

    expect(tx.providerBankAccount.findFirst).not.toHaveBeenCalled();
    expect(tx.providerWalletWithdrawalRequest.create).not.toHaveBeenCalled();
  });

  it('rejects partner wallet withdrawal requests above available balance after pending requests', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-account-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 750000 } }),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 400000 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1', userId: 'partner-user-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await expect(
      service.createProviderWalletWithdrawalRequestForProviderUser('partner-user-1', {
        idempotencyKey: 'withdrawal-request-2',
        amount: 500000,
        bankAccountId: 'bank-account-1',
      }),
    ).rejects.toThrow('Withdrawal amount exceeds available partner wallet balance');

    expect(tx.providerWalletWithdrawalRequest.aggregate).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'provider-1',
        status: {
          in: [
            ProviderWalletWithdrawalRequestStatus.REQUESTED,
            ProviderWalletWithdrawalRequestStatus.NEEDS_BANK_CORRECTION,
            ProviderWalletWithdrawalRequestStatus.APPROVED,
            ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
            ProviderWalletWithdrawalRequestStatus.REVIEW_REQUIRED,
            ProviderWalletWithdrawalRequestStatus.HOLD,
          ],
        },
      },
      _sum: { amount: true },
    });
    expect(tx.providerWalletWithdrawalRequest.create).not.toHaveBeenCalled();
  });

  it('filters admin partner wallet withdrawal requests by provider profile without loading every partner', async () => {
    const prisma = {
      providerWalletWithdrawalRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            bankReconciliationMatches: [],
            id: 'withdrawal-request-1',
            status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
          },
        ]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listProviderWalletWithdrawalRequestsForAdmin({
        providerProfileId: ' provider-1 ',
        range: 'all',
        skip: '25',
        status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
        take: '500',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        bankReconciliationMatch: null,
        id: 'withdrawal-request-1',
        reconciliationState: 'NOT_APPLICABLE',
      }),
    ]);

    expect(prisma.providerWalletWithdrawalRequest.findMany).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'provider-1',
        status: ProviderWalletWithdrawalRequestStatus.REQUESTED,
      },
      orderBy: { createdAt: 'desc' },
      skip: 25,
      take: 100,
      include: expect.objectContaining({
        bankAccount: true,
        bankReconciliationMatches: expect.objectContaining({
          take: 1,
          where: {
            status: {
              in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED],
            },
          },
        }),
      }),
    });
  });

  it('loads one exact withdrawal id independently from list pagination', async () => {
    const prisma = {
      providerWalletWithdrawalRequest: {
        findMany: vi.fn().mockResolvedValue([{
          bankReconciliationMatches: [],
          id: 'withdrawal-exact-1',
          status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
        }]),
      },
    };
    const service = new EarningsService(prisma as never);

    await service.listProviderWalletWithdrawalRequestsForAdmin({
      id: ' withdrawal-exact-1 ',
      range: 'all',
      take: 1,
    });

    expect(prisma.providerWalletWithdrawalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
        where: { id: 'withdrawal-exact-1' },
      }),
    );
  });

  it('filters paid withdrawals by active bank reconciliation state without counting reversed matches', async () => {
    const prisma = {
      providerWalletWithdrawalRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            bankReconciliationMatches: [],
            id: 'withdrawal-request-1',
            status: ProviderWalletWithdrawalRequestStatus.PAID,
          },
        ]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listProviderWalletWithdrawalRequestsForAdmin({
        range: 'all',
        reconciliation: 'unmatched',
        take: 10,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        bankReconciliationMatch: null,
        reconciliationState: 'UNMATCHED',
      }),
    ]);

    expect(prisma.providerWalletWithdrawalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: {
          AND: [
            { status: ProviderWalletWithdrawalRequestStatus.PAID },
            {
              bankReconciliationMatches: {
                none: {
                  status: {
                    in: [BankReconciliationStatus.MATCHED, BankReconciliationStatus.PARTIALLY_MATCHED],
                  },
                },
              },
            },
          ],
        },
      }),
    );
  });

  it('exposes an exact bank transaction candidate only when one OUTFLOW shares the transfer reference', async () => {
    const prisma = {
      companyBankTransaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            amount: 120_000,
            currency: 'VND',
            id: 'bank-transaction-exact-1',
            occurredAt: new Date('2026-07-01T09:00:00.000Z'),
            transferRef: 'BANK-OUT-EXACT-1',
          },
        ]),
      },
      providerWalletWithdrawalRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            bankReconciliationMatches: [],
            amount: 120_000,
            currency: 'VND',
            id: 'withdrawal-request-exact-bank-candidate',
            status: ProviderWalletWithdrawalRequestStatus.PAID,
            transferRef: 'BANK-OUT-EXACT-1',
          },
        ]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.listProviderWalletWithdrawalRequestsForAdmin({ range: 'all', take: 20 }),
    ).resolves.toEqual([
      expect.objectContaining({
        bankReconciliationCandidate: expect.objectContaining({ id: 'bank-transaction-exact-1' }),
        bankReconciliationCandidateCount: 1,
      }),
    ]);
    expect(prisma.companyBankTransaction.findMany).toHaveBeenCalledWith({
      where: {
        status: BankReconciliationStatus.UNMATCHED,
        transferRef: { in: ['BANK-OUT-EXACT-1'] },
        type: CompanyBankTransactionType.OUTFLOW,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { amount: true, currency: true, id: true, occurredAt: true, transferRef: true },
    });

    prisma.companyBankTransaction.findMany.mockResolvedValue([
      {
        amount: 120_000,
        currency: 'VND',
        id: 'bank-transaction-1',
        occurredAt: new Date(),
        transferRef: 'BANK-OUT-EXACT-1',
      },
      {
        amount: 120_000,
        currency: 'VND',
        id: 'bank-transaction-2',
        occurredAt: new Date(),
        transferRef: 'BANK-OUT-EXACT-1',
      },
    ]);
    await expect(
      service.listProviderWalletWithdrawalRequestsForAdmin({ range: 'all', take: 20 }),
    ).resolves.toEqual([
      expect.objectContaining({
        bankReconciliationCandidate: null,
        bankReconciliationCandidateCount: 2,
      }),
    ]);

    prisma.companyBankTransaction.findMany.mockResolvedValue([
      {
        amount: 999_000,
        currency: 'VND',
        id: 'bank-transaction-wrong-amount',
        occurredAt: new Date(),
        transferRef: 'BANK-OUT-EXACT-1',
      },
    ]);
    await expect(
      service.listProviderWalletWithdrawalRequestsForAdmin({ range: 'all', take: 20 }),
    ).resolves.toEqual([
      expect.objectContaining({
        bankReconciliationCandidate: null,
        bankReconciliationCandidateCount: 0,
      }),
    ]);
  });

  it('summarizes admin partner wallet withdrawal requests with count queries only', async () => {
    const prisma = {
      providerWalletWithdrawalRequest: {
        count: vi
          .fn()
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(2),
        aggregate: vi
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 2_400_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 700_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 1_600_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 900_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 500_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 300_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 1_100_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 800_000 } }),
        findMany: vi.fn(),
      },
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await expect(
      service.providerWalletWithdrawalRequestSummaryForAdmin({
        providerProfileId: ' provider-1 ',
        range: 'all',
      }),
    ).resolves.toEqual({
      generatedAt: expect.any(String),
      range: 'all',
      timeZone: 'Asia/Ho_Chi_Minh',
      scopeCount: 6,
      filteredTotal: 6,
      total: 6,
      requested: 2,
      reviewRequired: 1,
      bankTransferPending: 3,
      lockReleased: 1,
      totalAmount: 2_400_000,
      requestedAmount: 700_000,
      pendingWithdrawalPayableAmount: 1_600_000,
      bankTransferPendingAmount: 900_000,
      paidAmount: 500_000,
      returnedAmount: 300_000,
      paidUnreconciled: 4,
      paidUnreconciledAmount: 1_100_000,
      paidReconciled: 2,
      paidReconciledAmount: 800_000,
      currency: 'VND',
    });

    expect(prisma.providerWalletWithdrawalRequest.findMany).not.toHaveBeenCalled();
    expect(prisma.providerWalletWithdrawalRequest.count).toHaveBeenCalledWith({
      where: { providerProfileId: 'provider-1' },
    });
    expect(prisma.providerWalletWithdrawalRequest.count).toHaveBeenCalledWith({
      where: {
        AND: [
          { providerProfileId: 'provider-1' },
          { status: ProviderWalletWithdrawalRequestStatus.REQUESTED },
        ],
      },
    });
    expect(prisma.providerWalletWithdrawalRequest.count).toHaveBeenCalledWith({
      where: {
        AND: [
          { providerProfileId: 'provider-1' },
          {
            metadata: {
              equals: true,
              path: ['lastStatusChange', 'lockedAmountReleased'],
            },
          },
        ],
      },
    });
    expect(prisma.providerWalletWithdrawalRequest.aggregate).toHaveBeenCalledWith({
      where: { providerProfileId: 'provider-1' },
      _sum: { amount: true },
    });
    expect(prisma.providerWalletWithdrawalRequest.aggregate).toHaveBeenCalledWith({
      where: {
        AND: [
          { providerProfileId: 'provider-1' },
          {
            status: {
              in: [
                ProviderWalletWithdrawalRequestStatus.REQUESTED,
                ProviderWalletWithdrawalRequestStatus.NEEDS_BANK_CORRECTION,
                ProviderWalletWithdrawalRequestStatus.APPROVED,
                ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
                ProviderWalletWithdrawalRequestStatus.REVIEW_REQUIRED,
                ProviderWalletWithdrawalRequestStatus.HOLD,
              ],
            },
          },
        ],
      },
      _sum: { amount: true },
    });
  });

  it('rejects partner wallet withdrawal requests above prepaid wallet balance', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-account-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 300000 } }),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-1', userId: 'partner-user-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await expect(
      service.createProviderWalletWithdrawalRequestForProviderUser('partner-user-1', {
        idempotencyKey: 'withdrawal-request-3',
        amount: 500000,
        bankAccountId: 'bank-account-1',
      }),
    ).rejects.toThrow('Withdrawal amount exceeds partner wallet balance');

    expect(tx.providerWalletWithdrawalRequest.create).not.toHaveBeenCalled();
  });

  it('marks partner wallet withdrawal requests paid and records the prepaid wallet debit', async () => {
    const existingRequest = {
      id: 'withdrawal-request-1',
      providerProfileId: 'provider-1',
      bankAccountId: 'bank-account-1',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
      transferRef: 'BANK-OUT-001',
      adminNote: 'Manual transfer completed',
      correctionReason: null,
      paidAt: null,
      metadata: {
        requestedFrom: 'partner-app',
        bankTransferEvidence: {
          transferRef: 'BANK-OUT-001',
          bankTransferDate: '2026-06-29T09:30:00.000Z',
          attachmentFileId: 'file-payout-proof-1',
          attachmentUrl: null,
          submittedByAdminId: 'finance-maker-1',
          submittedAt: '2026-06-29T09:31:00.000Z',
        },
      },
    };
    const updatedRequest = {
      ...existingRequest,
      status: ProviderWalletWithdrawalRequestStatus.PAID,
      transferRef: 'BANK-OUT-001',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'withdrawal-journal-1' }),
      },
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-account-1' }),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 750000 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'withdrawal-ledger-1' }),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        update: vi.fn().mockResolvedValue(updatedRequest),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updatedRequest),
      },
    };
    const prisma = {
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(existingRequest),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await expect(
      service.updateProviderWalletWithdrawalRequestForAdmin(
        'withdrawal-request-1',
        {
          status: ProviderWalletWithdrawalRequestStatus.PAID,
        },
        'admin-user-1',
      ),
    ).resolves.toEqual(updatedRequest);

    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'partner-wallet-withdrawal:withdrawal-request-1:paid' },
      update: {},
      create: expect.objectContaining({
        providerProfileId: 'provider-1',
        type: ProviderWalletLedgerType.PARTNER_WALLET_WITHDRAWAL_PAID,
        sourceKey: 'partner-wallet-withdrawal:withdrawal-request-1:paid',
        amount: -500000,
        currency: 'VND',
        reference: 'BANK-OUT-001',
        notes: 'Manual transfer completed',
        metadata: {
          withdrawalRequestId: 'withdrawal-request-1',
          adminId: 'admin-user-1',
          bankPayout: {
            transferRef: 'BANK-OUT-001',
            bankTransferDate: '2026-06-29T09:30:00.000Z',
            attachmentFileId: 'file-payout-proof-1',
            attachmentUrl: null,
            preparedByAdminId: 'finance-maker-1',
            completedByAdminId: 'admin-user-1',
          },
        },
      }),
    });
    expect(tx.providerWalletWithdrawalRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'withdrawal-request-1',
        status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
      },
      data: expect.objectContaining({
        status: ProviderWalletWithdrawalRequestStatus.PAID,
        transferRef: 'BANK-OUT-001',
        adminNote: 'Manual transfer completed',
        reviewedByAdminId: 'admin-user-1',
        reviewedAt: expect.any(Date),
        paidAt: expect.any(Date),
        metadata: expect.objectContaining({
          requestedFrom: 'partner-app',
          bankPayout: {
            transferRef: 'BANK-OUT-001',
            bankTransferDate: '2026-06-29T09:30:00.000Z',
            attachmentFileId: 'file-payout-proof-1',
            attachmentUrl: null,
            preparedByAdminId: 'finance-maker-1',
            completedByAdminId: 'admin-user-1',
          },
          lastStatusChange: expect.objectContaining({
            previousStatus: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
            nextStatus: ProviderWalletWithdrawalRequestStatus.PAID,
            lockedAmountReleased: false,
            releasedAmount: 0,
            changedByAdminId: 'admin-user-1',
          }),
        }),
      }),
    });
    expect(tx.providerWalletWithdrawalRequest.update).not.toHaveBeenCalled();
    expect(tx.providerWalletWithdrawalRequest.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'withdrawal-request-1' },
      include: expect.objectContaining({
        bankAccount: true,
      }),
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledTimes(2);
    expect(tx.accountingJournalBatch.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          sourceKey: 'accounting-journal:provider-withdrawal:withdrawal-request-1:lock',
        },
      }),
    );
    expect(tx.accountingJournalBatch.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          sourceKey: 'accounting-journal:provider-withdrawal:withdrawal-request-1:paid',
        },
        create: expect.objectContaining({
          entries: {
            create: expect.arrayContaining([
              expect.objectContaining({
                side: 'DEBIT',
                accountCode: 'partner_withdrawal_payable',
                amount: 500000,
              }),
              expect.objectContaining({
                side: 'CREDIT',
                accountCode: 'company_bank_cash',
                amount: 500000,
              }),
            ]),
          },
        }),
      }),
    );
  });

  it('stops withdrawal side effects when the conditional paid claim loses a concurrent race', async () => {
    const existingRequest = {
      id: 'withdrawal-request-race',
      providerProfileId: 'provider-race',
      bankAccountId: 'bank-race',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
      transferRef: 'BANK-RACE',
      adminNote: 'Transfer prepared',
      correctionReason: null,
      paidAt: null,
      metadata: {
        bankTransferEvidence: {
          transferRef: 'BANK-RACE',
          bankTransferDate: '2026-07-13T08:00:00.000Z',
          attachmentUrl: 'https://storage.example/withdrawal-race.jpg',
          submittedByAdminId: 'finance-maker-1',
        },
      },
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      accountingJournalBatch: { upsert: vi.fn() },
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      providerBankAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'bank-race' }) },
      providerPayoutBatch: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }) },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 700000 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(existingRequest),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await expect(
      service.updateProviderWalletWithdrawalRequestForAdmin(
        existingRequest.id,
        { status: ProviderWalletWithdrawalRequestStatus.PAID },
        'finance-approver-2',
      ),
    ).rejects.toThrow(
      'Partner wallet withdrawal changed while paid closeout was running. Reload and review the latest status.',
    );

    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).not.toHaveBeenCalled();
    expect(tx.providerWalletWithdrawalRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('rejects withdrawal paid closeout in a finalized monthly period before ledger or GL writes', async () => {
    const existingRequest = {
      id: 'withdrawal-request-closed-period',
      providerProfileId: 'provider-closed-period',
      bankAccountId: 'bank-closed-period',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.APPROVED,
      transferRef: null,
      adminNote: null,
      correctionReason: null,
      paidAt: null,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      accountingJournalBatch: {
        upsert: vi.fn(),
      },
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({ status: MonthlyTaxClosingStatus.CLOSED }),
      },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-closed-period' }),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 750000 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        update: vi.fn(),
      },
    };
    const prisma = {
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(existingRequest),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await expect(
      service.updateProviderWalletWithdrawalRequestForAdmin(
        existingRequest.id,
        {
          status: ProviderWalletWithdrawalRequestStatus.PAID,
          transferRef: 'BANK-CLOSED-PERIOD',
          bankTransferDate: '2026-06-29T09:30:00.000Z',
          attachmentUrl: 'https://storage.example/payouts/closed-period-proof.jpg',
        },
        'admin-user-1',
      ),
    ).rejects.toThrow(
      'Partner wallet withdrawal paid closeout cannot post directly to finalized monthly period 2026-06',
    );

    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).not.toHaveBeenCalled();
    expect(tx.providerWalletWithdrawalRequest.update).not.toHaveBeenCalled();
  });

  it('rejects marking withdrawal paid when other pending withdrawals already reserve the balance', async () => {
    const existingRequest = {
      id: 'withdrawal-request-1',
      providerProfileId: 'provider-1',
      bankAccountId: 'bank-account-1',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.APPROVED,
      transferRef: null,
      adminNote: null,
      correctionReason: null,
      paidAt: null,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'withdrawal-release-journal-1' }),
      },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-account-1' }),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 750000 } }),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 300000 } }),
        update: vi.fn(),
      },
    };
    const prisma = {
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(existingRequest),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await expect(
      service.updateProviderWalletWithdrawalRequestForAdmin(
        'withdrawal-request-1',
        {
          status: ProviderWalletWithdrawalRequestStatus.PAID,
          transferRef: 'BANK-OUT-001',
          bankTransferDate: '2026-06-29T09:30:00.000Z',
          attachmentUrl: 'https://storage.example/payouts/proof.jpg',
        },
        'admin-user-1',
      ),
    ).rejects.toThrow('Withdrawal amount exceeds available partner wallet balance');

    expect(tx.providerWalletWithdrawalRequest.aggregate).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'provider-1',
        status: {
          in: [
            ProviderWalletWithdrawalRequestStatus.REQUESTED,
            ProviderWalletWithdrawalRequestStatus.NEEDS_BANK_CORRECTION,
            ProviderWalletWithdrawalRequestStatus.APPROVED,
            ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
            ProviderWalletWithdrawalRequestStatus.REVIEW_REQUIRED,
            ProviderWalletWithdrawalRequestStatus.HOLD,
          ],
        },
        id: { not: 'withdrawal-request-1' },
      },
      _sum: { amount: true },
    });
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).not.toHaveBeenCalled();
    expect(tx.providerWalletWithdrawalRequest.update).not.toHaveBeenCalled();
  });

  it('records lock-release metadata when an active withdrawal request is rejected', async () => {
    const existingRequest = {
      id: 'withdrawal-request-1',
      providerProfileId: 'provider-1',
      bankAccountId: 'bank-account-1',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.APPROVED,
      transferRef: null,
      adminNote: null,
      correctionReason: null,
      paidAt: null,
      metadata: { requestedFrom: 'partner-app' },
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'withdrawal-release-journal-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
        upsert: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...existingRequest,
          status: ProviderWalletWithdrawalRequestStatus.REJECTED,
        }),
      },
    };
    const prisma = {
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(existingRequest),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

    await service.updateProviderWalletWithdrawalRequestForAdmin(
      'withdrawal-request-1',
      {
        status: ProviderWalletWithdrawalRequestStatus.REJECTED,
        adminNote: 'Bank account ownership could not be verified',
      },
      'admin-user-1',
    );

    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[1],
    );
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledTimes(2);
    expect(tx.accountingJournalBatch.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          sourceKey: 'accounting-journal:provider-withdrawal:withdrawal-request-1:release',
        },
        create: expect.objectContaining({
          entries: {
            create: expect.arrayContaining([
              expect.objectContaining({
                side: 'DEBIT',
                accountCode: 'partner_withdrawal_payable',
              }),
              expect.objectContaining({
                side: 'CREDIT',
                accountCode: 'partner_wallet_liability',
              }),
            ]),
          },
        }),
      }),
    );
    expect(tx.providerWalletWithdrawalRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'withdrawal-request-1',
        status: ProviderWalletWithdrawalRequestStatus.APPROVED,
      },
      data: expect.objectContaining({
        status: ProviderWalletWithdrawalRequestStatus.REJECTED,
        metadata: expect.objectContaining({
          requestedFrom: 'partner-app',
          lastStatusChange: expect.objectContaining({
            previousStatus: ProviderWalletWithdrawalRequestStatus.APPROVED,
            nextStatus: ProviderWalletWithdrawalRequestStatus.REJECTED,
            lockedAmountReleased: true,
            releasedAmount: 500000,
            changedByAdminId: 'admin-user-1',
          }),
        }),
      }),
    });
    expect(tx.providerWalletWithdrawalRequest.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'withdrawal-request-1' },
      include: expect.objectContaining({
        bankAccount: true,
      }),
    });
  });

  it.each([
    ProviderWalletWithdrawalRequestStatus.REJECTED,
    ProviderWalletWithdrawalRequestStatus.CANCELLED,
    ProviderWalletWithdrawalRequestStatus.FAILED,
  ])(
    'rejects BANK_TRANSFER_PENDING to %s before any lock-release transaction begins',
    async (status) => {
      const existingRequest = {
        id: 'withdrawal-request-bank-pending',
        providerProfileId: 'provider-1',
        bankAccountId: 'bank-account-1',
        amount: 500000,
        currency: 'VND',
        status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
        transferRef: 'BANK-OUT-001',
        adminNote: null,
        correctionReason: null,
        paidAt: null,
        metadata: { requestedFrom: 'partner-app' },
      };
      const prisma = {
        providerWalletWithdrawalRequest: {
          findUnique: vi.fn().mockResolvedValue(existingRequest),
        },
        $transaction: vi.fn(),
      };
      const service = new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests;

      await expect(
        service.updateProviderWalletWithdrawalRequestForAdmin(
          existingRequest.id,
          { status },
          'admin-user-1',
        ),
      ).rejects.toThrow(`Withdrawal request cannot move from BANK_TRANSFER_PENDING to ${status}`);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects a stale non-paid withdrawal decision with a conditional status claim', async () => {
    const existingRequest = {
      id: 'withdrawal-request-decision-race',
      providerProfileId: 'provider-decision-race',
      bankAccountId: 'bank-decision-race',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.APPROVED,
      transferRef: null,
      adminNote: null,
      correctionReason: null,
      paidAt: null,
      metadata: null,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      accountingJournalBatch: { upsert: vi.fn().mockResolvedValue({ id: 'journal-1' }) },
      providerWalletWithdrawalRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
    };
    const prisma = {
      providerWalletWithdrawalRequest: { findUnique: vi.fn().mockResolvedValue(existingRequest) },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);
    const beforeCommit = vi.fn();

    await expect(
      service.updateProviderWalletWithdrawalRequestForAdmin(
        existingRequest.id,
        { status: ProviderWalletWithdrawalRequestStatus.REJECTED },
        'admin-user-1',
        beforeCommit,
      ),
    ).rejects.toThrow(
      'Partner wallet withdrawal changed while this action was running. Reload and review the latest status.',
    );

    expect(tx.providerWalletWithdrawalRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: existingRequest.id,
        status: ProviderWalletWithdrawalRequestStatus.APPROVED,
      },
      data: expect.objectContaining({ status: ProviderWalletWithdrawalRequestStatus.REJECTED }),
    });
    expect(tx.providerWalletWithdrawalRequest.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(beforeCommit).not.toHaveBeenCalled();
  });

  it('marks payout batch earnings, withholding, and wallet ledger paid together', async () => {
    const paidAt = new Date('2026-06-11T09:00:00.000Z');
    const earning = {
      id: 'earning-1',
      providerProfileId: 'provider-1',
      bookingId: 'booking-1',
      netAmount: 380000,
      currency: 'VND',
      status: EarningStatus.AVAILABLE,
    };
    const existingBatch = {
      id: 'payout-batch-1',
      providerProfileId: 'provider-1',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.PROCESSING,
      transferRef: 'BANK-001',
      paidAt: null,
      earnings: [earning],
    };
    const paidBatch = {
      ...existingBatch,
      status: PayoutBatchStatus.PAID,
      paidAt,
      providerProfile: { user: { id: 'partner-user' } },
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'payout-journal-1' }),
      },
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-account-1' }),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: 380000 } }),
        findMany: vi.fn().mockResolvedValue(existingBatch.earnings),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(paidBatch),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 380000 } }),
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(({ create }) => ({ id: 'paid-ledger-1', ...create })),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      withholdingLog: {
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const service = new EarningsService(prisma as never, notifications as never);

    await expect(
      service.updatePayoutBatch('payout-batch-1', {
        actorId: 'finance-maker-1',
        status: PayoutBatchStatus.PAID,
      }),
    ).resolves.toEqual(paidBatch);

    expect(tx.providerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { providerProfileId: 'provider-1' },
      _sum: { amount: true },
    });
    expect(tx.providerEarning.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['earning-1'] },
        payoutBatchId: 'payout-batch-1',
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
      },
      data: {
        status: EarningStatus.PAID,
        paidAt: expect.any(Date),
      },
    });
    expect(tx.withholdingLog.updateMany).toHaveBeenCalledWith({
      where: { payoutBatchId: 'payout-batch-1' },
      data: { status: 'PAID' },
    });
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'earning:earning-1:payout:payout-batch-1' },
        create: expect.objectContaining({
          payoutBatchId: 'payout-batch-1',
          type: ProviderWalletLedgerType.PAYOUT_PAID,
          amount: -380000,
          reference: 'BANK-001',
        }),
      }),
    );
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceKey: 'accounting-journal:provider-payout-batch:payout-batch-1:paid',
        },
        create: expect.objectContaining({
          createdById: 'finance-maker-1',
          sourceType: AccountingJournalSourceType.PROVIDER_PAYOUT_BATCH,
          totalCredit: 380000,
          totalDebit: 380000,
          entries: {
            create: expect.arrayContaining([
              expect.objectContaining({
                side: AccountingJournalEntrySide.DEBIT,
                accountCode: 'partner_wallet_liability',
                amount: 380000,
              }),
              expect.objectContaining({
                side: AccountingJournalEntrySide.CREDIT,
                accountCode: 'company_bank_cash',
                amount: 380000,
              }),
            ]),
          },
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'partner-user',
        type: 'provider.payout_batch.updated',
        body: 'Your payout batch was marked paid. Check the payout screen for details.',
      }),
    );
  });

  it('stops payout side effects when the conditional status update loses a concurrent race', async () => {
    const existingBatch = {
      id: 'payout-batch-race',
      providerProfileId: 'provider-race',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.PROCESSING,
      transferRef: 'BANK-RACE',
      notes: null,
      paidAt: null,
      earnings: [
        {
          id: 'earning-race',
          providerProfileId: 'provider-race',
          bookingId: 'booking-race',
          netAmount: 380000,
          currency: 'VND',
          status: EarningStatus.AVAILABLE,
        },
      ],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      accountingJournalBatch: {
        upsert: vi.fn(),
      },
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-race' }),
      },
      providerEarning: {
        findMany: vi.fn().mockResolvedValue(existingBatch.earnings),
        updateMany: vi.fn(),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 380000 } }),
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      withholdingLog: {
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.updatePayoutBatch(existingBatch.id, { status: PayoutBatchStatus.PAID }),
    ).rejects.toThrow(
      'Payout batch changed while this action was running. Reload and review the latest status.',
    );

    expect(tx.providerPayoutBatch.updateMany).toHaveBeenCalledWith({
      where: {
        id: existingBatch.id,
        notes: null,
        status: PayoutBatchStatus.PROCESSING,
        transferRef: 'BANK-RACE',
      },
      data: expect.objectContaining({
        status: PayoutBatchStatus.PAID,
        paidAt: expect.any(Date),
      }),
    });
    expect(tx.providerEarning.updateMany).not.toHaveBeenCalled();
    expect(tx.withholdingLog.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).not.toHaveBeenCalled();
    expect(tx.providerPayoutBatch.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('re-reads payout earnings under the wallet lock and rejects a concurrent refund cancellation', async () => {
    const staleEarning = {
      id: 'earning-refund-race',
      providerProfileId: 'provider-refund-race',
      bookingId: 'booking-refund-race',
      netAmount: 380000,
      currency: 'VND',
      status: EarningStatus.AVAILABLE,
    };
    const existingBatch = {
      id: 'payout-batch-refund-race',
      providerProfileId: 'provider-refund-race',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.PROCESSING,
      transferRef: 'BANK-REFUND-RACE',
      notes: null,
      paidAt: null,
      earnings: [staleEarning],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      providerBankAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'bank-1' }) },
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([
          { ...staleEarning, status: EarningStatus.CANCELLED, netAmount: 0 },
        ]),
        updateMany: vi.fn(),
      },
      providerPayoutBatch: { updateMany: vi.fn() },
      providerSanction: { findFirst: vi.fn().mockResolvedValue(null) },
      providerWalletLedgerEntry: { upsert: vi.fn() },
    };
    const prisma = {
      providerPayoutBatch: { findUnique: vi.fn().mockResolvedValue(existingBatch) },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.updatePayoutBatch(existingBatch.id, { status: PayoutBatchStatus.PAID }),
    ).rejects.toThrow('Payout batch contains a cancelled earning');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[1],
    );
    expect(tx.providerEarning.findMany).toHaveBeenCalledWith({
      where: { payoutBatchId: existingBatch.id },
    });
    expect(tx.providerPayoutBatch.updateMany).not.toHaveBeenCalled();
    expect(tx.providerEarning.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
  });

  it('rejects payout paid closeout in a finalized monthly period before status or ledger writes', async () => {
    const existingBatch = {
      id: 'payout-batch-closed-period',
      providerProfileId: 'provider-closed-period',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.PROCESSING,
      transferRef: 'BANK-CLOSED-PERIOD',
      notes: null,
      paidAt: null,
      earnings: [
        {
          id: 'earning-closed-period',
          providerProfileId: 'provider-closed-period',
          bookingId: 'booking-closed-period',
          netAmount: 380000,
          currency: 'VND',
          status: EarningStatus.AVAILABLE,
        },
      ],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      accountingJournalBatch: {
        upsert: vi.fn(),
      },
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({ status: MonthlyTaxClosingStatus.CLOSED }),
      },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-closed-period' }),
      },
      providerEarning: {
        findMany: vi.fn().mockResolvedValue(existingBatch.earnings),
        updateMany: vi.fn(),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
        updateMany: vi.fn(),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 380000 } }),
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      withholdingLog: {
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.updatePayoutBatch(existingBatch.id, { status: PayoutBatchStatus.PAID }),
    ).rejects.toThrow('Payout paid closeout cannot post directly to finalized monthly period');

    expect(tx.providerPayoutBatch.updateMany).not.toHaveBeenCalled();
    expect(tx.providerEarning.updateMany).not.toHaveBeenCalled();
    expect(tx.withholdingLog.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).not.toHaveBeenCalled();
  });

  it('rejects payout processing when the partner has no approved bank account', async () => {
    const existingBatch = {
      id: 'payout-batch-no-bank',
      providerProfileId: 'provider-no-bank',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.DRAFT,
      transferRef: 'BANK-NO-ACCOUNT',
      paidAt: null,
      earnings: [
        {
          id: 'earning-no-bank',
          providerProfileId: 'provider-no-bank',
          bookingId: 'booking-no-bank',
          netAmount: 380000,
          currency: 'VND',
          status: EarningStatus.AVAILABLE,
        },
      ],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerEarning: {
        findMany: vi.fn().mockResolvedValue(existingBatch.earnings),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
        updateMany: vi.fn(),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
        findFirst: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.updatePayoutBatch(existingBatch.id, { status: PayoutBatchStatus.PROCESSING }),
    ).rejects.toThrow('Partner needs an approved bank account before payout');

    expect(tx.providerPayoutBatch.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
  });

  it('rejects payout processing when linked earnings no longer match the batch total', async () => {
    const existingBatch = {
      id: 'payout-batch-total-drift',
      providerProfileId: 'provider-total-drift',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.DRAFT,
      transferRef: 'BANK-TOTAL-DRIFT',
      paidAt: null,
      earnings: [
        {
          id: 'earning-total-drift',
          providerProfileId: 'provider-total-drift',
          bookingId: 'booking-total-drift',
          netAmount: 360000,
          currency: 'VND',
          status: EarningStatus.AVAILABLE,
        },
      ],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-total-drift' }),
      },
      providerEarning: {
        findMany: vi.fn().mockResolvedValue(existingBatch.earnings),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
        updateMany: vi.fn(),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
        findFirst: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.updatePayoutBatch(existingBatch.id, { status: PayoutBatchStatus.PROCESSING }),
    ).rejects.toThrow('Payout batch earning total or currency no longer matches');

    expect(tx.providerPayoutBatch.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
  });

  it('rejects payout paid closeout when wallet balance cannot cover the batch', async () => {
    const existingBatch = {
      id: 'payout-batch-low-wallet',
      providerProfileId: 'provider-low-wallet',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.PROCESSING,
      transferRef: 'BANK-LOW-WALLET',
      paidAt: null,
      earnings: [
        {
          id: 'earning-low-wallet',
          providerProfileId: 'provider-low-wallet',
          bookingId: 'booking-low-wallet',
          netAmount: 380000,
          currency: 'VND',
          status: EarningStatus.AVAILABLE,
        },
      ],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-low-wallet' }),
      },
      providerEarning: {
        findMany: vi.fn().mockResolvedValue(existingBatch.earnings),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
        updateMany: vi.fn(),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 379999 } }),
        findFirst: vi.fn(),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.updatePayoutBatch(existingBatch.id, { status: PayoutBatchStatus.PAID }),
    ).rejects.toThrow('Partner wallet ledger balance cannot cover payout batch');

    expect(tx.providerPayoutBatch.updateMany).not.toHaveBeenCalled();
    expect(tx.providerWalletLedgerEntry.findFirst).not.toHaveBeenCalled();
  });

  it('rejects payout paid closeout when payout ledger evidence already exists', async () => {
    const existingBatch = {
      id: 'payout-batch-duplicate-ledger',
      providerProfileId: 'provider-duplicate-ledger',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.PROCESSING,
      transferRef: 'BANK-DUPLICATE',
      paidAt: null,
      earnings: [
        {
          id: 'earning-duplicate-ledger',
          providerProfileId: 'provider-duplicate-ledger',
          bookingId: 'booking-duplicate-ledger',
          netAmount: 380000,
          currency: 'VND',
          status: EarningStatus.AVAILABLE,
        },
      ],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
      providerBankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bank-duplicate-ledger' }),
      },
      providerEarning: {
        findMany: vi.fn().mockResolvedValue(existingBatch.earnings),
      },
      providerPayoutBatch: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
        updateMany: vi.fn(),
      },
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 380000 } }),
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-payout-ledger' }),
      },
      providerWalletWithdrawalRequest: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(existingBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.updatePayoutBatch(existingBatch.id, { status: PayoutBatchStatus.PAID }),
    ).rejects.toThrow('Payout wallet ledger evidence already exists while the batch is still open');

    expect(tx.providerPayoutBatch.updateMany).not.toHaveBeenCalled();
  });

  it('rejects withdrawal paid closeout when bank approval or ledger uniqueness is missing', async () => {
    const existingRequest = {
      id: 'withdrawal-request-preflight',
      providerProfileId: 'provider-withdrawal-preflight',
      bankAccountId: 'bank-withdrawal-preflight',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.APPROVED,
      transferRef: null,
      adminNote: null,
      correctionReason: null,
      paidAt: null,
    };
    const paidInput = {
      status: ProviderWalletWithdrawalRequestStatus.PAID,
      transferRef: 'BANK-WITHDRAWAL-PREFLIGHT',
      bankTransferDate: '2026-06-29T09:30:00.000Z',
      attachmentUrl: 'https://storage.example/payouts/withdrawal-proof.jpg',
    };
    const createService = (bankAccount: { id: string } | null, paidLedger: { id: string } | null) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
        monthlyTaxClosing: { findUnique: vi.fn().mockResolvedValue(null) },
        accountingJournalBatch: {
          upsert: vi.fn(),
        },
        providerBankAccount: {
          findFirst: vi.fn().mockResolvedValue(bankAccount),
        },
        providerPayoutBatch: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { totalNetAmount: 0 } }),
        },
        providerWalletLedgerEntry: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 750000 } }),
          findUnique: vi.fn().mockResolvedValue(paidLedger),
          upsert: vi.fn(),
        },
        providerWalletWithdrawalRequest: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
          update: vi.fn(),
        },
      };
      const prisma = {
        providerWalletWithdrawalRequest: {
          findUnique: vi.fn().mockResolvedValue(existingRequest),
        },
        $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
          callback(tx),
        ),
      };
      return {
        service: new EarningsService(prisma as never) as EarningsServiceWithWithdrawalRequests,
        tx,
      };
    };

    const missingBank = createService(null, null);
    await expect(
      missingBank.service.updateProviderWalletWithdrawalRequestForAdmin(
        existingRequest.id,
        paidInput,
        'admin-user-1',
      ),
    ).rejects.toThrow('Partner needs an approved bank account before withdrawal paid closeout');
    expect(missingBank.tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(missingBank.tx.providerWalletWithdrawalRequest.update).not.toHaveBeenCalled();

    const duplicateLedger = createService({ id: existingRequest.bankAccountId }, { id: 'existing-ledger' });
    await expect(
      duplicateLedger.service.updateProviderWalletWithdrawalRequestForAdmin(
        existingRequest.id,
        paidInput,
        'admin-user-1',
      ),
    ).rejects.toThrow(
      'Withdrawal paid wallet ledger evidence already exists while the request is still open',
    );
    expect(duplicateLedger.tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(duplicateLedger.tx.providerWalletWithdrawalRequest.update).not.toHaveBeenCalled();
  });

  it('reverses a paid payout into the open period without mutating the original payout', async () => {
    const payoutBatch = {
      id: 'payout-batch-reversal',
      providerProfileId: 'provider-reversal',
      totalNetAmount: 380000,
      currency: 'VND',
      status: PayoutBatchStatus.PAID,
      transferRef: 'BANK-PAID-001',
      notes: null,
      paidAt: new Date('2026-06-30T09:30:00.000Z'),
    };
    const originalJournal = {
      id: 'journal-payout-paid',
      sourceKey: `accounting-journal:provider-payout-batch:${payoutBatch.id}:paid`,
      sourceType: AccountingJournalSourceType.PROVIDER_PAYOUT_BATCH,
      sourceId: payoutBatch.id,
      currency: 'VND',
      status: 'POSTED',
      totalDebit: 380000,
      totalCredit: 380000,
      entries: [
        {
          id: 'entry-wallet-liability',
          side: AccountingJournalEntrySide.DEBIT,
          accountCode: 'partner_wallet_liability',
          accountName: 'Partner wallet liability',
          amount: 380000,
          currency: 'VND',
        },
        {
          id: 'entry-bank',
          side: AccountingJournalEntrySide.CREDIT,
          accountCode: 'company_bank_cash',
          accountName: 'Company bank / cash',
          amount: 380000,
          currency: 'VND',
        },
      ],
    };
    const reversalLedger = {
      id: 'ledger-payout-reversal',
      amount: 380000,
      sourceKey: `provider-payout-batch:${payoutBatch.id}:reversal`,
    };
    const reversalJournal = {
      id: 'journal-payout-reversal',
      entries: [],
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: { amount: -380000 },
        }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(reversalLedger),
      },
      accountingJournalBatch: {
        findUnique: vi
          .fn()
          .mockImplementation(({ where }: { where: { sourceKey: string } }) =>
            Promise.resolve(where.sourceKey === originalJournal.sourceKey ? originalJournal : null),
          ),
        create: vi.fn().mockResolvedValue(reversalJournal),
      },
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(payoutBatch),
        updateMany: vi.fn(),
      },
      providerEarning: {
        updateMany: vi.fn(),
      },
      withholdingLog: {
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(payoutBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.reversePaidPayoutBatchForAdmin(payoutBatch.id, {
        actorId: 'finance-maker-1',
        approvalAdminId: 'finance-approver-2',
        reason: 'Bank transfer was rejected and funds returned',
        reversalReference: 'BANK-RETURN-001',
        occurredAt: '2026-07-13T10:00:00.000Z',
        attachmentUrl: 'https://storage.example/payouts/return-proof.jpg',
      }),
    ).resolves.toEqual({
      payoutBatch,
      reversalJournalBatch: reversalJournal,
      reversalWalletLedgerEntry: reversalLedger,
    });

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.providerPayoutBatch.findUnique.mock.invocationCallOrder[0],
    );
    expect(tx.providerWalletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 380000,
        providerProfileId: 'provider-reversal',
        sourceKey: `provider-payout-batch:${payoutBatch.id}:reversal`,
        type: ProviderWalletLedgerType.ADMIN_ADJUSTMENT,
      }),
    });
    expect(tx.accountingJournalBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceKey: `accounting-journal:provider-payout-batch:${payoutBatch.id}:reversal`,
        totalDebit: 380000,
        totalCredit: 380000,
        entries: {
          create: expect.arrayContaining([
            expect.objectContaining({
              side: AccountingJournalEntrySide.CREDIT,
              accountCode: 'partner_wallet_liability',
              amount: 380000,
            }),
            expect.objectContaining({
              side: AccountingJournalEntrySide.DEBIT,
              accountCode: 'company_bank_cash',
              amount: 380000,
            }),
          ]),
        },
      }),
      include: { entries: true },
    });
    expect(tx.providerPayoutBatch.updateMany).not.toHaveBeenCalled();
    expect(tx.providerEarning.updateMany).not.toHaveBeenCalled();
    expect(tx.withholdingLog.updateMany).not.toHaveBeenCalled();
  });

  it('reverses both lock and paid journals when restoring a paid withdrawal to the wallet', async () => {
    const withdrawalRequest = {
      id: 'withdrawal-reversal',
      providerProfileId: 'provider-withdrawal-reversal',
      amount: 500000,
      currency: 'VND',
      status: ProviderWalletWithdrawalRequestStatus.PAID,
      metadata: null,
    };
    const journal = (phase: 'lock' | 'paid', debitAccountCode: string, creditAccountCode: string) => ({
      id: `journal-${phase}`,
      sourceKey: `accounting-journal:provider-withdrawal:${withdrawalRequest.id}:${phase}`,
      sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL,
      sourceId: withdrawalRequest.id,
      currency: 'VND',
      status: 'POSTED',
      totalDebit: 500000,
      totalCredit: 500000,
      entries: [
        {
          id: `entry-${phase}-debit`,
          side: AccountingJournalEntrySide.DEBIT,
          accountCode: debitAccountCode,
          accountName: debitAccountCode,
          amount: 500000,
          currency: 'VND',
        },
        {
          id: `entry-${phase}-credit`,
          side: AccountingJournalEntrySide.CREDIT,
          accountCode: creditAccountCode,
          accountName: creditAccountCode,
          amount: 500000,
          currency: 'VND',
        },
      ],
    });
    const lockJournal = journal('lock', 'partner_wallet_liability', 'partner_withdrawal_payable');
    const paidJournal = journal('paid', 'partner_withdrawal_payable', 'company_bank_cash');
    const reversedRequest = {
      ...withdrawalRequest,
      status: ProviderWalletWithdrawalRequestStatus.REVERSED,
    };
    const reversalLedger = { id: 'ledger-withdrawal-reversal', amount: 500000 };
    const reversalJournal = { id: 'journal-withdrawal-reversal', entries: [] };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      providerWalletLedgerEntry: {
        findUnique: vi
          .fn()
          .mockImplementation(({ where }: { where: { sourceKey: string } }) =>
            Promise.resolve(
              where.sourceKey === `partner-wallet-withdrawal:${withdrawalRequest.id}:paid`
                ? { id: 'ledger-withdrawal-paid', amount: -500000 }
                : null,
            ),
          ),
        create: vi.fn().mockResolvedValue(reversalLedger),
      },
      accountingJournalBatch: {
        findUnique: vi.fn().mockImplementation(({ where }: { where: { sourceKey: string } }) => {
          if (where.sourceKey === lockJournal.sourceKey) return Promise.resolve(lockJournal);
          if (where.sourceKey === paidJournal.sourceKey) return Promise.resolve(paidJournal);
          return Promise.resolve(null);
        }),
        create: vi.fn().mockResolvedValue(reversalJournal),
      },
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(withdrawalRequest),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(reversedRequest),
      },
    };
    const prisma = {
      providerWalletWithdrawalRequest: {
        findUnique: vi.fn().mockResolvedValue(withdrawalRequest),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.reversePaidProviderWalletWithdrawalForAdmin(withdrawalRequest.id, {
        actorId: 'finance-maker-1',
        approvalAdminId: 'finance-approver-2',
        reason: 'Bank rejected the transfer and returned the funds',
        reversalReference: 'BANK-RETURN-002',
        occurredAt: '2026-07-13T10:00:00.000Z',
        attachmentFileId: 'evidence-file-1',
      }),
    ).resolves.toEqual({
      withdrawalRequest: reversedRequest,
      reversalJournalBatch: reversalJournal,
      reversalWalletLedgerEntry: reversalLedger,
    });

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.providerWalletWithdrawalRequest.findUnique.mock.invocationCallOrder[0],
    );
    expect(tx.providerWalletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 500000,
        sourceKey: `provider-wallet-withdrawal:${withdrawalRequest.id}:reversal`,
        type: ProviderWalletLedgerType.ADMIN_ADJUSTMENT,
      }),
    });
    expect(tx.accountingJournalBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceKey: `accounting-journal:provider-withdrawal:${withdrawalRequest.id}:reversal`,
        totalDebit: 1000000,
        totalCredit: 1000000,
        entries: { create: expect.arrayContaining([expect.objectContaining({ amount: 500000 })]) },
      }),
      include: { entries: true },
    });
    expect(tx.providerWalletWithdrawalRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: withdrawalRequest.id,
        status: ProviderWalletWithdrawalRequestStatus.PAID,
      },
      data: expect.objectContaining({
        status: ProviderWalletWithdrawalRequestStatus.REVERSED,
        correctionReason: 'Bank rejected the transfer and returned the funds',
        reviewedByAdminId: 'finance-maker-1',
      }),
    });
  });

  it('blocks paid disbursement reversal when the new posting period is finalized', async () => {
    const payoutBatch = {
      id: 'payout-closed-reversal',
      providerProfileId: 'provider-closed-reversal',
      totalNetAmount: 250000,
      currency: 'VND',
      status: PayoutBatchStatus.PAID,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      monthlyTaxClosing: {
        findUnique: vi.fn().mockResolvedValue({ status: MonthlyTaxClosingStatus.CLOSED }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
        create: vi.fn(),
      },
      accountingJournalBatch: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(payoutBatch),
      },
    };
    const prisma = {
      providerPayoutBatch: {
        findUnique: vi.fn().mockResolvedValue(payoutBatch),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new EarningsService(prisma as never);

    await expect(
      service.reversePaidPayoutBatchForAdmin(payoutBatch.id, {
        actorId: 'finance-maker-1',
        approvalAdminId: 'finance-approver-2',
        reason: 'Returned transfer must be reversed in an open period',
        reversalReference: 'BANK-RETURN-CLOSED',
        occurredAt: '2026-07-13T10:00:00.000Z',
        attachmentUrl: 'https://storage.example/payouts/closed-proof.jpg',
      }),
    ).rejects.toThrow('Payout batch reversal cannot post directly to finalized monthly period');

    expect(tx.providerWalletLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.create).not.toHaveBeenCalled();
  });
});
