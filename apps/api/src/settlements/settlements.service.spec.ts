import {
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  PaymentFeePayer,
  PaymentFeeTreatment,
} from '@prisma/client';
import { settlementMonthlyPeriod, SettlementsService } from './settlements.service';

describe('settlementMonthlyPeriod', () => {
  it('uses Vietnam local month for monthly tax closing periods', () => {
    expect(settlementMonthlyPeriod(new Date('2026-06-30T18:00:00.000Z'))).toBe('2026-07');
  });
});

describe('SettlementsService', () => {
  it('upserts a booking settlement snapshot with calculated tax and fee amounts', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        upsert: vi.fn().mockResolvedValue({ id: 'settlement-1' }),
      },
    };
    const service = new SettlementsService(prisma as never);

    await expect(
      service.upsertBookingSettlementSnapshot({
        bookingId: 'booking-1',
        customerProfileId: 'customer-1',
        providerProfileId: 'provider-1',
        paymentId: 'payment-1',
        providerEarningId: 'earning-1',
        paymentMethod: 'CARD',
        currency: 'VND',
        customerPaymentAmount: 600_000,
        partnerPayoutAmount: 430_000,
        platformFeeGross: 128_000,
        partnerVatRateBps: 500,
        partnerPitRateBps: 200,
        platformVatRateBps: 800,
        paymentFeeRateBps: 150,
        paymentFeeFixedAmount: 1_000,
        paymentFeePayer: PaymentFeePayer.HANDS,
        paymentFeeTreatment: PaymentFeeTreatment.OPERATING_EXPENSE,
        taxPolicyVersionId: 'tax-policy-1',
        platformFeePolicyVersionId: 'platform-policy-1',
        paymentFeePolicyVersionId: 'payment-fee-policy-1',
        providerTaxLogIds: ['tax-vat-1', 'tax-pit-1'],
        providerPlatformFeeLogId: 'platform-log-1',
        providerWalletLedgerEntryIds: ['wallet-1'],
        occurredAt: new Date('2026-06-13T03:02:00.000Z'),
      }),
    ).resolves.toEqual({ id: 'settlement-1' });

    expect(prisma.bookingSettlementSnapshot.upsert).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      update: expect.objectContaining({
        sourceKey: 'booking-settlement:booking-1',
        partnerVatAmount: 30_000,
        partnerPitAmount: 12_000,
        partnerWithholdingTotal: 42_000,
        platformFeeNetRevenue: 118_519,
        companyOutputVat: 9_481,
        paymentProcessingFee: 10_000,
        monthlyPeriod: '2026-06',
      }),
      create: expect.objectContaining({
        sourceKey: 'booking-settlement:booking-1',
        bookingId: 'booking-1',
        providerTaxLogIds: ['tax-vat-1', 'tax-pit-1'],
        providerPlatformFeeLogId: 'platform-log-1',
        providerWalletLedgerEntryIds: ['wallet-1'],
      }),
    });
  });

  it('stores coupon accounting policy metadata while keeping paid amount separate from taxable base', async () => {
    const prisma = {
      bookingSettlementSnapshot: {
        upsert: vi.fn().mockResolvedValue({ id: 'settlement-coupon-1' }),
      },
    };
    const service = new SettlementsService(prisma as never);

    await service.upsertBookingSettlementSnapshot({
      bookingId: 'booking-coupon-1',
      customerProfileId: 'customer-1',
      providerProfileId: 'provider-1',
      paymentId: 'payment-1',
      providerEarningId: 'earning-1',
      paymentMethod: 'CARD',
      currency: 'VND',
      customerPaymentAmount: 540_000,
      partnerPayoutAmount: 430_000,
      partnerTaxableRevenueAmount: 600_000,
      platformFeeGross: 128_000,
      partnerVatRateBps: 500,
      partnerPitRateBps: 200,
      platformVatRateBps: 800,
      metadata: {
        couponId: 'coupon-1',
        couponCodeSnapshot: 'WELCOME10',
        couponDiscountAmount: 60_000,
        companyCouponExpense: 60_000,
        couponFundingSourceSnapshot: 'COMPANY',
      },
      occurredAt: new Date('2026-06-13T03:02:00.000Z'),
    });

    expect(prisma.bookingSettlementSnapshot.upsert).toHaveBeenCalledWith({
      where: { bookingId: 'booking-coupon-1' },
      update: expect.objectContaining({
        customerPaymentAmount: 540_000,
        partnerTaxableRevenue: 600_000,
        metadata: expect.objectContaining({
          couponId: 'coupon-1',
          couponCodeSnapshot: 'WELCOME10',
          couponDiscountAmount: 60_000,
          companyCouponExpense: 60_000,
          couponFundingSourceSnapshot: 'COMPANY',
        }),
      }),
      create: expect.objectContaining({
        bookingId: 'booking-coupon-1',
        customerPaymentAmount: 540_000,
        partnerTaxableRevenue: 600_000,
      }),
    });
  });

  it('reverses an open coupon settlement snapshot for refund without changing historical amounts', async () => {
    const existing = {
      id: 'settlement-coupon-1',
      bookingId: 'booking-coupon-1',
      couponDiscountAmount: 60_000,
      companyOutputVat: 9_481,
      companyOutputVatTotal: undefined,
      customerPaymentAmount: 540_000,
      metadata: {
        bookingServiceAmount: 600_000,
        companyCouponExpense: 60_000,
        couponDiscountAmount: 60_000,
        couponReversalStatus: 'NONE',
      },
      monthlyClosingId: null,
      partnerPayoutAmount: 430_000,
      partnerWithholdingTotal: 42_000,
      platformFeeNetRevenue: 118_519,
      settlementStatus: BookingSettlementStatus.POSTED,
      taxStatus: BookingSettlementTaxStatus.OPEN,
    };
    const prisma = {
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({ ...existing, settlementStatus: BookingSettlementStatus.REVERSED }),
      },
    };
    const service = new SettlementsService(prisma as never);

    await expect(
      service.reverseBookingSettlementSnapshotForRefund({
        actorId: 'admin-1',
        bookingId: 'booking-coupon-1',
        occurredAt: new Date('2026-06-14T03:02:00.000Z'),
        reason: 'Admin refund',
      }),
    ).resolves.toMatchObject({ settlementStatus: BookingSettlementStatus.REVERSED });

    expect(prisma.bookingSettlementSnapshot.update).toHaveBeenCalledWith({
      where: { bookingId: 'booking-coupon-1' },
      data: expect.objectContaining({
        closedAt: new Date('2026-06-14T03:02:00.000Z'),
        reversalReason: 'Admin refund',
        reversedById: 'admin-1',
        settlementStatus: BookingSettlementStatus.REVERSED,
        taxStatus: BookingSettlementTaxStatus.REVERSED,
        metadata: expect.objectContaining({
          bookingServiceAmount: 600_000,
          companyCouponExpense: 60_000,
          couponDiscountAmount: 60_000,
          couponReversalStatus: 'REVERSED',
          reversedCompanyCouponExpense: 60_000,
          reversedCouponDiscountAmount: 60_000,
        }),
      }),
    });
  });

  it('creates a reversal entry instead of editing a closed monthly settlement snapshot', async () => {
    const existing = {
      id: 'settlement-closed-1',
      bookingId: 'booking-closed-1',
      customerPaymentAmount: 540_000,
      customerProfileId: 'customer-1',
      currency: 'VND',
      metadata: {
        companyCouponExpense: 60_000,
        couponDiscountAmount: 60_000,
        couponReversalStatus: 'NONE',
      },
      monthlyClosingId: 'closing-1',
      monthlyPeriod: '2026-06',
      partnerPitAmount: 12_000,
      partnerPayoutAmount: 430_000,
      partnerTaxableRevenue: 600_000,
      partnerVatAmount: 30_000,
      partnerWithholdingTotal: 42_000,
      paymentId: 'payment-1',
      paymentMethod: 'CARD',
      paymentProcessingFee: 0,
      platformFeeGross: 128_000,
      platformFeeNetRevenue: 118_519,
      companyOutputVat: 9_481,
      providerEarningId: 'earning-1',
      providerProfileId: 'provider-1',
      settlementStatus: BookingSettlementStatus.POSTED,
      taxStatus: BookingSettlementTaxStatus.CLOSED,
    };
    const prisma = {
      bookingSettlementReversalEntry: {
        upsert: vi.fn().mockResolvedValue({
          id: 'reversal-entry-1',
          originalSettlementSnapshotId: 'settlement-closed-1',
          settlementStatus: BookingSettlementStatus.REVERSED,
        }),
      },
      bookingSettlementSnapshot: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn(),
      },
    };
    const service = new SettlementsService(prisma as never);

    await expect(
      service.reverseBookingSettlementSnapshotForRefund({
        actorId: 'admin-1',
        bookingId: 'booking-closed-1',
        occurredAt: new Date('2026-06-14T03:02:00.000Z'),
        reason: 'Closed refund',
      }),
    ).resolves.toMatchObject({
      id: 'reversal-entry-1',
      originalSettlementSnapshotId: 'settlement-closed-1',
      settlementStatus: BookingSettlementStatus.REVERSED,
    });
    expect(prisma.bookingSettlementSnapshot.update).not.toHaveBeenCalled();
    expect(prisma.bookingSettlementReversalEntry.upsert).toHaveBeenCalledWith({
      where: { originalSettlementSnapshotId: 'settlement-closed-1' },
      update: expect.objectContaining({
        reason: 'Closed refund',
      }),
      create: expect.objectContaining({
        bookingId: 'booking-closed-1',
        companyOutputVat: -9_481,
        customerPaymentAmount: -540_000,
        customerProfileId: 'customer-1',
        metadata: expect.objectContaining({
          couponReversalStatus: 'REVERSED',
          originalSettlementSnapshotId: 'settlement-closed-1',
          reversedCompanyCouponExpense: 60_000,
          reversedCouponDiscountAmount: 60_000,
        }),
        originalMonthlyClosingId: 'closing-1',
        originalMonthlyPeriod: '2026-06',
        originalSettlementSnapshotId: 'settlement-closed-1',
        partnerPayoutAmount: -430_000,
        partnerWithholdingTotal: -42_000,
        platformFeeNetRevenue: -118_519,
        reason: 'Closed refund',
        settlementStatus: BookingSettlementStatus.REVERSED,
        taxStatus: BookingSettlementTaxStatus.REVERSED,
      }),
    });
  });
});
