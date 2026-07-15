import {
  BookingStatus,
  EarningStatus,
  PaymentMethod,
  PaymentStatus,
  ProviderWalletLedgerType,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { analyzeHistoricalSettlementEvidence } from './historical-settlement-reconstruction';

describe('historical settlement reconstruction evidence', () => {
  it('builds an immutable paid earning reconstruction from retained evidence', () => {
    const result = analyzeHistoricalSettlementEvidence(paidBookingEvidence(), 'partner-1');

    expect(result).toMatchObject({
      canReconstruct: true,
      blockers: [],
      evidence: {
        bookingId: 'booking-1',
        customerPaymentAmount: 400_000,
        partnerPayoutAmount: 300_000,
        partnerTaxableRevenueAmount: 400_000,
        platformFeeGross: 80_000,
        partnerVatRateBps: 0,
        partnerPitRateBps: 500,
        platformVatRateBps: 0,
        providerEarningId: 'earning-1',
        providerPlatformFeeLogId: 'fee-log-1',
        providerTaxLogIds: ['tax-log-1'],
      },
      evidenceSummary: {
        platformFeeLogCount: 1,
        taxLogCount: 1,
        walletLedgerEntryCount: 2,
      },
    });
  });

  it('blocks paid earnings without fee and tax logs', () => {
    const booking = paidBookingEvidence();
    booking.earning.platformFeeLogs = [];
    booking.earning.taxLogs = [];

    const result = analyzeHistoricalSettlementEvidence(booking, 'partner-1');

    expect(result.canReconstruct).toBe(false);
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(
      expect.arrayContaining(['PLATFORM_FEE_LOG_AMBIGUOUS', 'TAX_LOG_AMBIGUOUS']),
    );
  });

  it('blocks wallet evidence that does not offset the paid earning', () => {
    const booking = paidBookingEvidence();
    booking.earning.walletLedgerEntries[1].amount = -290_000;

    const result = analyzeHistoricalSettlementEvidence(booking, 'partner-1');

    expect(result.canReconstruct).toBe(false);
    expect(result.blockers).toContainEqual(
      expect.objectContaining({ code: 'WALLET_LIFECYCLE_EVIDENCE_MISMATCH' }),
    );
  });

  it('blocks retained tax rates that do not reproduce withholding', () => {
    const booking = paidBookingEvidence();
    booking.earning.taxLogs[0].ruleSnapshot = { rateBps: 300 };

    const result = analyzeHistoricalSettlementEvidence(booking, 'partner-1');

    expect(result.canReconstruct).toBe(false);
    expect(result.blockers).toContainEqual(
      expect.objectContaining({ code: 'PARTNER_TAX_RATE_EVIDENCE_MISMATCH' }),
    );
  });

  it('uses retained policy VAT when a service payout snapshot does not carry vatBps', () => {
    const booking = paidBookingEvidence();
    booking.earning.platformFeeLogs[0].ruleSnapshot = { rateBps: 2_000 };
    booking.earning.platformFeeLogs[0].policyVersion = { vatRateBps: 800 };

    const result = analyzeHistoricalSettlementEvidence(booking, 'partner-1');

    expect(result.evidence?.platformVatRateBps).toBe(800);
  });

  it('derives a cash Partner payout without mutating the negative paid earning lifecycle', () => {
    const booking = paidBookingEvidence();
    booking.payment.method = PaymentMethod.CASH;
    booking.earning.netAmount = -100_000;
    booking.earning.walletLedgerEntries = [
      { id: 'wallet-created', type: ProviderWalletLedgerType.BOOKING_EARNING, amount: -100_000 },
      { id: 'wallet-paid', type: ProviderWalletLedgerType.CASH_FEE_DEBT_SETTLED, amount: 100_000 },
    ];

    const result = analyzeHistoricalSettlementEvidence(booking, 'partner-1');

    expect(result.canReconstruct).toBe(true);
    expect(result.evidence?.partnerPayoutAmount).toBe(320_000);
    expect(result.evidence?.platformFeeGross).toBe(60_000);
  });
});

function paidBookingEvidence() {
  return {
    id: 'booking-1',
    status: BookingStatus.COMPLETED,
    customerProfileId: 'customer-1',
    selectedProviderId: 'partner-1',
    updatedAt: new Date('2026-06-20T03:00:00.000Z'),
    closedAt: new Date('2026-06-20T02:00:00.000Z'),
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
      id: 'earning-1',
      providerProfileId: 'partner-1',
      status: EarningStatus.PAID,
      grossAmount: 400_000,
      platformFee: 80_000,
      withholdingAmount: 20_000,
      netAmount: 300_000,
      currency: 'VND',
      paidAt: new Date('2026-06-21T02:00:00.000Z'),
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
}
