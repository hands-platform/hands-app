import type { AdminPayment, AdminPaymentCallbackAttempt, AdminPaymentSummary } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
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
  readonly page: number;
  readonly pageSize: number;
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
  readonly totalCount: number;
  readonly reviewLinks: readonly PaymentFilterLink[];
  readonly visibleCallbackAttempts: readonly AdminPaymentCallbackAttempt[];
};

const PAYMENT_OPERATIONS_API_LIMIT = 10;
const PAYMENT_OPERATIONS_API_MAX_LIMIT = 50;
const DEFAULT_PAYMENT_REVIEW = 'needs-action';

export function buildPaymentPageModel({
  callbackAttempts,
  params,
  paymentSummary,
  payments,
}: {
  readonly callbackAttempts: readonly AdminPaymentCallbackAttempt[];
  readonly params: Record<string, string | string[] | undefined>;
  readonly paymentSummary?: AdminPaymentSummary | null;
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
    metrics: paymentSummary
      ? paymentMetricsFromSummary(paymentSummary)
      : buildPaymentMetrics(visiblePayments, visibleCallbackAttempts),
    payments: visiblePayments,
    rangeLinks: paymentRangeLinks(filters.review),
    reviewLinks,
    totalCount: paymentSummary?.totalCount ?? allPayments.length,
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
    amount: attempt.callbackAmount ?? null,
    bookingHref: attempt.payment?.bookingId ? `/bookings/${attempt.payment.bookingId}` : null,
    createdAt: attempt.createdAt,
    currency: attempt.payment?.currency ?? 'VND',
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
  const rangeParam = readSearchParam(params.range);
  const reviewParam = readSearchParam(params.review);

  return {
    page: readPaymentPage(params.page),
    pageSize: readPaymentPageSize(params.pageSize),
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
    review: reviewParam || DEFAULT_PAYMENT_REVIEW,
  };
}

export function buildPaymentOperationsApiHref(filters: PaymentFilters): string {
  return buildPaymentApiHref('/admin/payments', filters, { includePaging: true });
}

export function buildPaymentCallbackAttemptsApiHref(filters: PaymentFilters): string {
  return buildPaymentApiHref('/admin/payment-callback-attempts', filters, {
    review: paymentCallbackAttemptApiReview(filters.review),
  });
}

export function buildPaymentSummaryApiHref(filters: PaymentFilters): string {
  const params = new URLSearchParams({ range: filters.range });
  if (shouldIncludePaymentApiReview(filters.review)) {
    params.set('review', filters.review);
  }

  return `/admin/payments/summary?${params.toString()}`;
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
  if (review === 'needs-action') {
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

function paymentMetricsFromSummary(summary: AdminPaymentSummary): PaymentMetrics {
  return {
    authorized: summary.authorized,
    callbackReview: summary.callbackReview,
    callbackVerified: summary.callbackVerified,
    captured: summary.captured,
    cashDebt: summary.cashDebt,
    linkedRefunds: summary.linkedRefunds,
    needsAction: summary.needsAction,
    pendingCash: summary.pendingCash,
    refunded: summary.refunded,
  };
}

export function buildPaymentPageHref(filters: PaymentFilters, page?: number): string {
  const params = new URLSearchParams();
  if (filters.range !== 'all') {
    params.set('range', filters.range);
  }
  if (filters.review) {
    params.set('review', filters.review);
  }
  if (filters.pageSize !== PAYMENT_OPERATIONS_API_LIMIT) {
    params.set('pageSize', String(filters.pageSize));
  }
  if (page && page > 1) {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `/payments?${query}` : '/payments';
}

export function buildPaymentServerPagination<T>(
  rows: readonly T[],
  filters: PaymentFilters,
  totalRows: number,
) {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    hrefForPage: (nextPage: number) => buildPaymentPageHref(filters, nextPage),
    page,
    pageSize: filters.pageSize,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
}

function buildPaymentApiHref(
  path: string,
  filters: PaymentFilters,
  options: { readonly includePaging?: boolean; readonly review?: string | null } = {},
): string {
  const params = new URLSearchParams({ take: String(filters.pageSize), range: filters.range });
  const review = options.review === undefined ? filters.review : options.review;
  if (shouldIncludePaymentApiReview(review)) {
    params.set('review', review);
  }
  if (options.includePaging) {
    const skip = (filters.page - 1) * filters.pageSize;
    if (skip > 0) {
      params.set('skip', String(skip));
    }
  }

  return `${path}?${params.toString()}`;
}

function shouldIncludePaymentApiReview(review: string | null | undefined): review is string {
  return Boolean(review && review !== 'all');
}

function paymentCallbackAttemptApiReview(review: string): string | null {
  if (review === 'needs-action' || review === 'callback-review') {
    return 'callback-review';
  }
  if (review === 'callback-verified') {
    return 'callback-verified';
  }
  return null;
}

function readPaymentPage(value: string | string[] | undefined) {
  const page = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function readPaymentPageSize(value: string | string[] | undefined) {
  const pageSize = Number.parseInt(readSearchParam(value), 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return PAYMENT_OPERATIONS_API_LIMIT;
  }
  return Math.min(Math.trunc(pageSize), PAYMENT_OPERATIONS_API_MAX_LIMIT);
}
