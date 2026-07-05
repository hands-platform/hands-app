import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import { adminActionTitleText, marketplaceDisplayText } from '../../../lib/admin-copy';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerDetailRecentTimelineRecord = {
  readonly at: string;
  readonly detail: string;
  readonly detailNode?: ReactNode;
  readonly href: string;
  readonly id: string;
  readonly title: string;
  readonly type: string;
};

type PartnerDetailRecentTimelineSectionProps = {
  readonly records: readonly PartnerDetailRecentTimelineRecord[];
};

const recentTimelineHeaders = ['Type', 'Event', 'Detail', 'Latest'];

export function PartnerDetailRecentTimelineSection({
  records,
}: PartnerDetailRecentTimelineSectionProps) {
  const visibleRecords = records.slice(0, 8);

  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Latest factual partner events in the order operators need them: onboarding, app, location, booking, chat, finance, payout, document, tax, and staff records."
      footer={
        <Link className="text-link" href="#app-activity">
          Open full timeline
        </Link>
      }
      id="partner-recent-operations-timeline"
      resultLabel={`${records.length} event(s)`}
      title="Partner recent operations timeline"
    >
      <div className="admin-mt-12">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={<PartnerRecentTimelineEmptyState />}
            headers={recentTimelineHeaders}
            rowCount={visibleRecords.length}
          >
            {visibleRecords.map((record, index) => (
              <tr key={`recent-${record.type}-${record.id}-${record.at}-${index}`}>
                <td>
                  <StatusBadge tone="info">{record.type}</StatusBadge>
                </td>
                <td>
                  <Link className="text-link" href={record.href}>
                    {adminActionTitleText(record.title)}
                  </Link>
                </td>
                <td>
                  <p className="muted">{record.detailNode ?? marketplaceDisplayText(record.detail)}</p>
                </td>
                <td>
                  <small>
                    <DateTimeText fallback="Missing" value={record.at} />
                  </small>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
      <PartnerDetailVuexyTableFooter rowCount={visibleRecords.length} />
    </AdminFilterPanel>
  );
}

function PartnerRecentTimelineEmptyState() {
  return (
    <AdminEmptyState
      framed
      message="Clear the date filter or choose a wider period."
      title="No partner event matched this filter"
    />
  );
}
