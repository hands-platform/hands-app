import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminErrorState } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import {
  type AdminRefundOperationsRow,
  type AdminRefundQueueAge,
  type AdminRefundQueueMeta,
  adminGetResult,
} from '../../lib/admin-api';
import { formatDateTime, shortId } from '../../lib/admin-format';
import {
  readAdminQueueSlaFilter,
} from '../../lib/admin-queue-list';
import { type AdminDateRange, readSearchParam } from '../../lib/date-range';
import { relativeTimeLabel } from '../bookings/booking-list-time';
import { RefundCommandBoardSection } from './refund-command-board-section';
import {
  RefundFilterBoardSection,
  type RefundFilterValues,
} from './refund-filter-board-section';
import {
  RefundsTableSection,
  type RefundChecklistRow,
  type RefundTableRow,
} from './refunds-table-section';
import { DEFAULT_REFUND_QUEUE_HREF, refundApprovalFocusHref } from './refund-focus-links';

type RefundsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const REFUND_PAGE_SIZE = 10;
const REFUND_PAGE_SIZE_MAX = 50;
const REFUND_RESET_HREF = DEFAULT_REFUND_QUEUE_HREF;

export const metadata: Metadata = { title: 'Refunds' };

const EMPTY_REFUND_QUEUE_META: AdminRefundQueueMeta = {
  completedCount: 0,
  generatedAt: '',
  globalOpenCount: 0,
  oldestOpenAt: null,
  openCount: 0,
  processingCount: 0,
  queueAgeCounts: {
    all: 0,
    'under-1h': 0,
    '1-4h': 0,
    '4-24h': 0,
    '1-3d': 0,
    '3-7d': 0,
    'over-7d': 0,
  },
  queueSla: { overdueCount: 0, thresholdMinutes: 240 },
  rejectedCount: 0,
  requestedCount: 0,
  reviewRequiredCount: 0,
  selectedTotal: 0,
  stateMismatchCount: 0,
};

export default async function RefundsPage({ searchParams }: { searchParams?: RefundsPageSearchParams }) {
  const filters = buildRefundFilters(searchParams ? await searchParams : {});
  const [metaResult, refundsResult] = await Promise.all([
    adminGetResult<AdminRefundQueueMeta>(buildRefundQueueMetaApiHref(filters), EMPTY_REFUND_QUEUE_META),
    adminGetResult<AdminRefundOperationsRow[]>(buildRefundOperationsApiHref(filters), []),
  ]);
  const meta = metaResult.data;
  const totalRows = metaResult.ok ? meta.selectedTotal : refundsResult.data.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));

  if (metaResult.ok && filters.page > totalPages) {
    redirect(refundHref({ ...filters, page: totalPages }));
  }

  const currentHref = refundHref(filters);
  const pagination = buildRefundPagination(refundsResult.data, filters, totalRows);
  const refundRows = buildRefundTableRows(pagination.rows, currentHref);

  return (
    <AdminPageTemplate
      contentClassName="refund-page-content"
      description="Control open refund approvals, gateway progress, and reconciliation from one exclusive queue contract."
      title="Refunds"
    >
      {metaResult.ok ? (
        <RefundCommandBoardSection
          approvalRequired={meta.requestedCount}
          approvalHref={refundHref({ ...filters, page: 1, review: 'requested', sla: 'all' })}
          currentReview={filters.review}
          currentSla={filters.sla}
          currentSort={filters.sort}
          gatewayProcessing={meta.processingCount}
          gatewayHref={refundHref({ ...filters, page: 1, review: 'processing', sla: 'all' })}
          generatedAt={meta.generatedAt}
          oldestOpenLabel={
            meta.oldestOpenAt
              ? relativeTimeLabel(meta.oldestOpenAt, Date.parse(meta.generatedAt))
              : 'None in scope'
          }
          oldestOpenHref={refundHref({ ...filters, page: 1, review: 'open', sla: 'all', sort: 'oldest' })}
          otherReview={meta.reviewRequiredCount}
          otherReviewHref={refundHref({ ...filters, page: 1, review: 'other', sla: 'all' })}
          reconciliationRequired={meta.stateMismatchCount}
          reconciliationHref={refundHref({ ...filters, page: 1, review: 'state-mismatch', sla: 'all' })}
          refreshHref={currentHref}
          slaOverdue={meta.queueSla.overdueCount}
          slaOverdueHref={refundHref({ ...filters, page: 1, review: 'open', sla: 'overdue' })}
        />
      ) : (
        <AdminErrorState
          action={<AdminTextLink href={currentHref}>Retry queue totals</AdminTextLink>}
          message="Refund queue totals could not be loaded. Records and filters remain available, but do not use the visible row count as the full backlog."
          title="Refund queue totals unavailable"
        />
      )}

      <RefundFilterBoardSection
        ageCounts={meta.queueAgeCounts}
        ageHref={(age) => refundHref({ ...filters, age, page: 1 })}
        clearCustomerScopeHref={refundHref({ ...filters, customerProfileId: '', page: 1 })}
        filters={filters}
        queueSla={meta.queueSla}
        resetHref={REFUND_RESET_HREF}
        slaHref={(sla) => refundHref({ ...filters, page: 1, sla })}
      />

      {refundsResult.ok ? (
        <RefundsTableSection
          emptyMessage={refundEmptyState(filters, metaResult.ok ? meta.globalOpenCount : 0)}
          pagination={{ ...pagination, rows: refundRows }}
        />
      ) : (
        <AdminErrorState
          action={<AdminTextLink href={currentHref}>Retry refund records</AdminTextLink>}
          message="Refund records could not be loaded. Queue totals above are not presented as an empty case list."
          title="Refund records unavailable"
        />
      )}
    </AdminPageTemplate>
  );
}

function buildRefundFilters(params: Record<string, string | string[] | undefined>) {
  const review = readRefundReview(params.review);

  return {
    age: readRefundQueueAge(params.age),
    customerProfileId: readSearchParam(params.customerProfileId).trim(),
    page: readPositiveInteger(params.page, 1, Number.MAX_SAFE_INTEGER),
    pageSize: readPositiveInteger(params.pageSize, REFUND_PAGE_SIZE, REFUND_PAGE_SIZE_MAX),
    q: readSearchParam(params.q).trim(),
    range: readRefundRange(params.range),
    review,
    sla: review === 'open' ? readAdminQueueSlaFilter(params.sla) : 'all',
    sort: readSearchParam(params.sort) === 'newest' ? 'newest' : 'oldest',
  } satisfies RefundFilterValues & { page: number };
}

function buildRefundOperationsApiHref(filters: ReturnType<typeof buildRefundFilters>) {
  const params = refundApiParams(filters);
  params.set('take', String(filters.pageSize));
  const skip = (filters.page - 1) * filters.pageSize;
  if (skip > 0) params.set('skip', String(skip));
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  return `/admin/refunds?${params.toString()}`;
}

function buildRefundQueueMetaApiHref(filters: ReturnType<typeof buildRefundFilters>) {
  return `/admin/refunds/queue-meta?${refundApiParams(filters).toString()}`;
}

function refundApiParams(filters: ReturnType<typeof buildRefundFilters>) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') params.set('review', filters.review);
  if (filters.age !== 'all') params.set('age', filters.age);
  if (filters.review === 'open' && filters.sla !== 'all') params.set('sla', filters.sla);
  if (filters.customerProfileId) params.set('customerProfileId', filters.customerProfileId);
  if (filters.q) params.set('q', filters.q);
  return params;
}

function refundHref(filters: ReturnType<typeof buildRefundFilters>) {
  const params = new URLSearchParams({
    range: filters.range,
    review: filters.review,
    sort: filters.sort,
  });
  if (filters.age !== 'all') params.set('age', filters.age);
  if (filters.review === 'open' && filters.sla !== 'all') params.set('sla', filters.sla);
  if (filters.customerProfileId) params.set('customerProfileId', filters.customerProfileId);
  if (filters.q) params.set('q', filters.q);
  if (filters.pageSize !== REFUND_PAGE_SIZE) params.set('pageSize', String(filters.pageSize));
  if (filters.page > 1) params.set('page', String(filters.page));
  return `/refunds?${params.toString()}`;
}

function buildRefundPagination<T>(
  rows: readonly T[],
  filters: ReturnType<typeof buildRefundFilters>,
  totalRows: number,
) {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    hrefForPage: (nextPage: number) => refundHref({ ...filters, page: nextPage }),
    page,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
}

function buildRefundTableRows(refunds: readonly AdminRefundOperationsRow[], returnTo: string): RefundTableRow[] {
  const nowMs = Date.now();

  return refunds.map((refund) => {
    const metadata = refundMetadata(refund.metadata);
    const checklistRows = refundChecklist(refund, metadata);
    const requiredRows = checklistRows.filter((row) => row.required);
    const checklistCompleted = requiredRows.filter((row) => row.pillClass === 'pill-success').length;
    const notRequiredCount = checklistRows.length - requiredRows.length;
    const actionBlockerCount = checklistRows.filter(
      (row) => row.pillClass === 'pill-danger' && row.missingCategory === 'action-blocker',
    ).length;
    const historicalGapCount = checklistRows.filter(
      (row) => row.pillClass === 'pill-danger' && row.missingCategory === 'historical-evidence',
    ).length;
    const customerProfileId = refund.booking?.customerProfile?.id;
    const action = refundPrimaryAction(refund, returnTo);

    return {
      ageLabel: relativeTimeLabel(refund.createdAt, nowMs),
      amount: refund.amount,
      bookingHref: `/bookings/${encodeURIComponent(refund.bookingId)}`,
      bookingId: refund.bookingId,
      bookingIdLabel: shortId(refund.bookingId),
      bookingStatus: refund.booking?.status ?? 'Unknown',
      checklistCompleted,
      checklistRows,
      createdAtLabel: formatDateTime(refund.createdAt),
      currency: refund.payment?.currency ?? refund.currency ?? 'VND',
      customerHref: customerProfileId ? `/customers/${encodeURIComponent(customerProfileId)}` : null,
      customerLabel:
        refund.booking?.customerProfile?.user?.fullName ??
        refund.booking?.customerProfile?.user?.phone ??
        'Customer not included',
      evidenceBlockerLabel: [
        actionBlockerCount > 0
          ? `${actionBlockerCount} action blocker${actionBlockerCount === 1 ? '' : 's'}`
          : 'No action blockers',
        historicalGapCount > 0
          ? `${historicalGapCount} historical evidence item${historicalGapCount === 1 ? '' : 's'} unavailable`
          : 'Historical evidence complete',
      ].join(' · '),
      evidenceLabel: `${checklistCompleted}/${requiredRows.length} required facts available${
        notRequiredCount > 0 ? ` · ${notRequiredCount} not required` : ''
      }`,
      id: refund.id,
      opsHint: refund.nextAction,
      opsTone: refundOpsTone(refund),
      paymentHref: `/payments/${encodeURIComponent(refund.paymentId)}`,
      paymentId: refund.paymentId,
      paymentLabel: `${refund.payment?.method ?? 'Unknown method'} · ${refund.payment?.status ?? 'Unknown status'}`,
      primaryActionHref: action.href,
      primaryActionLabel: action.label,
      reason: refund.reason?.trim() || 'No reason recorded',
      requestSource: refundSourceLabel(metadata.source),
      shortId: shortId(refund.id),
      stageLabel: refundStageLabel(refund.operationalStage),
      workstreamLabel: refund.assignee ?? 'Finance operations',
    };
  });
}

function refundChecklist(
  refund: AdminRefundOperationsRow,
  metadata: ReturnType<typeof refundMetadata>,
): RefundChecklistRow[] {
  const callbacks = refund.payment?.callbackAttempts ?? [];
  const gatewayExpected = !['CASH', 'WALLET'].includes(refund.payment?.method ?? '');
  const gatewayEvidence = Boolean(refund.payment?.providerRef || callbacks.length > 0);
  const requestContext = Boolean(metadata.requestedAt || metadata.requestedByAdminId || metadata.source);

  return [
    evidenceCheck(
      'Booking record',
      Boolean(refund.booking),
      refund.booking
        ? `Booking ${shortId(refund.bookingId)} is linked with status ${refund.booking.status ?? 'unknown'}.`
        : 'No linked booking record is present in the refund payload.',
    ),
    evidenceCheck(
      'Payment record',
      Boolean(refund.payment),
      refund.payment
        ? `Payment ${shortId(refund.paymentId)} is linked with status ${refund.payment.status}.`
        : 'No linked payment record is present in the refund payload.',
    ),
    evidenceCheck(
      'Request context',
      requestContext,
      requestContext
        ? [
            metadata.source ? `Source ${metadata.source}` : null,
            metadata.requestedByAdminId ? `maker ${shortId(metadata.requestedByAdminId)}` : null,
            metadata.requestedAt ? `requested ${formatDateTime(metadata.requestedAt)}` : null,
          ].filter(Boolean).join(' · ')
        : 'Request source, maker, and request time are not recorded in refund metadata.',
      'historical-evidence',
    ),
    gatewayExpected
      ? evidenceCheck(
          'Gateway evidence',
          gatewayEvidence,
          gatewayEvidence
            ? `${refund.payment?.providerRef ? `Provider reference ${refund.payment.providerRef}` : 'No provider reference'} · ${callbacks.length} recent callback${callbacks.length === 1 ? '' : 's'}.`
            : 'No provider reference or recent callback is present in the list payload.',
        )
      : {
          detail: `${refund.payment?.method ?? 'This payment method'} does not require gateway callback evidence.`,
          label: 'Payment channel evidence',
          pillClass: 'pill-neutral',
          required: false,
          status: 'Not required',
        },
    refund.stateMismatchReason
      ? {
          detail: refund.stateMismatchReason,
          label: 'State alignment',
          missingCategory: 'action-blocker',
          pillClass: 'pill-danger',
          required: true,
          status: 'Mismatch',
        }
      : evidenceCheck(
          'State alignment',
          true,
          'Refund, payment, and booking states are aligned under the API contract.',
        ),
  ];
}

function evidenceCheck(
  label: string,
  complete: boolean,
  detail: string,
  missingCategory: RefundChecklistRow['missingCategory'] = 'action-blocker',
): RefundChecklistRow {
  return {
    detail,
    label,
    missingCategory: complete ? undefined : missingCategory,
    pillClass: complete ? 'pill-success' : 'pill-danger',
    required: true,
    status: complete ? 'Available' : 'Missing',
  };
}

function refundPrimaryAction(refund: AdminRefundOperationsRow, returnTo: string) {
  switch (refund.operationalStage) {
    case 'AWAITING_DECISION':
      return { href: refundApprovalFocusHref(refund.id, returnTo), label: 'Review decision' };
    case 'STATE_MISMATCH':
      return { href: refundApprovalFocusHref(refund.id, returnTo), label: 'Review state mismatch' };
    case 'PAYMENT_PROCESSING':
      return { href: `/payments/${encodeURIComponent(refund.paymentId)}`, label: 'Check gateway progress' };
    case 'CLOSED':
      return { href: `/payments/${encodeURIComponent(refund.paymentId)}`, label: 'Review closed payment' };
    case 'REJECTED':
      return { href: `/bookings/${encodeURIComponent(refund.bookingId)}`, label: 'Review rejection context' };
    default:
      return { href: `/payments/${encodeURIComponent(refund.paymentId)}`, label: 'Review refund state' };
  }
}

function refundMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { requestedAt: null, requestedByAdminId: null, source: null };
  }
  const record = value as Record<string, unknown>;
  return {
    requestedAt: metadataString(record.requestedAt),
    requestedByAdminId: metadataString(record.requestedByAdminId) ?? metadataString(record.actorId),
    source: metadataString(record.source),
  };
}

function metadataString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function refundEmptyState(filters: ReturnType<typeof buildRefundFilters>, globalOpenCount: number) {
  const currentScope = filters.range === 'today' && filters.review === 'open'
    ? 'No open refunds were created today.'
    : 'No refund cases match the current filters.';

  return (
    <div className="refund-empty-state">
      <AdminEmptyState
        message={
          globalOpenCount > 0 && !(filters.range === 'all' && filters.review === 'open')
            ? `${currentScope} ${globalOpenCount} refund${globalOpenCount === 1 ? ' is' : 's are'} still open across all dates.`
            : currentScope
        }
        title="No cases in this view"
      />
      {globalOpenCount > 0 && !(filters.range === 'all' && filters.review === 'open') ? (
        <AdminTextLink href={REFUND_RESET_HREF}>View all open refunds</AdminTextLink>
      ) : null}
    </div>
  );
}

function refundOpsTone(refund: AdminRefundOperationsRow): RefundTableRow['opsTone'] {
  switch (refund.operationalStage) {
    case 'STATE_MISMATCH':
      return 'warn';
    case 'AWAITING_DECISION':
      return 'warn';
    case 'PAYMENT_PROCESSING':
      return 'info';
    case 'CLOSED':
      return 'ok';
    case 'REJECTED':
      return 'ok';
    default:
      return 'info';
  }
}

function refundSourceLabel(source: string | null | undefined) {
  if (!source) return 'Legacy request · source not recorded';
  if (source === 'ADMIN_MANUAL') return 'Created manually by an administrator';
  if (source === 'UNMATCHED_BOOKING_CLOSE') return 'Created while closing an unmatched booking';
  if (source === 'CUSTOMER_REQUEST') return 'Created from a customer request';
  if (source === 'POST_MATCH_CANCELLATION') return 'Created from a post-match cancellation';
  if (source === 'PAYMENT_DETAIL') return 'Created from payment review';
  const readableSource = source.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
  return `Other source · ${readableSource} (${source})`;
}

function refundStageLabel(stage: AdminRefundOperationsRow['operationalStage']) {
  if (stage === 'STATE_MISMATCH') return 'Reconciliation required';
  if (stage === 'AWAITING_DECISION') return 'Approval required';
  if (stage === 'PAYMENT_PROCESSING') return 'Gateway processing';
  if (stage === 'CLOSED') return 'Closed and reconciled';
  if (stage === 'REJECTED') return 'Rejected';
  return 'Review required';
}

function readRefundRange(value: string | string[] | undefined): AdminDateRange {
  const range = readSearchParam(value);
  return range === 'today' || range === '7d' || range === '30d' ? range : 'all';
}

function readRefundReview(value: string | string[] | undefined) {
  const review = readSearchParam(value);
  return review === 'all' ||
    review === 'requested' ||
    review === 'processing' ||
    review === 'state-mismatch' ||
    review === 'other' ||
    review === 'completed' ||
    review === 'rejected'
    ? review
    : 'open';
}

function readRefundQueueAge(value: string | string[] | undefined): AdminRefundQueueAge {
  const age = readSearchParam(value);
  return age === 'under-1h' ||
    age === '1-4h' ||
    age === '4-24h' ||
    age === '1-3d' ||
    age === '3-7d' ||
    age === 'over-7d'
    ? age
    : 'all';
}

function readPositiveInteger(
  value: string | string[] | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.trunc(parsed), maximum) : fallback;
}
