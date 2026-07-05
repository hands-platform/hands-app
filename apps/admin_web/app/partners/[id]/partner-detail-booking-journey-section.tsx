import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { DateTimeText } from '../../../components/date-time-text';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerBookingJourneyRow = {
  readonly detail: string;
  readonly heading: string;
  readonly id: string;
  readonly latestAt?: string;
  readonly links: readonly {
    readonly href: string;
    readonly label: string;
  }[];
  readonly relation: string;
  readonly steps: readonly {
    readonly label: string;
    readonly tone: string;
    readonly value: string;
  }[];
};

type PartnerDetailBookingJourneySectionProps = {
  readonly description: string;
  readonly emptyDetail: string;
  readonly emptyTitle: string;
  readonly id: string;
  readonly rows: readonly PartnerBookingJourneyRow[];
  readonly title: string;
};

const bookingJourneyHeaders = ['Relation', 'Booking', 'Detail', 'Steps', 'Latest', 'Action'];

export function PartnerDetailBookingJourneySection({
  description,
  emptyDetail,
  emptyTitle,
  id,
  rows,
  title,
}: PartnerDetailBookingJourneySectionProps) {
  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description={description}
      id={id}
      resultLabel={`${rows.length} journey row(s)`}
      title={title}
    >
      <div className="admin-mt-12">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={<PartnerBookingJourneyEmptyState detail={emptyDetail} title={emptyTitle} />}
            headers={bookingJourneyHeaders}
            rowCount={rows.length}
          >
            {rows.map((row) => (
              <tr key={`partner-journey-${row.id}-${row.relation}`}>
                <td>
                  <strong>{row.relation}</strong>
                </td>
                <td>
                  <Link className="text-link" href={`/bookings/${row.id}`}>
                    {row.heading}
                  </Link>
                </td>
                <td>
                  <p className="muted">{row.detail}</p>
                </td>
                <td>
                  <div className="participant-list">
                    {row.steps.map((step) => (
                      <StatusBadge key={`${row.id}-${step.label}`} tone={statusBadgeToneFromPillClass(step.tone)}>
                        {step.label}: {step.value}
                      </StatusBadge>
                    ))}
                  </div>
                </td>
                <td>
                  <small>
                    <DateTimeText fallback="No date" value={row.latestAt} />
                  </small>
                </td>
                <td>
                  <div className="participant-list">
                    {row.links.map((link) => (
                      <Link className="text-link" href={link.href} key={link.label}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

function PartnerBookingJourneyEmptyState({ detail, title }: { readonly detail: string; readonly title: string }) {
  return <AdminEmptyState framed message={detail} title={title} />;
}
