import { CashFeeSettlementMethod, PaymentMethod, PayoutBatchStatus } from '@prisma/client';

import {
  allocatePartnerBankDeposit,
  applyCashBookingDeductionToPartnerWallet,
  calculateCashBookingPartnerDue,
  calculatePlatformFeeBreakdown,
  calculateProviderWalletDelta,
  calculateServicePayoutFeeFromRules,
  normalizePartnerBankDepositInput,
  normalizeCashFeeDebtSettlementInput,
  normalizePayoutBatchUpdateStatus,
} from './earnings.policy';

describe('earnings policy', () => {
  it('credits non-cash bookings after platform fee and withholding', () => {
    const delta = calculateProviderWalletDelta({
      paymentMethod: PaymentMethod.MOMO,
      grossAmount: 500000,
      platformFee: 120000,
      withholdingAmount: 25000,
    });

    expect(delta).toBe(355000);
  });

  it('creates negative wallet debt for cash bookings from the total amount due to HANDS', () => {
    const delta = calculateProviderWalletDelta({
      paymentMethod: PaymentMethod.CASH,
      grossAmount: 500000,
      platformFee: 120000,
      withholdingAmount: 25000,
    });

    expect(delta).toBe(-120000);
  });

  it('splits gross platform fee into net revenue and company output VAT', () => {
    expect(calculatePlatformFeeBreakdown(128000, 800)).toEqual({
      platformFeeGross: 128000,
      platformFeeVatRateBps: 800,
      platformFeeNetRevenue: 118519,
      companyOutputVat: 9481,
    });
  });

  it('calculates cash booking partner due to HANDS from fee gross and partner tax', () => {
    expect(calculateCashBookingPartnerDue(128000, 800, 42000)).toEqual({
      platformFeeGross: 128000,
      platformFeeVatRateBps: 800,
      platformFeeNetRevenue: 118519,
      companyOutputVat: 9481,
      partnerTaxPayable: 42000,
      totalPartnerDueToCompany: 170000,
    });
  });

  it('allocates partner bank deposit to negative wallet first and liability second', () => {
    expect(allocatePartnerBankDeposit(-170000, 1000000)).toEqual({
      depositAmount: 1000000,
      currentWalletBalance: -170000,
      currentNegativeWalletAmount: 170000,
      amountAppliedToNegativeWallet: 170000,
      amountCreditedToWalletLiability: 830000,
      resultingWalletBalance: 830000,
    });
  });

  it('normalizes partner bank deposit inputs for admin approval', () => {
    expect(
      normalizePartnerBankDepositInput({
        providerProfileId: '  provider-1  ',
        amount: 1000000.4,
        bankTransactionId: '  BIDV-20260629-001  ',
        depositDate: '2026-06-29T09:30:00.000Z',
        bankAccount: '  BIDV 123456789  ',
        attachmentFileId: '  file-deposit-proof-1  ',
        notes: '  Confirmed against bank statement  ',
        adminId: '  admin-user-1  ',
      }),
    ).toEqual({
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: new Date('2026-06-29T09:30:00.000Z'),
      bankAccount: 'BIDV 123456789',
      attachmentFileId: 'file-deposit-proof-1',
      attachmentUrl: undefined,
      notes: 'Confirmed against bank statement',
      adminId: 'admin-user-1',
    });
  });

  it('requires partner bank deposit transaction reference and evidence', () => {
    expect(() =>
      normalizePartnerBankDepositInput({
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: '',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: 'file-deposit-proof-1',
      }),
    ).toThrow('Bank transaction id is required for partner bank deposit');

    expect(() =>
      normalizePartnerBankDepositInput({
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
      }),
    ).toThrow('Deposit evidence is required for partner bank deposit');
  });

  it('applies cash booking deduction against prepaid wallet liability when enough balance exists', () => {
    expect(applyCashBookingDeductionToPartnerWallet(830000, 170000)).toEqual({
      currentWalletBalance: 830000,
      totalDeduction: 170000,
      walletLiabilityUsed: 170000,
      negativeWalletCreated: 0,
      resultingWalletBalance: 660000,
    });
  });

  it('splits cash booking deduction between wallet liability and negative receivable when balance is short', () => {
    expect(applyCashBookingDeductionToPartnerWallet(150000, 170000)).toEqual({
      currentWalletBalance: 150000,
      totalDeduction: 170000,
      walletLiabilityUsed: 150000,
      negativeWalletCreated: 20000,
      resultingWalletBalance: -20000,
    });
  });

  it('calculates service payout fee snapshots from admin-defined service duration rules', () => {
    const fee = calculateServicePayoutFeeFromRules({
      grossAmount: 500000,
      currency: 'VND',
      services: [
        {
          serviceId: 'foot-massage',
          serviceName: 'Foot Massage',
          price: 500000,
          quantity: 1,
        },
      ],
      payoutRules: [
        {
          id: 'rule-foot-60-500',
          serviceId: 'foot-massage',
          customerPrice: 500000,
          providerPayoutAmount: 380000,
          vatBps: 1000,
          otherCostAmount: 20000,
        },
      ],
    });

    expect(fee).not.toBeNull();
    expect(fee?.platformFeeAmount).toBe(120000);
    expect(fee?.ruleSnapshot.providerPayoutAmount).toBe(380000);
    expect(fee?.ruleSnapshot.vatAmount).toBe(12000);
    expect(fee?.ruleSnapshot.otherCostAmount).toBe(20000);
    expect(fee?.ruleSnapshot.netCompanyFeeBeforeWithholding).toBe(88000);
    expect(fee?.ruleSnapshot.lines).toEqual([
      expect.objectContaining({
        serviceId: 'foot-massage',
        quantity: 1,
        customerPrice: 500000,
        providerPayoutAmount: 380000,
        platformFeeAmount: 120000,
        ruleId: 'rule-foot-60-500',
      }),
    ]);
  });

  it('returns null when a selected service has no matching payout rule', () => {
    const fee = calculateServicePayoutFeeFromRules({
      grossAmount: 500000,
      currency: 'VND',
      services: [
        {
          serviceId: 'deep-tissue',
          price: 500000,
          quantity: 1,
        },
      ],
      payoutRules: [],
    });

    expect(fee).toBeNull();
  });

  it('rejects positive earnings because payout batches release partner income', () => {
    expect(() =>
      normalizeCashFeeDebtSettlementInput({
        netAmount: 380000,
        settlementRef: 'HANDS-CASH-001',
        settlementMethod: CashFeeSettlementMethod.PARTNER_DEPOSIT,
      }),
    ).toThrow('Positive partner earnings must be paid through payout batches');
  });

  it('requires a settlement reference for negative cash fee debt settlement', () => {
    expect(() =>
      normalizeCashFeeDebtSettlementInput({
        netAmount: -120000,
        settlementMethod: CashFeeSettlementMethod.PARTNER_DEPOSIT,
      }),
    ).toThrow('Settlement reference is required for cash fee debt settlement');
  });

  it('requires an allowed settlement method for negative cash fee debt settlement', () => {
    expect(() =>
      normalizeCashFeeDebtSettlementInput({
        netAmount: -120000,
        settlementRef: 'HANDS-CASH-001',
        settlementMethod: 'MANUAL_CREDIT',
      }),
    ).toThrow('Invalid cash fee settlement method');
  });

  it('normalizes valid cash fee debt settlement input', () => {
    const settlement = normalizeCashFeeDebtSettlementInput({
      netAmount: -120000,
      settlementRef: '  HANDS-CASH-001  ',
      settlementNotes: '  Partner bank deposit confirmed  ',
      settlementMethod: 'PARTNER_DEPOSIT',
    });

    expect(settlement).toEqual({
      settlementRef: 'HANDS-CASH-001',
      settlementNotes: 'Partner bank deposit confirmed',
      settlementMethod: CashFeeSettlementMethod.PARTNER_DEPOSIT,
    });
  });

  it('rejects invalid payout batch update statuses', () => {
    expect(() =>
      normalizePayoutBatchUpdateStatus({
        currentStatus: PayoutBatchStatus.DRAFT,
        requestedStatus: 'RELEASED',
        nextTransferRef: 'BANK-001',
      }),
    ).toThrow('Invalid payout batch status');
  });

  it('prevents paid payout batches from moving back to unpaid states', () => {
    expect(() =>
      normalizePayoutBatchUpdateStatus({
        currentStatus: PayoutBatchStatus.PAID,
        requestedStatus: PayoutBatchStatus.PROCESSING,
        nextTransferRef: 'BANK-001',
      }),
    ).toThrow('Paid payout batches cannot be moved back to an unpaid status');
  });

  it('requires a transfer reference before marking a payout batch paid', () => {
    expect(() =>
      normalizePayoutBatchUpdateStatus({
        currentStatus: PayoutBatchStatus.PROCESSING,
        requestedStatus: PayoutBatchStatus.PAID,
        nextTransferRef: null,
      }),
    ).toThrow('Transfer reference is required before marking a payout batch paid');
  });

  it('normalizes omitted payout batch status updates as metadata-only updates', () => {
    const nextStatus = normalizePayoutBatchUpdateStatus({
      currentStatus: PayoutBatchStatus.DRAFT,
      requestedStatus: null,
      nextTransferRef: 'BANK-001',
    });

    expect(nextStatus).toBeUndefined();
  });
});
