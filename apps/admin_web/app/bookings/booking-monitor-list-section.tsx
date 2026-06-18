import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import {
  AdminAvatarStatusDot,
  AdminPersonCell,
  adminPersonInitials,
  type AdminAvatarStatus,
} from '../../components/admin-person-cell';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import type { AdminBooking } from '../../lib/admin-api';
import { readPlainRecord, shortId } from '../../lib/admin-format';
import type { BookingListActionChip } from '../../lib/booking-list-action-chips';
import type { BookingListStage } from '../../lib/booking-list-stage';
import { readAddressText } from './booking-address-readers';
import { formatBookingDate } from './booking-list-time';

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
      readonly displayName?: string | null;
      readonly user?: { readonly fullName?: string | null; readonly phone?: string };
    }
  | null
  | undefined;

type BookingAvatarSession = {
  readonly active?: boolean;
  readonly deviceLanguage?: string | null;
  readonly lastSeenAt?: string | null;
};

type BookingAvatarPushDelivery = {
  readonly response?: unknown;
  readonly status?: string | null;
};

type BookingAvatarPushDevice = {
  readonly deliveries?: readonly BookingAvatarPushDelivery[];
  readonly enabled?: boolean;
  readonly lastSeenAt?: string | null;
};

type BookingAvatarUserLike =
  | {
      readonly appSessions?: readonly BookingAvatarSession[];
      readonly pushDevices?: readonly BookingAvatarPushDevice[];
    }
  | null
  | undefined;

type BookingAvatarProviderLike =
  | (NonNullable<BookingProviderLike> & {
      readonly devices?: readonly BookingAvatarPushDevice[];
      readonly sessions?: readonly BookingAvatarSession[];
      readonly status?: string | null;
      readonly user?: NonNullable<NonNullable<BookingProviderLike>['user']> & {
        readonly appSessions?: readonly BookingAvatarSession[];
        readonly pushDevices?: readonly BookingAvatarPushDevice[];
      };
    })
  | null
  | undefined;

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
const BOOKING_APP_ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const BOOKING_APP_DELETE_SUSPECT_MS = 30 * 24 * 60 * 60 * 1000;

export function BookingMonitorListSection({ emptyMessage, rows }: BookingMonitorListSectionProps) {
  const groupedRows = useMemo(() => buildBookingTableGroups(rows), [rows]);
  const visibleBookingCount = groupedRows.reduce((count, group) => count + group.rows.length, 0);

  return (
    <section className="vuexy-booking-table-card admin-mt-16" aria-labelledby="booking-monitor-table-title">
      <div className="vuexy-booking-table-toolbar">
        <div>
          <h2 id="booking-monitor-table-title">Realtime Bookings</h2>
          <p>
            Grouped by operating state; filters can leave a table empty, and pre-match cancellations
            are omitted from this queue.
          </p>
        </div>
        <span className="pill pill-info">
          {visibleBookingCount} shown / {rows.length} loaded
        </span>
      </div>

      <div className="vuexy-booking-table-groups">
        {rows.length === 0 && <p className="vuexy-booking-table-empty-hint">{emptyMessage}</p>}
        {groupedRows.map((group) => (
          <BookingMonitorTableGroup group={group} key={group.key} />
        ))}
      </div>
    </section>
  );
}

function BookingMonitorTableGroup({ group }: { readonly group: BookingTableGroup }) {
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
            <BookingMonitorListTableRow key={row.booking.id} row={row} />
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

function BookingMonitorListTableRow({ row }: { readonly row: BookingMonitorListRow }) {
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
    </tr>
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
      pillLabel="State changed"
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
      pillLabel="Device language"
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
      pillLabel="Service type"
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
      pillLabel="Service address"
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
  pillLabel,
  shortLabel,
}: {
  readonly ariaPrefix: string;
  readonly children?: ReactNode;
  readonly className: string;
  readonly fullLabel: string;
  readonly pillLabel: string;
  readonly shortLabel: string;
}) {
  return (
    <div className={className}>
      <span className="pill pill-neutral">{pillLabel}</span>
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
  const user = booking.customerProfile?.user;
  if (isUserAppDeleteSuspected(user)) {
    return 'app-deleted';
  }
  if (BOOKING_MATCHING_AVATAR_STATUSES.has(booking.status)) {
    return 'matching';
  }
  if (BOOKING_WORKING_AVATAR_STATUSES.has(booking.status)) {
    return 'working';
  }
  return isUserAppOnline(user) ? 'online' : 'offline';
}

function bookingRequestedPartnerAvatarStatus(
  booking: AdminBooking,
  partner: AdminBooking['preferredProvider'] | AdminBooking['selectedProvider'] | null,
): AdminAvatarStatus {
  const selectedPartnerId = booking.selectedProvider?.id ?? booking.selectedProviderId ?? null;
  const partnerId = partner?.id ?? null;

  if (isProviderAppDeleteSuspected(partner)) {
    return 'app-deleted';
  }
  if (BOOKING_WORKING_AVATAR_STATUSES.has(booking.status) && partnerId && partnerId === selectedPartnerId) {
    return 'working';
  }
  if (BOOKING_MATCHING_AVATAR_STATUSES.has(booking.status) && partnerId) {
    return 'matching';
  }
  return isProviderAppOnline(partner) ? 'online' : 'offline';
}

function bookingParticipantAvatarStatus(
  booking: AdminBooking,
  participant: NonNullable<AdminBooking['participants']>[number],
): AdminAvatarStatus {
  const provider = participant.providerProfile;
  const selectedPartnerId = booking.selectedProvider?.id ?? booking.selectedProviderId ?? null;
  const participantPartnerId = participant.providerProfile?.id ?? participant.providerProfileId ?? null;

  if (isProviderAppDeleteSuspected(provider)) {
    return 'app-deleted';
  }
  if (
    BOOKING_WORKING_AVATAR_STATUSES.has(booking.status) &&
    participantPartnerId &&
    participantPartnerId === selectedPartnerId
  ) {
    return 'working';
  }
  if (BOOKING_MATCHING_AVATAR_STATUSES.has(booking.status)) {
    return 'matching';
  }
  return isProviderAppOnline(provider) ? 'online' : 'offline';
}

function isUserAppDeleteSuspected(user: BookingAvatarUserLike) {
  return isAppDeleteSuspected(user?.appSessions, user?.pushDevices);
}

function isProviderAppDeleteSuspected(provider: BookingAvatarProviderLike) {
  const sessions = provider?.sessions ?? provider?.user?.appSessions;
  const devices = provider?.devices ?? provider?.user?.pushDevices;
  return isAppDeleteSuspected(sessions, devices);
}

function isAppDeleteSuspected(
  sessions: readonly BookingAvatarSession[] | null | undefined,
  devices: readonly BookingAvatarPushDevice[] | null | undefined,
) {
  const latestSeenAt = latestAvatarSeenAt([...(sessions ?? []), ...(devices ?? [])]);
  if (latestSeenAt === null || Date.now() - latestSeenAt < BOOKING_APP_DELETE_SUSPECT_MS) {
    return false;
  }

  return hasDisabledPushDevice(devices) || hasFailedPushDelivery(devices);
}

function isUserAppOnline(user: BookingAvatarUserLike) {
  return hasActiveSession(user?.appSessions);
}

function isProviderAppOnline(provider: BookingAvatarProviderLike) {
  if (provider?.status?.startsWith('ONLINE')) {
    return true;
  }

  return hasActiveSession(provider?.sessions) || hasActiveSession(provider?.user?.appSessions);
}

function hasActiveSession(sessions: readonly BookingAvatarSession[] | null | undefined) {
  const now = Date.now();

  return (sessions ?? []).some((session) => {
    if (session.active === true) {
      return true;
    }
    const lastSeenAt = parseAvatarTimestamp(session.lastSeenAt);
    return lastSeenAt !== null && now - lastSeenAt <= BOOKING_APP_ACTIVE_WINDOW_MS;
  });
}

function latestAvatarSeenAt(items: readonly { readonly lastSeenAt?: string | null }[]) {
  const timestamps = items
    .map((item) => parseAvatarTimestamp(item.lastSeenAt))
    .filter((value): value is number => value !== null);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function parseAvatarTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasDisabledPushDevice(devices: readonly BookingAvatarPushDevice[] | null | undefined) {
  return (devices ?? []).some((device) => device.enabled === false);
}

function hasFailedPushDelivery(devices: readonly BookingAvatarPushDevice[] | null | undefined) {
  return (devices ?? []).some((device) => (device.deliveries ?? []).some(isFailedPushDelivery));
}

function isFailedPushDelivery(delivery: BookingAvatarPushDelivery) {
  const status = delivery.status?.trim().toUpperCase();
  if (status && !['DELIVERED', 'OK', 'SENT', 'SUCCESS'].includes(status)) {
    return true;
  }

  return pushDeliveryResponseText(delivery.response).some((text) =>
    ['APNS_AUTH_ERROR', 'INVALID_ARGUMENT', 'NOT_FOUND', 'REGISTRATION_TOKEN_NOT_REGISTERED', 'UNREGISTERED'].some(
      (needle) => text.includes(needle),
    ),
  );
}

function pushDeliveryResponseText(response: unknown) {
  if (typeof response === 'string') {
    return [response.toUpperCase()];
  }
  try {
    return [JSON.stringify(response ?? '').toUpperCase()];
  } catch {
    return [];
  }
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
