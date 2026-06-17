import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import type { AdminBooking } from '../../lib/admin-api';
import { readPlainRecord, shortId } from '../../lib/admin-format';
import type { BookingListActionChip } from '../../lib/booking-list-action-chips';
import type { BookingListStage } from '../../lib/booking-list-stage';
import { stagePillClass } from './booking-command-display';
import { readAddressText } from './booking-address-readers';

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

type StatusBadgeProps = {
  readonly status: string;
};

type BookingTableGroupKey =
  | 'matching-waiting'
  | 'matched-in-progress'
  | 'completed'
  | 'post-match-cancellations';

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

type BookingProviderLike = {
  readonly displayName?: string | null;
  readonly user?: { readonly fullName?: string | null; readonly phone?: string };
} | null | undefined;

const BOOKING_TABLE_PAGE_SIZE = 10;
const BOOKING_TABLE_HEADERS = [
  'Request Time',
  'Customer',
  'Requested Partner',
  'Participating Partners',
  'Device Language',
  'Service Type',
  'Address',
  'Status',
] as const;

const BOOKING_TABLE_GROUPS: readonly BookingTableGroupDefinition[] = [
  {
    description: 'Requests waiting for Partner participation or matching decision.',
    emptyMessage: 'No bookings are waiting for matching.',
    key: 'matching-waiting',
    title: 'Matching Waiting',
  },
  {
    description: 'Matched bookings currently moving through dispatch and service.',
    emptyMessage: 'No matched bookings are in progress.',
    key: 'matched-in-progress',
    title: 'Matched / In Progress',
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
        {groupedRows.map((group) => (
          <BookingMonitorTableGroup
            allRowsEmpty={rows.length === 0}
            emptyMessage={emptyMessage}
            group={group}
            key={group.key}
          />
        ))}
      </div>
    </section>
  );
}

function BookingMonitorTableGroup({
  allRowsEmpty,
  emptyMessage,
  group,
}: {
  readonly allRowsEmpty: boolean;
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
          emptyMessage={allRowsEmpty ? emptyMessage : group.emptyMessage}
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
        <nav aria-label={`${group.title} pages`} className="vuexy-booking-pagination">
          <PaginationButton
            disabled={activePage <= 1}
            label="First page"
            onClick={() => setPage(1)}
          >
            <ChevronsLeft size={18} />
          </PaginationButton>
          <PaginationButton
            disabled={activePage <= 1}
            label="Previous page"
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          >
            <ChevronLeft size={18} />
          </PaginationButton>
          {visiblePageNumbers(activePage, totalPages).map((pageNumber) => (
            <PaginationButton
              active={pageNumber === activePage}
              key={pageNumber}
              label={`Page ${pageNumber}`}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </PaginationButton>
          ))}
          <PaginationButton
            disabled={activePage >= totalPages}
            label="Next page"
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
          >
            <ChevronRight size={18} />
          </PaginationButton>
          <PaginationButton
            disabled={activePage >= totalPages}
            label="Last page"
            onClick={() => setPage(totalPages)}
          >
            <ChevronsRight size={18} />
          </PaginationButton>
        </nav>
      </div>
    </section>
  );
}

function BookingMonitorListTableRow({ row }: { readonly row: BookingMonitorListRow }) {
  const { booking } = row;
  const statusState = bookingWorkflowStatusState(booking);
  const participantRows = bookingParticipantRows(booking);
  const addressLabel = bookingAddressLabel(booking);
  const requestedPartner = booking.preferredProvider ?? booking.selectedProvider ?? null;
  const requestedPartnerHref = bookingPartnerHref(
    booking.preferredProvider?.id ?? booking.preferredProviderId ?? booking.selectedProvider?.id ?? booking.selectedProviderId,
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
          <div className="vuexy-booking-participant-list">
            {participantRows.slice(0, 3).map((participant) => (
              <BookingParticipantPill key={participant.id} participant={participant} />
            ))}
            {participantRows.length > 3 && (
              <span className="pill pill-info">+{participantRows.length - 3} more</span>
            )}
          </div>
        ) : (
          <span className="muted">Waiting for Partner participation</span>
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
        <span className={`pill ${statusState.tone}`}>{statusState.label}</span>
        <div className="admin-mt-8">
          <StatusBadge status={booking.status} />
        </div>
        <Link
          className={`pill ${stagePillClass(row.stage.tone)} admin-mt-8`}
          href={row.stage.href}
          title={`${row.stage.detail} ${row.stage.action}`}
        >
          {row.stage.label}
        </Link>
        <div className="muted admin-mt-8">{statusState.detail}</div>
        {row.closureState && (
          <div className="muted admin-mt-6">Closure: {row.closureState.detail}</div>
        )}
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

function BookingParticipantPill({
  participant,
}: {
  readonly participant: BookingParticipantTableRow;
}) {
  const content = (
    <>
      <span aria-hidden="true" className="vuexy-booking-participant-avatar">
        {avatarInitials(participant.partnerLabel)}
      </span>
      <span>{participant.partnerLabel}</span>
      <span className="vuexy-booking-participant-status">{participant.status}</span>
    </>
  );

  if (!participant.partnerHref) {
    return <span className="vuexy-booking-participant-pill">{content}</span>;
  }

  return (
    <Link className="vuexy-booking-participant-pill" href={participant.partnerHref}>
      {content}
    </Link>
  );
}

function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}

function PaginationButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: {
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  const className = active ? 'vuexy-booking-page-link is-active' : 'vuexy-booking-page-link';

  return (
    <button
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className={className}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function visiblePageNumbers(activePage: number, totalPages: number) {
  const start = Math.max(1, activePage - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
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
  const snapshotAddress =
    readAddressText(booking.addressSnapshot) ??
    readAddressText(booking.addressSnapshot?.addressText ?? booking.addressSnapshot?.address);
  const legacyAddress = readAddressText(booking.address);
  return compactAddressLabel(snapshotAddress ?? legacyAddress ?? 'No address');
}

function compactAddressLabel(value: string) {
  return value.length > 54 ? `${value.slice(0, 51)}...` : value;
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
      return 'matching-waiting';
    case 'MATCHED':
    case 'PROVIDER_ON_THE_WAY':
    case 'ARRIVED':
    case 'IN_SERVICE':
      return 'matched-in-progress';
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
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}` : parts[0]?.slice(0, 2);
  return (initials || 'NA').toUpperCase();
}

function bookingWorkflowStatusState(booking: AdminBooking): {
  readonly detail: string;
  readonly label: string;
  readonly tone: string;
} {
  switch (booking.status) {
    case 'CREATED':
      return {
        detail: 'Request received; waiting for matching readiness.',
        label: 'Booking requested',
        tone: 'pill-info',
      };
    case 'OPEN_MATCHING':
      return {
        detail: 'Partner matching is open and waiting for participation or response.',
        label: 'Waiting for match',
        tone: 'pill-warn',
      };
    case 'MATCHED':
    case 'PROVIDER_ON_THE_WAY':
    case 'ARRIVED':
    case 'IN_SERVICE':
      return {
        detail: 'Matched booking is active; monitor Partner progress and chat.',
        label: 'Matched / in progress',
        tone: 'pill-success',
      };
    case 'COMPLETED':
      return {
        detail: 'Service completed; closeout evidence can be reviewed in detail.',
        label: 'Work completed',
        tone: 'pill-success',
      };
    case 'CANCELLED':
      if (booking.matchedAt || booking.selectedProviderId) {
        return {
          detail: 'Partner-side cancellation needs admin confirmation from chat and cancel note evidence.',
          label: 'Partner cancel review',
          tone: 'pill-danger',
        };
      }
      return {
        detail: 'Cancelled before matching; confirm no Partner-side service obligation exists.',
        label: 'Cancelled before match',
        tone: 'pill-neutral',
      };
    case 'NO_SHOW':
      return {
        detail: 'Review chat history and Partner no-show note before final admin confirmation.',
        label: 'No-show review',
        tone: 'pill-danger',
      };
    case 'EXPIRED':
      return {
        detail: 'Matching expired; review payment release and customer follow-up if needed.',
        label: 'Expired',
        tone: 'pill-warn',
      };
    case 'REFUNDED':
      return {
        detail: 'Refund state is recorded; confirm booking closeout evidence in detail.',
        label: 'Refunded',
        tone: 'pill-info',
      };
    default:
      return {
        detail: 'Open the booking detail for the full operating record.',
        label: booking.status,
        tone: 'pill-neutral',
      };
  }
}
