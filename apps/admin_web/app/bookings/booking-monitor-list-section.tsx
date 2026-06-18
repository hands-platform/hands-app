import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, Eye, MessageSquare, PauseCircle, X } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import {
  AdminAvatarStatusDot,
  AdminPersonCell,
  adminPersonInitials,
} from '../../components/admin-person-cell';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import {
  adminAvatarStatusFromSignals,
  type AdminAvatarPushDeviceSignal,
  type AdminAvatarSessionSignal,
  type AdminAvatarStatus,
} from '../../lib/admin-avatar-status';
import type { AdminBooking } from '../../lib/admin-api';
import { readPlainRecord, shortId } from '../../lib/admin-format';
import type { BookingListActionChip } from '../../lib/booking-list-action-chips';
import type { BookingListStage } from '../../lib/booking-list-stage';
import { approvePostMatchCancellation, holdPostMatchCancellation } from './actions';
import { readAddressText } from './booking-address-readers';
import { formatBookingDate } from './booking-list-time';
import {
  isPostMatchCancellationAutoApprovalEligible,
  isPostMatchCancellationBooking,
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
};

type BookingTableGroupKey = 'pre-match' | 'post-match-in-progress' | 'completed' | 'post-match-cancellations';

type BookingTableGroupDefinition = {
  readonly description: string;
  readonly emptyMessage: string;
  readonly key: BookingTableGroupKey;
  readonly title: string;
};

type BookingTableGroup = BookingTableGroupDefinition & {
  readonly rows: readonly BookingMonitorListRow[];
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

type BookingChatMessage = NonNullable<NonNullable<AdminBooking['chatRoom']>['messages']>[number];

const BOOKING_TABLE_PAGE_SIZE = 10;
const BOOKING_TABLE_HEADERS = [
  'Request Time',
  'Customer',
  'Requested Partner',
  'Participating Partners',
  'Device Language',
  'Service Type',
  'Address',
  'State Changed',
  'Actions',
] as const;

const BOOKING_TABLE_GROUPS: readonly BookingTableGroupDefinition[] = [
  {
    description: 'Requests before final Partner matching.',
    emptyMessage: 'No pre-match bookings are waiting.',
    key: 'pre-match',
    title: 'Pre-match',
  },
  {
    description: 'Matched bookings currently moving through dispatch and service.',
    emptyMessage: 'No post-match bookings are in progress.',
    key: 'post-match-in-progress',
    title: 'Post-match / In Progress',
  },
  {
    description: 'Completed bookings ready for normal closeout review.',
    emptyMessage: 'No completed bookings in this result set.',
    key: 'completed',
    title: 'Completed',
  },
  {
    description: 'Partner-side cancellations and no-show reviews after matching.',
    emptyMessage: 'No post-match cancellations in this result set.',
    key: 'post-match-cancellations',
    title: 'Post-match Cancellations',
  },
];

const BOOKING_MATCHING_AVATAR_STATUSES = new Set<string>(['CREATED', 'OPEN_MATCHING']);
const BOOKING_WORKING_AVATAR_STATUSES = new Set<string>([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

export function BookingMonitorListSection({ emptyMessage, rows }: BookingMonitorListSectionProps) {
  const groupedRows = useMemo(() => buildBookingTableGroups(rows), [rows]);
  const visibleBookingCount = groupedRows.reduce((count, group) => count + group.rows.length, 0);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);
  const activeChatRow = useMemo(
    () => rows.find((row) => row.booking.id === chatBookingId) ?? null,
    [chatBookingId, rows],
  );

  return (
    <section className="vuexy-booking-table-card admin-mt-16" aria-labelledby="booking-monitor-table-title">
      <div className="vuexy-booking-table-toolbar">
        <div>
          <h2 id="booking-monitor-table-title">Realtime Bookings</h2>
          <p>
            Grouped by operating state; filters can leave a table empty, and pre-match cancellations are
            omitted from this queue.
          </p>
        </div>
        <span className="pill pill-info">
          {visibleBookingCount} shown / {rows.length} loaded
        </span>
      </div>

      <div className="vuexy-booking-table-groups">
        {rows.length === 0 && <p className="vuexy-booking-table-empty-hint">{emptyMessage}</p>}
        {groupedRows.map((group) => (
          <BookingMonitorTableGroup group={group} key={group.key} onOpenChat={setChatBookingId} />
        ))}
      </div>
      {activeChatRow && (
        <BookingPostMatchCancellationChatLayer onClose={() => setChatBookingId(null)} row={activeChatRow} />
      )}
    </section>
  );
}

function BookingMonitorTableGroup({
  group,
  onOpenChat,
}: {
  readonly group: BookingTableGroup;
  readonly onOpenChat: (bookingId: string) => void;
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
  const pageFrom = group.rows.length === 0 ? 0 : pageStartIndex + 1;
  const pageTo = Math.min(group.rows.length, pageStartIndex + visibleRows.length);

  useEffect(() => {
    setPage(1);
  }, [rowKey]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  return (
    <section className="vuexy-booking-table-group" aria-labelledby={`booking-table-${group.key}`}>
      <div className="vuexy-booking-table-group-header">
        <div>
          <h3 id={`booking-table-${group.key}`}>{group.title}</h3>
          <p>{group.description}</p>
        </div>
        <span className="pill pill-neutral">{group.rows.length} booking(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={group.emptyMessage}
          headers={BOOKING_TABLE_HEADERS}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((row) => (
            <BookingMonitorListTableRow key={row.booking.id} onOpenChat={onOpenChat} row={row} />
          ))}
        </AdminDataTable>
      </AdminTableScroll>

      <div className="vuexy-booking-table-footer">
        <span>
          Showing {pageFrom} to {pageTo} of {group.rows.length} entries
        </span>
        <AdminRoundedPagination
          activePage={activePage}
          ariaLabel={`${group.title} pages`}
          className="vuexy-booking-pagination"
          onPageChange={setPage}
          pageLinkClassName="vuexy-booking-page-link"
          totalPages={totalPages}
        />
      </div>
    </section>
  );
}

function BookingMonitorListTableRow({
  onOpenChat,
  row,
}: {
  readonly onOpenChat: (bookingId: string) => void;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const participantRows = bookingParticipantRows(booking);
  const addressDisplay = bookingAddressDisplay(booking);
  const deviceLanguageDisplay = bookingDeviceLanguageDisplay(bookingDeviceLanguageLabel(booking));
  const serviceDisplay = bookingServiceDisplay(row.serviceOptionLabel);
  const stateChange = bookingStatusChangeState(booking);
  const cancellationReviewSignal = bookingCancellationReviewSignal(booking);
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
          <Link className="text-link" href={`/bookings/${booking.id}`} title="Open booking detail">
            <Eye aria-hidden="true" size={14} />
            {shortId(booking.id)}
          </Link>
        </div>
        <strong>{row.openedDateLabel}</strong>
        <div className="muted">{row.recencyLabel}</div>
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
          <span className="muted">No Partner joined yet</span>
        )}
      </td>
      <td>
        <BookingDeviceLanguageCell language={deviceLanguageDisplay} />
      </td>
      <td>
        <BookingServiceCell service={serviceDisplay} />
      </td>
      <td>
        <BookingAddressCell address={addressDisplay} />
      </td>
      <td>
        <BookingStateChangedCell
          cancellationReviewSignal={cancellationReviewSignal}
          closureState={row.closureState}
          stateChange={stateChange}
        />
      </td>
      <td>
        <BookingPostMatchCancellationActionsCell onOpenChat={onOpenChat} row={row} />
      </td>
    </tr>
  );
}

function BookingPostMatchCancellationActionsCell({
  onOpenChat,
  row,
}: {
  readonly onOpenChat: (bookingId: string) => void;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const isCancellation = isPostMatchCancellationBooking(booking);
  const chatCount = booking.chatRoom?.messages?.length ?? 0;

  if (!isCancellation) {
    return (
      <Link className="booking-action-button is-secondary" href={`/bookings/${booking.id}`}>
        <Eye aria-hidden="true" size={14} />
        Detail
      </Link>
    );
  }

  const resolution = postMatchCancellationResolution(booking);
  const feeState = postMatchCancellationFeeState(booking);
  const autoApprovalEligible = isPostMatchCancellationAutoApprovalEligible(booking);
  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);

  return (
    <div className="vuexy-booking-actions-cell">
      <button
        className="booking-action-button is-secondary"
        onClick={() => onOpenChat(booking.id)}
        type="button"
      >
        <MessageSquare aria-hidden="true" size={14} />
        Chat ({chatCount})
      </button>
      <span className={`pill ${cancellationFeeStateTone(feeState)}`}>
        {cancellationFeeStateLabel(feeState)}
      </span>
      <span className={`pill ${autoApprovalEligible ? 'pill-info' : 'pill-warn'}`}>
        {autoApprovalEligible ? 'Within 15m' : cancellationMinutesLabel(minutesAfterMatch)}
      </span>
      {resolution === 'pending' ? (
        <div className="booking-action-form-grid">
          <form action={approvePostMatchCancellation} className="booking-action-form">
            <input name="bookingId" type="hidden" value={booking.id} />
            <input
              name="note"
              type="hidden"
              value={
                autoApprovalEligible
                  ? 'Approved within 15-minute post-match cancellation window.'
                  : 'Approved after admin chat evidence review.'
              }
            />
            <button className="booking-action-button is-success" type="submit">
              <CheckCircle2 aria-hidden="true" size={14} />
              Approve
            </button>
          </form>
          <form action={holdPostMatchCancellation} className="booking-action-form">
            <input name="bookingId" type="hidden" value={booking.id} />
            <input name="note" type="hidden" value="Held after admin chat evidence review." />
            <button className="booking-action-button is-warning" type="submit">
              <PauseCircle aria-hidden="true" size={14} />
              Hold
            </button>
          </form>
        </div>
      ) : (
        <span className={`pill ${resolution === 'approved' ? 'pill-success' : 'pill-danger'}`}>
          {resolution === 'approved' ? 'Approved' : 'Held'}
        </span>
      )}
    </div>
  );
}

function BookingPostMatchCancellationChatLayer({
  onClose,
  row,
}: {
  readonly onClose: () => void;
  readonly row: BookingMonitorListRow;
}) {
  const { booking } = row;
  const messages = booking.chatRoom?.messages ?? [];
  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);
  const feeState = postMatchCancellationFeeState(booking);
  const resolution = postMatchCancellationResolution(booking);

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
            <span className="pill pill-info">Post-match cancellation evidence</span>
            <h3 id={`booking-chat-layer-title-${booking.id}`}>
              {bookingCustomerLabel(booking)} / {providerTableLabel(booking.selectedProvider)}
            </h3>
            <p>
              {cancellationMinutesLabel(minutesAfterMatch)} · {cancellationFeeStateLabel(feeState)} ·{' '}
              {cancellationResolutionLabel(resolution)}
            </p>
          </div>
          <button
            aria-label="Close chat evidence"
            className="booking-chat-close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="booking-chat-message-list">
          {messages.length > 0 ? (
            messages.map((message) => <BookingChatMessageRow key={message.id} message={message} />)
          ) : (
            <div className="booking-chat-empty">No retained chat messages for this booking.</div>
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
    <article className="booking-chat-message">
      <div className="booking-chat-message-meta">
        <strong>{senderName}</strong>
        <span className="pill pill-neutral">{senderRole}</span>
        <time>{formatBookingDate(message.createdAt)}</time>
      </div>
      <p>{message.body || 'No message body retained.'}</p>
    </article>
  );
}

function BookingStateChangedCell({
  cancellationReviewSignal,
  closureState,
  stateChange,
}: {
  readonly cancellationReviewSignal: { readonly label: string; readonly tone: string } | null;
  readonly closureState: BookingMonitorPillDetail | null;
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
            <span className={`pill ${closureState.tone}`}>{closureState.label}</span>
            {cancellationReviewSignal && (
              <span className={`pill ${cancellationReviewSignal.tone}`}>
                {cancellationReviewSignal.label}
              </span>
            )}
          </div>
          <div className="muted">{closureState.detail}</div>
        </div>
      )}
    </BookingCompactCell>
  );
}

function BookingDeviceLanguageCell({
  language,
}: {
  readonly language: {
    readonly fullLabel: string;
    readonly shortLabel: string;
  };
}) {
  return (
    <BookingCompactCell
      ariaPrefix="Device language"
      className="vuexy-booking-language-cell"
      fullLabel={language.fullLabel}
      shortLabel={language.shortLabel}
    />
  );
}

function BookingServiceCell({
  service,
}: {
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
    />
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
      {address.tone === 'pill-warn' && <span className="pill pill-warn">Address missing</span>}
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
    <div className="vuexy-booking-participants" aria-label={`${participants.length} participating Partners`}>
      <div className="vuexy-booking-avatar-group">
        {participants.slice(0, 4).map((participant) => (
          <BookingParticipantAvatar key={participant.id} participant={participant} />
        ))}
        {participants.length > 4 && (
          <span className="vuexy-booking-avatar-group-item is-overflow">+{participants.length - 4}</span>
        )}
      </div>
      <span className="vuexy-booking-participant-count">{participants.length} participating</span>
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
  if (row.finalPartnerLabel) {
    return `Final Partner: ${row.finalPartnerLabel}`;
  }
  if (row.preferredPartnerLabel !== 'none') {
    return row.firstPickPhoneLabel;
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

function bookingDeviceLanguageDisplay(label: string) {
  const fullLabel = label.trim() || 'Unknown';

  return {
    fullLabel,
    shortLabel: compactTableLabel(fullLabel),
  } as const;
}

function bookingAddressDisplay(booking: AdminBooking) {
  const apiAddress = metadataText({ serviceAddressText: booking.serviceAddressText }, 'serviceAddressText');
  const legacyAddress = readAddressText(booking.address);
  const snapshotAddress =
    readAddressText(booking.addressSnapshot?.addressText) ??
    readAddressText(booking.addressSnapshot?.address) ??
    readAddressText(booking.addressSnapshot);
  const fullLabel = apiAddress ?? legacyAddress ?? snapshotAddress ?? 'No address';

  return {
    fullLabel,
    shortLabel: compactTableLabel(fullLabel),
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

function cancellationFeeStateTone(feeState: ReturnType<typeof postMatchCancellationFeeState>) {
  switch (feeState) {
    case 'restored':
      return 'pill-success';
    case 'held':
      return 'pill-danger';
    default:
      return 'pill-neutral';
  }
}

function cancellationFeeStateLabel(feeState: ReturnType<typeof postMatchCancellationFeeState>) {
  switch (feeState) {
    case 'restored':
      return 'Fee restored';
    case 'held':
      return 'Fee held';
    default:
      return 'No earning';
  }
}

function cancellationMinutesLabel(minutesAfterMatch: number | null) {
  if (minutesAfterMatch === null) {
    return 'Match time missing';
  }
  return `${minutesAfterMatch}m after match`;
}

function cancellationResolutionLabel(resolution: ReturnType<typeof postMatchCancellationResolution>) {
  switch (resolution) {
    case 'approved':
      return 'Approved';
    case 'held':
      return 'Held';
    default:
      return 'Pending admin decision';
  }
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildBookingTableGroups(rows: readonly BookingMonitorListRow[]): readonly BookingTableGroup[] {
  return BOOKING_TABLE_GROUPS.map((definition) => ({
    ...definition,
    rows: rows
      .filter((row) => bookingTableGroupKey(row.booking) === definition.key)
      .sort(compareBookingTableRows),
  }));
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
      return 'post-match-cancellations';
    case 'CANCELLED':
      return bookingHasPostMatchEvidence(booking) ? 'post-match-cancellations' : null;
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
