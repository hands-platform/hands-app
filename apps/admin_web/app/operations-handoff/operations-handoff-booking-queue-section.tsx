import { ClipboardList, ExternalLink, MessageSquare } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTableSection } from '../../components/admin-table-panel';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { formatRelativeTime, shortDisplayId } from '../../lib/admin-format';
import type { BookingHandoffQueueRow } from './operations-handoff-booking-queue';
import {
  OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
  OperationsHandoffPaginationFooter,
  operationsHandoffServerPageWindow,
  type OperationsHandoffPagination,
} from './operations-handoff-pagination';

type OperationsHandoffBookingQueueSectionProps = {
  readonly bookings: readonly BookingHandoffQueueRow[];
  readonly pagination: OperationsHandoffPagination;
};

const BOOKING_HANDOFF_QUEUE_HEADERS = [
  'Booking',
  'Customer',
  'Partner',
  'Status',
  'Payment / wallet',
  'Chat',
  'Next action',
  'Review reason',
] as const;

export function OperationsHandoffBookingQueueSection({
  bookings,
  pagination,
}: OperationsHandoffBookingQueueSectionProps) {
  const visibleBookings = bookings.slice(0, OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE);
  const pageWindow = operationsHandoffServerPageWindow(visibleBookings.length, pagination);

  return (
    <AdminTableSection
      actions={
        <div className="actions">
          <AdminFormControlLink className="button-secondary" href="/bookings?view=attention">
            <ClipboardList aria-hidden="true" size={16} />
            Booking monitor
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href="/bookings?view=chat">
            <MessageSquare aria-hidden="true" size={16} />
            Booking chats
          </AdminFormControlLink>
        </div>
      }
      className="operations-handoff-booking-queue-card admin-mb-16"
      description="Open and recently changed bookings with payment, chat, Partner, and next action."
      id="operations-handoff-booking-history"
      title="Booking history queue"
    >
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No booking history rows."
          headers={BOOKING_HANDOFF_QUEUE_HEADERS}
          rowCount={visibleBookings.length}
        >
          {visibleBookings.map((booking) => (
            <tr key={booking.id}>
              <td>
                <AdminFormControlLink
                  className="button-secondary admin-inline-action"
                  href={`/bookings/${booking.id}`}
                >
                  <ExternalLink aria-hidden="true" size={14} />
                  {shortDisplayId(booking.id)}
                </AdminFormControlLink>
                <div className="muted">{relativeTime(booking.updatedAt ?? booking.createdAt)}</div>
              </td>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar is-customer"
                  avatarStatus={booking.customerAvatarStatus}
                  className="vuexy-booking-person"
                  helper={booking.customerPhone}
                  href={booking.customerHref}
                  label={booking.customerName}
                  linkClassName="table-link"
                />
              </td>
              <td>
                <AdminPersonCell
                  avatarClassName="vuexy-booking-avatar is-partner"
                  avatarStatus={booking.partnerAvatarStatus}
                  className="vuexy-booking-person"
                  helper={booking.partnerDetail}
                  href={booking.partnerHref}
                  label={booking.partnerName}
                  linkClassName="table-link"
                />
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={booking.statusClass}>{booking.status}</StatusBadgeFromPillClass>
              </td>
              <td>
                <div>{booking.paymentLabel}</div>
                <small className="muted">{booking.walletLabel}</small>
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={booking.chatClass}>{booking.chatLabel}</StatusBadgeFromPillClass>
              </td>
              <td>{booking.nextAction}</td>
              <td>
                <small className="muted">{booking.reviewReason}</small>
              </td>
            </tr>
          ))}
        </AdminDataTable>
        <OperationsHandoffPaginationFooter
          from={pageWindow.from}
          pagination={pagination}
          to={pageWindow.to}
          totalPages={pageWindow.totalPages}
        />
      </AdminTableScroll>
    </AdminTableSection>
  );
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
