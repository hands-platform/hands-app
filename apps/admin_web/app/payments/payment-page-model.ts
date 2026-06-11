import type { AdminPayment, AdminPaymentCallbackAttempt } from '../../lib/admin-api';
import { formatDateTime, formatMoney as money, shortId } from '../../lib/admin-format';
import {
  type AdminDateRange,
  dateRangeLabel,
  isInDateRange,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';
import type { PaymentCallbackAttemptLedgerRow } from './payment-callback-attempt-ledger-section';
import type { PaymentFilterLink, PaymentRangeLink } from './payment-filter-board-section';
import { paymentFilterLinks, paymentRangeLinks, withPaymentRange } from './payment-page-links';
import {
  paymentCallbackAttemptNeedsReview,
  paymentCallbackAttemptPill,
  paymentCallbackAttemptVerified,
  paymentCallbackNeedsReview,
  paymentCallbackVerified,
  paymentCashDebtNeedsSettlement,
  paymentOpsState,
  paymentPriority,
  paymentRecordDate,
} from './payment-page-rules';

export type PaymentFilters = {
  readonly range: AdminDateRange;
  readonly review: string;
};

export type PaymentMetrics = {
  readonly authorized: number;
  readonly callbackReview: number;
  readonly callbackVerified: number;
  readonly captured: number;
  readonly cashDebt: number;
  readonly linkedRefunds: number;
  readonly needsAction: number;
  readonly pendingCash: number;
  readonly refunded: number;
};

export type PaymentPageModel = {
  readonly activeFilter: PaymentFilterLink | null;
  readonly allPayments: readonly AdminPayment[];
  readonly callbackAttemptRows: readonly PaymentCallbackAttemptLedgerRow[];
  readonly dateRangeLabel: string;
  readonly filters: PaymentFilters;
  readonly metrics: PaymentMetrics;
  readonly payments: readonly AdminPayment[];
  readonly rangeLinks: readonly PaymentRangeLink[];
  readonly reviewLinks: readonly PaymentFilterLink[];
  readonly visibleCallbackAttempts: readonly AdminPaymentCallbackAttempt[];
};

export function buildPaymentPageModel({
  callbackAttempts,
  params,
  payments,
}: {
  readonly callbackAttempts: readonly AdminPaymentCallbackAttempt[];
  readonly params: Record<string, string | string[] | undefined>;
  readonly payments: readonly AdminPayment[];
}): PaymentPageModel {
  const filters = buildPaymentFilters(params);
  const allPayments = sortPayments(payments);
  const sortedCallbackAttempts = sortPaymentCallbackAttempts(callbackAttempts);
  const visiblePayments = filterPayments(allPayments, filters);
  const visibleCallbackAttempts = filterPaymentCallbackAttempts(sortedCallbackAttempts, filters);
  const reviewLinks = paymentFilterLinks().map((item) => ({
    ...item,
    href: withPaymentRange(item.href, filters.range),
  }));

  return {
    activeFilter: paymentFilterLinks().find((item) => item.review === filters.review) ?? null,
    allPayments,
    callbackAttemptRows: buildPaymentCallbackAttemptLedgerRows(visibleCallbackAttempts),
    dateRangeLabel: dateRangeLabel(filters.range),
    filters,
    metrics: buildPaymentMetrics(visiblePayments, visibleCallbackAttempts),
    payments: visiblePayments,
    rangeLinks: paymentRangeLinks(filters.review),
    reviewLinks,
    visibleCallbackAttempts,
  };
}

export function sortPayments(payments: readonly AdminPayment[]): AdminPayment[] {
  return [...payments].sort((left, right) => {
    const leftPriority = paymentPriority(left);
    const rightPriority = paymentPriority(right);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return (right.id || '').localeCompare(left.id || '');
  });
}

export function sortPaymentCallbackAttempts(
  attempts: readonly AdminPaymentCallbackAttempt[],
): AdminPaymentCallbackAttempt[] {
  return [...attempts].sort((left, right) => {
    const leftDate = Date.parse(left.createdAt || '');
    const rightDate = Date.parse(right.createdAt || '');
    return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
  });
}

export function buildPaymentCallbackAttemptLedgerRows(
  attempts: readonly AdminPaymentCallbackAttempt[],
): PaymentCallbackAttemptLedgerRow[] {
  return attempts.map((attempt) => ({
    amountLabel:
      attempt.callbackAmount !== null && attempt.callbackAmount !== undefined
        ? money(attempt.callbackAmount)
        : 'unknown',
    bookingHref: attempt.payment?.bookingId ? `/bookings/${attempt.payment.bookingId}` : null,
    createdAtLabel: formatDateTime(attempt.createdAt),
    errorMessage: attempt.errorMessage ?? null,
    gatewayTransactionId: attempt.gatewayTransactionId ?? 'No gateway transaction id',
    id: attempt.id,
    method: attempt.method,
    outcome: attempt.outcome,
    paymentIdLabel: attempt.paymentId ? shortId(attempt.paymentId) : null,
    paymentStatus: attempt.payment?.status ?? null,
    pillClass: paymentCallbackAttemptPill(attempt),
    providerRef: attempt.providerRef ?? 'NONE',
    providerStatus: attempt.providerStatus ?? 'No status code',
    signatureLabel: attempt.signatureVerified === true ? 'Verified' : 'Not verified',
    verificationMode: attempt.verificationMode ?? 'unknown',
  }));
}

export function buildPaymentFilters(params: Record<string, string | string[] | undefined>): PaymentFilters {
  return {
    range: normalizeDateRange(readSearchParam(params.range)),
    review: readSearchParam(params.review),
  };
}

export function filterPayments(payments: readonly AdminPayment[], filters: PaymentFilters): AdminPayment[] {
  return payments.filter(
    (payment) =>
      isInDateRange(paymentRecordDate(payment), filters.range) &&
      (!filters.review || paymentMatchesReview(payment, filters.review)),
  );
}

export function filterPaymentCallbackAttempts(
  attempts: readonly AdminPaymentCallbackAttempt[],
  filters: PaymentFilters,
): AdminPaymentCallbackAttempt[] {
  return attempts.filter(
    (attempt) =>
      isInDateRange(attempt.createdAt, filters.range) &&
      callbackAttemptMatchesReview(attempt, filters.review),
  );
}

function paymentMatchesReview(payment: AdminPayment, review: string): boolean {
  switch (review) {
    case 'capture':
      return payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED';
    case 'missing-ref':
      return payment.status === 'AUTHORIZED' && !payment.providerRef;
    case 'authorized':
      return payment.status === 'AUTHORIZED';
    case 'cash':
      return payment.method === 'CASH' && payment.status === 'PENDING';
    case 'cash-debt':
      return paymentCashDebtNeedsSettlement(payment);
    case 'needs-action':
      return paymentOpsState(payment) !== 'settled';
    case 'callback-review':
      return (
        (payment.callbackAttempts?.some(paymentCallbackAttemptNeedsReview) ?? false) ||
        paymentCallbackNeedsReview(payment)
      );
    case 'callback-verified':
      return (
        (payment.callbackAttempts?.some(paymentCallbackAttemptVerified) ?? false) ||
        paymentCallbackVerified(payment)
      );
    case 'refunded':
      return payment.status === 'REFUNDED';
    default:
      return true;
  }
}

function callbackAttemptMatchesReview(attempt: AdminPaymentCallbackAttempt, review: string): boolean {
  if (!review) {
    return true;
  }
  if (review === 'callback-review') {
    return paymentCallbackAttemptNeedsReview(attempt);
  }
  if (review === 'callback-verified') {
    return paymentCallbackAttemptVerified(attempt);
  }
  return true;
}

function buildPaymentMetrics(
  payments: readonly AdminPayment[],
  callbackAttempts: readonly AdminPaymentCallbackAttempt[],
): PaymentMetrics {
  return {
    authorized: payments.filter((payment) => payment.status === 'AUTHORIZED').length,
    callbackReview: callbackAttempts.filter(paymentCallbackAttemptNeedsReview).length,
    callbackVerified: callbackAttempts.filter(paymentCallbackAttemptVerified).length,
    captured: payments.filter((payment) => payment.status === 'CAPTURED').length,
    cashDebt: payments.filter(paymentCashDebtNeedsSettlement).length,
    linkedRefunds: payments.reduce((total, payment) => total + (payment.refunds?.length ?? 0), 0),
    needsAction: payments.filter((payment) => paymentOpsState(payment) !== 'settled').length,
    pendingCash: payments.filter((payment) => payment.method === 'CASH' && payment.status === 'PENDING')
      .length,
    refunded: payments.filter((payment) => payment.status === 'REFUNDED').length,
  };
}
