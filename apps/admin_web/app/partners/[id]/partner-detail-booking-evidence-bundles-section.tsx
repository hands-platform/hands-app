import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerBookingEvidenceRow = {
  readonly bookingLabel: string;
  readonly bookingLabelNode?: ReactNode;
  readonly chatDetail: string;
  readonly chatHref?: string;
  readonly chatStatus: string;
  readonly customerDetail: string;
  readonly customerHref?: string;
  readonly customerStatus: string;
  readonly id: string;
  readonly moneyDetail: string;
  readonly moneyDetailNode?: ReactNode;
  readonly moneyStatus: string;
  readonly opsDetail: string;
  readonly opsDetailNode?: ReactNode;
  readonly opsStatus: string;
  readonly relation: string;
  readonly roleDetail: string;
  readonly roleStatus: string;
  readonly serviceLabel: string;
  readonly serviceLabelNode?: ReactNode;
  readonly status: string;
};

type PartnerDetailBookingEvidenceBundlesSectionProps = {
  readonly rows: readonly PartnerBookingEvidenceRow[];
  readonly statusPillClass: (status?: string) => string;
};

const PARTNER_BOOKING_EVIDENCE_HEADERS = [
  'Booking',
  'Partner role',
  'Customer and location',
  'Chat archive',
  'Money records',
  'Ops evidence',
  'Open',
] as const;

export function PartnerDetailBookingEvidenceBundlesSection({
  rows,
  statusPillClass,
}: PartnerDetailBookingEvidenceBundlesSectionProps) {
  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Booking-by-booking partner work bundle for operators. Each row connects the partner role, customer address snapshot, chat archive, payment, earning, payout/wallet records, location, and staff task records as factual history only."
      id="partner-booking-evidence-bundles"
      resultLabel={`${rows.length} booking bundle(s)`}
      title="Partner booking evidence bundles"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={null}
          headers={PARTNER_BOOKING_EVIDENCE_HEADERS}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={`${row.id}-${row.relation}`}>
              <td>
                <strong>{row.bookingLabelNode ?? row.bookingLabel}</strong>
                <p className="muted">{row.serviceLabelNode ?? row.serviceLabel}</p>
                <StatusBadge tone={statusBadgeToneFromPillClass(statusPillClass(row.status))}>
                  {row.status}
                </StatusBadge>
              </td>
              <td>
                <strong>{row.roleStatus}</strong>
                <p className="muted">{row.roleDetail}</p>
              </td>
              <td>
                <strong>{row.customerStatus}</strong>
                <p className="muted">{row.customerDetail}</p>
              </td>
              <td>
                <strong>{row.chatStatus}</strong>
                <p className="muted">{row.chatDetail}</p>
              </td>
              <td>
                <strong>{row.moneyStatus}</strong>
                <p className="muted">{row.moneyDetailNode ?? row.moneyDetail}</p>
              </td>
              <td>
                <strong>{row.opsStatus}</strong>
                <p className="muted">{row.opsDetailNode ?? row.opsDetail}</p>
              </td>
              <td>
                <Link className="text-link" href={`/bookings/${row.id}`}>
                  Booking
                </Link>
                {row.customerHref ? (
                  <Link className="text-link admin-ml-10" href={row.customerHref}>
                    Customer
                  </Link>
                ) : null}
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
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
      {rows.length === 0 ? (
        <p className="muted admin-mt-12">
          No partner booking bundle matched this date filter.
        </p>
      ) : null}
    </AdminFilterPanel>
  );
}
