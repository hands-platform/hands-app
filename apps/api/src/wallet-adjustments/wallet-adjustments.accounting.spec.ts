import {
  buildManualWalletAdjustmentPreview,
  buildManualWalletAdjustmentReversal,
} from './wallet-adjustments.accounting';

describe('manual wallet adjustment accounting policy', () => {
  it.each([
    ['CUSTOMER', 'CREDIT', 'PROMOTION_CREDIT', 'CUSTOMER_PROMOTION_EXPENSE', 'CUSTOMER_WALLET_LIABILITY'],
    [
      'CUSTOMER',
      'CREDIT',
      'CUSTOMER_COMPENSATION',
      'CUSTOMER_COMPENSATION_EXPENSE',
      'CUSTOMER_WALLET_LIABILITY',
    ],
    [
      'CUSTOMER',
      'CREDIT',
      'REFERRAL_CORRECTION',
      'CUSTOMER_REFERRAL_CORRECTION_EXPENSE',
      'CUSTOMER_WALLET_LIABILITY',
    ],
    [
      'CUSTOMER',
      'CREDIT',
      'ERROR_CORRECTION',
      'MANUAL_WALLET_ADJUSTMENT_EXPENSE',
      'CUSTOMER_WALLET_LIABILITY',
    ],
    [
      'CUSTOMER',
      'DEBIT',
      'REFERRAL_CORRECTION',
      'CUSTOMER_WALLET_LIABILITY',
      'CUSTOMER_REFERRAL_CORRECTION_EXPENSE',
    ],
    [
      'CUSTOMER',
      'DEBIT',
      'ERROR_CORRECTION',
      'CUSTOMER_WALLET_LIABILITY',
      'MANUAL_WALLET_ADJUSTMENT_EXPENSE_CONTRA',
    ],
    [
      'PARTNER',
      'CREDIT',
      'CUSTOMER_COMPENSATION',
      'PARTNER_COMPENSATION_EXPENSE',
      'PARTNER_WALLET_LIABILITY',
    ],
    ['PARTNER', 'CREDIT', 'PARTNER_BONUS', 'PARTNER_BONUS_EXPENSE', 'PARTNER_WALLET_LIABILITY'],
    [
      'PARTNER',
      'CREDIT',
      'REFERRAL_CORRECTION',
      'PARTNER_REFERRAL_CORRECTION_EXPENSE',
      'PARTNER_WALLET_LIABILITY',
    ],
    [
      'PARTNER',
      'CREDIT',
      'ERROR_CORRECTION',
      'MANUAL_WALLET_ADJUSTMENT_EXPENSE',
      'PARTNER_WALLET_LIABILITY',
    ],
    [
      'PARTNER',
      'CREDIT',
      'RECEIVABLE_WRITE_OFF',
      'PARTNER_RECEIVABLE_WRITE_OFF_EXPENSE',
      'PARTNER_RECEIVABLE',
    ],
    [
      'PARTNER',
      'DEBIT',
      'REFERRAL_CORRECTION',
      'PARTNER_WALLET_LIABILITY',
      'PARTNER_REFERRAL_CORRECTION_EXPENSE',
    ],
    [
      'PARTNER',
      'DEBIT',
      'ERROR_CORRECTION',
      'PARTNER_WALLET_LIABILITY',
      'MANUAL_WALLET_ADJUSTMENT_EXPENSE_CONTRA',
    ],
    ['PARTNER', 'DEBIT', 'PENALTY', 'PARTNER_WALLET_LIABILITY', 'PENALTY_INCOME'],
  ] as const)(
    'posts %s %s %s to the approved debit and credit accounts',
    (ownerType, direction, adjustmentType, accountDebit, accountCredit) => {
      const preview = buildManualWalletAdjustmentPreview({
        adjustmentType,
        adminId: 'admin-1',
        amount: 100_000,
        approvalId: 'approval-1',
        currentBalance: adjustmentType === 'RECEIVABLE_WRITE_OFF' ? -500_000 : 500_000,
        direction,
        ownerType,
        reason: 'Policy snapshot',
      });

      expect(preview.accountingEntries).toEqual([{ accountCredit, accountDebit, amount: 100_000 }]);
      expect(preview.affects.bankCash).toBe(false);
      expect(preview.affects.taxPayable).toBe(false);
    },
  );

  it('manual customer promotion credit increases customer wallet liability and expense, not revenue', () => {
    expect(
      buildManualWalletAdjustmentPreview({
        adjustmentType: 'PROMOTION_CREDIT',
        adminId: 'admin-1',
        amount: 100_000,
        approvalId: 'approval-1',
        currentBalance: 0,
        direction: 'CREDIT',
        ownerType: 'CUSTOMER',
        reason: 'Launch promotion',
      }),
    ).toMatchObject({
      afterBalance: 100_000,
      bankCashAmount: 0,
      beforeBalance: 0,
      companyOutputVat: 0,
      expenseAmount: 100_000,
      platformRevenueAmount: 0,
      walletLiabilityIncrease: 100_000,
    });
  });

  it('manual partner bonus credit increases partner wallet liability and expense, not revenue', () => {
    expect(
      buildManualWalletAdjustmentPreview({
        adjustmentType: 'PARTNER_BONUS',
        adminId: 'admin-1',
        amount: 200_000,
        approvalId: 'approval-1',
        currentBalance: 0,
        direction: 'CREDIT',
        ownerType: 'PARTNER',
        reason: 'Quality bonus',
      }),
    ).toMatchObject({
      afterBalance: 200_000,
      bankCashAmount: 0,
      companyOutputVat: 0,
      expenseAmount: 200_000,
      partnerReceivableDecrease: 0,
      platformRevenueAmount: 0,
      walletLiabilityIncrease: 200_000,
    });
  });

  it('manual credit to negative partner wallet reduces partner receivable first', () => {
    expect(
      buildManualWalletAdjustmentPreview({
        adjustmentType: 'CUSTOMER_COMPENSATION',
        adminId: 'admin-1',
        amount: 100_000,
        approvalId: 'approval-1',
        currentBalance: -170_000,
        direction: 'CREDIT',
        ownerType: 'PARTNER',
        reason: 'Partner compensation against negative wallet',
      }),
    ).toMatchObject({
      afterBalance: -70_000,
      expenseAmount: 100_000,
      partnerReceivableDecrease: 100_000,
      walletLiabilityIncrease: 0,
    });
  });

  it('manual debit from positive wallet reduces wallet liability', () => {
    expect(
      buildManualWalletAdjustmentPreview({
        adjustmentType: 'ERROR_CORRECTION',
        adminId: 'admin-1',
        amount: 100_000,
        approvalId: 'approval-1',
        currentBalance: 250_000,
        direction: 'DEBIT',
        ownerType: 'CUSTOMER',
        reason: 'Reverse mistaken promotion',
      }),
    ).toMatchObject({
      afterBalance: 150_000,
      expenseContraAmount: 100_000,
      platformRevenueAmount: 0,
      walletLiabilityDecrease: 100_000,
    });
  });

  it('manual debit greater than positive partner wallet creates partner receivable for shortage', () => {
    expect(
      buildManualWalletAdjustmentPreview({
        adjustmentType: 'PENALTY',
        adminId: 'admin-1',
        amount: 100_000,
        approvalId: 'approval-1',
        currentBalance: 60_000,
        direction: 'DEBIT',
        ownerType: 'PARTNER',
        reason: 'Penalty exceeds wallet balance',
      }),
    ).toMatchObject({
      afterBalance: -40_000,
      partnerReceivableIncrease: 40_000,
      revenueAmount: 100_000,
      walletLiabilityDecrease: 60_000,
    });
  });

  it('manual wallet adjustment does not touch bank or cash', () => {
    const preview = buildManualWalletAdjustmentPreview({
      adjustmentType: 'PARTNER_BONUS',
      adminId: 'admin-1',
      amount: 120_000,
      approvalId: 'approval-1',
      currentBalance: 50_000,
      direction: 'CREDIT',
      ownerType: 'PARTNER',
      reason: 'Manual bonus',
    });

    expect(preview.bankCashAmount).toBe(0);
    expect(preview.affects.bankCash).toBe(false);
  });

  it('manual wallet adjustment does not create output VAT unless it is booking settlement logic', () => {
    const preview = buildManualWalletAdjustmentPreview({
      adjustmentType: 'PENALTY',
      adminId: 'admin-1',
      amount: 120_000,
      approvalId: 'approval-1',
      currentBalance: 200_000,
      direction: 'DEBIT',
      ownerType: 'PARTNER',
      reason: 'Penalty is not platform fee settlement',
    });

    expect(preview.companyOutputVat).toBe(0);
    expect(preview.affects.taxPayable).toBe(false);
    expect(() =>
      buildManualWalletAdjustmentPreview({
        adjustmentType: 'CASH_BOOKING_DEDUCTION',
        adminId: 'admin-1',
        amount: 120_000,
        approvalId: 'approval-1',
        currentBalance: 200_000,
        direction: 'DEBIT',
        ownerType: 'PARTNER',
        reason: 'Should use booking settlement',
      }),
    ).toThrow('Cash booking deductions must use booking settlement logic.');
  });

  it('penalty debit does not reduce platform fee revenue', () => {
    expect(
      buildManualWalletAdjustmentPreview({
        adjustmentType: 'PENALTY',
        adminId: 'admin-1',
        amount: 100_000,
        approvalId: 'approval-1',
        currentBalance: 250_000,
        direction: 'DEBIT',
        ownerType: 'PARTNER',
        reason: 'Operational penalty',
      }),
    ).toMatchObject({
      platformRevenueAmount: 0,
      revenueAccount: 'PENALTY_INCOME',
      revenueAmount: 100_000,
    });
  });

  it('reversal entry restores original accounting impact', () => {
    const original = buildManualWalletAdjustmentPreview({
      adjustmentType: 'PROMOTION_CREDIT',
      adminId: 'admin-1',
      amount: 100_000,
      approvalId: 'approval-1',
      currentBalance: 0,
      direction: 'CREDIT',
      ownerType: 'CUSTOMER',
      reason: 'Mistaken promotion',
    });

    const reversal = buildManualWalletAdjustmentReversal({
      adminId: 'admin-2',
      approvalId: 'approval-2',
      currentBalance: original.afterBalance,
      monthlyPeriod: '2026-08',
      monthlyPeriodStatus: 'DRAFT',
      original,
      reason: 'Reverse mistaken promotion',
    });

    expect(reversal).toMatchObject({
      adjustmentType: 'MANUAL_REVERSAL',
      afterBalance: 0,
      beforeBalance: 100_000,
      direction: 'DEBIT',
      expenseContraAmount: 100_000,
      walletLiabilityDecrease: 100_000,
    });
    expect(reversal.accountingEntries).toEqual(
      original.accountingEntries.map((entry) => ({
        accountCredit: entry.accountDebit,
        accountDebit: entry.accountCredit,
        amount: entry.amount,
      })),
    );
  });

});
