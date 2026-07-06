import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye, X } from 'lucide-react';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlButton } from '../../components/admin-form-controls';
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
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import {
  adminAvatarStatusFromSignals,
  type AdminAvatarPushDeviceSignal,
  type AdminAvatarSessionSignal,
  type AdminAvatarStatus,
} from '../../lib/admin-avatar-status';
import type { AdminBooking, AdminChatMessage } from '../../lib/admin-api';
import { readPlainRecord, shortId } from '../../lib/admin-format';
import type { BookingListActionChip } from '../../lib/booking-list-action-chips';
import type { BookingListStage } from '../../lib/booking-list-stage';
import { readAddressText, serviceAddressAreaLabel } from './booking-address-readers';
import { bookingChatMessageCount } from './booking-chat-message-count';
import { formatBookingDate } from './booking-list-time';
import {
  bookingPostMatchChatEvidenceRows,
  bookingPostMatchEvidenceLabel,
} from './booking-post-match-chat-evidence';
import {
  postMatchCancellationFeeStateLabel,
  postMatchCancellationMinutesLabel,
  postMatchCancellationResolutionLabel,
} from './booking-post-match-cancellation-display';
import {
  isPostMatchCancellationAutoApproved,
  isPostMatchCancellationBooking,
  isPostMatchCancellationManualReviewRequired,
  isPostMatchCancellationReviewBooking,
  postMatchCancellationFeeState,
  postMatchCancellationMinutesAfterMatch,
  postMatchCancellationResolution,
} from './booking-post-match-cancellations-model';

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
  readonly location: {
    readonly pillLabel: string;
    readonly signalLabel: string;
    readonly toneClass: string;
  };
  readonly matchingPolicySummaryLabel: string;
  readonly matchingRuleSnapshot: BookingMonitorMatchingRuleSnapshot;
  readonly marketplaceParticipantOverflowCount: number;
  readonly marketplaceParticipants: readonly BookingMonitorParticipantPill[];
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
  readonly recencyLabel: string;
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
  readonly rows: readonly BookingMonitorListRow[];
  readonly visibleGroupKeys?: readonly BookingTableGroupKey[];
};

export type BookingTableGroupKey =
  | 'pre-match'
  | 'post-match-in-progress'
  | 'completed'
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
  readonly tone: 'pill-danger' | 'pill-info' | 'pill-warn';
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

const BOOKING_TABLE_GROUPS: readonly BookingTableGroupDefinition[] = [
  {
    countTone: 'pill-neutral',
    description:
      'Live requests from booking submission through matching wait before final Partner assignment.',
    emptyMessage: 'No realtime bookings are waiting.',
    key: 'pre-match',
    title: 'Realtime Bookings',
  },
  {
    countTone: 'pill-info',
    description: 'Matched bookings currently moving through dispatch and service.',
    emptyMessage: 'No post-match bookings are in progress.',
    key: 'post-match-in-progress',
    title: 'Post-match / In Progress',
  },
  {
    countTone: 'pill-success',
    description: 'Completed bookings ready for normal closeout review.',
    emptyMessage: 'No completed bookings in this result set.',
    key: 'completed',
    title: 'Completed',
  },
  {
    countTone: 'pill-warn',
    description: 'Partner-side cancellations and no-show reviews still needing admin evidence review.',
    emptyMessage: 'No pending post-match cancellation reviews in this result set.',
    key: 'post-match-cancellations-pending',
    title: 'Post-match Cancellations / Needs Review',
  },
  {
    countTone: 'pill-success',
    description: 'Approved, held, or auto-approved cancellation decisions retained for audit.',
    emptyMessage: 'No resolved post-match cancellation decisions in this result set.',
    key: 'post-match-cancellations-resolved',
    title: 'Post-match Cancellations / Resolved',
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
  rows,
  visibleGroupKeys,
}: BookingMonitorListSectionProps) {
  const groupedRows = useMemo(
    () => buildBookingTableGroups(rows, visibleGroupKeys),
    [rows, visibleGroupKeys],
  );
  return (
    <>
      {groupedRows.map((group, index) => (
        <BookingMonitorTableGroup
          emptyMessage={rows.length === 0 && index === 0 ? emptyMessage : group.emptyMessage}
          group={group}
          key={group.key}
        />
      ))}
    </>
  );
}

function BookingMonitorTableGroup({
  emptyMessage,
  group,
}: {
  readonly emptyMessage: string;
  readonly group: BookingTableGroup;
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
      resultLabel={`${group.rows.length} booking(s)`}
      resultTone={bookingTableGroupResultTone(group)}
      title={group.title}
    >
      {needsReviewMetrics.length > 0 && <BookingNeedsReviewSummary metrics={needsReviewMetrics} />}
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={emptyMessage}
          headers={bookingTableHeaders(group.key)}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((row) => (
            <BookingMonitorListTableRow groupKey={group.key} key={row.booking.id} row={row} />
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
        label: metric.label,
        value: metric.value,
      }))}
    />
  );
}

function BookingMonitorListTableRow({
  groupKey,
  row,
}: {
  readonly groupKey: BookingTableGroupKey;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const participantRows = bookingParticipantRows(booking);
  const addressDisplay = bookingAddressDisplay(booking);
  const countryDisplay = bookingCountryDisplay(bookingDeviceLanguageLabel(booking));
  const serviceDisplay = bookingServiceDisplay(row.serviceOptionLabel);
  const stateChange = bookingStatusChangeState(booking);
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
          <AdminTextLink href={`/bookings/${booking.id}`} title="Open booking detail">
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
        <div className="booking-chat-evidence-grid" aria-label="Cancellation evidence snapshot">
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
        <time>{formatBookingDate(message.createdAt)}</time>
      </div>
      <p>{message.body || 'No message body retained.'}</p>
    </div>
  );
}

function BookingStateChangedCell({
  cancellationReviewSignal,
  closureState,
  reviewReasonPills,
  stateChange,
}: {
  readonly cancellationReviewSignal: { readonly label: string; readonly tone: string } | null;
  readonly closureState: BookingMonitorPillDetail | null;
  readonly reviewReasonPills: readonly BookingReviewReasonPill[];
  readonly stateChange: { readonly dateLabel: string; readonly label: string };
}) {
  return (
    <BookingCompactCell
      ariaPrefix="State changed"
      className="vuexy-booking-state-cell"
      fullLabel={stateChange.label}
      shortLabel={stateChange.label}
    >
      <div
        aria-label={`State changed at: ${stateChange.dateLabel}`}
        className="muted"
        title={stateChange.dateLabel}
      >
        {stateChange.dateLabel}
      </div>
      {closureState && (
        <div className="vuexy-booking-closure-evidence">
          <div className="vuexy-booking-closure-pills">
            <StatusBadge tone={statusBadgeToneFromPillClass(closureState.tone)}>
              {closureState.label}
            </StatusBadge>
            {cancellationReviewSignal && (
              <StatusBadge tone={statusBadgeToneFromPillClass(cancellationReviewSignal.tone)}>
                {cancellationReviewSignal.label}
              </StatusBadge>
            )}
          </div>
          <div className="muted">{closureState.detail}</div>
        </div>
      )}
      {reviewReasonPills.length > 0 && (
        <div className="vuexy-booking-review-reasons" aria-label="Cancellation review reasons">
          {reviewReasonPills.map((reason) => (
            <StatusBadge
              key={reason.label}
              tone={statusBadgeToneFromPillClass(reason.tone)}
              title={reason.title}
            >
              {reason.label}
            </StatusBadge>
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
  return (
    <BookingCompactCell
      ariaPrefix="Service address"
      className="vuexy-booking-address-cell"
      fullLabel={address.fullLabel}
      shortLabel={address.shortLabel}
    >
      {address.tone === 'pill-warn' && <StatusBadge tone="warning">Address missing</StatusBadge>}
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
    <Link aria-label={label} className={className} href={participant.partnerHref} title={label}>
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

  return String.fromCodePoint(
    ...region.split('').map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

function bookingAddressDisplay(booking: AdminBooking) {
  const apiAddress = metadataText({ serviceAddressText: booking.serviceAddressText }, 'serviceAddressText');
  const legacyAddress = readAddressText(booking.address);
  const snapshotAddress =
    readAddressText(booking.addressSnapshot?.addressText) ??
    readAddressText(booking.addressSnapshot?.address) ??
    readAddressText(booking.addressSnapshot);
  const fullLabel = apiAddress ?? legacyAddress ?? snapshotAddress ?? 'No address';
  const displayLabel = fullLabel === 'No address' ? fullLabel : serviceAddressAreaLabel(fullLabel);

  return {
    fullLabel,
    shortLabel: compactTableLabel(displayLabel),
    tone: fullLabel === 'No address' ? 'pill-warn' : 'pill-neutral',
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

function bookingStatusChangeState(booking: AdminBooking) {
  const timestamp = booking.statusChangedAt ?? bookingStatusChangedTimestamp(booking);

  return {
    dateLabel: formatBookingDate(timestamp),
    label: booking.statusChangedLabel?.trim() || bookingStatusChangedLabel(booking),
  };
}

function bookingStatusChangedTimestamp(booking: AdminBooking) {
  switch (booking.status) {
    case 'CREATED':
    case 'OPEN_MATCHING':
      return booking.openedAt ?? booking.createdAt ?? booking.updatedAt ?? null;
    case 'MATCHED':
      return booking.matchedAt ?? booking.updatedAt ?? null;
    case 'PROVIDER_ON_THE_WAY':
    case 'ARRIVED':
    case 'IN_SERVICE':
      return booking.updatedAt ?? booking.matchedAt ?? null;
    case 'COMPLETED':
    case 'CANCELLED':
    case 'NO_SHOW':
      return booking.closedAt ?? booking.updatedAt ?? null;
    case 'EXPIRED':
      return booking.closedAt ?? booking.expiresAt ?? booking.updatedAt ?? null;
    case 'REFUNDED':
      return booking.updatedAt ?? booking.closedAt ?? null;
    default:
      return booking.updatedAt ?? booking.createdAt ?? null;
  }
}

function bookingStatusChangedLabel(booking: AdminBooking) {
  switch (booking.status) {
    case 'CREATED':
      return 'Requested at';
    case 'OPEN_MATCHING':
      return 'Matching opened at';
    case 'MATCHED':
      return 'Matched at';
    case 'PROVIDER_ON_THE_WAY':
      return 'Partner on the way at';
    case 'ARRIVED':
      return 'Arrived at';
    case 'IN_SERVICE':
      return 'Service started at';
    case 'COMPLETED':
      return 'Completed at';
    case 'CANCELLED':
      return bookingHasPostMatchEvidence(booking) ? 'Partner cancelled at' : 'Cancelled at';
    case 'NO_SHOW':
      return 'No-show marked at';
    case 'EXPIRED':
      return 'Expired at';
    case 'REFUNDED':
      return 'Refunded at';
    default:
      return 'Updated at';
  }
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

  return BOOKING_TABLE_GROUPS.filter(
    (definition) => !visibleKeySet || visibleKeySet.has(definition.key),
  ).map((definition) => ({
    ...definition,
    rows: rows
      .filter((row) => bookingTableGroupKey(row.booking) === definition.key)
      .sort(compareBookingTableRows),
  }));
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
  const reasons: BookingReviewReasonPill[] = [];

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
    return [];
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
  return safeBookingTime(booking.statusChangedAt ?? bookingStatusChangedTimestamp(booking));
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
    case 'NO_SHOW':
      return 'post-match-cancellations-pending';
    case 'CANCELLED':
      if (!bookingHasPostMatchEvidence(booking)) {
        return null;
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
