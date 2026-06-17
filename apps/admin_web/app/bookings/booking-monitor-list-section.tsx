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

const BOOKING_TABLE_PAGE_SIZE = 10;

export function BookingMonitorListSection({ emptyMessage, rows }: BookingMonitorListSectionProps) {
  const [page, setPage] = useState(1);
  const rowKey = rows.map((row) => row.booking.id).join('|');
  const totalPages = Math.max(1, Math.ceil(rows.length / BOOKING_TABLE_PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const pageStartIndex = (activePage - 1) * BOOKING_TABLE_PAGE_SIZE;
  const visibleRows = useMemo(
    () => rows.slice(pageStartIndex, pageStartIndex + BOOKING_TABLE_PAGE_SIZE),
    [pageStartIndex, rows],
  );
  const pageFrom = rows.length === 0 ? 0 : pageStartIndex + 1;
  const pageTo = Math.min(rows.length, pageStartIndex + visibleRows.length);

  useEffect(() => {
    setPage(1);
  }, [rowKey]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  return (
    <section className="vuexy-booking-table-card admin-mt-16" aria-labelledby="booking-monitor-table-title">
      <div className="vuexy-booking-table-toolbar">
        <div>
          <h2 id="booking-monitor-table-title">Realtime Bookings</h2>
          <p>Request-to-completion queue ordered by live booking operations status.</p>
        </div>
        <span className="pill pill-info">{rows.length} booking(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={emptyMessage}
          headers={[
            'Request Time',
            'Customer',
            'Requested Partner',
            'Participating Partners',
            'Device Language',
            'Service Type',
            'Region',
            'Status',
          ]}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((row) => (
            <BookingMonitorListTableRow key={row.booking.id} row={row} />
          ))}
        </AdminDataTable>
      </AdminTableScroll>

      <div className="vuexy-booking-table-footer">
        <span>
          Showing {pageFrom} to {pageTo} of {rows.length} entries
        </span>
        <nav aria-label="Realtime booking pages" className="vuexy-booking-pagination">
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
  const regionLabel = bookingRegionLabel(booking);

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
        <strong>{booking.customerProfile?.user?.fullName ?? 'Customer'}</strong>
        <div className="muted">{booking.customerProfile?.user?.phone ?? 'No phone'}</div>
      </td>
      <td>
        <strong>{requestedPartnerLabel(row)}</strong>
        <div className="muted">{requestedPartnerHint(row)}</div>
      </td>
      <td>
        {participantRows.length > 0 ? (
          <div className="vuexy-booking-participant-list">
            {participantRows.slice(0, 3).map((participant) => (
              <span className="pill pill-neutral" key={participant.id}>
                {participant.label} ({participant.status})
              </span>
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
        <div className="muted">{row.servicePriceLabel}</div>
      </td>
      <td>
        <strong>{regionLabel}</strong>
        <div className="muted">{row.addressState.pin}</div>
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

function requestedPartnerLabel(row: BookingMonitorListRow) {
  return row.preferredPartnerLabel === 'none' ? 'Not selected' : row.preferredPartnerLabel;
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
    label:
      participant.providerProfile?.displayName ??
      participant.providerProfile?.user?.fullName ??
      participant.providerProfile?.user?.phone ??
      'Partner',
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

function bookingRegionLabel(booking: AdminBooking) {
  const snapshotAddress = readAddressText(booking.addressSnapshot?.addressText ?? booking.addressSnapshot?.address);
  const legacyAddress = readAddressText(booking.address);
  return compactRegionLabel(snapshotAddress ?? legacyAddress ?? 'No region');
}

function compactRegionLabel(value: string) {
  return value.length > 54 ? `${value.slice(0, 51)}...` : value;
}

function metadataText(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
