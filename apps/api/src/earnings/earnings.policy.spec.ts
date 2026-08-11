import {
  CashFeeSettlementMethod,
  PaymentMethod,
  PayoutBatchStatus,
  ProviderWalletWithdrawalRequestStatus,
} from '@prisma/client';

import {
  allocatePartnerBankDeposit,
  applyCashBookingDeductionToPartnerWallet,
  calculateCashBookingPartnerDue,
  calculatePlatformFeeBreakdown,
  calculateProviderWalletDelta,
  calculateServicePayoutFeeFromRules,
  normalizeProviderWalletWithdrawalRequestInput,
  normalizeProviderWalletWithdrawalRequestUpdateInput,
  normalizePartnerBankDepositInput,
  normalizeCashFeeDebtSettlementInput,
  normalizePayoutBatchUpdateStatus,
} from './earnings.policy';

describe('earnings policy', () => {
  it('credits non-cash bookings with the partner payout after withholding', () => {
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

    expect(delta).toBe(-145000);
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
      companyCouponExpense: 0,
      platformFeeGross: 128000,
      platformFeeVatRateBps: 800,
      platformFeeNetRevenue: 118519,
      companyOutputVat: 9481,
      partnerTaxPayable: 42000,
      partnerCouponSubsidyPayable: 0,
      totalPartnerDueToCompany: 170000,
      walletDeductionCompanyOutputVat: 9481,
      walletDeductionPartnerTaxPayable: 42000,
      walletDeductionPlatformFeeNetRevenue: 118519,
    });
  });

  it('reduces cash booking partner due by company-funded coupon without reducing tax or revenue facts', () => {
    expect(
      calculateCashBookingPartnerDue(128000, 800, 42000, {
        companyCouponExpense: 60000,
      }),
    ).toEqual({
      companyCouponExpense: 60000,
      companyOutputVat: 9481,
      partnerTaxPayable: 42000,
      partnerCouponSubsidyPayable: 0,
      platformFeeGross: 128000,
      platformFeeNetRevenue: 118519,
      platformFeeVatRateBps: 800,
      totalPartnerDueToCompany: 110000,
      walletDeductionCompanyOutputVat: 9481,
      walletDeductionPartnerTaxPayable: 42000,
      walletDeductionPlatformFeeNetRevenue: 58519,
    });
  });

  it('creates a Partner payable when a company CASH coupon exceeds fees and withholding', () => {
    expect(
      calculateCashBookingPartnerDue(128000, 800, 42000, {
        companyCouponExpense: 300000,
      }),
    ).toMatchObject({
      partnerCouponSubsidyPayable: 130000,
      totalPartnerDueToCompany: 0,
      walletDeductionCompanyOutputVat: 0,
      walletDeductionPartnerTaxPayable: 0,
      walletDeductionPlatformFeeNetRevenue: 0,
    });
    expect(
      calculateProviderWalletDelta({
        paymentMethod: PaymentMethod.CASH,
        grossAmount: 600000,
        platformFee: 128000,
        withholdingAmount: 42000,
        companyCouponExpense: 300000,
      }),
    ).toBe(130000);
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

  it('requires an admin actor before normalizing partner bank deposits', () => {
    expect(() =>
      normalizePartnerBankDepositInput({
        providerProfileId: 'provider-1',
        amount: 1000000,
        bankTransactionId: 'BIDV-20260629-001',
        depositDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: 'file-deposit-proof-1',
      }),
    ).toThrow('Admin actor is required for partner bank deposit');
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

  it('requires a transfer reference before processing a payout batch', () => {
    expect(() =>
      normalizePayoutBatchUpdateStatus({
        currentStatus: PayoutBatchStatus.DRAFT,
        requestedStatus: PayoutBatchStatus.PROCESSING,
        nextTransferRef: null,
      }),
    ).toThrow('Transfer reference is required before processing a payout batch');
  });

  it('normalizes omitted payout batch status updates as metadata-only updates', () => {
    const nextStatus = normalizePayoutBatchUpdateStatus({
      currentStatus: PayoutBatchStatus.DRAFT,
      requestedStatus: null,
      nextTransferRef: 'BANK-001',
    });

    expect(nextStatus).toBeUndefined();
  });

  it('normalizes partner wallet withdrawal request input', () => {
    const request = normalizeProviderWalletWithdrawalRequestInput({
      amount: 500000,
      bankAccountId: ' bank-account-1 ',
      requestNote: '  Send to my primary bank  ',
    });

    expect(request).toEqual({
      amount: 500000,
      bankAccountId: 'bank-account-1',
      requestNote: 'Send to my primary bank',
    });
  });

  it('rejects empty partner wallet withdrawal amounts', () => {
    expect(() =>
      normalizeProviderWalletWithdrawalRequestInput({
        amount: 0,
        bankAccountId: 'bank-account-1',
      }),
    ).toThrow('Withdrawal amount must be greater than 0 VND');
  });

  it('requires a correction reason before sending withdrawal requests back to the partner', () => {
    expect(() =>
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.REQUESTED,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.NEEDS_BANK_CORRECTION,
        correctionReason: ' ',
      }),
    ).toThrow('Bank correction reason is required');
  });

  it('requires a transfer reference before marking withdrawal requests paid', () => {
    expect(() =>
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.APPROVED,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.PAID,
        transferRef: null,
      }),
    ).toThrow('Transfer reference is required before marking a withdrawal request paid');
  });

  it('requires bank transfer date and evidence before marking withdrawal requests paid', () => {
    expect(() =>
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.APPROVED,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.PAID,
        transferRef: 'BANK-OUT-001',
        bankTransferDate: null,
        attachmentUrl: 'https://storage.example/payouts/proof.jpg',
      }),
    ).toThrow('Bank transfer date is required before marking a withdrawal request paid');

    expect(() =>
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.APPROVED,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.PAID,
        transferRef: 'BANK-OUT-001',
        bankTransferDate: '2026-06-29T09:30:00.000Z',
      }),
    ).toThrow('Bank transfer evidence is required before marking a withdrawal request paid');
  });

  it('normalizes bank payout evidence for paid withdrawal requests', () => {
    expect(
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.APPROVED,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.PAID,
        transferRef: ' BANK-OUT-001 ',
        bankTransferDate: '2026-06-29T09:30:00.000Z',
        attachmentFileId: ' file-payout-proof-1 ',
        adminNote: ' Completed by bank portal ',
      }),
    ).toMatchObject({
      status: ProviderWalletWithdrawalRequestStatus.PAID,
      transferRef: 'BANK-OUT-001',
      bankTransferDate: new Date('2026-06-29T09:30:00.000Z'),
      attachmentFileId: 'file-payout-proof-1',
      adminNote: 'Completed by bank portal',
    });
  });

  it('allows approved withdrawals to move into bank transfer pending', () => {
    expect(
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.APPROVED,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
        adminNote: 'Queued for Monday payout run',
      }),
    ).toMatchObject({
      status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
      adminNote: 'Queued for Monday payout run',
    });
  });

  it('rejects bank transfer pending before finance approval', () => {
    expect(() =>
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.REQUESTED,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
      }),
    ).toThrow('Withdrawal request must be approved before bank transfer pending');
  });

  it('allows bank transfer pending withdrawals to be marked paid with bank evidence', () => {
    expect(
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.PAID,
        transferRef: 'BANK-OUT-002',
        bankTransferDate: '2026-06-29T10:30:00.000Z',
        attachmentUrl: 'https://storage.example/payouts/proof-2.jpg',
      }),
    ).toMatchObject({
      status: ProviderWalletWithdrawalRequestStatus.PAID,
      transferRef: 'BANK-OUT-002',
      bankTransferDate: new Date('2026-06-29T10:30:00.000Z'),
      attachmentUrl: 'https://storage.example/payouts/proof-2.jpg',
    });
  });

  it('prevents held or review-required withdrawals from being marked paid directly', () => {
    for (const currentStatus of [
      ProviderWalletWithdrawalRequestStatus.HOLD,
      ProviderWalletWithdrawalRequestStatus.REVIEW_REQUIRED,
      ProviderWalletWithdrawalRequestStatus.NEEDS_BANK_CORRECTION,
      ProviderWalletWithdrawalRequestStatus.REQUESTED,
    ]) {
      expect(() =>
        normalizeProviderWalletWithdrawalRequestUpdateInput({
          currentStatus,
          requestedStatus: ProviderWalletWithdrawalRequestStatus.PAID,
          transferRef: 'BANK-OUT-003',
          bankTransferDate: '2026-06-29T10:30:00.000Z',
          attachmentUrl: 'https://storage.example/payouts/proof-3.jpg',
        }),
      ).toThrow('Withdrawal request must be approved or bank-transfer pending before paid');
    }
  });

  it('prevents paid withdrawal requests from moving back to unpaid states', () => {
    expect(() =>
      normalizeProviderWalletWithdrawalRequestUpdateInput({
        currentStatus: ProviderWalletWithdrawalRequestStatus.PAID,
        requestedStatus: ProviderWalletWithdrawalRequestStatus.APPROVED,
        transferRef: 'BANK-001',
      }),
    ).toThrow('Paid withdrawal requests cannot be moved back to an unpaid status');
  });
});
