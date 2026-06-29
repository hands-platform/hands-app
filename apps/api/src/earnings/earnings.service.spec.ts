import {
  BookingStatus,
  EarningStatus,
  PartnerTaxLineKind,
  PaymentMethod,
  PayoutBatchStatus,
  ProviderTaxProfileStatus,
  ProviderWalletLedgerType,
  Role,
} from '@prisma/client';
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
            select: expect.objectContaining({ id: true, reference: true, type: true }),
          }),
        }),
      }),
    );
    expect(prisma.providerEarning.findMany.mock.calls[0][0].include.booking).not.toHaveProperty('include');
    expect(prisma.providerEarning.findMany.mock.calls[0][0].include.booking.select).not.toHaveProperty('review');
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

  it('summarizes admin payout batches with aggregate queries instead of loading full batches', async () => {
    const prisma = {
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
          .mockResolvedValueOnce(6),
        findMany: vi.fn(),
      },
      withholdingLog: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 75000 } }),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.payoutBatchSummaryForAdmin({ range: '7d' })).resolves.toEqual({
      currency: 'VND',
      generatedAt: expect.any(String),
      inProgress: 3,
      missingTransferRefs: 4,
      needsReview: 2,
      open: 6,
      payoutHolds: 1,
      settled: 5,
      total: 12,
      totalNetAmount: 900000,
      withholdingAmount: 75000,
    });

    expect(prisma.providerPayoutBatch.findMany).not.toHaveBeenCalled();
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
                select: expect.objectContaining({ id: true, reference: true, type: true }),
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

  it('filters cash settlement summaries by range without hydrating unrelated earning rows', async () => {
    const prisma = {
      providerEarning: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new EarningsService(prisma as never);

    await expect(service.cashSettlementSummaryForAdmin({ range: '7d' })).resolves.toMatchObject({
      rowCount: 0,
      totalDebtAmount: 0,
    });

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
      }),
    );
  });

  it('posts a split VAT/PIT settlement snapshot inside the completed booking transaction', async () => {
    const occurredAt = new Date('2026-06-13T03:02:00.000Z');
    const booking = {
      id: 'booking-1',
      customerProfileId: 'customer-1',
      selectedProviderId: 'provider-1',
      status: BookingStatus.COMPLETED,
      updatedAt: occurredAt,
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
    };
    const tx = {
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

    await expect(service.createForCompletedBooking('booking-1', 'provider-1')).resolves.toEqual(earning);

    expect(settlements.upsertBookingSettlementSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        customerProfileId: 'customer-1',
        providerProfileId: 'provider-1',
        paymentId: 'payment-1',
        providerEarningId: 'earning-1',
        paymentMethod: PaymentMethod.CARD,
        customerPaymentAmount: 600_000,
        partnerPayoutAmount: 430_000,
        platformFeeGross: 128_000,
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
  });

  it('posts cash booking wallet debt as split platform fee, output VAT, and partner tax ledger rows', async () => {
    const occurredAt = new Date('2026-06-13T03:02:00.000Z');
    const booking = {
      id: 'booking-cash-1',
      customerProfileId: 'customer-1',
      selectedProviderId: 'provider-1',
      status: BookingStatus.COMPLETED,
      updatedAt: occurredAt,
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
        update: expect.objectContaining({ netAmount: -170_000 }),
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
