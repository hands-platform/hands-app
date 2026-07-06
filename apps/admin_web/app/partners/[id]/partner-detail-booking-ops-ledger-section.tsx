import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTablePanel,
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerBookingOpsLedgerRow = {
  id: string;
  relation: string;
  bookingLabel: string;
  bookingLabelNode?: ReactNode;
  serviceLabel: string;
  status: string;
  noteStatus: string;
  noteDetail: string;
  taskStatus: string;
  taskDetail: string;
  closeoutStatus: string;
  closeoutDetail: string;
  closeoutDetailNode?: ReactNode;
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
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Booking-level notes, manual closeout context, and staff tasks linked to this partner. This is factual operator history only for follow-up, settlement, and evidence review."
      id="partner-booking-ops-ledger"
      resultLabel={`${rows.length} booking note row(s)`}
      title="Booking operations note ledger"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={null}
          headers={PARTNER_BOOKING_OPS_LEDGER_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={`${row.id}-${row.relation}`}>
              <td>
                <strong>{row.bookingLabelNode ?? row.bookingLabel}</strong>
                <p className="muted">{row.serviceLabel}</p>
                <StatusBadge tone={statusBadgeToneFromPillClass(statusPillClass(row.status))}>
                  {row.status}
                </StatusBadge>
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
                <p className="muted">{row.closeoutDetailNode ?? row.closeoutDetail}</p>
              </td>
              <td>
                <AdminTextLink href={`/bookings/${row.id}`}>
                  Booking
                </AdminTextLink>
                {row.chatHref ? (
                  <AdminTextLink className="admin-ml-10" href={row.chatHref}>
                    Chat
                  </AdminTextLink>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
      {rows.length === 0 ? (
        <p className="muted admin-mt-12">
          No booking-level operation notes or staff tasks matched this partner date filter.
        </p>
      ) : null}
    </PartnerDetailVuexyTablePanel>
  );
}
