import { BookingStatus, EarningStatus, PayoutBatchStatus, ProviderWalletLedgerType, Role } from '@prisma/client';
import { EarningsService } from './earnings.service';

describe('EarningsService payout batches', () => {
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
        take: '500',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerEarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          netAmount: { gt: 0 },
          payoutBatchId: null,
          status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        }),
        take: 100,
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
        take: '500',
      }),
    ).resolves.toEqual([]);

    expect(prisma.providerPayoutBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          status: { in: [PayoutBatchStatus.DRAFT, PayoutBatchStatus.FAILED] },
        }),
        take: 100,
      }),
    );
  });

  it('excludes post-match cancellation fee holds from cash settlement debt lists', async () => {
    const prisma = {
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.listCashSettlementDebtForAdmin()).resolves.toEqual([]);

    expect(prisma.providerEarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: {
            booking: {
              is: expect.objectContaining({
                OR: [{ matchedAt: { not: null } }, { selectedProviderId: { not: null } }],
                status: BookingStatus.CANCELLED,
              }),
            },
          },
        }),
      }),
    );
  });

  it('filters cash settlement debt by range and clamps requested limits', async () => {
    const prisma = {
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

    expect(prisma.providerEarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          NOT: {
            booking: {
              is: expect.objectContaining({
                OR: [{ matchedAt: { not: null } }, { selectedProviderId: { not: null } }],
                status: BookingStatus.CANCELLED,
              }),
            },
          },
        }),
        take: 100,
      }),
    );
  });

  it('uses the same post-match cancellation exclusion for cash settlement summaries', async () => {
    const prisma = {
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cashSettlementSummaryForAdmin()).resolves.toMatchObject({
      rowCount: 0,
      totalDebtAmount: 0,
    });

    expect(prisma.providerEarning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: {
            booking: {
              is: expect.objectContaining({
                OR: [{ matchedAt: { not: null } }, { selectedProviderId: { not: null } }],
                status: BookingStatus.CANCELLED,
              }),
            },
          },
        }),
      }),
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
        update: vi.fn().mockResolvedValue({ ...existingBatch, status: PayoutBatchStatus.FAILED }),
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
        update: vi.fn().mockResolvedValue(returnedBatch),
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
      service.updatePayoutBatch('payout-batch-1', { notes: 'Bank reference pending' }),
    ).resolves.toEqual(returnedBatch);

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('marks payout batch earnings, withholding, and wallet ledger paid together', async () => {
    const paidAt = new Date('2026-06-11T09:00:00.000Z');
    const earning = {
      id: 'earning-1',
      providerProfileId: 'provider-1',
      bookingId: 'booking-1',
      netAmount: 380000,
      currency: 'VND',
    };
    const existingBatch = {
      id: 'payout-batch-1',
      providerProfileId: 'provider-1',
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
      providerSanction: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: 380000 } }),
        updateMany: vi.fn(),
      },
      providerPayoutBatch: {
        update: vi.fn().mockResolvedValue(paidBatch),
        findUniqueOrThrow: vi.fn().mockResolvedValue(paidBatch),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn(),
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
      service.updatePayoutBatch('payout-batch-1', { status: PayoutBatchStatus.PAID }),
    ).resolves.toEqual(paidBatch);

    expect(tx.providerEarning.updateMany).toHaveBeenCalledWith({
      where: {
        payoutBatchId: 'payout-batch-1',
        status: { not: EarningStatus.CANCELLED },
      },
      data: {
        status: EarningStatus.PAID,
        paidAt,
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
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'partner-user',
        type: 'provider.payout_batch.updated',
        body: 'Your payout batch was marked paid. Check the payout screen for details.',
      }),
    );
  });
});
