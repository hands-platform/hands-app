import { AdminRefund, adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { shortId } from '../../lib/admin-format';
import {
  AdminDateRange,
  dateRangeLabel,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';
import {
  RefundCommandBoardSection,
  type RefundCommandItem,
  type RefundCommandPreview,
} from './refund-command-board-section';
import {
  RefundDecisionChecklistSection,
  type RefundDecisionChecklistItem,
} from './refund-decision-checklist-section';
import {
  RefundFilterBoardSection,
  type RefundFilterLink,
  type RefundRangeLink,
} from './refund-filter-board-section';
import { RefundsTableSection, type RefundActionExecutionRow, type RefundTableRow } from './refunds-table-section';

type RefundsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
const REFUND_OPERATIONS_API_LIMIT = 25;

export default async function RefundsPage({ searchParams }: { searchParams?: RefundsPageSearchParams }) {
  const filters = buildRefundFilters(searchParams ? await searchParams : {});
  const allRefunds = sortRefunds(await adminGet<AdminRefund[]>(buildRefundOperationsApiHref(filters), []));
  const refunds = allRefunds;
  const activeFilter = refundFilterLinks().find((item) => item.review === filters.review);
  const commandBoard = buildRefundCommandBoard(allRefunds);
  const decisionChecklist = buildRefundDecisionChecklist(allRefunds);
  const refundRows = buildRefundTableRows(refunds);

  return (
    <AdminPageTemplate
      description="Refund operations for customer protection, payment ledger alignment, and finance handoff."
      metrics={[
        { label: 'Total refunds', value: allRefunds.length, helper: 'Refund records loaded.' },
        {
          label: 'Requested',
          value: allRefunds.filter((refund) => refund.status === 'REQUESTED').length,
          helper: 'Customer refund requests waiting for review.',
        },
        {
          label: 'Refunded bookings',
          value: allRefunds.filter((refund) => refund.booking?.status === 'REFUNDED').length,
          helper: 'Bookings already in the refund outcome.',
        },
        {
          label: 'Needs update',
          value: allRefunds.filter(
            (refund) => refund.status === 'REQUESTED' && refund.payment?.status !== 'REFUNDED',
          ).length,
          helper: 'Refund records whose payment ledger still needs attention.',
        },
      ]}
      title="Refunds"
    >
      <RefundCommandBoardSection items={commandBoard} />
      <RefundFilterBoardSection
        activeFilterDescription={
          activeFilter?.review ? refundFilterDescription(activeFilter.review) : null
        }
        activeFilterLabel={activeFilter?.review ? activeFilter.label : null}
        activeRange={filters.range}
        filteredCount={refunds.length}
        rangeLabel={dateRangeLabel(filters.range)}
        rangeLinks={refundRangeLinks(filters.review)}
        review={filters.review}
        reviewLinks={refundFilterLinks().map((item) => ({
          ...item,
          href: withRefundRange(item.href, filters.range),
        }))}
        totalCount={allRefunds.length}
      />
      <RefundDecisionChecklistSection items={decisionChecklist} />
      <RefundsTableSection emptyMessage={emptyRefundMessage(filters.review)} rows={refundRows} />
    </AdminPageTemplate>
  );
}

function sortRefunds(refunds: AdminRefund[]) {
  return [...refunds].sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
}

function buildRefundTableRows(refunds: readonly AdminRefund[]): RefundTableRow[] {
  return refunds.map((refund) => ({
    amountLabel: `${refund.amount} ${refund.payment?.currency ?? 'VND'}`,
    bookingHref: `/bookings/${refund.bookingId}`,
    bookingIdLabel: shortId(refund.bookingId),
    bookingStatus: refund.booking?.status ?? refund.bookingId,
    customerLabel:
      refund.booking?.customerProfile?.user?.fullName ??
      refund.booking?.customerProfile?.user?.phone ??
      'Unknown',
    executionRows: refundActionExecutionMap(refund),
    id: refund.id,
    opsHint: refundOpsHint(refund),
    opsSignal: refundOpsSignal(refund),
    partnerLabel: refund.booking?.selectedProvider?.displayName ?? 'Unmatched',
    paymentHref: `/payments#payment-${refund.paymentId}`,
    paymentLabel: `${refund.payment?.method ?? 'UNKNOWN'} / ${refund.payment?.status ?? 'UNKNOWN'}`,
    shortId: shortId(refund.id),
    status: refund.status,
  }));
}

function buildRefundCommandBoard(refunds: AdminRefund[]): RefundCommandItem[] {
  const requested = refunds.filter((refund) => refund.status === 'REQUESTED');
  const paymentMismatch = refunds.filter(
    (refund) => refund.status === 'REQUESTED' && refund.payment?.status !== 'REFUNDED',
  );
  const bookingSettled = refunds.filter(
    (refund) => refund.status === 'COMPLETED' || refund.booking?.status === 'REFUNDED',
  );
  const cancelledOrExpired = refunds.filter((refund) =>
    ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(refund.booking?.status ?? ''),
  );

  return [
    {
      title: 'Customer refund requests',
      detail: 'Guests are waiting for a clear refund decision and customer-facing update.',
      status: 'REQUESTED',
      operatorAction: 'Confirm eligibility, payment method, and customer message.',
      href: '/refunds?review=requested',
      tone: requested.length > 0 ? 'warn' : 'ok',
      refunds: buildRefundCommandPreviews(requested),
    },
    {
      title: 'Payment ledger mismatch',
      detail: 'Refund record exists but the linked payment is not marked as refunded.',
      status: 'Payment not refunded',
      operatorAction: 'Open payment, confirm reversal, then close the refund case.',
      href: '/refunds?review=needs-update',
      tone: paymentMismatch.length > 0 ? 'warn' : 'ok',
      refunds: buildRefundCommandPreviews(paymentMismatch),
    },
    {
      title: 'Closed refund evidence',
      detail: 'Refunds that look settled and should match booking, payment, and audit notes.',
      status: 'Settled',
      operatorAction: 'Sample settled cases and make sure operator notes are complete.',
      href: '/refunds?review=completed',
      tone: bookingSettled.length > 0 ? 'info' : 'ok',
      refunds: buildRefundCommandPreviews(bookingSettled),
    },
    {
      title: 'Cancel, expire, no-show context',
      detail: 'Refunds linked to failed service outcomes need consistent customer and wallet handling.',
      status: 'Closeout related',
      operatorAction: 'Check booking closeout, cash debt, and customer protection policy.',
      href: '/bookings?view=closeout',
      tone: cancelledOrExpired.length > 0 ? 'warn' : 'ok',
      refunds: buildRefundCommandPreviews(cancelledOrExpired),
    },
  ];
}

function buildRefundCommandPreviews(refunds: readonly AdminRefund[]): RefundCommandPreview[] {
  return refunds.map((refund) => ({
    amountLabel: `${refund.amount} ${refund.payment?.currency ?? 'VND'}`,
    customerLabel: refundCustomerLabel(refund),
    id: shortId(refund.id),
  }));
}

function buildRefundDecisionChecklist(refunds: AdminRefund[]): RefundDecisionChecklistItem[] {
  const openRefunds = refunds.filter((refund) => refund.status !== 'COMPLETED');
  const paymentUpdates = refunds.filter(
    (refund) => refund.status === 'REQUESTED' && refund.payment?.status !== 'REFUNDED',
  );
  const outcomeLinked = refunds.filter((refund) =>
    ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED'].includes(refund.booking?.status ?? ''),
  );
  const settled = refunds.filter((refund) => refund.status === 'COMPLETED');

  return [
    {
      title: 'Booking evidence',
      detail:
        'Open the booking, chat, location notes, and operator notes before deciding the refund outcome.',
      operatorRule: 'Decision must be based on saved evidence, not customer or Partner judgement.',
      href: '/bookings?view=manual-decision',
      status: `${outcomeLinked.length} outcome-linked`,
      className: outcomeLinked.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: outcomeLinked.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Payment ledger',
      detail: 'Check that payment method, hold, refund, or release state matches the refund record.',
      operatorRule: 'Do not close a refund until payment ledger state and refund status match.',
      href: '/payments',
      status: `${paymentUpdates.length} update(s)`,
      className: paymentUpdates.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: paymentUpdates.length ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Customer update',
      detail: 'Confirm the customer-facing message is clear after the operator decision is recorded.',
      operatorRule: 'Every open refund should have an operator note or customer update path.',
      href: '/refunds?review=open',
      status: `${openRefunds.length} open`,
      className: openRefunds.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: openRefunds.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Finance handoff',
      detail: 'Settled refunds should align with booking state, payment rows, and audit records.',
      operatorRule: 'Sample settled cases during closeout so finance can finish the shift cleanly.',
      href: '/finance-closeout',
      status: `${settled.length} settled`,
      className: settled.length ? 'ops-task-done' : 'ops-task-pending',
      pillClass: settled.length ? 'pill-success' : 'pill-info',
    },
  ];
}

function refundActionExecutionMap(refund: AdminRefund): RefundActionExecutionRow[] {
  const bookingStatus = refund.booking?.status ?? 'UNKNOWN';
  const paymentStatus = refund.payment?.status ?? 'UNKNOWN';
  const paymentMethod = refund.payment?.method ?? 'UNKNOWN';
  const isOpen = refund.status !== 'COMPLETED';
  const paymentAligned = refund.status === 'COMPLETED' || paymentStatus === 'REFUNDED';
  const outcomeNeedsEvidence = ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED'].includes(bookingStatus);
  const hasBookingRecord = Boolean(refund.booking);

  return [
    {
      action: 'Confirm booking evidence',
      status: hasBookingRecord ? 'Linked' : 'Missing',
      reason: hasBookingRecord
        ? `Booking ${shortId(refund.bookingId)} is linked and currently ${bookingStatus}.`
        : `Booking ${shortId(refund.bookingId)} is not included in the current refund payload.`,
      operatorRule:
        'Open booking detail and keep chat, payment, location, and operator notes attached to the decision.',
      pillClass: hasBookingRecord ? 'pill-success' : 'pill-danger',
    },
    {
      action: 'Review outcome context',
      status: outcomeNeedsEvidence ? 'Evidence path' : 'Monitor',
      reason: outcomeNeedsEvidence
        ? `Booking outcome is ${bookingStatus}; admin decision evidence should explain the refund path.`
        : `Booking outcome is ${bookingStatus}; keep the refund aligned with the active booking state.`,
      operatorRule:
        'Cancellation, expiry, no-show, and refund outcomes should be handled from saved records, not personal judgement.',
      pillClass: outcomeNeedsEvidence ? 'pill-warn' : 'pill-neutral',
    },
    {
      action: 'Match payment ledger',
      status: paymentAligned ? 'Aligned' : 'Update needed',
      reason: paymentAligned
        ? `Refund status ${refund.status} and payment status ${paymentStatus} are compatible.`
        : `Refund status is ${refund.status}, but payment status is ${paymentStatus}.`,
      operatorRule: 'Do not close the refund case until payment ledger state and refund status match.',
      pillClass: paymentAligned ? 'pill-success' : 'pill-danger',
    },
    {
      action: 'Customer update',
      status: isOpen ? 'Message needed' : 'Closed',
      reason: isOpen
        ? 'This refund is still open, so the customer-facing update path should be clear.'
        : 'This refund is closed; confirm the customer can see the outcome in support history.',
      operatorRule: 'Every open refund should have an operator note or customer communication path.',
      pillClass: isOpen ? 'pill-warn' : 'pill-success',
    },
    {
      action: 'Finance handoff',
      status: refund.status === 'COMPLETED' ? 'Ready' : 'Open',
      reason:
        refund.status === 'COMPLETED'
          ? `${paymentMethod} refund can be sampled in finance closeout.`
          : `${paymentMethod} refund still needs payment and booking evidence before closeout.`,
      operatorRule: 'Finance closeout should reconcile booking, payment, refund, and audit records together.',
      pillClass: refund.status === 'COMPLETED' ? 'pill-success' : 'pill-info',
    },
  ];
}

function buildRefundFilters(params: Record<string, string | string[] | undefined>) {
  const rangeParam = readSearchParam(params.range);

  return {
    review: readSearchParam(params.review),
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
  };
}

function buildRefundOperationsApiHref(filters: ReturnType<typeof buildRefundFilters>) {
  const params = new URLSearchParams({
    range: filters.range,
    take: String(REFUND_OPERATIONS_API_LIMIT),
  });
  if (filters.review) {
    params.set('review', filters.review);
  }

  return `/admin/refunds?${params.toString()}`;
}

function refundFilterLinks(): RefundFilterLink[] {
  return [
    { label: 'All refunds', href: '/refunds', review: '' },
    { label: 'Open refunds', href: '/refunds?review=open', review: 'open' },
    { label: 'Requested', href: '/refunds?review=requested', review: 'requested' },
    { label: 'Needs update', href: '/refunds?review=needs-update', review: 'needs-update' },
    { label: 'Refunded bookings', href: '/refunds?review=refunded-booking', review: 'refunded-booking' },
    { label: 'Completed', href: '/refunds?review=completed', review: 'completed' },
  ];
}

function refundRangeLinks(review: string): RefundRangeLink[] {
  return [
    { label: 'All dates', href: withRefundReview('/refunds', review), range: 'all' as const },
    { label: 'Today', href: withRefundReview('/refunds?range=today', review), range: 'today' as const },
    { label: 'Last 7 days', href: withRefundReview('/refunds?range=7d', review), range: '7d' as const },
    { label: 'Last 30 days', href: withRefundReview('/refunds?range=30d', review), range: '30d' as const },
  ];
}

function withRefundRange(href: string, range: AdminDateRange) {
  if (range === 'all') {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}range=${range}`;
}

function withRefundReview(href: string, review: string) {
  if (!review) {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}review=${review}`;
}

function refundFilterDescription(review: string) {
  if (review === 'open') {
    return 'refund cases that are not completed yet.';
  }
  if (review === 'requested') {
    return 'customer refund requests waiting for operator processing.';
  }
  if (review === 'needs-update') {
    return 'requested refunds whose payment record is not marked refunded yet.';
  }
  if (review === 'refunded-booking') {
    return 'bookings already marked as refunded, ready for ledger confirmation.';
  }
  if (review === 'completed') {
    return 'closed refund cases.';
  }
  return 'all refund records.';
}

function emptyRefundMessage(review: string) {
  if (!review) {
    return 'No refunds loaded.';
  }
  return `No refunds currently match this queue. ${refundFilterDescription(review)}`;
}

function refundOpsSignal(refund: AdminRefund) {
  if (refund.status === 'REQUESTED') {
    return <span className="signal signal-warn">Customer refund requested</span>;
  }
  if (refund.status === 'COMPLETED' || refund.booking?.status === 'REFUNDED') {
    return <span className="signal signal-ok">Refund settled</span>;
  }
  return <span className="signal signal-info">Review refund</span>;
}

function refundOpsHint(refund: AdminRefund) {
  if (refund.status === 'REQUESTED') {
    return 'Confirm the payment reversal path and notify the guest once the refund is complete.';
  }
  if (refund.booking?.status === 'REFUNDED') {
    return 'Booking is already marked as refunded. Check payment ledger and customer notes.';
  }
  return 'Review this refund before closing the case.';
}

function refundCustomerLabel(refund: AdminRefund) {
  return (
    refund.booking?.customerProfile?.user?.fullName ??
    refund.booking?.customerProfile?.user?.phone ??
    'Unknown customer'
  );
}
