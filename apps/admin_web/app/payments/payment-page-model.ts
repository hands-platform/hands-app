import type { AdminPayment, AdminPaymentSummary } from '../../lib/admin-api';
import {
  type AdminDateRange,
  dateRangeLabel,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';
import {
  readAdminQueueAge,
  readAdminQueueSlaFilter,
  readAdminQueueSort,
  type AdminQueueAge,
  type AdminQueueSort,
  type AdminQueueSlaFilter,
} from '../../lib/admin-queue-list';
import type { PaymentFilterLink, PaymentRangeLink } from './payment-filter-board-section';
import { paymentFilterLinks, paymentRangeLinks } from './payment-page-links';
import {
  paymentCallbackAttemptNeedsReview,
  paymentCallbackAttemptVerified,
  paymentCashDebtNeedsSettlement,
  paymentOpsState,
  paymentPriority,
} from './payment-page-rules';

export type PaymentFilters = {
  readonly age: AdminQueueAge;
  readonly bookingStatus: string;
  readonly customerProfileId: string;
  readonly evidence: string;
  readonly page: number;
  readonly pageSize: number;
  readonly paymentMethod: string;
  readonly paymentStatus: string;
  readonly q: string;
  readonly range: AdminDateRange;
  readonly review: string;
  readonly sla: AdminQueueSlaFilter;
  readonly sort: AdminQueueSort;
};

export type PaymentMetrics = {
  readonly activeCashCollection: number;
  readonly authorized: number;
  readonly captureReady: number;
  readonly callbackReview: number;
  readonly callbackVerified: number;
  readonly captured: number;
  readonly cashDebt: number;
  readonly evidenceConflicts: number;
  readonly linkedRefunds: number;
  readonly needsAction: number;
  readonly pendingCash: number;
  readonly refunded: number;
  readonly releaseRecommended: number;
  readonly staleMismatch: number;
};

export type PaymentPageModel = {
  readonly activeFilter: PaymentFilterLink | null;
  readonly allPayments: readonly AdminPayment[];
  readonly dateRangeLabel: string;
  readonly filters: PaymentFilters;
  readonly metrics: PaymentMetrics;
  readonly payments: readonly AdminPayment[];
  readonly rangeLinks: readonly PaymentRangeLink[];
  readonly totalCount: number;
  readonly reviewLinks: readonly PaymentFilterLink[];
};

const PAYMENT_OPERATIONS_API_LIMIT = 10;
const PAYMENT_OPERATIONS_API_MAX_LIMIT = 50;
const DEFAULT_PAYMENT_REVIEW = 'capture-ready';

export function buildPaymentPageModel({
  params,
  paymentSummary,
  payments,
}: {
  readonly params: Record<string, string | string[] | undefined>;
  readonly paymentSummary?: AdminPaymentSummary | null;
  readonly payments: readonly AdminPayment[];
}): PaymentPageModel {
  const filters = buildPaymentFilters(params);
  const allPayments = sortPayments(payments, filters.sort);
  const visiblePayments = allPayments;
  const reviewLinks = paymentFilterLinks().map((item) => ({
    ...item,
    href: buildPaymentPageHref({ ...filters, page: 1, review: item.review }),
  }));
  const rangeLinks = paymentRangeLinks(filters.review).map((item) => ({
    ...item,
    href: buildPaymentPageHref({ ...filters, page: 1, range: item.range }),
  }));

  return {
    activeFilter: paymentFilterLinks().find((item) => item.review === filters.review) ?? null,
    allPayments,
    dateRangeLabel: dateRangeLabel(filters.range),
    filters,
    metrics: paymentSummary
      ? paymentMetricsFromSummary(paymentSummary)
      : buildPaymentMetrics(visiblePayments),
    payments: visiblePayments,
    rangeLinks,
    reviewLinks,
    totalCount: paymentSummary?.currentQueueTotal ?? paymentSummary?.totalCount ?? allPayments.length,
  };
}

export function sortPayments(
  payments: readonly AdminPayment[],
  sort: AdminQueueSort = 'newest',
): AdminPayment[] {
  return [...payments].sort((left, right) => {
    if (sort === 'oldest') {
      const leftDate = Date.parse(left.booking?.updatedAt ?? left.booking?.createdAt ?? '');
      const rightDate = Date.parse(right.booking?.updatedAt ?? right.booking?.createdAt ?? '');
      return (Number.isFinite(leftDate) ? leftDate : 0) - (Number.isFinite(rightDate) ? rightDate : 0);
    }
    const leftPriority = paymentPriority(left);
    const rightPriority = paymentPriority(right);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return (right.id || '').localeCompare(left.id || '');
  });
}

export function buildPaymentFilters(params: Record<string, string | string[] | undefined>): PaymentFilters {
  const customerProfileId = readSearchParam(params.customerProfileId).trim();
  const rangeParam = readSearchParam(params.range);
  const reviewParam = readSearchParam(params.review);

  const review = normalizePaymentReview(reviewParam || DEFAULT_PAYMENT_REVIEW);

  return {
    age: readAdminQueueAge(params.age),
    bookingStatus: readPaymentEnumFilter(params.bookingStatus),
    customerProfileId,
    evidence: readPaymentEvidenceFilter(params.evidence),
    page: readPaymentPage(params.page),
    pageSize: readPaymentPageSize(params.pageSize),
    paymentMethod: readPaymentEnumFilter(params.paymentMethod),
    paymentStatus: readPaymentEnumFilter(params.paymentStatus),
    q: readSearchParam(params.q).trim().slice(0, 120),
    range: rangeParam ? normalizeDateRange(rangeParam) : 'all',
    review,
    sla: review === 'authorized' ? readAdminQueueSlaFilter(params.sla) : 'all',
    sort: readSearchParam(params.sort) ? readAdminQueueSort(params.sort) : 'oldest',
  };
}

function normalizePaymentReview(review: string) {
  if (review === 'callback-review') return 'evidence-conflict';
  if (review === 'stale-mismatch') return 'terminal-cash-cleanup';
  if (review === 'capture') return 'capture-ready';
  if (review === 'cash') return 'active-cash';
  if (review === 'missing-ref') return 'missing-gateway-evidence';
  return review;
}

export function buildPaymentOperationsApiHref(filters: PaymentFilters): string {
  return buildPaymentApiHref('/admin/payments', filters, { includePaging: true });
}

export function buildPaymentSummaryApiHref(filters: PaymentFilters): string {
  const params = new URLSearchParams({ range: filters.range });
  appendPaymentDirectoryParams(params, filters);
  appendPaymentQueueParams(params, filters);
  if (shouldIncludePaymentApiReview(filters.review)) {
    params.set('review', filters.review);
  }
  if (filters.customerProfileId) {
    params.set('customerProfileId', filters.customerProfileId);
  }

  return `/admin/payments/summary?${params.toString()}`;
}

function buildPaymentMetrics(payments: readonly AdminPayment[]): PaymentMetrics {
  const callbackAttempts = payments.flatMap((payment) => payment.callbackAttempts ?? []);
  return {
    activeCashCollection: payments.filter((payment) =>
      payment.method === 'CASH' && payment.status === 'PENDING' &&
      ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']
        .includes(payment.booking?.status ?? ''),
    ).length,
    authorized: payments.filter((payment) => payment.status === 'AUTHORIZED').length,
    captureReady: payments.filter((payment) =>
      payment.actionDecisions?.some((decision) => decision.action === 'CAPTURE' && decision.state === 'AVAILABLE'),
    ).length,
    callbackReview: callbackAttempts.filter(paymentCallbackAttemptNeedsReview).length,
    callbackVerified: callbackAttempts.filter(paymentCallbackAttemptVerified).length,
    captured: payments.filter((payment) => payment.status === 'CAPTURED').length,
    cashDebt: payments.filter(paymentCashDebtNeedsSettlement).length,
    evidenceConflicts: payments.filter((payment) => payment.evidence?.state === 'CONFLICT').length,
    linkedRefunds: payments.reduce((total, payment) => total + (payment.refunds?.length ?? 0), 0),
    needsAction: payments.filter((payment) => paymentOpsState(payment) !== 'settled').length,
    pendingCash: payments.filter((payment) => payment.method === 'CASH' && payment.status === 'PENDING')
      .length,
    refunded: payments.filter((payment) => payment.status === 'REFUNDED').length,
    releaseRecommended: payments.filter((payment) =>
      payment.actionDecisions?.some((decision) => decision.action === 'RELEASE' && decision.state === 'AVAILABLE'),
    ).length,
    staleMismatch: payments.filter((payment) =>
      payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED' &&
      !payment.actionDecisions?.some((decision) => decision.action === 'CAPTURE' && decision.state === 'AVAILABLE'),
    ).length,
  };
}

function paymentMetricsFromSummary(summary: AdminPaymentSummary): PaymentMetrics {
  return {
    activeCashCollection: summary.activeCashCollection ?? 0,
    authorized: summary.authorized,
    captureReady: summary.captureReady ?? 0,
    callbackReview: summary.callbackReview,
    callbackVerified: summary.callbackVerified,
    captured: summary.captured,
    cashDebt: summary.cashDebt,
    evidenceConflicts: summary.evidenceConflicts ?? 0,
    linkedRefunds: summary.linkedRefunds,
    needsAction: summary.needsAction,
    pendingCash: summary.pendingCash,
    refunded: summary.refunded,
    releaseRecommended: summary.releaseRecommended ?? 0,
    staleMismatch: summary.staleMismatch ?? 0,
  };
}

export function buildPaymentPageHref(filters: PaymentFilters, page?: number): string {
  const params = new URLSearchParams();
  appendPaymentDirectoryParams(params, filters);
  if (filters.customerProfileId) {
    params.set('customerProfileId', filters.customerProfileId);
  }
  if (filters.range !== 'all') {
    params.set('range', filters.range);
  }
  if (filters.review) {
    params.set('review', filters.review);
  }
  appendPaymentQueueParams(params, filters);
  if (filters.pageSize !== PAYMENT_OPERATIONS_API_LIMIT) {
    params.set('pageSize', String(filters.pageSize));
  }
  if (page && page > 1) {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `/payments?${query}` : '/payments';
}

export function buildPaymentResetHref(filters: PaymentFilters): string {
  return buildPaymentPageHref({
    ...filters,
    age: 'all',
    bookingStatus: '',
    evidence: '',
    page: 1,
    paymentMethod: '',
    paymentStatus: '',
    q: '',
    range: 'all',
    sla: 'all',
  });
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
  appendPaymentDirectoryParams(params, filters);
  appendPaymentQueueParams(params, filters);
  const review = options.review === undefined ? filters.review : options.review;
  if (shouldIncludePaymentApiReview(review)) {
    params.set('review', review);
  }
  if (filters.customerProfileId) {
    params.set('customerProfileId', filters.customerProfileId);
  }
  if (options.includePaging) {
    const skip = (filters.page - 1) * filters.pageSize;
    if (skip > 0) {
      params.set('skip', String(skip));
    }
  }

  return `${path}?${params.toString()}`;
}

function appendPaymentQueueParams(params: URLSearchParams, filters: PaymentFilters) {
  if (filters.age !== 'all') {
    params.set('age', filters.age);
  }
  if (filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }
  if (filters.sla !== 'all') {
    params.set('sla', filters.sla);
  }
}

function appendPaymentDirectoryParams(params: URLSearchParams, filters: PaymentFilters) {
  if (filters.q) params.set('q', filters.q);
  if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
  if (filters.bookingStatus) params.set('bookingStatus', filters.bookingStatus);
  if (filters.evidence) params.set('evidence', filters.evidence);
}

function shouldIncludePaymentApiReview(review: string | null | undefined): review is string {
  return Boolean(review && review !== 'all');
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

function readPaymentEnumFilter(value: string | string[] | undefined) {
  return readSearchParam(value).trim().toUpperCase().replace(/[^A-Z_]/g, '');
}

function readPaymentEvidenceFilter(value: string | string[] | undefined) {
  const evidence = readSearchParam(value).trim().toLowerCase();
  return ['verified', 'missing', 'conflict', 'not-applicable'].includes(evidence) ? evidence : '';
}
