import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

export type PartnerBookingOpsLedgerRow = {
  id: string;
  relation: string;
  bookingLabel: string;
  serviceLabel: string;
  status: string;
  noteStatus: string;
  noteDetail: string;
  taskStatus: string;
  taskDetail: string;
  closeoutStatus: string;
  closeoutDetail: string;
  chatHref?: string;
};

type PartnerDetailBookingOpsLedgerSectionProps = {
  rows: PartnerBookingOpsLedgerRow[];
  statusPillClass: (status?: string) => string;
};

const PARTNER_BOOKING_OPS_LEDGER_HEADERS = [
  'Booking',
  'Relation',
  'Manual notes',
  'Staff tasks',
  'Closeout context',
  'Open',
] as const;

export function PartnerDetailBookingOpsLedgerSection({
  rows,
  statusPillClass,
}: PartnerDetailBookingOpsLedgerSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-booking-ops-ledger">
      <div className="ops-section-header">
        <div>
          <h2>Booking operations note ledger</h2>
          <p className="muted">
            Booking-level notes, manual closeout context, and staff tasks linked to this partner. This is
            factual operator history only for follow-up, settlement, and evidence review.
          </p>
        </div>
        <span className="pill pill-info">{rows.length} booking note row(s)</span>
      </div>
      <AdminTableScroll>
        <AdminDataTable emptyMessage={null} headers={PARTNER_BOOKING_OPS_LEDGER_HEADERS} rowCount={rows.length}>
          {rows.map((row) => (
            <tr key={`${row.id}-${row.relation}`}>
              <td>
                <strong>{row.bookingLabel}</strong>
                <p className="muted">{row.serviceLabel}</p>
                <span className={`pill ${statusPillClass(row.status)}`}>{row.status}</span>
              </td>
              <td>{row.relation}</td>
              <td>
                <strong>{row.noteStatus}</strong>
                <p className="muted">{row.noteDetail}</p>
              </td>
              <td>
                <strong>{row.taskStatus}</strong>
                <p className="muted">{row.taskDetail}</p>
              </td>
              <td>
                <strong>{row.closeoutStatus}</strong>
                <p className="muted">{row.closeoutDetail}</p>
              </td>
              <td>
                <Link className="text-link" href={`/bookings/${row.id}`}>
                  Booking
                </Link>
                {row.chatHref ? (
                  <Link className="text-link admin-ml-10" href={row.chatHref}>
                    Chat
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      {rows.length === 0 ? (
        <p className="muted admin-mt-12">
          No booking-level operation notes or staff tasks matched this partner date filter.
        </p>
      ) : null}
    </div>
  );
}
