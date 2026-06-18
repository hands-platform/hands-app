import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
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

export function BookingMonitorListSection({ emptyMessage, rows }: BookingMonitorListSectionProps) {
  const groupedRows = useMemo(() => buildBookingTableGroups(rows), [rows]);
  const visibleGroups = groupedRows.filter((group) => group.rows.length > 0);
  const visibleBookingCount = groupedRows.reduce((count, group) => count + group.rows.length, 0);

  return (
    <section className="vuexy-booking-table-card admin-mt-16" aria-labelledby="booking-monitor-table-title">
      <div className="vuexy-booking-table-toolbar">
        <div>
          <h2 id="booking-monitor-table-title">Realtime Bookings</h2>
          <p>Grouped by operating state; pre-match cancellations are omitted from this queue.</p>
        </div>
        <span className="pill pill-info">
          {visibleBookingCount} shown / {rows.length} loaded
        </span>
      </div>

      <div className="vuexy-booking-table-groups">
        {rows.length === 0 ? (
          <BookingMonitorEmptyTableState emptyMessage={emptyMessage} />
        ) : (
          visibleGroups.map((group) => <BookingMonitorTableGroup group={group} key={group.key} />)
        )}
      </div>
    </section>
  );
}

function BookingMonitorEmptyTableState({ emptyMessage }: { readonly emptyMessage: string }) {
  return (
    <section className="vuexy-booking-table-group" aria-labelledby="booking-table-empty">
      <div className="vuexy-booking-table-group-header">
        <div>
          <h3 id="booking-table-empty">No realtime bookings</h3>
          <p>Change filters or wait for new booking requests.</p>
        </div>
        <span className="pill pill-neutral">0 booking(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={emptyMessage}
          headers={BOOKING_TABLE_HEADERS}
          rowCount={0}
        >
          {null}
        </AdminDataTable>
      </AdminTableScroll>
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
  const addressLabel = bookingAddressLabel(booking);
  const stateChange = bookingStatusChangeState(booking);
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
          helper={booking.customerProfile?.user?.phone ?? 'No phone'}
          href={bookingCustomerHref(booking)}
          label={bookingCustomerLabel(booking)}
          tone="customer"
        />
      </td>
      <td>
        <BookingPersonCell
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
        <span className="pill pill-neutral">{bookingDeviceLanguageLabel(booking)}</span>
      </td>
      <td>
        <strong>{row.serviceOptionLabel}</strong>
      </td>
      <td>
        <strong>{addressLabel}</strong>
      </td>
      <td>
        <strong>{stateChange.label}</strong>
        <div className="muted admin-mt-6">{stateChange.dateLabel}</div>
        {row.closureState && <div className="muted admin-mt-6">{row.closureState.detail}</div>}
      </td>
    </tr>
  );
}

function BookingPersonCell({
  helper,
  href,
  label,
  tone,
}: {
  readonly helper: string;
  readonly href: string | null;
  readonly label: string;
  readonly tone: 'customer' | 'partner';
}) {
  const className = tone === 'partner' ? 'vuexy-booking-avatar is-partner' : 'vuexy-booking-avatar';

  return (
    <div className="vuexy-booking-person">
      <span aria-hidden="true" className={className}>
        {avatarInitials(label)}
      </span>
      <div className="vuexy-booking-person-copy">
        {href ? (
          <Link className="vuexy-booking-person-link" href={href}>
            {label}
          </Link>
        ) : (
          <strong>{label}</strong>
        )}
        <div className="muted">{helper}</div>
      </div>
    </div>
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
        {avatarInitials(participant.partnerLabel)}
      </span>
    );
  }

  return (
    <Link aria-label={label} className={className} href={participant.partnerHref} title={label}>
      {avatarInitials(participant.partnerLabel)}
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
    id: participant.id,
    partnerHref: bookingPartnerHref(participant.providerProfile?.id ?? participant.providerProfileId),
    partnerLabel: providerTableLabel(participant.providerProfile),
    status: participant.status,
  }));
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

function bookingAddressLabel(booking: AdminBooking) {
  const apiAddress = metadataText({ serviceAddressText: booking.serviceAddressText }, 'serviceAddressText');
  const snapshotAddress =
    readAddressText(booking.addressSnapshot?.addressText) ??
    readAddressText(booking.addressSnapshot?.address) ??
    readAddressText(booking.addressSnapshot);
  const legacyAddress = readAddressText(booking.address);
  return compactAddressLabel(apiAddress ?? snapshotAddress ?? legacyAddress ?? 'No address');
}

function compactAddressLabel(value: string) {
  return value.length > 72 ? `${value.slice(0, 69)}...` : value;
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

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildBookingTableGroups(rows: readonly BookingMonitorListRow[]): readonly BookingTableGroup[] {
  return BOOKING_TABLE_GROUPS.map((definition) => ({
    ...definition,
    rows: rows.filter((row) => bookingTableGroupKey(row.booking) === definition.key),
  }));
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

function avatarInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}` : parts[0]?.slice(0, 2);
  return (initials || 'NA').toUpperCase();
}
