import {
  assertManualWalletAdjustmentCombinationAllowed,
  type ManualWalletAdjustmentPeriodStatus,
} from './manual-wallet-adjustment-policy';

export type ManualWalletAdjustmentDirection = 'CREDIT' | 'DEBIT';

export type ManualWalletAdjustmentOwnerType = 'CUSTOMER' | 'PARTNER';

export type ManualWalletAdjustmentType =
  | 'PROMOTION_CREDIT'
  | 'CUSTOMER_COMPENSATION'
  | 'PARTNER_BONUS'
  | 'REFERRAL_CORRECTION'
  | 'ERROR_CORRECTION'
  | 'PENALTY'
  | 'CASH_BOOKING_DEDUCTION'
  | 'RECEIVABLE_WRITE_OFF'
  | 'MANUAL_REVERSAL';

export type ManualWalletAdjustmentInput = {
  readonly adjustmentType: ManualWalletAdjustmentType;
  readonly adminId: string;
  readonly amount: number;
  readonly approvalId: string;
  readonly attachmentUrl?: string | null;
  readonly currentBalance: number;
  readonly direction: ManualWalletAdjustmentDirection;
  readonly highAmountThreshold?: number;
  readonly monthlyPeriod?: string | null;
  readonly monthlyPeriodStatus?: ManualWalletAdjustmentPeriodStatus | null;
  readonly ownerType: ManualWalletAdjustmentOwnerType;
  readonly reason: string;
};

export type ManualWalletAdjustmentAccountingEntry = {
  readonly accountCredit: string;
  readonly accountDebit: string;
  readonly amount: number;
};

export type ManualWalletAdjustmentPreview = ManualWalletAdjustmentInput & {
  readonly accountingEntries: readonly ManualWalletAdjustmentAccountingEntry[];
  readonly affects: {
    readonly bankCash: boolean;
    readonly expense: boolean;
    readonly partnerReceivable: boolean;
    readonly revenue: boolean;
    readonly taxPayable: boolean;
    readonly walletLiability: boolean;
  };
  readonly afterBalance: number;
  readonly bankCashAmount: number;
  readonly beforeBalance: number;
  readonly companyOutputVat: number;
  readonly expenseAmount: number;
  readonly expenseContraAmount: number;
  readonly partnerReceivableDecrease: number;
  readonly partnerReceivableIncrease: number;
  readonly platformRevenueAmount: number;
  readonly revenueAccount: string | null;
  readonly revenueAmount: number;
  readonly requiresApproval: boolean;
  readonly requiresAttachment: boolean;
  readonly walletLiabilityDecrease: number;
  readonly walletLiabilityIncrease: number;
  readonly walletDelta: number;
};

export type ManualWalletAdjustmentReversalInput = {
  readonly adminId: string;
  readonly approvalId: string;
  readonly attachmentUrl?: string | null;
  readonly currentBalance: number;
  readonly monthlyPeriod: string | null;
  readonly monthlyPeriodStatus: ManualWalletAdjustmentPeriodStatus | null;
  readonly original: ManualWalletAdjustmentPreview;
  readonly reason: string;
};

export function buildManualWalletAdjustmentPreview(input: ManualWalletAdjustmentInput): ManualWalletAdjustmentPreview {
  assertManualWalletAdjustmentInput(input);
  assertManualWalletAdjustmentCombinationAllowed(input);

  const beforeBalance = input.currentBalance;
  const walletDelta = input.direction === 'CREDIT' ? input.amount : -input.amount;
  const afterBalance = beforeBalance + walletDelta;
  const allocation =
    input.direction === 'CREDIT'
      ? creditAllocation(input.ownerType, beforeBalance, input.amount)
      : debitAllocation(input.ownerType, beforeBalance, input.amount);
  const entries =
    input.direction === 'CREDIT'
      ? creditAccountingEntries(input, allocation)
      : debitAccountingEntries(input, allocation);
  const revenueAccount = input.direction === 'DEBIT' ? debitRevenueAccount(input.adjustmentType) : null;
  const revenueAmount = revenueAccount ? input.amount : 0;
  const expenseAmount = input.direction === 'CREDIT' ? input.amount : 0;
  const expenseContraAmount = input.direction === 'DEBIT' && !revenueAccount ? input.amount : 0;

  return {
    ...input,
    accountingEntries: entries,
    affects: {
      bankCash: false,
      expense: expenseAmount > 0 || expenseContraAmount > 0,
      partnerReceivable: allocation.partnerReceivableDecrease > 0 || allocation.partnerReceivableIncrease > 0,
      revenue: revenueAmount > 0,
      taxPayable: false,
      walletLiability: allocation.walletLiabilityIncrease > 0 || allocation.walletLiabilityDecrease > 0,
    },
    afterBalance,
    bankCashAmount: 0,
    beforeBalance,
    companyOutputVat: 0,
    expenseAmount,
    expenseContraAmount,
    partnerReceivableDecrease: allocation.partnerReceivableDecrease,
    partnerReceivableIncrease: allocation.partnerReceivableIncrease,
    platformRevenueAmount: 0,
    revenueAccount,
    revenueAmount,
    requiresApproval: true,
    requiresAttachment: requiresManualAdjustmentAttachment(input),
    walletLiabilityDecrease: allocation.walletLiabilityDecrease,
    walletLiabilityIncrease: allocation.walletLiabilityIncrease,
    walletDelta,
  };
}

export function buildManualWalletAdjustmentReversal(
  input: ManualWalletAdjustmentReversalInput,
): ManualWalletAdjustmentPreview {
  assertNonEmpty(input.adminId, 'Admin id');
  assertNonEmpty(input.approvalId, 'Approval id');
  assertNonEmpty(input.reason, 'Reason');
  assertWholeVnd(input.currentBalance, 'Current balance');

  const original = input.original;
  const direction: ManualWalletAdjustmentDirection = original.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
  const walletDelta = -original.walletDelta;
  const afterBalance = input.currentBalance + walletDelta;

  return {
    adjustmentType: 'MANUAL_REVERSAL',
    adminId: input.adminId,
    amount: original.amount,
    approvalId: input.approvalId,
    attachmentUrl: input.attachmentUrl,
    currentBalance: input.currentBalance,
    direction,
    monthlyPeriod: input.monthlyPeriod,
    monthlyPeriodStatus: input.monthlyPeriodStatus,
    ownerType: original.ownerType,
    reason: input.reason,
    accountingEntries: original.accountingEntries.map((entry) => ({
      accountCredit: entry.accountDebit,
      accountDebit: entry.accountCredit,
      amount: entry.amount,
    })),
    affects: {
      bankCash: false,
      expense: original.affects.expense,
      partnerReceivable: original.affects.partnerReceivable,
      revenue: original.affects.revenue,
      taxPayable: false,
      walletLiability: original.affects.walletLiability,
    },
    afterBalance,
    bankCashAmount: 0,
    beforeBalance: input.currentBalance,
    companyOutputVat: 0,
    expenseAmount: original.expenseContraAmount,
    expenseContraAmount: original.expenseAmount,
    partnerReceivableDecrease: original.partnerReceivableIncrease,
    partnerReceivableIncrease: original.partnerReceivableDecrease,
    platformRevenueAmount: 0,
    revenueAccount: original.revenueAccount,
    revenueAmount: original.revenueAmount,
    requiresApproval: true,
    requiresAttachment: original.requiresAttachment,
    walletDelta,
    walletLiabilityDecrease: original.walletLiabilityIncrease,
    walletLiabilityIncrease: original.walletLiabilityDecrease,
  };
}

type ManualWalletAllocation = {
  readonly partnerReceivableDecrease: number;
  readonly partnerReceivableIncrease: number;
  readonly walletLiabilityDecrease: number;
  readonly walletLiabilityIncrease: number;
};

const EMPTY_ALLOCATION: ManualWalletAllocation = {
  partnerReceivableDecrease: 0,
  partnerReceivableIncrease: 0,
  walletLiabilityDecrease: 0,
  walletLiabilityIncrease: 0,
};

function creditAllocation(
  ownerType: ManualWalletAdjustmentOwnerType,
  currentBalance: number,
  amount: number,
): ManualWalletAllocation {
  if (ownerType === 'CUSTOMER') {
    return { ...EMPTY_ALLOCATION, walletLiabilityIncrease: amount };
  }

  const negativeReceivable = Math.max(0, -currentBalance);
  const partnerReceivableDecrease = Math.min(amount, negativeReceivable);
  const walletLiabilityIncrease = amount - partnerReceivableDecrease;

  return {
    ...EMPTY_ALLOCATION,
    partnerReceivableDecrease,
    walletLiabilityIncrease,
  };
}

function debitAllocation(
  ownerType: ManualWalletAdjustmentOwnerType,
  currentBalance: number,
  amount: number,
): ManualWalletAllocation {
  const walletLiabilityDecrease = Math.min(amount, Math.max(0, currentBalance));
  const shortage = amount - walletLiabilityDecrease;

  if (ownerType === 'CUSTOMER' && shortage > 0) {
    throw new Error('Customer wallet debit cannot exceed positive customer wallet liability.');
  }

  return {
    ...EMPTY_ALLOCATION,
    partnerReceivableIncrease: ownerType === 'PARTNER' ? shortage : 0,
    walletLiabilityDecrease,
  };
}

function creditAccountingEntries(
  input: ManualWalletAdjustmentInput,
  allocation: ManualWalletAllocation,
): ManualWalletAdjustmentAccountingEntry[] {
  const accountDebit = creditExpenseAccount(input.adjustmentType, input.ownerType);
  const entries: ManualWalletAdjustmentAccountingEntry[] = [];

  if (allocation.partnerReceivableDecrease > 0) {
    entries.push({
      accountCredit: 'PARTNER_RECEIVABLE',
      accountDebit,
      amount: allocation.partnerReceivableDecrease,
    });
  }

  if (allocation.walletLiabilityIncrease > 0) {
    entries.push({
      accountCredit: walletLiabilityAccount(input.ownerType),
      accountDebit,
      amount: allocation.walletLiabilityIncrease,
    });
  }

  return entries;
}

function debitAccountingEntries(
  input: ManualWalletAdjustmentInput,
  allocation: ManualWalletAllocation,
): ManualWalletAdjustmentAccountingEntry[] {
  const accountCredit = debitCreditAccount(input.adjustmentType, input.ownerType);
  const entries: ManualWalletAdjustmentAccountingEntry[] = [];

  if (allocation.walletLiabilityDecrease > 0) {
    entries.push({
      accountCredit,
      accountDebit: walletLiabilityAccount(input.ownerType),
      amount: allocation.walletLiabilityDecrease,
    });
  }

  if (allocation.partnerReceivableIncrease > 0) {
    entries.push({
      accountCredit,
      accountDebit: 'PARTNER_RECEIVABLE',
      amount: allocation.partnerReceivableIncrease,
    });
  }

  return entries;
}

function walletLiabilityAccount(ownerType: ManualWalletAdjustmentOwnerType) {
  return ownerType === 'CUSTOMER' ? 'CUSTOMER_WALLET_LIABILITY' : 'PARTNER_WALLET_LIABILITY';
}

function creditExpenseAccount(
  adjustmentType: ManualWalletAdjustmentType,
  ownerType: ManualWalletAdjustmentOwnerType,
) {
  switch (adjustmentType) {
    case 'PROMOTION_CREDIT':
      return 'CUSTOMER_PROMOTION_EXPENSE';
    case 'CUSTOMER_COMPENSATION':
      return ownerType === 'CUSTOMER' ? 'CUSTOMER_COMPENSATION_EXPENSE' : 'PARTNER_COMPENSATION_EXPENSE';
    case 'PARTNER_BONUS':
      return 'PARTNER_BONUS_EXPENSE';
    case 'REFERRAL_CORRECTION':
      return `${ownerType}_REFERRAL_CORRECTION_EXPENSE`;
    case 'RECEIVABLE_WRITE_OFF':
      return 'PARTNER_RECEIVABLE_WRITE_OFF_EXPENSE';
    default:
      return 'MANUAL_WALLET_ADJUSTMENT_EXPENSE';
  }
}

function debitCreditAccount(
  adjustmentType: ManualWalletAdjustmentType,
  ownerType: ManualWalletAdjustmentOwnerType,
) {
  const revenueAccount = debitRevenueAccount(adjustmentType);
  if (revenueAccount) return revenueAccount;
  if (adjustmentType === 'PROMOTION_CREDIT') return 'CUSTOMER_PROMOTION_EXPENSE';
  if (adjustmentType === 'REFERRAL_CORRECTION') return `${ownerType}_REFERRAL_CORRECTION_EXPENSE`;
  return 'MANUAL_WALLET_ADJUSTMENT_EXPENSE_CONTRA';
}

function debitRevenueAccount(adjustmentType: ManualWalletAdjustmentType) {
  return adjustmentType === 'PENALTY' ? 'PENALTY_INCOME' : null;
}

function requiresManualAdjustmentAttachment(input: ManualWalletAdjustmentInput) {
  const threshold = input.highAmountThreshold ?? 10_000_000;
  return input.amount >= threshold || input.adjustmentType === 'RECEIVABLE_WRITE_OFF';
}

function assertManualWalletAdjustmentInput(input: ManualWalletAdjustmentInput) {
  assertNonEmpty(input.adminId, 'Admin id');
  assertNonEmpty(input.approvalId, 'Approval id');
  assertNonEmpty(input.reason, 'Reason');
  assertPositiveWholeVnd(input.amount, 'Amount');
  assertWholeVnd(input.currentBalance, 'Current balance');

}

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

function assertPositiveWholeVnd(value: number, label: string) {
  assertWholeVnd(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

function assertWholeVnd(value: number, label: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole VND amount.`);
  }
}
