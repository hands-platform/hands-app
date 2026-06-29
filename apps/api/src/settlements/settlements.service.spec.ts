import { PaymentFeePayer, PaymentFeeTreatment } from '@prisma/client';
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
});
