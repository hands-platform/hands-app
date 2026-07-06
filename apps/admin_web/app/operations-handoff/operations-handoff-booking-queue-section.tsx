import { ClipboardList, ExternalLink, MessageSquare } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { AdminTableSection } from '../../components/admin-table-panel';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { formatRelativeTime, shortDisplayId } from '../../lib/admin-format';
import type { BookingHandoffQueueRow } from './operations-handoff-booking-queue';

type OperationsHandoffBookingQueueSectionProps = {
  readonly bookings: readonly BookingHandoffQueueRow[];
};

const BOOKING_HANDOFF_QUEUE_HEADERS = [
  'Booking',
  'Customer',
  'Partner',
  'Status',
  'Payment / wallet',
  'Chat',
  'Next action',
] as const;

export function OperationsHandoffBookingQueueSection({
  bookings,
}: OperationsHandoffBookingQueueSectionProps) {
  return (
    <AdminTableSection
      actions={
        <div className="actions">
          <AdminFormControlLink className="button-secondary" href="/bookings?view=attention">
            <ClipboardList aria-hidden="true" size={16} />
            Booking monitor
          </AdminFormControlLink>
          <AdminFormControlLink className="button-secondary" href="/chat-archive">
            <MessageSquare aria-hidden="true" size={16} />
            Chat archive
          </AdminFormControlLink>
        </div>
      }
      className="operations-handoff-booking-queue-card admin-mb-16"
      description="Open and recently changed bookings with payment, chat, Partner, and next action."
      title="Booking handoff queue"
    >
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No active booking handoff rows."
          headers={BOOKING_HANDOFF_QUEUE_HEADERS}
          rowCount={bookings.length}
        >
          {bookings.map((booking) => (
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
            </tr>
          ))}
        </AdminDataTable>
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
