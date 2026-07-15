import {
  BookingStatus,
  EarningStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderWalletLedgerType,
} from '@prisma/client';
import { bookingServiceAmount, buildCouponSettlementContext } from './coupon-settlement';
import { bpsAmount } from './settlement-calculator';

export type HistoricalSettlementBlocker = {
  code: string;
  message: string;
};

type HistoricalSettlementBooking = {
  id: string;
  status: BookingStatus;
  customerProfileId: string;
  selectedProviderId: string | null;
  updatedAt: Date;
  closedAt: Date | null;
  services: Array<{ price: number; quantity: number }>;
  payment: {
    id: string;
    status: PaymentStatus;
    method: PaymentMethod;
    amount: number;
    currency: string;
    rawMeta: Prisma.JsonValue | null;
  } | null;
  settlementSnapshot: { id: string } | null;
  earning: {
    id: string;
    providerProfileId: string;
    status: EarningStatus;
    grossAmount: number;
    platformFee: number;
    withholdingAmount: number;
    netAmount: number;
    currency: string;
    paidAt: Date | null;
    platformFeeLogs: Array<{
      id: string;
      grossAmount: number;
      platformFeeAmount: number;
      currency: string;
      policyVersionId: string | null;
      ruleSnapshot: Prisma.JsonValue | null;
      policyVersion: { vatRateBps: number } | null;
    }>;
    taxLogs: Array<{
      id: string;
      grossAmount: number;
      taxableAmount: number;
      withholdingAmount: number;
      currency: string;
      policyVersionId: string | null;
      ruleSnapshot: Prisma.JsonValue | null;
    }>;
    walletLedgerEntries: Array<{
      id: string;
      type: ProviderWalletLedgerType;
      amount: number;
    }>;
  } | null;
};

export type HistoricalSettlementEvidence = {
  bookingId: string;
  customerProfileId: string;
  providerProfileId: string;
  paymentId: string;
  providerEarningId: string;
  paymentMethod: PaymentMethod;
  currency: string;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  partnerTaxableRevenueAmount: number;
  platformFeeGross: number;
  partnerVatRateBps: number;
  partnerPitRateBps: number;
  platformVatRateBps: number;
  taxPolicyVersionId: string | null;
  platformFeePolicyVersionId: string | null;
  taxRuleSnapshot: Prisma.InputJsonValue;
  platformFeeRuleSnapshot: Prisma.InputJsonValue;
  providerTaxLogIds: string[];
  providerPlatformFeeLogId: string;
  providerWalletLedgerEntryIds: string[];
  metadata: Prisma.InputJsonObject;
  occurredAt: Date;
};

export type HistoricalSettlementEvidenceAnalysis = {
  canReconstruct: boolean;
  blockers: HistoricalSettlementBlocker[];
  evidence: HistoricalSettlementEvidence | null;
  evidenceSummary: {
    platformFeeLogCount: number;
    taxLogCount: number;
    walletLedgerEntryCount: number;
  };
};

export function analyzeHistoricalSettlementEvidence(
  booking: HistoricalSettlementBooking,
  providerProfileId: string,
): HistoricalSettlementEvidenceAnalysis {
  const blockers: HistoricalSettlementBlocker[] = [];
  const earning = booking.earning;
  const platformFeeLogs = earning?.platformFeeLogs ?? [];
  const taxLogs = earning?.taxLogs ?? [];
  const walletLedgerEntries = earning?.walletLedgerEntries ?? [];
  const evidenceSummary = {
    platformFeeLogCount: platformFeeLogs.length,
    taxLogCount: taxLogs.length,
    walletLedgerEntryCount: walletLedgerEntries.length,
  };

  if (booking.status !== BookingStatus.COMPLETED) {
    blockers.push({ code: 'BOOKING_NOT_COMPLETED', message: 'Booking is not completed.' });
  }
  if (!booking.selectedProviderId || booking.selectedProviderId !== providerProfileId) {
    blockers.push({ code: 'PARTNER_EVIDENCE_MISMATCH', message: 'Selected Partner evidence does not match.' });
  }
  if (booking.services.length === 0) {
    blockers.push({ code: 'SERVICE_EVIDENCE_MISSING', message: 'Booking service evidence is missing.' });
  }
  if (!booking.payment || booking.payment.status !== PaymentStatus.CAPTURED) {
    blockers.push({ code: 'PAYMENT_NOT_CAPTURED', message: 'Captured payment evidence is required.' });
  }
  if (booking.settlementSnapshot) {
    blockers.push({ code: 'SETTLEMENT_EXISTS', message: 'A settlement snapshot already exists.' });
  }
  if (!earning || earning.status !== EarningStatus.PAID || !earning.paidAt) {
    blockers.push({ code: 'PAID_EARNING_REQUIRED', message: 'Paid earning evidence is required.' });
  } else if (earning.providerProfileId !== providerProfileId) {
    blockers.push({ code: 'EARNING_PARTNER_MISMATCH', message: 'Paid earning belongs to another Partner.' });
  }
  if (platformFeeLogs.length !== 1) {
    blockers.push({
      code: 'PLATFORM_FEE_LOG_AMBIGUOUS',
      message: 'Exactly one retained platform fee log is required.',
    });
  }
  if (taxLogs.length !== 1) {
    blockers.push({ code: 'TAX_LOG_AMBIGUOUS', message: 'Exactly one retained Partner tax log is required.' });
  }

  if (
    !earning ||
    earning.status !== EarningStatus.PAID ||
    !earning.paidAt ||
    !booking.payment ||
    platformFeeLogs.length !== 1 ||
    taxLogs.length !== 1
  ) {
    return { blockers, canReconstruct: false, evidence: null, evidenceSummary };
  }

  const platformFeeLog = platformFeeLogs[0];
  const taxLog = taxLogs[0];
  if (
    platformFeeLog.grossAmount !== earning.grossAmount ||
    platformFeeLog.platformFeeAmount !== earning.platformFee ||
    platformFeeLog.currency !== earning.currency
  ) {
    blockers.push({
      code: 'PLATFORM_FEE_EVIDENCE_MISMATCH',
      message: 'Platform fee log does not match the paid earning.',
    });
  }
  if (
    taxLog.grossAmount !== earning.grossAmount ||
    taxLog.withholdingAmount !== earning.withholdingAmount ||
    taxLog.currency !== earning.currency
  ) {
    blockers.push({ code: 'TAX_EVIDENCE_MISMATCH', message: 'Tax log does not match the paid earning.' });
  }

  const bookingEarningEntry = walletLedgerEntries.find(
    (entry) => entry.type === ProviderWalletLedgerType.BOOKING_EARNING && entry.amount === earning.netAmount,
  );
  const paidEntry = walletLedgerEntries.find(
    (entry) =>
      (entry.type === ProviderWalletLedgerType.PAYOUT_PAID ||
        entry.type === ProviderWalletLedgerType.CASH_FEE_DEBT_SETTLED) &&
      entry.amount === -earning.netAmount,
  );
  if (earning.netAmount !== 0 && (!bookingEarningEntry || !paidEntry)) {
    blockers.push({
      code: 'WALLET_LIFECYCLE_EVIDENCE_MISMATCH',
      message: 'Paid wallet earning and offset entries do not reconcile to zero.',
    });
  }

  let couponSettlement;
  try {
    couponSettlement = buildCouponSettlementContext({
      bookingServiceAmount: bookingServiceAmount(booking.services),
      customerPaymentAmount: booking.payment.amount,
      paymentRawMeta: booking.payment.rawMeta,
    });
  } catch (error) {
    blockers.push({
      code: 'COUPON_EVIDENCE_INVALID',
      message: error instanceof Error ? error.message : 'Coupon evidence is invalid.',
    });
    return { blockers, canReconstruct: false, evidence: null, evidenceSummary };
  }
  if (couponSettlement.settlementBaseAmount !== earning.grossAmount) {
    blockers.push({
      code: 'BOOKING_AMOUNT_EVIDENCE_MISMATCH',
      message: 'Booking service and coupon evidence does not match the paid earning gross amount.',
    });
  }
  if (
    couponSettlement.partnerTaxableRevenueAmount !== undefined &&
    couponSettlement.partnerTaxableRevenueAmount !== taxLog.taxableAmount
  ) {
    blockers.push({
      code: 'PARTNER_TAXABLE_REVENUE_MISMATCH',
      message: 'Coupon-funded taxable revenue does not match the retained tax log.',
    });
  }

  const platformVatRateBps = historicalPlatformVatRateBps(platformFeeLog);
  if (platformVatRateBps === null) {
    blockers.push({
      code: 'PLATFORM_VAT_RATE_EVIDENCE_MISSING',
      message: 'Platform VAT rate cannot be recovered from retained fee evidence.',
    });
  }
  const partnerTaxRates = historicalPartnerTaxRates(taxLog.ruleSnapshot, taxLog.withholdingAmount);
  if (!partnerTaxRates) {
    blockers.push({
      code: 'PARTNER_TAX_RATE_EVIDENCE_MISSING',
      message: 'Partner VAT/PIT rates cannot be recovered from retained tax evidence.',
    });
  } else if (
    bpsAmount(taxLog.taxableAmount, partnerTaxRates.partnerVatRateBps) +
      bpsAmount(taxLog.taxableAmount, partnerTaxRates.partnerPitRateBps) !==
    taxLog.withholdingAmount
  ) {
    blockers.push({
      code: 'PARTNER_TAX_RATE_EVIDENCE_MISMATCH',
      message: 'Recovered Partner VAT/PIT rates do not reproduce the retained withholding amount.',
    });
  }

  const partnerPayoutAmount =
    booking.payment.method === PaymentMethod.CASH
      ? Math.max(0, earning.grossAmount - earning.platformFee)
      : earning.netAmount;
  if (partnerPayoutAmount < 0) {
    blockers.push({
      code: 'PARTNER_PAYOUT_EVIDENCE_INVALID',
      message: 'Paid non-cash earning cannot produce a negative Partner payout.',
    });
  }
  const platformFeeGross = earning.grossAmount - partnerPayoutAmount - earning.withholdingAmount;
  if (platformFeeGross < 0) {
    blockers.push({
      code: 'PLATFORM_FEE_EVIDENCE_INVALID',
      message: 'Historical amounts produce a negative platform fee.',
    });
  }

  if (blockers.length > 0 || platformVatRateBps === null || !partnerTaxRates) {
    return { blockers, canReconstruct: false, evidence: null, evidenceSummary };
  }

  return {
    blockers,
    canReconstruct: true,
    evidence: {
      bookingId: booking.id,
      customerProfileId: booking.customerProfileId,
      providerProfileId,
      paymentId: booking.payment.id,
      providerEarningId: earning.id,
      paymentMethod: booking.payment.method,
      currency: booking.payment.currency || earning.currency,
      customerPaymentAmount: couponSettlement.customerPaymentAmount,
      partnerPayoutAmount,
      partnerTaxableRevenueAmount: taxLog.taxableAmount,
      platformFeeGross,
      partnerVatRateBps: partnerTaxRates.partnerVatRateBps,
      partnerPitRateBps: partnerTaxRates.partnerPitRateBps,
      platformVatRateBps,
      taxPolicyVersionId: taxLog.policyVersionId,
      platformFeePolicyVersionId: platformFeeLog.policyVersionId,
      taxRuleSnapshot: jsonInputValue(taxLog.ruleSnapshot),
      platformFeeRuleSnapshot: jsonInputValue(platformFeeLog.ruleSnapshot),
      providerTaxLogIds: [taxLog.id],
      providerPlatformFeeLogId: platformFeeLog.id,
      providerWalletLedgerEntryIds: walletLedgerEntries.map((entry) => entry.id),
      metadata: {
        ...(couponSettlement.metadata ?? {}),
        historicalReconstruction: true,
        historicalReconstructionSource: 'PAID_EARNING_EVIDENCE',
        paidAt: earning.paidAt.toISOString(),
      },
      occurredAt: booking.closedAt ?? booking.updatedAt,
    },
    evidenceSummary,
  };
}

function historicalPlatformVatRateBps(log: {
  ruleSnapshot: Prisma.JsonValue | null;
  policyVersion: { vatRateBps: number } | null;
}) {
  if (log.policyVersion && Number.isInteger(log.policyVersion.vatRateBps)) {
    return log.policyVersion.vatRateBps;
  }
  const snapshot = jsonRecord(log.ruleSnapshot);
  const directRate = integerValue(snapshot?.vatRateBps);
  if (directRate !== null) {
    return directRate;
  }
  const lines = Array.isArray(snapshot?.lines) ? snapshot.lines : [];
  const firstLine = lines.map(jsonRecord).find((line) => integerValue(line?.vatBps) !== null);
  const lineRate = integerValue(firstLine?.vatBps);
  if (lineRate !== null) {
    return lineRate;
  }
  return integerValue(snapshot?.vatAmount) === 0 ? 0 : null;
}

function historicalPartnerTaxRates(ruleSnapshot: Prisma.JsonValue | null, withholdingAmount: number) {
  if (withholdingAmount === 0) {
    return { partnerVatRateBps: 0, partnerPitRateBps: 0 };
  }
  const snapshot = jsonRecord(ruleSnapshot);
  const lines = Array.isArray(snapshot?.lines) ? snapshot.lines.map(jsonRecord) : [];
  if (lines.length > 0) {
    const vatLine = lines.find((line) => line?.taxKind === 'PARTNER_VAT');
    const pitLine = lines.find(
      (line) => line?.taxKind === 'PARTNER_PIT' || line?.taxKind === 'PARTNER_WITHHOLDING_COMBINED',
    );
    const partnerVatRateBps = integerValue(vatLine?.rateBps) ?? 0;
    const partnerPitRateBps = integerValue(pitLine?.rateBps) ?? 0;
    return partnerVatRateBps > 0 || partnerPitRateBps > 0
      ? { partnerVatRateBps, partnerPitRateBps }
      : null;
  }
  const combinedRateBps = integerValue(snapshot?.rateBps);
  return combinedRateBps !== null
    ? { partnerVatRateBps: 0, partnerPitRateBps: combinedRateBps }
    : null;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function integerValue(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function jsonInputValue(value: Prisma.JsonValue | null): Prisma.InputJsonValue {
  return value === null ? {} : (value as Prisma.InputJsonValue);
}
