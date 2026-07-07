import type { AttentionFlag } from './admin-attention-flags';

export type BookingFinanceFlagTrace = {
  currency: string;
  customerPriceAmount: number | null;
  providerPayoutAmount: number | null;
  payoutRuleMissing: boolean;
  paymentMethod?: string | null;
  walletTotalAmount: number;
};

export type BookingFinanceFlagsInput = {
  bookingStatus: string;
  paymentAmount: number | null;
  servicePrice: number | null;
  hasEarning: boolean;
  earningNetAmount?: number | null;
  partnerLabel: string;
  cashDebtNeedsSettlement: boolean;
  financeTrace: BookingFinanceFlagTrace;
  formatMoney?: (amount?: number | null, currency?: string) => string;
};

export type BookingCashDebtNeedsSettlementInput = {
  paymentMethod?: string | null;
  hasEarning: boolean;
  earningNetAmount?: number | null;
  earningStatus?: string | null;
};

const defaultMoney = (amount?: number | null, currency = 'VND') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);

export function bookingCashDebtNeedsSettlement(input: BookingCashDebtNeedsSettlementInput): boolean {
  return Boolean(
    input.paymentMethod === 'CASH' &&
      input.hasEarning &&
      (input.earningNetAmount ?? 0) < 0 &&
      input.earningStatus !== 'PAID',
  );
}

export function bookingFinanceFlags(input: BookingFinanceFlagsInput): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  const { financeTrace } = input;
  const formatMoney = input.formatMoney ?? defaultMoney;

  if (financeTrace.payoutRuleMissing) {
    flags.push({
      severity: 'high',
      title: 'Payout rule missing',
      detail: 'This booking price has no matching active service payout rule.',
      action: 'Open Services and add a payout rule before allowing this option in production.',
    });
  }

  if (paymentDiffersFromBookedService(input)) {
    flags.push({
      severity: 'medium',
      title: 'Payment amount differs from booked service',
      detail: `Payment is ${formatMoney(input.paymentAmount, financeTrace.currency)} but booked service is ${formatMoney(
        input.servicePrice,
        financeTrace.currency,
      )}.`,
      action: 'Review coupon, discount, or payment capture rules before closing finance.',
    });
  }

  if (partnerPayoutExceedsCustomerPrice(financeTrace)) {
    flags.push({
      severity: 'high',
      title: 'Partner payout exceeds customer price',
      detail: 'The payout rule would pay more than the customer charge.',
      action: 'Disable or correct the service payout rule immediately.',
    });
  }

  if (input.bookingStatus === 'COMPLETED' && !input.hasEarning) {
    flags.push({
      severity: 'high',
      title: 'Completed booking has no earning',
      detail: 'Service is completed but no Partner earning/wallet entry exists.',
      action: 'Run earning creation or inspect completion processing.',
    });
  }

  if (input.cashDebtNeedsSettlement) {
    flags.push({
      severity: 'high',
      title: 'Cash wallet debt blocks Partner',
      detail: `${input.partnerLabel} owes ${formatMoney(
        Math.abs(input.earningNetAmount ?? financeTrace.walletTotalAmount),
        financeTrace.currency,
      )} before final acceptance, service start, or payout release can continue.`,
      action: 'Collect the HANDS fee deposit or offset it in an admin settlement.',
    });
  }

  if (cashDebtLedgerMayBeStale(input)) {
    flags.push({
      severity: 'medium',
      title: 'Cash debt ledger may be stale',
      detail: 'The earning is negative but visible wallet entries are not negative.',
      action: 'Check wallet impact entries and settlement status.',
    });
  }

  return flags;
}

function paymentDiffersFromBookedService(input: BookingFinanceFlagsInput) {
  return (
    input.paymentAmount !== null &&
    input.servicePrice !== null &&
    input.paymentAmount !== input.servicePrice
  );
}

function partnerPayoutExceedsCustomerPrice(financeTrace: BookingFinanceFlagTrace) {
  return (
    financeTrace.providerPayoutAmount !== null &&
    financeTrace.customerPriceAmount !== null &&
    financeTrace.providerPayoutAmount > financeTrace.customerPriceAmount
  );
}

function cashDebtLedgerMayBeStale(input: BookingFinanceFlagsInput) {
  return (
    input.financeTrace.paymentMethod === 'CASH' &&
    input.hasEarning &&
    input.financeTrace.walletTotalAmount >= 0 &&
    (input.earningNetAmount ?? 0) < 0
  );
}
