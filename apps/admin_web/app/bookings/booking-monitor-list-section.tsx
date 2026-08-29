import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye, X } from 'lucide-react';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlButton, AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import {
  AdminAvatarStatusDot,
  AdminPersonCell,
  adminPersonInitials,
} from '../../components/admin-person-cell';
import { AdminErrorState, AdminLoadingState } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import {
  adminAvatarStatusFromSignals,
  type AdminAvatarPushDeviceSignal,
  type AdminAvatarSessionSignal,
  type AdminAvatarStatus,
} from '../../lib/admin-avatar-status';
import type { AdminBooking, AdminChatMessage } from '../../lib/admin-api';
import { adminCountLabel } from '../../lib/admin-copy';
import { formatMoney, readPlainRecord, shortId } from '../../lib/admin-format';
import type { BookingListActionChip } from '../../lib/booking-list-action-chips';
import type { BookingListStage } from '../../lib/booking-list-stage';
import { readAddressText, serviceAddressAreaLabel } from './booking-address-readers';
import { bookingChatMessageCount } from './booking-chat-message-count';
import {
  bookingPostMatchChatEvidenceRows,
  bookingPostMatchEvidenceLabel,
} from './booking-post-match-chat-evidence';
import {
  postMatchCancellationActorLabel,
  postMatchCancellationDecisionSourceLabel,
  postMatchCancellationFeeStateLabel,
  postMatchCancellationMinutesLabel,
  postMatchCancellationResolutionLabel,
} from './booking-post-match-cancellation-display';
import {
  postMatchCancellationDetail,
  postMatchCancellationReasonDisplay,
} from './booking-post-match-cancellation-reason';
import {
  isPostMatchCancellationAutoApproved,
  isPostMatchCancellationBooking,
  isPostMatchCancellationManualReviewRequired,
  isPostMatchCancellationReviewBooking,
  postMatchCancellationFeeState,
  postMatchCancellationDecisionSource,
  postMatchCancellationDecisionSla,
  postMatchCancellationMinutesAfterMatch,
  postMatchCancellationResolution,
  postMatchCancellationTimeDisplay,
} from './booking-post-match-cancellations-model';
import { bookingMonitorDetailHrefSuffix } from './booking-monitor-operation-links';
import type { BookingPageView } from './booking-page-params';
import { BOOKING_RECORD_VIEWS } from './booking-monitor-realtime';

type BookingMonitorPillDetail = {
  readonly detail: string;
  readonly label: string;
  readonly tone: string;
};

type BookingMonitorAddressState = BookingMonitorPillDetail & {
  readonly pin: string;
};

type BookingMonitorMatchingRuleSnapshot = {
  readonly customerChoiceLabel: string;
  readonly operatorAction: string;
  readonly radiusLabel: string;
  readonly sourceLabel: string;
  readonly sourceTone: string;
  readonly supplyLabel: string;
  readonly windowLabel: string;
};

type BookingMonitorParticipantPill = {
  readonly id: string;
  readonly partnerLabel: string;
  readonly status: string;
};

type BookingMonitorSignal = {
  readonly helper: string;
  readonly label: string;
  readonly tone: string;
};

export type BookingMonitorListRow = {
  readonly actionChips: readonly BookingListActionChip[];
  readonly addressState: BookingMonitorAddressState;
  readonly backupAlert: {
    readonly label: string;
    readonly pill: string;
    readonly tone: string;
  };
  readonly booking: AdminBooking;
  readonly cashDebtAmountLabel: string | null;
  readonly cashDebtNeedsOps: boolean;
  readonly chatState: BookingMonitorPillDetail;
  readonly checkSignal: BookingMonitorSignal;
  readonly closureState: BookingMonitorPillDetail | null;
  readonly commandDecisionStrip: {
    readonly primaryAction: string;
    readonly primaryDetail: string;
    readonly status: string;
    readonly tone: string;
  };
  readonly customerVisibleStateLabel: string;
  readonly finalGateReason: {
    readonly detail: string;
    readonly href: string;
    readonly label: string;
    readonly tone: string;
  };
  readonly finalPartnerLabel: string | null;
  readonly firstCheckTitle: string | null;
  readonly firstPickPhoneLabel: string;
  readonly hasMatchingPolicySnapshot: boolean;
  readonly issueChips?: readonly { readonly label: string; readonly tone: string }[];
  readonly location: {
    readonly pillLabel: string;
    readonly signalLabel: string;
    readonly toneClass: string;
  };
  readonly matchingPolicySummaryLabel: string;
  readonly matchingRuleSnapshot: BookingMonitorMatchingRuleSnapshot;
  readonly marketplaceParticipantOverflowCount: number;
  readonly marketplaceParticipants: readonly BookingMonitorParticipantPill[];
  readonly nextActionHelper: string;
  readonly nextActionLabel: string;
  readonly expiresAtLabel: string | null;
  readonly openedDateLabel: string;
  readonly opsSignal: ReactNode;
  readonly preferredPartnerLabel: string;
  readonly preferredProviderStateLabel: string | null;
  readonly pricingPolicy: {
    readonly label: string;
    readonly status: string;
    readonly tone: string;
  };
  readonly statusEvent: {
    readonly clockLabel: string | null;
    readonly dateLabel: string;
    readonly label: string;
    readonly relativeLabel: string;
  };
  readonly terminalWaitingLabel?: string;
  readonly selectedFinalPartnerPillLabel: string | null;
  readonly selection: {
    readonly label: string;
    readonly pathLabel: string;
    readonly toneClass: string;
  };
  readonly serviceOptionLabel: string;
  readonly servicePayoutLabel: string | null;
  readonly servicePriceLabel: string;
  readonly stage: BookingListStage;
};

type BookingMonitorListSectionProps = {
  readonly emptyMessage: string;
  readonly emptyResetHref?: string;
  readonly hideEmptyGroups?: boolean;
  readonly loadFailed?: boolean;
  readonly operationsWorkspace?: BookingOperationsWorkspace;
  readonly nowMs?: number;
  readonly retryHref?: string;
  readonly returnHref?: string;
  readonly rows: readonly BookingMonitorListRow[];
  readonly serverPagination?: BookingServerPagination;
  readonly visibleGroupKeys?: readonly BookingTableGroupKey[];
};

type BookingOperationsWorkspace = {
  readonly description: string;
  readonly detailPagePath: string;
  readonly detailView: BookingPageView;
  readonly title: string;
  readonly tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning';
};

type BookingServerPagination = {
  readonly hrefForPage: (page: number) => string;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

export type BookingTableGroupKey =
  | 'pre-match'
  | 'post-match-in-progress'
  | 'completed'
  | 'closed-records'
  | 'post-match-cancellations-pending'
  | 'post-match-cancellations-resolved';

type BookingTableGroupDefinition = {
  readonly countTone: string;
  readonly description: string;
  readonly emptyMessage: string;
  readonly key: BookingTableGroupKey;
  readonly title: string;
};

type BookingTableGroup = BookingTableGroupDefinition & {
  readonly rows: readonly BookingMonitorListRow[];
};

type BookingNeedsReviewMetric = {
  readonly helper: string;
  readonly label: string;
  readonly tone: string;
  readonly value: string;
};

type BookingReviewReasonPill = {
  readonly label: string;
  readonly title: string;
  readonly tone: 'pill-danger' | 'pill-info' | 'pill-neutral' | 'pill-success' | 'pill-warn';
};

type BookingParticipantTableRow = {
  readonly avatarStatus: AdminAvatarStatus;
  readonly id: string;
  readonly partnerHref: string | null;
  readonly partnerLabel: string;
  readonly status: string;
};

type BookingProviderLike =
  | {
      readonly devices?: readonly AdminAvatarPushDeviceSignal[];
      readonly displayName?: string | null;
      readonly id?: string;
      readonly sessions?: readonly AdminAvatarSessionSignal[];
      readonly status?: string | null;
      readonly user?: {
        readonly appSessions?: readonly AdminAvatarSessionSignal[];
        readonly fullName?: string | null;
        readonly phone?: string;
        readonly pushDevices?: readonly AdminAvatarPushDeviceSignal[];
      };
    }
  | null
  | undefined;

type BookingCustomerUserLike =
  | {
      readonly appSessions?: readonly AdminAvatarSessionSignal[];
      readonly pushDevices?: readonly AdminAvatarPushDeviceSignal[];
    }
  | null
  | undefined;

type BookingChatMessage = AdminChatMessage;
type BookingChatMessagesResponse = {
  readonly bookingId: string;
  readonly chatRoomId: string | null;
  readonly limit: number;
  readonly messages: readonly BookingChatMessage[];
  readonly truncated: boolean;
};

const BOOKING_TABLE_PAGE_SIZE = 10;
const BOOKING_TABLE_HEADERS = [
  'Request Time',
  'Customer',
  'Requested',
  'Participating',
  'Country',
  'Service Type',
  'Address',
  'State',
] as const;
const BOOKING_POST_MATCH_IN_PROGRESS_HEADERS = [
  'Request Time',
  'Customer',
  'Requested',
  'Participating',
  'Matched',
  'Country',
  'Service Type',
  'Address',
  'State',
] as const;
const BOOKING_OPERATIONS_HEADERS = [
  'Status',
  'Booking · Customer',
  'Partner · Matching',
  'Service · Area',
  'Last activity',
  'Next action',
] as const;
const BOOKING_RECORDS_HEADERS = [
  'Booking · Customer',
  'Status · Closed',
  'Partner · Service',
  'Area · Payment',
  'Follow-up',
] as const;
const BOOKING_CLOSEOUT_OPERATIONS_HEADERS = [
  'Priority · Issue',
  'Booking · Customer',
  'Completed service',
  'Payment',
  'Partner · Closeout',
  'Next action',
] as const;
const BOOKING_POST_MATCH_OPERATIONS_HEADERS = [
  'Decision · SLA',
  'Booking · Actor',
  'Reason · Evidence',
  'Payment',
  'Partner fee',
  'Next action',
] as const;

const BOOKING_TABLE_GROUPS: readonly BookingTableGroupDefinition[] = [
  {
    countTone: 'pill-neutral',
    description:
      'Current requests from booking submission through matching wait before final Partner assignment.',
    emptyMessage: 'No realtime bookings are waiting.',
    key: 'pre-match',
    title: 'Live / Today Bookings',
  },
  {
    countTone: 'pill-info',
    description: 'Live matched bookings currently moving through dispatch, arrival, and service.',
    emptyMessage: 'No post-match bookings are in progress.',
    key: 'post-match-in-progress',
    title: 'Live In Progress',
  },
  {
    countTone: 'pill-success',
    description: 'Completed booking records ready for normal payment, earning, and closeout review.',
    emptyMessage: 'No completed bookings in this result set.',
    key: 'completed',
    title: 'Closeout Records',
  },
  {
    countTone: 'pill-neutral',
    description: 'Cancelled, expired, and refunded records retained for support and finance lookup.',
    emptyMessage: 'No other closed booking records in this result set.',
    key: 'closed-records',
    title: 'Other Closed Records',
  },
  {
    countTone: 'pill-warn',
    description: 'Partner-side cancellations and no-show reviews still needing admin evidence review.',
    emptyMessage: 'No pending post-match cancellation reviews in this result set.',
    key: 'post-match-cancellations-pending',
    title: 'Cancellation Review / Needs Action',
  },
  {
    countTone: 'pill-success',
    description: 'Approved, held, or auto-approved cancellation decisions retained for audit.',
    emptyMessage: 'No resolved post-match cancellation decisions in this result set.',
    key: 'post-match-cancellations-resolved',
    title: 'Cancellation Records / Resolved',
  },
];

const BOOKING_MATCHING_AVATAR_STATUSES = new Set<string>(['CREATED', 'OPEN_MATCHING']);
const BOOKING_WORKING_AVATAR_STATUSES = new Set<string>([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

export function BookingMonitorListSection({
  emptyMessage,
  emptyResetHref,
  hideEmptyGroups = false,
  loadFailed = false,
  operationsWorkspace,
  nowMs = 0,
  retryHref = '/bookings',
  returnHref,
  rows,
  serverPagination,
  visibleGroupKeys,
}: BookingMonitorListSectionProps) {
  if (loadFailed) {
    return (
      <AdminErrorState
        action={<AdminTextLink href={retryHref}>Retry booking records</AdminTextLink>}
        message="Booking records could not be loaded. No empty booking queue is shown until the list source is available."
        title="Booking records unavailable"
      />
    );
  }

  if (operationsWorkspace) {
    return (
      <BookingMonitorOperationsTable
        emptyMessage={emptyMessage}
        emptyResetHref={emptyResetHref}
        pagination={serverPagination}
        nowMs={nowMs}
        returnHref={returnHref}
        rows={rows}
        workspace={operationsWorkspace}
      />
    );
  }

  const groups = buildBookingTableGroups(rows, visibleGroupKeys);
  const groupedRows =
    hideEmptyGroups && rows.length > 0 ? groups.filter((group) => group.rows.length > 0) : groups;
  return (
    <>
      {groupedRows.map((group, index) => (
        <BookingMonitorTableGroup
          emptyMessage={rows.length === 0 && index === 0 ? emptyMessage : group.emptyMessage}
          group={group}
          key={group.key}
          returnHref={returnHref}
        />
      ))}
    </>
  );
}

function BookingMonitorOperationsTable({
  emptyMessage,
  emptyResetHref,
  pagination,
  nowMs,
  returnHref,
  rows,
  workspace,
}: {
  readonly emptyMessage: string;
  readonly emptyResetHref?: string;
  readonly pagination?: BookingServerPagination;
  readonly nowMs: number;
  readonly returnHref?: string;
  readonly rows: readonly BookingMonitorListRow[];
  readonly workspace: BookingOperationsWorkspace;
}) {
  const activePage = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? Math.max(rows.length, 1);
  const totalRows = pagination?.totalRows ?? rows.length;
  const from = totalRows === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const to = totalRows === 0 ? 0 : Math.min(totalRows, from + rows.length - 1);
  const isCloseoutWorkspace = workspace.detailPagePath === '/bookings/completed';
  const isPostMatchWorkspace = workspace.detailPagePath === '/bookings/post-match-cancellations';
  const isRecordsWorkspace =
    workspace.detailPagePath === '/bookings' && BOOKING_RECORD_VIEWS.has(workspace.detailView);

  if (rows.length === 0) {
    return (
      <AdminTablePanel
        description={workspace.description}
        id="booking-table-operations"
        resultLabel={isPostMatchWorkspace ? `Current result: ${adminCountLabel(totalRows, 'booking')}` : adminCountLabel(totalRows, 'booking')}
        resultTone={workspace.tone}
        title={workspace.title}
      >
        <AdminEmptyState message={emptyMessage} title={null} />
        {emptyResetHref ? (
          <AdminFormControlLink className="button-secondary admin-mt-12" href={emptyResetHref}>
            {isRecordsWorkspace ? 'Clear search' : 'Reset filters'}
          </AdminFormControlLink>
        ) : null}
      </AdminTablePanel>
    );
  }

  return (
    <AdminTablePanel
      description={workspace.description}
      id="booking-table-operations"
      resultLabel={isPostMatchWorkspace ? `Current result: ${adminCountLabel(totalRows, 'booking')}` : adminCountLabel(totalRows, 'booking')}
      resultTone={workspace.tone}
      title={workspace.title}
    >
      <AdminTableScroll ariaLabel={`${workspace.title} booking table`}>
        <AdminDataTable
          className={
            isRecordsWorkspace
              ? 'vuexy-booking-operations-table vuexy-booking-records-table'
              : isCloseoutWorkspace
                ? 'vuexy-booking-operations-table booking-closeout-operations-table'
                : isPostMatchWorkspace
                  ? 'vuexy-booking-operations-table booking-post-match-operations-table'
                  : 'vuexy-booking-operations-table'
          }
          emptyMessage={emptyMessage}
          headers={
            isCloseoutWorkspace
              ? BOOKING_CLOSEOUT_OPERATIONS_HEADERS
              : isPostMatchWorkspace
                ? BOOKING_POST_MATCH_OPERATIONS_HEADERS
                : isRecordsWorkspace
                  ? BOOKING_RECORDS_HEADERS
                  : BOOKING_OPERATIONS_HEADERS
          }
          rowCount={rows.length}
        >
          {rows.map((row) => (
            isCloseoutWorkspace ? (
              <BookingMonitorCloseoutTableRow
                detailPagePath={workspace.detailPagePath}
                detailView={workspace.detailView}
                key={row.booking.id}
                returnHref={returnHref}
                row={row}
              />
            ) : isPostMatchWorkspace ? (
              <BookingMonitorPostMatchTableRow
                detailPagePath={workspace.detailPagePath}
                detailView={workspace.detailView}
                key={row.booking.id}
                nowMs={nowMs}
                returnHref={returnHref}
                row={row}
              />
            ) : isRecordsWorkspace ? (
              <BookingMonitorRecordsTableRow
                key={row.booking.id}
                returnHref={returnHref}
                row={row}
              />
            ) : (
              <BookingMonitorOperationsTableRow
                detailPagePath={workspace.detailPagePath}
                detailView={workspace.detailView}
                key={row.booking.id}
                returnHref={returnHref}
                row={row}
              />
            )
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={activePage}
        ariaLabel={`${workspace.title} pages`}
        from={from}
        hrefForPage={pagination?.hrefForPage}
        to={to}
        totalPages={pagination?.totalPages ?? 1}
        totalRows={totalRows}
      />
    </AdminTablePanel>
  );
}

function BookingMonitorPostMatchTableRow({
  detailPagePath,
  detailView,
  nowMs,
  returnHref,
  row,
}: {
  readonly detailPagePath: string;
  readonly detailView: BookingPageView;
  readonly nowMs: number;
  readonly returnHref?: string;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const source = postMatchCancellationDecisionSource(booking);
  const decisionSla = postMatchCancellationDecisionSla(booking, nowMs);
  const timeDisplay = postMatchCancellationTimeDisplay(booking, nowMs);
  const reason = postMatchCancellationReasonDisplay(booking);
  const detail = postMatchCancellationDetail(booking);
  const feeState = postMatchCancellationFeeState(booking);
  const detailHrefSuffix = bookingMonitorDetailHrefSuffix(detailPagePath, detailView, booking.status);
  const anchoredReturnHref = returnHref
    ? `${returnHref.split('#', 1)[0]}#booking-${encodeURIComponent(booking.id)}`
    : undefined;
  const actionLabel = postMatchCancellationActionLabel(booking, source);
  const locationRecorded = Boolean(
    booking.selectedProvider?.currentLocationUpdatedAt ||
      booking.selectedProvider?.locationSnapshots?.length ||
      booking.addressSnapshot,
  );

  return (
    <tr id={`booking-${booking.id}`}>
      <td data-label="Decision · SLA">
        <div className="booking-closeout-stack">
          <StatusBadge tone={source === 'open' ? 'warning' : 'success'}>
            {source === 'open' ? 'Pending' : 'Resolved'}
          </StatusBadge>
          {source === 'open' ? (
            <StatusBadge tone={decisionSla.overdue ? 'danger' : 'info'}>{decisionSla.label}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">{postMatchCancellationDecisionSourceLabel(source)}</StatusBadge>
          )}
          {timeDisplay.timestamp ? (
            <span>
              {timeDisplay.timestampLabel} <DateTimeText value={timeDisplay.timestamp} />
            </span>
          ) : (
            <span>Time unavailable</span>
          )}
          {timeDisplay.timestamp ? (
            <span className="muted">
              {timeDisplay.ageLabel}{' '}
              {timeDisplay.ageMinutes === null
                ? 'time unavailable'
                : postMatchCancellationElapsedDuration(timeDisplay.ageMinutes)}
            </span>
          ) : null}
        </div>
      </td>
      <td data-label="Booking · Actor">
        <div className="booking-closeout-stack">
          <AdminTextLink
            href={bookingDetailHref(booking.id, '', anchoredReturnHref)}
            title={`Open booking ${booking.id}`}
          >
            <Eye aria-hidden="true" size={14} />
            {shortId(booking.id)}
            <span className="sr-only">Full booking ID {booking.id}</span>
          </AdminTextLink>
          <strong>{postMatchCancellationActorLabel(booking.closedByRole)}</strong>
          <span className="muted">{postMatchCancellationMinutesLabel(postMatchCancellationMinutesAfterMatch(booking))}</span>
        </div>
      </td>
      <td data-label="Reason · Evidence">
        <div className="booking-closeout-stack">
          <StatusBadgeFromPillClass pillClass={reason?.tone ?? 'pill-neutral'}>
            {reason?.label ?? 'No structured reason'}
          </StatusBadgeFromPillClass>
          {detail ? (
            <span className="booking-closeout-wrap" title={detail}>
              {detail}
            </span>
          ) : null}
          <span className="muted">
            {adminCountLabel(bookingChatMessageCount(booking), 'chat message')} ·{' '}
            {locationRecorded ? 'Location evidence recorded' : 'No location evidence'}
          </span>
        </div>
      </td>
      <td data-label="Payment">
        <div className="booking-closeout-stack">
          {booking.payment ? (
            <>
              <div>
                <StatusBadge tone={closeoutPaymentTone(booking.payment.status)}>{booking.payment.method}</StatusBadge>
                <strong>{booking.payment.status}</strong>
              </div>
              <span>{formatMoney(Number(booking.payment.amount ?? 0), booking.payment.currency)}</span>
            </>
          ) : (
            <AdminInlineFallback>No payment record</AdminInlineFallback>
          )}
        </div>
      </td>
      <td data-label="Partner fee">
        <div className="booking-closeout-stack">
          <StatusBadge tone={feeState === 'restored' ? 'success' : feeState === 'held' ? 'danger' : 'neutral'}>
            {postMatchCancellationFeeStateLabel(feeState)}
          </StatusBadge>
          {booking.earning ? (
            <span>{formatMoney(Number(booking.earning.netAmount ?? 0), booking.earning.currency)}</span>
          ) : (
            <span className="muted">No Partner fee record</span>
          )}
          <span className="muted">{postMatchCancellationDecisionSourceLabel(source)}</span>
        </div>
      </td>
      <td data-label="Next action">
        <div className="vuexy-booking-next-action-cell">
          <AdminTextLink href={bookingDetailHref(booking.id, detailHrefSuffix, anchoredReturnHref)}>
            {actionLabel}
          </AdminTextLink>
          <span className="muted">Read evidence and money outcome in booking detail.</span>
        </div>
      </td>
    </tr>
  );
}

function postMatchCancellationElapsedDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (24 * 60))}d`;
}

function postMatchCancellationActionLabel(
  booking: AdminBooking,
  source: ReturnType<typeof postMatchCancellationDecisionSource>,
) {
  if (source === 'open') {
    return booking.status === 'NO_SHOW' ? 'Review no-show outcome' : 'Review cancellation decision';
  }
  if (!booking.earning) return 'View cancellation outcome';
  if (source === 'admin-held') return 'View kept fee record';
  if (source === 'admin-approved' || source === 'auto-resolved') return 'View waived fee record';
  return 'View legacy decision record';
}

function BookingMonitorCloseoutTableRow({
  detailPagePath,
  detailView,
  returnHref,
  row,
}: {
  readonly detailPagePath: string;
  readonly detailView: BookingPageView;
  readonly returnHref?: string;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const payment = booking.payment;
  const earning = booking.earning;
  const partner = booking.selectedProvider ?? booking.preferredProvider ?? null;
  const partnerId =
    booking.selectedProvider?.id ??
    booking.selectedProviderId ??
    booking.preferredProvider?.id ??
    booking.preferredProviderId ??
    null;
  const detailHrefSuffix = bookingMonitorDetailHrefSuffix(detailPagePath, detailView, booking.status);
  const address = bookingAddressDisplay(booking);
  const service = bookingServiceDisplay(row.serviceOptionLabel);
  const refunds = [...(booking.refunds ?? []), ...(payment?.refunds ?? [])];

  return (
    <tr id={`booking-${booking.id}`}>
      <td data-label="Priority · Issue">
        <div className="booking-closeout-priority-cell">
          <div>
            <StatusBadge tone={['all', 'expired'].includes(detailView) ? 'neutral' : 'warning'}>
              {['all', 'expired'].includes(detailView) ? 'Record' : 'Action'}
            </StatusBadge>
            <strong>{row.terminalWaitingLabel ?? 'Waiting time unavailable'}</strong>
          </div>
          <span className="muted">
            {row.statusEvent.label} · {row.statusEvent.dateLabel}
          </span>
          <div className="booking-closeout-issue-chips" aria-label="Queue inclusion reasons">
            {(row.issueChips ?? []).map((issue) => (
              <StatusBadgeFromPillClass key={issue.label} pillClass={issue.tone}>
                {issue.label}
              </StatusBadgeFromPillClass>
            ))}
          </div>
        </div>
      </td>
      <td data-label="Booking · Customer">
        <div className="booking-closeout-stack">
          <AdminTextLink href={bookingDetailHref(booking.id, '', returnHref)} title="Open booking detail">
            <Eye aria-hidden="true" size={14} />
            {shortId(booking.id)}
          </AdminTextLink>
          {bookingCustomerHref(booking) ? (
            <AdminTextLink href={bookingCustomerHref(booking) ?? '/customers'}>
              {bookingCustomerLabel(booking)}
            </AdminTextLink>
          ) : (
            <strong>{bookingCustomerLabel(booking)}</strong>
          )}
          <span className="muted">{booking.customerProfile?.user?.phone ?? 'No phone'}</span>
        </div>
      </td>
      <td data-label="Completed service">
        <div className="booking-closeout-stack">
          <strong>{service.fullLabel}</strong>
          <span>{address.fullLabel}</span>
          <span className="muted">{closeoutServicePriceLabel(row.servicePriceLabel, detailView)}</span>
        </div>
      </td>
      <td data-label="Payment">
        <div className="booking-closeout-stack">
          {payment ? (
            <>
              <div>
                <StatusBadge tone={closeoutPaymentTone(payment.status)}>{payment.method}</StatusBadge>
                <strong>{payment.status}</strong>
              </div>
              <span>{formatMoney(Number(payment.amount ?? 0), payment.currency)}</span>
              {payment.method !== 'CASH' && (payment.providerRef || payment.status === 'AUTHORIZED') && (
                <span className="muted">
                  {payment.providerRef ? 'Reference saved' : 'Gateway ref missing'}
                </span>
              )}
              {refunds.length > 0 && (
                <span className="muted">
                  Refund · {refunds[0]?.status ?? 'unknown'} ({refunds.length})
                </span>
              )}
            </>
          ) : (
            <AdminInlineFallback>No payment record</AdminInlineFallback>
          )}
        </div>
      </td>
      <td data-label="Partner · Closeout">
        <div className="booking-closeout-stack">
          {partner ? (
            <AdminTextLink href={bookingPartnerHref(partnerId) ?? '/partners'}>
              {providerTableLabel(partner)}
            </AdminTextLink>
          ) : (
            <AdminInlineFallback>No final Partner</AdminInlineFallback>
          )}
          {earning ? (
            <>
              <span>
                {row.cashDebtNeedsOps && row.cashDebtAmountLabel
                  ? `Partner owes HANDS ${row.cashDebtAmountLabel}`
                  : `Earning ${earning.status} · ${formatMoney(Number(earning.netAmount ?? 0), earning.currency)}`}
              </span>
              <div className="booking-closeout-ledger-chips" aria-label="Closeout records">
                <CloseoutRecordBadge exists={Boolean(earning.platformFeeLogs?.length)} label="Fee" />
                <CloseoutRecordBadge exists={Boolean(earning.taxLogs?.length)} label="Tax" />
                <CloseoutRecordBadge exists={Boolean(earning.walletLedgerEntries?.length)} label="Wallet" />
              </div>
            </>
          ) : (
            <StatusBadge tone="danger">Earning missing</StatusBadge>
          )}
        </div>
      </td>
      <td data-label="Next action">
        <div className="vuexy-booking-next-action-cell">
          <AdminTextLink href={bookingDetailHref(booking.id, detailHrefSuffix, returnHref)}>
            {row.nextActionLabel}
          </AdminTextLink>
          <span className="muted">{row.nextActionHelper}</span>
        </div>
      </td>
    </tr>
  );
}

function CloseoutRecordBadge({ exists, label }: { readonly exists: boolean; readonly label: string }) {
  return <StatusBadge tone={exists ? 'success' : 'warning'}>{label} {exists ? 'recorded' : 'missing'}</StatusBadge>;
}

function closeoutPaymentTone(status: string) {
  if (['CAPTURED', 'RELEASED', 'REFUNDED'].includes(status)) return 'success' as const;
  if (status === 'AUTHORIZED' || status === 'PENDING') return 'warning' as const;
  return 'neutral' as const;
}

function closeoutServicePriceLabel(label: string, view: BookingPageView) {
  return view === 'pricing'
    ? label.replace(' / Minimum ', ' / Catalog minimum ')
    : label.split(' / Minimum ', 1)[0];
}

function BookingMonitorTableGroup({
  emptyMessage,
  group,
  returnHref,
}: {
  readonly emptyMessage: string;
  readonly group: BookingTableGroup;
  readonly returnHref?: string;
}) {
  const [page, setPage] = useState(1);
  const rowKey = group.rows.map((row) => row.booking.id).join('|');
  const totalPages = Math.max(1, Math.ceil(group.rows.length / BOOKING_TABLE_PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const pageStartIndex = (activePage - 1) * BOOKING_TABLE_PAGE_SIZE;
  const visibleRows = useMemo(
    () => group.rows.slice(pageStartIndex, pageStartIndex + BOOKING_TABLE_PAGE_SIZE),
    [group.rows, pageStartIndex],
  );
  const needsReviewMetrics = useMemo(
    () =>
      group.key === 'post-match-cancellations-pending' && group.rows.length > 0
        ? bookingPostMatchNeedsReviewMetrics(group.rows)
        : [],
    [group.key, group.rows],
  );
  const pageFrom = group.rows.length === 0 ? 0 : pageStartIndex + 1;
  const pageTo = Math.min(group.rows.length, pageStartIndex + visibleRows.length);

  useEffect(() => {
    const timer = window.setTimeout(() => setPage(1), 0);

    return () => window.clearTimeout(timer);
  }, [rowKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage((currentPage) => Math.min(currentPage, totalPages));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [totalPages]);

  return (
    <AdminTablePanel
      description={group.description}
      id={`booking-table-${group.key}`}
      resultLabel={adminCountLabel(group.rows.length, 'booking')}
      resultTone={bookingTableGroupResultTone(group)}
      title={group.title}
    >
      {needsReviewMetrics.length > 0 && <BookingNeedsReviewSummary metrics={needsReviewMetrics} />}
      <AdminTableScroll ariaLabel={`${group.title} booking table`}>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={emptyMessage}
          headers={bookingTableHeaders(group.key)}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((row) => (
            <BookingMonitorListTableRow
              groupKey={group.key}
              key={row.booking.id}
              returnHref={returnHref}
              row={row}
            />
          ))}
        </AdminDataTable>
      </AdminTableScroll>

      <AdminTablePaginationFooter
        activePage={activePage}
        ariaLabel={`${group.title} pages`}
        from={pageFrom}
        onPageChange={setPage}
        to={pageTo}
        totalPages={totalPages}
        totalRows={group.rows.length}
      />
    </AdminTablePanel>
  );
}

function bookingTableGroupResultTone(
  group: BookingTableGroup,
): 'danger' | 'info' | 'neutral' | 'success' | 'warning' {
  switch (group.countTone) {
    case 'pill-danger':
      return 'danger';
    case 'pill-info':
      return 'info';
    case 'pill-success':
      return 'success';
    case 'pill-warn':
      return 'warning';
    default:
      return 'neutral';
  }
}

function BookingNeedsReviewSummary({ metrics }: { readonly metrics: readonly BookingNeedsReviewMetric[] }) {
  return (
    <AdminTraceSummary
      ariaLabel="Post-match cancellation review priorities"
      className="vuexy-booking-review-summary"
      metrics={metrics.map((metric) => ({
        className: metric.tone,
        detail: metric.helper,
        key: metric.label,
        kind: 'action',
        label: metric.label,
        scope: 'Needs action',
        value: metric.value,
      }))}
    />
  );
}

function BookingMonitorListTableRow({
  groupKey,
  returnHref,
  row,
}: {
  readonly groupKey: BookingTableGroupKey;
  readonly returnHref?: string;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const participantRows = bookingParticipantRows(booking);
  const addressDisplay = bookingAddressDisplay(booking);
  const countryDisplay = bookingCountryDisplay(bookingDeviceLanguageLabel(booking));
  const serviceDisplay = bookingServiceDisplay(row.serviceOptionLabel);
  const stateChange = row.statusEvent;
  const cancellationReviewSignal = bookingCancellationReviewSignal(booking);
  const reviewReasonPills = bookingReviewReasonPills(booking);
  const requestedPartner = booking.preferredProvider ?? booking.selectedProvider ?? null;
  const requestedPartnerHref = bookingPartnerHref(
    booking.preferredProvider?.id ??
      booking.preferredProviderId ??
      booking.selectedProvider?.id ??
      booking.selectedProviderId,
  );

  return (
    <tr id={`booking-${booking.id}`}>
      <td>
        <div className="vuexy-booking-id-line">
          <AdminTextLink href={bookingDetailHref(booking.id, '', returnHref)} title="Open booking detail">
            <Eye aria-hidden="true" size={14} />
            {shortId(booking.id)}
          </AdminTextLink>
        </div>
        <div className="muted">{row.openedDateLabel}</div>
      </td>
      <td>
        <BookingPersonCell
          avatarStatus={bookingCustomerAvatarStatus(booking)}
          helper={booking.customerProfile?.user?.phone ?? 'No phone'}
          href={bookingCustomerHref(booking)}
          label={bookingCustomerLabel(booking)}
          tone="customer"
        />
      </td>
      <td>
        <BookingPersonCell
          avatarStatus={bookingRequestedPartnerAvatarStatus(booking, requestedPartner)}
          helper={requestedPartnerHint(row)}
          href={requestedPartnerHref}
          label={requestedPartnerLabel(row, requestedPartner)}
          tone="partner"
        />
      </td>
      <td>
        {participantRows.length > 0 ? (
          <BookingParticipantAvatarGroup participants={participantRows} />
        ) : (
          <AdminInlineFallback>No Partner joined yet</AdminInlineFallback>
        )}
      </td>
      {groupKey === 'post-match-in-progress' && (
        <td>
          <BookingMatchedPartnerCell booking={booking} />
        </td>
      )}
      <td>
        <BookingCountryCell country={countryDisplay} />
      </td>
      <td>
        <BookingServiceCell amount={row.servicePriceLabel} service={serviceDisplay} />
      </td>
      <td>
        <BookingAddressCell address={addressDisplay} />
      </td>
      <td>
        <BookingStateChangedCell
          cancellationReviewSignal={cancellationReviewSignal}
          closureState={row.closureState}
          reviewReasonPills={reviewReasonPills}
          stateChange={stateChange}
        />
      </td>
    </tr>
  );
}

function BookingMonitorOperationsTableRow({
  detailPagePath,
  detailView,
  returnHref,
  row,
}: {
  readonly detailPagePath: string;
  readonly detailView: BookingPageView;
  readonly returnHref?: string;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const addressDisplay = bookingAddressDisplay(booking);
  const serviceDisplay = bookingServiceDisplay(row.serviceOptionLabel);
  const stateChange = row.statusEvent;
  const cancellationReviewSignal = bookingCancellationReviewSignal(booking);
  const reviewReasonPills = bookingReviewReasonPills(booking);
  const partner = booking.selectedProvider ?? booking.preferredProvider ?? null;
  const partnerId =
    booking.selectedProvider?.id ??
    booking.selectedProviderId ??
    booking.preferredProvider?.id ??
    booking.preferredProviderId ??
    null;
  const participantCount = booking.participants?.length ?? 0;
  const detailHrefSuffix = bookingMonitorDetailHrefSuffix(detailPagePath, detailView, booking.status);

  return (
    <tr id={`booking-${booking.id}`}>
      <td data-label="Status">
        <BookingStateChangedCell
          cancellationReviewSignal={cancellationReviewSignal}
          closureState={row.closureState}
          reviewReasonPills={reviewReasonPills}
          showDate={false}
          stateChange={stateChange}
        />
      </td>
      <td data-label="Booking / Customer">
        <div className="vuexy-booking-id-line">
          <AdminTextLink href={bookingDetailHref(booking.id, '', returnHref)} title="Open booking detail">
            <Eye aria-hidden="true" size={14} />
            {shortId(booking.id)}
          </AdminTextLink>
          <span className="muted">{row.openedDateLabel}</span>
        </div>
        <BookingPersonCell
          avatarStatus={bookingCustomerAvatarStatus(booking)}
          helper={booking.customerProfile?.user?.phone ?? 'No phone'}
          href={bookingCustomerHref(booking)}
          label={bookingCustomerLabel(booking)}
          tone="customer"
        />
      </td>
      <td data-label="Partner / Matching">
        {partner ? (
          <BookingPersonCell
            avatarStatus={bookingRequestedPartnerAvatarStatus(booking, partner)}
            helper={participantCount > 0 ? adminCountLabel(participantCount, 'participant') : 'No participants yet'}
            href={bookingPartnerHref(partnerId)}
            label={providerTableLabel(partner)}
            tone="partner"
          />
        ) : (
          <AdminInlineFallback>
            {participantCount > 0 ? adminCountLabel(participantCount, 'participant') : 'Waiting for Partner'}
          </AdminInlineFallback>
        )}
      </td>
      <td data-label="Service / Area">
        <div className="vuexy-booking-service-area-cell">
          <BookingServiceCell amount={row.servicePriceLabel} service={serviceDisplay} />
          <BookingAddressCell address={addressDisplay} />
        </div>
      </td>
      <td data-label="Last activity">
        <BookingCompactCell
          ariaPrefix="Last activity"
          className="vuexy-booking-age-cell"
          fullLabel={row.statusEvent.relativeLabel}
          shortLabel={row.statusEvent.relativeLabel}
        >
          <div className="muted" title={row.statusEvent.dateLabel}>
            {row.statusEvent.dateLabel}
          </div>
        </BookingCompactCell>
      </td>
      <td data-label="Next action">
        <div className="vuexy-booking-next-action-cell">
          <StatusBadge tone={bookingCheckSignalTone(row.checkSignal.label)}>
            {row.checkSignal.label}
          </StatusBadge>
          <AdminTextLink href={bookingDetailHref(booking.id, detailHrefSuffix, returnHref)}>
            {row.nextActionLabel}
          </AdminTextLink>
          <span className="muted">{row.nextActionHelper}</span>
        </div>
      </td>
    </tr>
  );
}

function BookingMonitorRecordsTableRow({
  returnHref,
  row,
}: {
  readonly returnHref?: string;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const partner = booking.selectedProvider ?? booking.preferredProvider ?? null;
  const partnerId =
    booking.selectedProvider?.id ??
    booking.selectedProviderId ??
    booking.preferredProvider?.id ??
    booking.preferredProviderId ??
    null;
  const service = bookingServiceDisplay(row.serviceOptionLabel);
  const address = bookingAddressDisplay(booking);
  const needsFollowUp = row.checkSignal.label !== 'Checks clear';
  const payment = booking.payment;

  return (
    <tr id={`booking-${booking.id}`}>
      <td data-label="Booking · Customer">
        <div className="booking-records-cell">
          <AdminTextLink href={bookingDetailHref(booking.id, '', returnHref)} title={`Booking ${booking.id}`}>
            {shortId(booking.id)}
            <span className="sr-only">Full booking ID {booking.id}</span>
          </AdminTextLink>
          <span className="muted">Requested {row.openedDateLabel}</span>
          {bookingCustomerHref(booking) ? (
            <AdminTextLink href={bookingCustomerHref(booking) ?? '/customers'}>
              {bookingCustomerLabel(booking)}
            </AdminTextLink>
          ) : (
            <strong>{bookingCustomerLabel(booking)}</strong>
          )}
          <span className="muted">{booking.customerProfile?.user?.phone ?? 'Phone unavailable'}</span>
        </div>
      </td>
      <td data-label="Status · Closed">
        <div className="booking-records-cell">
          <StatusBadge tone={bookingRecordStatusTone(booking.status)}>{booking.status}</StatusBadge>
          <span>{row.statusEvent.dateLabel}</span>
          {row.closureState ? (
            <StatusBadgeFromPillClass pillClass={row.closureState.tone}>
              {row.closureState.label}
            </StatusBadgeFromPillClass>
          ) : null}
        </div>
      </td>
      <td data-label="Partner · Service">
        <div className="booking-records-cell">
          {partner ? (
            <AdminTextLink href={bookingPartnerHref(partnerId) ?? '/partners'}>
              {providerTableLabel(partner)}
            </AdminTextLink>
          ) : (
            <AdminInlineFallback>No final Partner</AdminInlineFallback>
          )}
          <strong>{service.fullLabel}</strong>
          <span className="muted">{bookingRecordPriceLabel(row.servicePriceLabel)}</span>
          <span className="muted">{bookingRecordPayoutLabel(row.servicePayoutLabel)}</span>
        </div>
      </td>
      <td data-label="Area · Payment">
        <div className="booking-records-cell">
          {address.tone === 'pill-warn' ? (
            <StatusBadge tone="warning">Service address missing</StatusBadge>
          ) : (
            <span title={address.fullLabel}>{address.fullLabel}</span>
          )}
          {payment ? (
            <>
              <StatusBadge tone={closeoutPaymentTone(payment.status)}>
                {payment.method} · {payment.status}
              </StatusBadge>
              <span className="muted">
                {formatMoney(Number(payment.amount ?? 0), payment.currency)}
              </span>
            </>
          ) : (
            <AdminInlineFallback>No payment record</AdminInlineFallback>
          )}
        </div>
      </td>
      <td data-label="Follow-up">
        <div className="booking-records-cell">
          <StatusBadge tone={needsFollowUp ? 'warning' : 'success'}>
            {needsFollowUp ? 'Needs follow-up' : 'No follow-up'}
          </StatusBadge>
          <AdminTextLink href={bookingDetailHref(booking.id, '', returnHref)}>
            {needsFollowUp ? row.nextActionLabel : 'View booking record'}
          </AdminTextLink>
          {needsFollowUp ? (
            <span className="muted">{row.firstCheckTitle ?? row.nextActionHelper}</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function bookingRecordStatusTone(status: string) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'danger' as const;
  if (status === 'EXPIRED') return 'warning' as const;
  if (status === 'REFUNDED') return 'info' as const;
  return 'neutral' as const;
}

function bookingRecordPriceLabel(label: string) {
  return label.replace(' / Minimum ', ' / Partner minimum ');
}

function bookingRecordPayoutLabel(label: string | null) {
  return label ? label.replace(/^Payout /u, 'Partner payout ') : 'Partner payout unavailable';
}

function bookingCheckSignalTone(label: BookingMonitorSignal['label']) {
  if (label === 'Action') return 'danger' as const;
  if (label === 'Watch') return 'info' as const;
  return 'success' as const;
}

function bookingDetailHref(bookingId: string, suffix: string, returnHref?: string) {
  const baseHref = `/bookings/${encodeURIComponent(bookingId)}`;
  if (!returnHref) {
    return `${baseHref}${suffix}`;
  }
  const [queryPart = '', fragment] = suffix.split('#', 2);
  const params = new URLSearchParams(queryPart.startsWith('?') ? queryPart.slice(1) : '');
  params.set('returnTo', returnHref);
  return `${baseHref}?${params.toString()}${fragment ? `#${fragment}` : ''}`;
}

function bookingTableHeaders(groupKey: BookingTableGroupKey) {
  return groupKey === 'post-match-in-progress'
    ? BOOKING_POST_MATCH_IN_PROGRESS_HEADERS
    : BOOKING_TABLE_HEADERS;
}

export function BookingPostMatchCancellationChatLayer({
  onClose,
  row,
}: {
  readonly onClose: () => void;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const embeddedMessages = booking.chatRoom?.messages ?? [];
  const [chatState, setChatState] = useState<{
    readonly error: string | null;
    readonly loaded: boolean;
    readonly messages: readonly BookingChatMessage[];
  }>(() => ({
    error: null,
    loaded: embeddedMessages.length > 0,
    messages: embeddedMessages,
  }));
  const listedMessageCount = bookingChatMessageCount(booking);
  const messages = chatState.messages;
  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);
  const feeState = postMatchCancellationFeeState(booking);
  const resolution = postMatchCancellationResolution(booking);
  const autoApproved = isPostMatchCancellationAutoApproved(booking);
  const evidenceLabel = bookingPostMatchEvidenceLabel(booking);
  const evidenceRows = bookingPostMatchChatEvidenceRows({
    booking,
    messageCount: chatState.loaded ? messages.length : listedMessageCount,
  });

  useEffect(() => {
    if (!booking.chatRoom || embeddedMessages.length > 0) {
      return undefined;
    }

    const controller = new AbortController();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setChatState((current) => ({ ...current, error: null, loaded: false }));
      }
    });

    fetch(`/api/admin/bookings/${encodeURIComponent(booking.id)}/chat-messages`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('CHAT_MESSAGES_UNAVAILABLE');
        }
        return (await response.json()) as BookingChatMessagesResponse;
      })
      .then((payload) => {
        setChatState({
          error: null,
          loaded: true,
          messages: payload.messages ?? [],
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setChatState({
          error: 'Unable to load retained chat messages. Open booking detail if this persists.',
          loaded: true,
          messages: [],
        });
      });

    return () => controller.abort();
  }, [booking.chatRoom, booking.id, embeddedMessages.length]);

  return (
    <div className="booking-chat-layer" role="presentation">
      <div
        aria-labelledby={`booking-chat-layer-title-${booking.id}`}
        aria-modal="true"
        className="booking-chat-dialog"
        role="dialog"
      >
        <div className="booking-chat-dialog-header">
          <div>
            <StatusBadge tone="info">{evidenceLabel}</StatusBadge>
            <h3 id={`booking-chat-layer-title-${booking.id}`}>
              {bookingCustomerLabel(booking)} / {providerTableLabel(booking.selectedProvider)}
            </h3>
            <p>
              {postMatchCancellationMinutesLabel(minutesAfterMatch)} ·{' '}
              {postMatchCancellationFeeStateLabel(feeState)} ·{' '}
              {postMatchCancellationResolutionLabel(resolution, autoApproved)}
            </p>
          </div>
          <AdminFormControlButton
            aria-label="Close chat evidence"
            className="button-secondary booking-chat-close"
            onClick={onClose}
            title="Close chat evidence"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </AdminFormControlButton>
        </div>
        <div className="booking-chat-evidence-grid" aria-label="Cancellation evidence record">
          {evidenceRows.map((item) => (
            <div className="booking-chat-evidence-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.helper}</p>
            </div>
          ))}
        </div>
        <div className="booking-chat-message-list">
          {!chatState.loaded ? (
            <AdminLoadingState
              className="booking-chat-empty"
              message="Loading retained chat messages..."
              title="Loading chat evidence"
            />
          ) : chatState.error ? (
            <AdminErrorState
              className="booking-chat-empty"
              message={chatState.error}
              title="Unable to load chat evidence"
            />
          ) : messages.length > 0 ? (
            messages.map((message) => <BookingChatMessageRow key={message.id} message={message} />)
          ) : (
            <AdminEmptyState
              className="booking-chat-empty"
              message="No retained chat messages for this booking."
              title={null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BookingChatMessageRow({ message }: { readonly message: BookingChatMessage }) {
  const senderName = message.sender?.fullName ?? message.sender?.phone ?? 'Unknown sender';
  const senderRole = bookingChatSenderRole(message.sender?.roles);

  return (
    <div className="booking-chat-message">
      <div className="booking-chat-message-meta">
        <strong>{senderName}</strong>
        <StatusBadge tone="neutral">{senderRole}</StatusBadge>
        <DateTimeText fallback="Missing" value={message.createdAt} />
      </div>
      <p>{message.body || 'No message body retained.'}</p>
    </div>
  );
}

function BookingStateChangedCell({
  cancellationReviewSignal,
  closureState,
  reviewReasonPills,
  showDate = true,
  stateChange,
}: {
  readonly cancellationReviewSignal: { readonly label: string; readonly tone: string } | null;
  readonly closureState: BookingMonitorPillDetail | null;
  readonly reviewReasonPills: readonly BookingReviewReasonPill[];
  readonly showDate?: boolean;
  readonly stateChange: {
    readonly clockLabel: string | null;
    readonly dateLabel: string;
    readonly label: string;
  };
}) {
  const displayLabel =
    !showDate && stateChange.clockLabel
      ? `${stateChange.label} · ${stateChange.clockLabel}`
      : stateChange.label;

  return (
    <BookingCompactCell
      ariaPrefix="State changed"
      className="vuexy-booking-state-cell"
      fullLabel={displayLabel}
      shortLabel={displayLabel}
    >
      {showDate && (
        <div
          aria-label={`State changed at: ${stateChange.dateLabel}`}
          className="muted"
          title={stateChange.dateLabel}
        >
          {stateChange.dateLabel}
        </div>
      )}
      {closureState && (
        <div className="vuexy-booking-closure-evidence">
          <div className="vuexy-booking-closure-pills">
            <StatusBadgeFromPillClass pillClass={closureState.tone}>
              {closureState.label}
            </StatusBadgeFromPillClass>
            {cancellationReviewSignal && (
              <StatusBadgeFromPillClass pillClass={cancellationReviewSignal.tone}>
                {cancellationReviewSignal.label}
              </StatusBadgeFromPillClass>
            )}
          </div>
          <div className="muted">{closureState.detail}</div>
        </div>
      )}
      {reviewReasonPills.length > 0 && (
        <div className="vuexy-booking-review-reasons" aria-label="Cancellation review reasons">
          {reviewReasonPills.map((reason) => (
            <StatusBadgeFromPillClass key={reason.label} pillClass={reason.tone} title={reason.title}>
              {reason.label}
            </StatusBadgeFromPillClass>
          ))}
        </div>
      )}
    </BookingCompactCell>
  );
}

function BookingCountryCell({
  country,
}: {
  readonly country: {
    readonly flag: string | null;
    readonly flagLabel: string;
    readonly fullLabel: string;
    readonly shortLabel: string;
  };
}) {
  return (
    <div
      aria-label={`Country: ${country.fullLabel}`}
      className="vuexy-booking-country-cell"
      title={country.fullLabel}
    >
      <span
        aria-label={country.flag ? country.flagLabel : undefined}
        aria-hidden={country.flag ? undefined : true}
        className="vuexy-booking-country-flag"
        role={country.flag ? 'img' : undefined}
      >
        {country.flag ?? '--'}
      </span>
      <strong>{country.shortLabel}</strong>
    </div>
  );
}

function BookingServiceCell({
  amount,
  service,
}: {
  readonly amount: string;
  readonly service: {
    readonly fullLabel: string;
    readonly shortLabel: string;
  };
}) {
  return (
    <BookingCompactCell
      ariaPrefix="Service type"
      className="vuexy-booking-service-cell"
      fullLabel={service.fullLabel}
      shortLabel={service.shortLabel}
    >
      <div className="muted">{amount}</div>
    </BookingCompactCell>
  );
}

function BookingAddressCell({
  address,
}: {
  readonly address: {
    readonly fullLabel: string;
    readonly shortLabel: string;
    readonly tone: 'pill-neutral' | 'pill-warn';
  };
}) {
  if (address.tone === 'pill-warn') {
    return <StatusBadge tone="warning">Service address missing</StatusBadge>;
  }

  return (
    <BookingCompactCell
      ariaPrefix="Service address"
      className="vuexy-booking-address-cell"
      fullLabel={address.fullLabel}
      shortLabel={address.shortLabel}
    >
    </BookingCompactCell>
  );
}

function BookingCompactCell({
  ariaPrefix,
  children,
  className,
  fullLabel,
  shortLabel,
}: {
  readonly ariaPrefix: string;
  readonly children?: ReactNode;
  readonly className: string;
  readonly fullLabel: string;
  readonly shortLabel: string;
}) {
  return (
    <div className={className}>
      <strong aria-label={`${ariaPrefix}: ${fullLabel}`} title={fullLabel}>
        {shortLabel}
      </strong>
      {children}
    </div>
  );
}

function BookingPersonCell({
  avatarStatus,
  helper,
  href,
  label,
  tone,
}: {
  readonly avatarStatus: AdminAvatarStatus;
  readonly helper: string;
  readonly href: string | null;
  readonly label: string;
  readonly tone: 'customer' | 'partner';
}) {
  const className = tone === 'partner' ? 'vuexy-booking-avatar is-partner' : 'vuexy-booking-avatar';

  return (
    <AdminPersonCell
      avatarClassName={className}
      avatarStatus={avatarStatus}
      className="vuexy-booking-person"
      copyClassName="vuexy-booking-person-copy"
      helper={helper}
      href={href}
      label={label}
      linkClassName="vuexy-booking-person-link"
    />
  );
}

function BookingParticipantAvatarGroup({
  participants,
}: {
  readonly participants: readonly BookingParticipantTableRow[];
}) {
  return (
    <div className="vuexy-booking-participants" aria-label="Participating Partners">
      <div className="vuexy-booking-avatar-group">
        {participants.slice(0, 4).map((participant) => (
          <BookingParticipantAvatar key={participant.id} participant={participant} />
        ))}
        {participants.length > 4 && (
          <span className="vuexy-booking-avatar-group-item is-overflow">+{participants.length - 4}</span>
        )}
      </div>
    </div>
  );
}

function BookingParticipantAvatar({ participant }: { readonly participant: BookingParticipantTableRow }) {
  const className = 'vuexy-booking-avatar-group-item';
  const label = `${participant.partnerLabel} (${participant.status})`;

  if (!participant.partnerHref) {
    return (
      <span aria-label={label} className={className} title={label}>
        {adminPersonInitials(participant.partnerLabel)}
        <AdminAvatarStatusDot status={participant.avatarStatus} />
      </span>
    );
  }

  return (
    <Link
      aria-label={label}
      className={className}
      href={participant.partnerHref}
      prefetch={false}
      title={label}
    >
      {adminPersonInitials(participant.partnerLabel)}
      <AdminAvatarStatusDot status={participant.avatarStatus} />
    </Link>
  );
}

function BookingMatchedPartnerCell({ booking }: { readonly booking: AdminBooking }) {
  const selectedPartner = booking.selectedProvider ?? null;
  const selectedPartnerId = selectedPartner?.id ?? booking.selectedProviderId ?? null;
  const selectedPartnerHref = bookingPartnerHref(selectedPartnerId);

  if (!selectedPartnerId) {
    return <span className="muted">Not matched yet</span>;
  }

  const selectedPartnerFallback = selectedPartner ?? {
    displayName: `Partner ${shortId(selectedPartnerId)}`,
    id: selectedPartnerId,
  };

  return (
    <BookingPersonCell
      avatarStatus={bookingRequestedPartnerAvatarStatus(booking, selectedPartnerFallback)}
      helper={selectedPartner?.user?.phone ?? 'Matched Partner'}
      href={selectedPartnerHref}
      label={providerTableLabel(selectedPartnerFallback)}
      tone="partner"
    />
  );
}

function requestedPartnerLabel(
  row: BookingMonitorListRow,
  requestedPartner: AdminBooking['preferredProvider'] | AdminBooking['selectedProvider'] | null,
) {
  if (row.preferredPartnerLabel !== 'none') {
    return row.preferredPartnerLabel;
  }
  if (requestedPartner) {
    return providerTableLabel(requestedPartner);
  }
  return 'Open marketplace';
}

function requestedPartnerHint(row: BookingMonitorListRow) {
  if (row.preferredPartnerLabel !== 'none') {
    return row.firstPickPhoneLabel.replace(/^First-pick phone\s+/i, '').trim();
  }
  if (row.finalPartnerLabel) {
    return `Final Partner: ${row.finalPartnerLabel}`;
  }
  return 'Open marketplace request';
}

function bookingParticipantRows(booking: AdminBooking) {
  return (booking.participants ?? []).map((participant) => ({
    avatarStatus: bookingParticipantAvatarStatus(booking, participant),
    id: participant.id,
    partnerHref: bookingPartnerHref(participant.providerProfile?.id ?? participant.providerProfileId),
    partnerLabel: providerTableLabel(participant.providerProfile),
    status: participant.status,
  }));
}

function bookingCustomerAvatarStatus(booking: AdminBooking): AdminAvatarStatus {
  const user = booking.customerProfile?.user as BookingCustomerUserLike;

  return adminAvatarStatusFromSignals({
    devices: user?.pushDevices,
    matching: BOOKING_MATCHING_AVATAR_STATUSES.has(booking.status),
    sessions: user?.appSessions,
    working: BOOKING_WORKING_AVATAR_STATUSES.has(booking.status),
  });
}

function bookingRequestedPartnerAvatarStatus(
  booking: AdminBooking,
  partner: BookingProviderLike,
): AdminAvatarStatus {
  const selectedPartnerId = booking.selectedProvider?.id ?? booking.selectedProviderId ?? null;
  const partnerId = partner?.id ?? null;

  return adminAvatarStatusFromSignals({
    devices: partner?.devices ?? partner?.user?.pushDevices,
    fallbackOnline: Boolean(partner?.status?.startsWith('ONLINE')),
    matching: BOOKING_MATCHING_AVATAR_STATUSES.has(booking.status) && Boolean(partnerId),
    sessions: partner?.sessions ?? partner?.user?.appSessions,
    working:
      BOOKING_WORKING_AVATAR_STATUSES.has(booking.status) &&
      Boolean(partnerId) &&
      partnerId === selectedPartnerId,
  });
}

function bookingParticipantAvatarStatus(
  booking: AdminBooking,
  participant: NonNullable<AdminBooking['participants']>[number],
): AdminAvatarStatus {
  const provider = participant.providerProfile as BookingProviderLike;
  const selectedPartnerId = booking.selectedProvider?.id ?? booking.selectedProviderId ?? null;
  const participantPartnerId = participant.providerProfile?.id ?? participant.providerProfileId ?? null;

  return adminAvatarStatusFromSignals({
    devices: provider?.devices ?? provider?.user?.pushDevices,
    fallbackOnline: Boolean(provider?.status?.startsWith('ONLINE')),
    matching: BOOKING_MATCHING_AVATAR_STATUSES.has(booking.status),
    sessions: provider?.sessions ?? provider?.user?.appSessions,
    working:
      BOOKING_WORKING_AVATAR_STATUSES.has(booking.status) &&
      Boolean(participantPartnerId) &&
      participantPartnerId === selectedPartnerId,
  });
}

function bookingDeviceLanguageLabel(booking: AdminBooking) {
  const sessionLanguage = booking.customerProfile?.user?.appSessions?.[0]?.deviceLanguage;
  if (sessionLanguage) {
    return sessionLanguage;
  }

  const metadata = readPlainRecord(booking.metadata);
  const metadataLanguage =
    metadataText(metadata, 'deviceLanguage') ??
    metadataText(metadata, 'customerDeviceLanguage') ??
    metadataText(metadata, 'language') ??
    metadataText(metadata, 'locale');

  return metadataLanguage ?? 'Unknown';
}

function bookingCountryDisplay(label: string) {
  const sourceLabel = label.trim();
  const region = bookingCountryRegion(sourceLabel);
  const fullLabel = region ? bookingCountryName(region) : 'Unknown country';

  return {
    flag: region ? countryFlagFromRegion(region) : null,
    flagLabel: region ? `${fullLabel} flag` : 'Unknown country',
    fullLabel,
    shortLabel: compactTableLabel(fullLabel),
  } as const;
}

function bookingCountryRegion(label: string) {
  if (!label || label === 'Unknown') {
    return null;
  }

  const normalized = label.replace(/_/g, '-').trim();
  const parts = normalized.split('-').filter(Boolean);
  const lastPart = parts.at(-1);

  if (lastPart && /^[a-z]{2}$/i.test(lastPart) && parts.length > 1) {
    return lastPart.toUpperCase();
  }

  if (/^[a-z]{2}$/i.test(normalized) && normalized.toLowerCase() === 'vi') {
    return 'VN';
  }

  return null;
}

function bookingCountryName(region: string) {
  const countryNames: Record<string, string> = {
    CN: 'China',
    JP: 'Japan',
    KR: 'South Korea',
    SG: 'Singapore',
    VN: 'Vietnam',
  };

  return countryNames[region] ?? displayRegionName(region);
}

function displayRegionName(region: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(region) ?? region;
  } catch {
    return region;
  }
}

function countryFlagFromRegion(region: string) {
  if (!/^[A-Z]{2}$/.test(region)) {
    return null;
  }

  return String.fromCodePoint(...region.split('').map((letter) => 127397 + letter.charCodeAt(0)));
}

function bookingAddressDisplay(booking: AdminBooking) {
  const apiAddress = metadataText({ serviceAddressText: booking.serviceAddressText }, 'serviceAddressText');
  const legacyAddress = readAddressText(booking.address);
  const snapshotAddress =
    readAddressText(booking.addressSnapshot?.addressText) ??
    readAddressText(booking.addressSnapshot?.address) ??
    readAddressText(booking.addressSnapshot);
  const sourceLabel = apiAddress ?? legacyAddress ?? snapshotAddress ?? 'Service address missing';
  const displayLabel =
    sourceLabel === 'Service address missing' ? sourceLabel : serviceAddressAreaLabel(sourceLabel);

  return {
    fullLabel: displayLabel,
    shortLabel: compactTableLabel(displayLabel),
    tone: sourceLabel === 'Service address missing' ? 'pill-warn' : 'pill-neutral',
  } as const;
}

function bookingServiceDisplay(label: string) {
  const fullLabel = label.trim() || 'Service pending';

  return {
    fullLabel,
    shortLabel: compactTableLabel(fullLabel),
  } as const;
}

function compactTableLabel(value: string) {
  return value.length > 58 ? `${value.slice(0, 55)}...` : value;
}

function bookingCancellationReviewSignal(booking: AdminBooking) {
  if (booking.status !== 'CANCELLED' && booking.status !== 'NO_SHOW') {
    return null;
  }

  const hasClosureTime = Boolean(booking.closedAt);
  const hasClosureActor = Boolean(booking.closedByRole?.trim());
  const hasClosureReason = Boolean(booking.closedReason?.trim());

  if (hasClosureTime && hasClosureActor && hasClosureReason) {
    return {
      label: booking.closedByRole?.toUpperCase() === 'ADMIN' ? 'Admin confirmed' : 'Closure confirmed',
      tone: 'pill-success',
    };
  }

  if (hasClosureTime) {
    return {
      label: 'Needs closure detail',
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-warn',
    };
  }

  return {
    label: 'Evidence missing',
    tone: 'pill-danger',
  };
}

function bookingChatSenderRole(roles?: readonly string[]) {
  if (roles?.includes('CUSTOMER')) {
    return 'Customer';
  }
  if (roles?.includes('PROVIDER')) {
    return 'Partner';
  }
  if (roles?.includes('ADMIN')) {
    return 'Admin';
  }
  return 'User';
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildBookingTableGroups(
  rows: readonly BookingMonitorListRow[],
  visibleGroupKeys?: readonly BookingTableGroupKey[],
): readonly BookingTableGroup[] {
  const visibleKeySet = visibleGroupKeys ? new Set(visibleGroupKeys) : null;

  return BOOKING_TABLE_GROUPS.filter((definition) => !visibleKeySet || visibleKeySet.has(definition.key)).map(
    (definition) => ({
      ...definition,
      rows: rows
        .filter((row) => bookingTableGroupKey(row.booking) === definition.key)
        .sort(compareBookingTableRows),
    }),
  );
}

function bookingPostMatchNeedsReviewMetrics(
  rows: readonly BookingMonitorListRow[],
): readonly BookingNeedsReviewMetric[] {
  const manualReviewCount = rows.filter((row) =>
    isPostMatchCancellationManualReviewRequired(row.booking),
  ).length;
  const noShowCount = rows.filter((row) => row.booking.status === 'NO_SHOW').length;
  const missingChatCount = rows.filter((row) => bookingChatMessageCount(row.booking) === 0).length;
  const feeHeldCount = rows.filter((row) => postMatchCancellationFeeState(row.booking) === 'held').length;

  return [
    {
      helper: 'Partner cancellation after 15m; confirm chat before closing.',
      label: 'Manual review',
      tone: manualReviewCount > 0 ? 'is-warn' : 'is-neutral',
      value: String(manualReviewCount),
    },
    {
      helper: 'Check Partner message and retained evidence.',
      label: 'No-show',
      tone: noShowCount > 0 ? 'is-danger' : 'is-neutral',
      value: String(noShowCount),
    },
    {
      helper: 'Open detail if no retained chat is attached.',
      label: 'Missing chat',
      tone: missingChatCount > 0 ? 'is-warn' : 'is-neutral',
      value: String(missingChatCount),
    },
    {
      helper: 'Fee deduction remains until approval.',
      label: 'Fee held',
      tone: feeHeldCount > 0 ? 'is-danger' : 'is-neutral',
      value: String(feeHeldCount),
    },
  ];
}

function bookingReviewReasonPills(booking: AdminBooking): readonly BookingReviewReasonPill[] {
  if (!isPostMatchCancellationReviewBooking(booking)) {
    return [];
  }

  const chatCount = bookingChatMessageCount(booking);
  const cancellationReason = postMatchCancellationReasonDisplay(booking);
  const reasons: BookingReviewReasonPill[] = cancellationReason
    ? [
        {
          label: cancellationReason.label,
          title: cancellationReason.title,
          tone: cancellationReason.tone,
        },
      ]
    : [];

  if (booking.status === 'NO_SHOW') {
    reasons.push({
      label: 'No-show',
      title: 'No-show review needs retained evidence.',
      tone: 'pill-warn',
    });

    if (chatCount === 0) {
      reasons.push({
        label: 'No chat',
        title: 'No retained chat messages are attached.',
        tone: 'pill-warn',
      });
    }

    return reasons;
  }

  if (!isPostMatchCancellationBooking(booking) || postMatchCancellationResolution(booking) !== 'pending') {
    return reasons;
  }

  if (isPostMatchCancellationManualReviewRequired(booking)) {
    reasons.push({
      label: 'After 15m',
      title: 'Partner cancellation happened after the 15-minute auto-approval window.',
      tone: 'pill-warn',
    });
  }

  if (postMatchCancellationFeeState(booking) === 'held') {
    reasons.push({
      label: 'Fee held',
      title: 'Partner fee deduction remains until approval.',
      tone: 'pill-danger',
    });
  }

  if (chatCount === 0) {
    reasons.push({
      label: 'No chat',
      title: 'No retained chat messages are attached.',
      tone: 'pill-warn',
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      label: 'Review',
      title: 'Retained evidence review is pending.',
      tone: 'pill-info',
    });
  }

  return reasons;
}

function compareBookingTableRows(left: BookingMonitorListRow, right: BookingMonitorListRow) {
  const stateChangedDiff =
    bookingTableStateChangedTime(right.booking) - bookingTableStateChangedTime(left.booking);
  if (stateChangedDiff !== 0) {
    return stateChangedDiff;
  }

  const requestDiff = bookingRequestTime(right.booking) - bookingRequestTime(left.booking);
  if (requestDiff !== 0) {
    return requestDiff;
  }

  return left.booking.id.localeCompare(right.booking.id);
}

function bookingTableStateChangedTime(booking: AdminBooking) {
  return safeBookingTime(booking.statusChangedAt ?? booking.updatedAt ?? booking.createdAt);
}

function bookingRequestTime(booking: AdminBooking) {
  return safeBookingTime(booking.openedAt ?? booking.createdAt ?? booking.updatedAt ?? null);
}

function safeBookingTime(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function bookingTableGroupKey(booking: AdminBooking): BookingTableGroupKey | null {
  switch (booking.status) {
    case 'CREATED':
    case 'OPEN_MATCHING':
      return 'pre-match';
    case 'MATCHED':
    case 'PROVIDER_ON_THE_WAY':
    case 'ARRIVED':
    case 'IN_SERVICE':
      return 'post-match-in-progress';
    case 'COMPLETED':
      return 'completed';
    case 'EXPIRED':
    case 'REFUNDED':
      return 'closed-records';
    case 'NO_SHOW':
      return 'post-match-cancellations-pending';
    case 'CANCELLED':
      if (!bookingHasPostMatchEvidence(booking)) {
        return 'closed-records';
      }
      return postMatchCancellationResolution(booking) === 'pending'
        ? 'post-match-cancellations-pending'
        : 'post-match-cancellations-resolved';
    default:
      return null;
  }
}

function bookingHasPostMatchEvidence(booking: AdminBooking) {
  return Boolean(booking.matchedAt || booking.selectedProviderId || booking.selectedProvider);
}

function bookingCustomerHref(booking: AdminBooking) {
  const customerId = booking.customerProfile?.id ?? booking.customerProfileId;
  return customerId ? `/customers/${customerId}` : null;
}

function bookingCustomerLabel(booking: AdminBooking) {
  return booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
}

function bookingPartnerHref(partnerId?: string | null) {
  return partnerId ? `/partners/${partnerId}` : null;
}

function providerTableLabel(provider: BookingProviderLike) {
  return provider?.displayName ?? provider?.user?.fullName ?? provider?.user?.phone ?? 'Partner';
}
