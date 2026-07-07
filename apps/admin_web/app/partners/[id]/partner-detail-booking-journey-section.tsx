import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { DateTimeText } from '../../../components/date-time-text';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminTextLink } from '../../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  PartnerDetailVuexyTablePanel,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerBookingJourneyRow = {
  readonly detail: string;
  readonly detailNode?: ReactNode;
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
    readonly value: ReactNode;
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
    <PartnerDetailVuexyTablePanel
      className="admin-mb-16"
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
                  <AdminTextLink href={`/bookings/${row.id}`}>
                    {row.heading}
                  </AdminTextLink>
                </td>
                <td>
                  <p className="muted">{row.detailNode ?? row.detail}</p>
                </td>
                <td>
                  <AdminFilterChipGroup ariaLabel={`${row.heading} journey steps`}>
                    {row.steps.map((step) => (
                      <StatusBadgeFromPillClass key={`${row.id}-${step.label}`} pillClass={step.tone}>
                        {step.label}: {step.value}
                      </StatusBadgeFromPillClass>
                    ))}
                  </AdminFilterChipGroup>
                </td>
                <td>
                  <small>
                    <DateTimeText fallback="No date" value={row.latestAt} />
                  </small>
                </td>
                <td>
                  <AdminFilterChipGroup ariaLabel={`${row.heading} journey links`}>
                    {row.links.map((link) => (
                      <AdminTextLink href={link.href} key={link.label}>
                        {link.label}
                      </AdminTextLink>
                    ))}
                  </AdminFilterChipGroup>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </PartnerDetailVuexyTablePanel>
  );
}

function PartnerBookingJourneyEmptyState({ detail, title }: { readonly detail: string; readonly title: string }) {
  return <AdminEmptyState framed message={detail} title={title} />;
}
