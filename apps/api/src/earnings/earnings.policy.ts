import { BadRequestException } from '@nestjs/common';
import {
  CashFeeSettlementMethod,
  PaymentMethod,
  PayoutBatchStatus,
  ProviderWalletWithdrawalRequestStatus,
} from '@prisma/client';

const BPS_DENOMINATOR = 10_000;

export type WalletDeltaInput = {
  paymentMethod?: PaymentMethod | string | null;
  grossAmount: number;
  platformFee: number;
  withholdingAmount: number;
  companyCouponExpense?: number | null;
};

export type PricedServiceLine = {
  serviceId: string;
  serviceName?: string | null;
  price: number;
  quantity: number;
};

export type ServicePayoutRuleLine = {
  id: string;
  serviceId: string;
  customerPrice: number;
  providerPayoutAmount: number;
  vatBps: number;
  otherCostAmount: number;
};

export type CashFeeDebtSettlementInput = {
  netAmount: number;
  settlementRef?: string | null;
  settlementNotes?: string | null;
  settlementMethod?: string | null;
};

export type PartnerBankDepositInput = {
  providerProfileId?: string | null;
  amount: number;
  bankTransactionId?: string | null;
  depositDate?: Date | string | null;
  bankAccount?: string | null;
  attachmentFileId?: string | null;
  attachmentUrl?: string | null;
  notes?: string | null;
  adminId?: string | null;
};

export type ProviderWalletWithdrawalRequestInput = {
  amount: number;
  bankAccountId?: string | null;
  requestNote?: string | null;
};

export type ProviderWalletWithdrawalRequestUpdateInput = {
  currentStatus?: ProviderWalletWithdrawalRequestStatus | string;
  status?: ProviderWalletWithdrawalRequestStatus | string | null;
  requestedStatus?: ProviderWalletWithdrawalRequestStatus | string | null;
  transferRef?: string | null;
  bankTransferDate?: Date | string | null;
  attachmentFileId?: string | null;
  attachmentUrl?: string | null;
  adminNote?: string | null;
  correctionReason?: string | null;
};

export type PayoutBatchUpdateStatusInput = {
  currentStatus: PayoutBatchStatus | string;
  requestedStatus?: PayoutBatchStatus | string | null;
  nextTransferRef?: string | null;
};

type SelectedServicePayoutRule = {
  service: PricedServiceLine;
  rule: ServicePayoutRuleLine;
};

export function calculatePlatformFeeBreakdown(platformFeeGross: number, platformFeeVatRateBps: number) {
  const gross = nonNegativeWholeVnd(platformFeeGross, 'Platform fee gross');
  const vatRateBps = nonNegativeWholeVnd(platformFeeVatRateBps, 'Platform fee VAT rate');
  const vatMultiplier = 1 + vatRateBps / BPS_DENOMINATOR;
  const platformFeeNetRevenue = Math.round(gross / vatMultiplier);

  return {
    platformFeeGross: gross,
    platformFeeVatRateBps: vatRateBps,
    platformFeeNetRevenue,
    companyOutputVat: gross - platformFeeNetRevenue,
  };
}

export function calculateCashBookingPartnerDue(
  platformFeeGross: number,
  platformFeeVatRateBps: number,
  partnerTaxPayable: number,
  options: { companyCouponExpense?: number | null } = {},
) {
  const fee = calculatePlatformFeeBreakdown(platformFeeGross, platformFeeVatRateBps);
  const tax = nonNegativeWholeVnd(partnerTaxPayable, 'Partner tax payable');
  const companyCouponExpense = nonNegativeWholeVnd(
    options.companyCouponExpense ?? 0,
    'Company coupon expense',
  );
  let remainingCouponOffset = Math.min(
    companyCouponExpense,
    fee.platformFeeNetRevenue + fee.companyOutputVat + tax,
  );
  const platformFeeNetOffset = Math.min(remainingCouponOffset, fee.platformFeeNetRevenue);
  remainingCouponOffset -= platformFeeNetOffset;
  const companyOutputVatOffset = Math.min(remainingCouponOffset, fee.companyOutputVat);
  remainingCouponOffset -= companyOutputVatOffset;
  const partnerTaxOffset = Math.min(remainingCouponOffset, tax);
  const totalDueBeforeCoupon = fee.platformFeeNetRevenue + fee.companyOutputVat + tax;
  const partnerCouponSubsidyPayable = Math.max(0, companyCouponExpense - totalDueBeforeCoupon);
  const walletDeductionPlatformFeeNetRevenue = fee.platformFeeNetRevenue - platformFeeNetOffset;
  const walletDeductionCompanyOutputVat = fee.companyOutputVat - companyOutputVatOffset;
  const walletDeductionPartnerTaxPayable = tax - partnerTaxOffset;

  return {
    ...fee,
    companyCouponExpense,
    partnerTaxPayable: tax,
    partnerCouponSubsidyPayable,
    totalPartnerDueToCompany:
      walletDeductionPlatformFeeNetRevenue +
      walletDeductionCompanyOutputVat +
      walletDeductionPartnerTaxPayable,
    walletDeductionCompanyOutputVat,
    walletDeductionPartnerTaxPayable,
    walletDeductionPlatformFeeNetRevenue,
  };
}

export function allocatePartnerBankDeposit(currentWalletBalance: number, depositAmount: number) {
  const balance = wholeVnd(currentWalletBalance, 'Current wallet balance');
  const deposit = nonNegativeWholeVnd(depositAmount, 'Deposit amount');
  const currentNegativeWalletAmount = Math.max(0, -balance);
  const amountAppliedToNegativeWallet = Math.min(currentNegativeWalletAmount, deposit);
  const amountCreditedToWalletLiability = deposit - amountAppliedToNegativeWallet;

  return {
    depositAmount: deposit,
    currentWalletBalance: balance,
    currentNegativeWalletAmount,
    amountAppliedToNegativeWallet,
    amountCreditedToWalletLiability,
    resultingWalletBalance: balance + deposit,
  };
}

export function applyCashBookingDeductionToPartnerWallet(
  currentWalletBalance: number,
  totalDeduction: number,
) {
  const balance = wholeVnd(currentWalletBalance, 'Current wallet balance');
  const deduction = nonNegativeWholeVnd(totalDeduction, 'Total deduction');
  const currentWalletLiability = Math.max(0, balance);
  const walletLiabilityUsed = Math.min(currentWalletLiability, deduction);

  return {
    currentWalletBalance: balance,
    totalDeduction: deduction,
    walletLiabilityUsed,
    negativeWalletCreated: deduction - walletLiabilityUsed,
    resultingWalletBalance: balance - deduction,
  };
}

export function calculateProviderWalletDelta(input: WalletDeltaInput) {
  if (input.paymentMethod === PaymentMethod.CASH || input.paymentMethod === 'CASH') {
    const companyCouponExpense = nonNegativeWholeVnd(
      input.companyCouponExpense ?? 0,
      'Company coupon expense',
    );
    return companyCouponExpense - input.platformFee - input.withholdingAmount;
  }

  return input.grossAmount - input.platformFee - input.withholdingAmount;
}

export function normalizeCashFeeDebtSettlementInput(input: CashFeeDebtSettlementInput) {
  const settlementRef = cleanOptionalText(input.settlementRef);
  const settlementNotes = cleanOptionalText(input.settlementNotes);
  const settlementMethod = normalizeCashFeeSettlementMethod(input.settlementMethod);

  if (input.netAmount >= 0) {
    throw new BadRequestException('Positive partner earnings must be paid through payout batches');
  }
  if (!settlementRef) {
    throw new BadRequestException('Settlement reference is required for cash fee debt settlement');
  }
  if (!settlementMethod) {
    throw new BadRequestException('Settlement method is required for cash fee debt settlement');
  }

  return {
    settlementRef,
    settlementNotes,
    settlementMethod,
  };
}

export function normalizePartnerBankDepositInput(input: PartnerBankDepositInput) {
  const providerProfileId = cleanOptionalText(input.providerProfileId);
  const amount = positiveWholeVnd(input.amount, 'Deposit amount');
  const bankTransactionId = cleanOptionalText(input.bankTransactionId);
  const bankAccount = cleanOptionalText(input.bankAccount) ?? undefined;
  const attachmentFileId = cleanOptionalText(input.attachmentFileId) ?? undefined;
  const attachmentUrl = cleanOptionalText(input.attachmentUrl) ?? undefined;
  const notes = cleanOptionalText(input.notes) ?? undefined;
  const adminId = cleanOptionalText(input.adminId) ?? undefined;
  const depositDate = normalizeDepositDate(input.depositDate);

  if (!providerProfileId) {
    throw new BadRequestException('Partner profile is required for partner bank deposit');
  }
  if (!bankTransactionId) {
    throw new BadRequestException('Bank transaction id is required for partner bank deposit');
  }
  if (!attachmentFileId && !attachmentUrl) {
    throw new BadRequestException('Deposit evidence is required for partner bank deposit');
  }
  if (!adminId) {
    throw new BadRequestException('Admin actor is required for partner bank deposit');
  }

  return {
    providerProfileId,
    amount,
    bankTransactionId,
    depositDate,
    bankAccount,
    attachmentFileId,
    attachmentUrl,
    notes,
    adminId,
  };
}

export function normalizeProviderWalletWithdrawalRequestInput(input: ProviderWalletWithdrawalRequestInput) {
  const amount = wholeVnd(input.amount, 'Withdrawal amount');
  const bankAccountId = cleanOptionalText(input.bankAccountId) ?? undefined;
  const requestNote = cleanOptionalText(input.requestNote) ?? undefined;

  if (amount <= 0) {
    throw new BadRequestException('Withdrawal amount must be greater than 0 VND');
  }

  return {
    amount,
    bankAccountId,
    requestNote,
  };
}

export function normalizeProviderWalletWithdrawalRequestUpdateInput(
  input: ProviderWalletWithdrawalRequestUpdateInput,
) {
  const requestedStatus = input.requestedStatus ?? input.status;
  const nextStatus = requestedStatus ? (requestedStatus as ProviderWalletWithdrawalRequestStatus) : undefined;
  const transferRef = cleanOptionalText(input.transferRef);
  const bankTransferDate = normalizeOptionalDate(input.bankTransferDate, 'Bank transfer date');
  const attachmentFileId = cleanOptionalText(input.attachmentFileId);
  const attachmentUrl = cleanOptionalText(input.attachmentUrl);
  const adminNote = cleanOptionalText(input.adminNote);
  const correctionReason = cleanOptionalText(input.correctionReason);

  if (nextStatus && !Object.values(ProviderWalletWithdrawalRequestStatus).includes(nextStatus)) {
    throw new BadRequestException('Invalid withdrawal request status');
  }
  if (
    nextStatus === ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING &&
    input.currentStatus !== ProviderWalletWithdrawalRequestStatus.APPROVED
  ) {
    throw new BadRequestException('Withdrawal request must be approved before bank transfer pending');
  }
  if (
    nextStatus === ProviderWalletWithdrawalRequestStatus.PAID &&
    input.currentStatus !== ProviderWalletWithdrawalRequestStatus.PAID &&
    input.currentStatus !== ProviderWalletWithdrawalRequestStatus.APPROVED &&
    input.currentStatus !== ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING
  ) {
    throw new BadRequestException('Withdrawal request must be approved or bank-transfer pending before paid');
  }
  if (
    input.currentStatus === ProviderWalletWithdrawalRequestStatus.PAID &&
    nextStatus &&
    nextStatus !== ProviderWalletWithdrawalRequestStatus.PAID
  ) {
    throw new BadRequestException('Paid withdrawal requests cannot be moved back to an unpaid status');
  }
  if (nextStatus === ProviderWalletWithdrawalRequestStatus.PAID && !transferRef) {
    throw new BadRequestException('Transfer reference is required before marking a withdrawal request paid');
  }
  if (nextStatus === ProviderWalletWithdrawalRequestStatus.PAID && !bankTransferDate) {
    throw new BadRequestException('Bank transfer date is required before marking a withdrawal request paid');
  }
  if (nextStatus === ProviderWalletWithdrawalRequestStatus.PAID && !attachmentFileId && !attachmentUrl) {
    throw new BadRequestException(
      'Bank transfer evidence is required before marking a withdrawal request paid',
    );
  }
  if (nextStatus === ProviderWalletWithdrawalRequestStatus.NEEDS_BANK_CORRECTION && !correctionReason) {
    throw new BadRequestException('Bank correction reason is required');
  }

  return {
    status: nextStatus,
    transferRef,
    bankTransferDate,
    attachmentFileId,
    attachmentUrl,
    adminNote,
    correctionReason,
  };
}

export function normalizePayoutBatchUpdateStatus(
  input: PayoutBatchUpdateStatusInput,
): PayoutBatchStatus | undefined {
  if (!input.requestedStatus) {
    return undefined;
  }

  const nextStatus = input.requestedStatus as PayoutBatchStatus;
  if (!Object.values(PayoutBatchStatus).includes(nextStatus)) {
    throw new BadRequestException('Invalid payout batch status');
  }
  if (input.currentStatus === PayoutBatchStatus.PAID && nextStatus !== PayoutBatchStatus.PAID) {
    throw new BadRequestException('Paid payout batches cannot be moved back to an unpaid status');
  }
  if (nextStatus === PayoutBatchStatus.PROCESSING && !input.nextTransferRef) {
    throw new BadRequestException('Transfer reference is required before processing a payout batch');
  }
  if (nextStatus === PayoutBatchStatus.PAID && !input.nextTransferRef) {
    throw new BadRequestException('Transfer reference is required before marking a payout batch paid');
  }

  return nextStatus;
}

export function calculateServicePayoutFeeFromRules(input: {
  grossAmount: number;
  currency: string;
  services: PricedServiceLine[];
  payoutRules: ServicePayoutRuleLine[];
}) {
  if (input.services.length === 0) {
    return null;
  }

  const selectedRules = selectPayoutRulesForServices(input.services, input.payoutRules);
  if (!selectedRules) {
    return null;
  }

  const ruleLines = selectedRules.map(buildPayoutRuleLine);
  const providerPayoutAmount = sumBy(ruleLines, (line) => line.providerPayoutAmount);
  const platformFeeAmount = Math.max(0, input.grossAmount - providerPayoutAmount);
  const vatAmount = sumBy(ruleLines, (line) => line.vatAmount);
  const otherCostAmount = sumBy(ruleLines, (line) => line.otherCostAmount);

  return {
    platformFeeAmount,
    currency: input.currency,
    policyVersionId: null,
    ruleSnapshot: {
      source: 'SERVICE_PAYOUT_RULE',
      providerPayoutAmount,
      vatAmount,
      otherCostAmount,
      grossAmount: input.grossAmount,
      netCompanyFeeBeforeWithholding: platformFeeAmount - vatAmount - otherCostAmount,
      lines: ruleLines,
    },
  };
}

function selectPayoutRulesForServices(
  services: readonly PricedServiceLine[],
  payoutRules: readonly ServicePayoutRuleLine[],
): SelectedServicePayoutRule[] | null {
  const ruleByServiceAndPrice = new Map(
    payoutRules.map((rule) => [payoutRuleLookupKey(rule.serviceId, rule.customerPrice), rule]),
  );
  const selectedRules: SelectedServicePayoutRule[] = [];

  for (const service of services) {
    const rule = ruleByServiceAndPrice.get(payoutRuleLookupKey(service.serviceId, service.price));
    if (!rule) {
      return null;
    }
    selectedRules.push({ service, rule });
  }

  return selectedRules;
}

function buildPayoutRuleLine({ service, rule }: SelectedServicePayoutRule) {
  const customerAmount = service.price * service.quantity;
  const providerPayoutAmount = rule.providerPayoutAmount * service.quantity;
  const platformFeeAmount = Math.max(0, customerAmount - providerPayoutAmount);
  const vatAmount = Math.round((platformFeeAmount * rule.vatBps) / BPS_DENOMINATOR);
  const otherCostAmount = rule.otherCostAmount * service.quantity;

  return {
    serviceId: service.serviceId,
    serviceName: service.serviceName,
    quantity: service.quantity,
    customerPrice: service.price,
    customerAmount,
    providerPayoutAmount,
    platformFeeAmount,
    vatBps: rule.vatBps,
    vatAmount,
    otherCostAmount,
    ruleId: rule.id,
  };
}

function payoutRuleLookupKey(serviceId: string, customerPrice: number) {
  return `${serviceId}:${customerPrice}`;
}

function sumBy<T>(items: readonly T[], select: (item: T) => number) {
  return items.reduce((sum, item) => sum + select(item), 0);
}

function wholeVnd(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new BadRequestException(`${label} must be a finite VND amount`);
  }
  return Math.round(value);
}

function nonNegativeWholeVnd(value: number, label: string) {
  const amount = wholeVnd(value, label);
  if (amount < 0) {
    throw new BadRequestException(`${label} must be greater than or equal to zero`);
  }
  return amount;
}

function positiveWholeVnd(value: number, label: string) {
  const amount = nonNegativeWholeVnd(value, label);
  if (amount <= 0) {
    throw new BadRequestException(`${label} must be greater than zero`);
  }
  return amount;
}

function cleanOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 240) : null;
}

function normalizeDepositDate(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException('Deposit date must be valid');
    }
    return value;
  }
  const clean = cleanOptionalText(value);
  if (!clean) {
    throw new BadRequestException('Deposit date is required for partner bank deposit');
  }
  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Deposit date must be valid');
  }
  return date;
}

function normalizeOptionalDate(value: Date | string | null | undefined, label: string): Date | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException(`${label} must be valid`);
    }
    return value;
  }
  const clean = cleanOptionalText(value);
  if (!clean) {
    return undefined;
  }
  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} must be valid`);
  }
  return date;
}

function normalizeCashFeeSettlementMethod(value: string | null | undefined): CashFeeSettlementMethod | null {
  const clean = cleanOptionalText(value);
  if (!clean) {
    return null;
  }
  if (clean === CashFeeSettlementMethod.PARTNER_DEPOSIT || clean === CashFeeSettlementMethod.ADMIN_OFFSET) {
    return clean;
  }
  throw new BadRequestException('Invalid cash fee settlement method');
}
