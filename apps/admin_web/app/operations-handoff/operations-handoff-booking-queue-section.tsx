import Link from 'next/link';
import { ClipboardList, ExternalLink, MessageSquare } from 'lucide-react';
import { AdminDataTable } from '../../components/admin-data-table';
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
    <section className="card admin-mb-16">
      <div className="toolbar">
        <div>
          <h2>Booking handoff queue</h2>
          <p className="muted">
            Open and recently changed bookings with payment, chat, Partner, and next action.
          </p>
        </div>
        <div className="actions">
          <Link className="button button-secondary" href="/bookings?view=attention">
            <ClipboardList aria-hidden="true" size={16} />
            Booking monitor
          </Link>
          <Link className="button button-secondary" href="/chat-archive">
            <MessageSquare aria-hidden="true" size={16} />
            Chat archive
          </Link>
        </div>
      </div>
      <div className="admin-table-scroll">
        <AdminDataTable
          emptyMessage="No active booking handoff rows."
          headers={BOOKING_HANDOFF_QUEUE_HEADERS}
          rowCount={bookings.length}
        >
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td>
                <Link className="button button-secondary admin-inline-action" href={`/bookings/${booking.id}`}>
                  <ExternalLink aria-hidden="true" size={14} />
                  {shortDisplayId(booking.id)}
                </Link>
                <div className="muted">{relativeTime(booking.updatedAt ?? booking.createdAt)}</div>
              </td>
              <td>
                <div>{booking.customerName}</div>
                <small className="muted">{booking.customerPhone}</small>
              </td>
              <td>
                <div>{booking.partnerName}</div>
                <small className="muted">{booking.partnerDetail}</small>
              </td>
              <td>
                <span className={booking.statusClass}>{booking.status}</span>
              </td>
              <td>
                <div>{booking.paymentLabel}</div>
                <small className="muted">{booking.walletLabel}</small>
              </td>
              <td>
                <span className={booking.chatClass}>{booking.chatLabel}</span>
              </td>
              <td>{booking.nextAction}</td>
            </tr>
          ))}
        </AdminDataTable>
      </div>
    </section>
  );
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
