import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTablePanel,
  PartnerDetailVuexyTableFooter,
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
  'Status',
  'Partner role',
  'Amount',
  'Next action',
] as const;

export function PartnerDetailBookingEvidenceBundlesSection({
  rows,
  statusPillClass,
}: PartnerDetailBookingEvidenceBundlesSectionProps) {
  return (
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
      description="Booking-by-booking partner work bundle for operators. Each row connects the partner role, customer service address record, chat record, payment, earning, payout/wallet records, location, and staff task records as factual history only."
      id="partner-booking-evidence-bundles"
      resultLabel={`${rows.length} booking bundle(s)`}
      title="Partner booking evidence bundles"
    >
      <AdminTableScroll ariaLabel="Partner booking evidence table">
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
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={statusPillClass(row.status)}>
                  {row.status}
                </StatusBadgeFromPillClass>
              </td>
              <td>
                <strong>{row.roleStatus}</strong>
                <p className="muted">{row.roleDetail}</p>
              </td>
              <td>
                <strong>{row.moneyStatus}</strong>
                <p className="muted">{row.moneyDetailNode ?? row.moneyDetail}</p>
              </td>
              <td>
                <AdminTextLink href={`/bookings/${row.id}`}>
                  Open details
                </AdminTextLink>
                <details className="partner-booking-evidence-details">
                  <summary>Evidence summary</summary>
                  <p><strong>Customer and location:</strong> {row.customerStatus} · {row.customerDetail}</p>
                  <p><strong>Chat:</strong> {row.chatStatus} · {row.chatDetail}</p>
                  <p><strong>Operations:</strong> {row.opsStatus} · {row.opsDetailNode ?? row.opsDetail}</p>
                  {row.customerHref ? <AdminTextLink href={row.customerHref}>Open customer</AdminTextLink> : null}
                  {row.chatHref ? <AdminTextLink className="admin-ml-10" href={row.chatHref}>Open chat</AdminTextLink> : null}
                </details>
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
    </PartnerDetailVuexyTablePanel>
  );
}
