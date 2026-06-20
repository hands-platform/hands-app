import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { adminActionTitleText, marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerDetailRecentTimelineRecord = {
  readonly at: string;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly title: string;
  readonly type: string;
};

type PartnerDetailRecentTimelineSectionProps = {
  readonly formatDate: (value: string) => string;
  readonly records: readonly PartnerDetailRecentTimelineRecord[];
};

const recentTimelineHeaders = ['Type', 'Event', 'Detail', 'Latest'];

export function PartnerDetailRecentTimelineSection({
  formatDate,
  records,
}: PartnerDetailRecentTimelineSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-recent-operations-timeline">
      <div className="ops-section-header">
        <div>
          <h2>Partner recent operations timeline</h2>
          <p className="muted">
            Latest factual partner events in the order operators need them: onboarding, app, location,
            booking, chat, finance, payout, document, tax, and staff records.
          </p>
        </div>
        <Link className="text-link" href="#app-activity">
          Open full timeline
        </Link>
      </div>
      <div className="admin-mt-12">
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={<PartnerRecentTimelineEmptyState />}
            headers={recentTimelineHeaders}
            rowCount={records.length}
          >
            {records.slice(0, 8).map((record, index) => (
              <tr key={`recent-${record.type}-${record.id}-${record.at}-${index}`}>
                <td>
                  <span className="pill pill-info">{record.type}</span>
                </td>
                <td>
                  <Link className="text-link" href={record.href}>
                    {adminActionTitleText(record.title)}
                  </Link>
                </td>
                <td>
                  <p className="muted">{marketplaceDisplayText(record.detail)}</p>
                </td>
                <td>
                  <small>{formatDate(record.at)}</small>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
    </div>
  );
}

function PartnerRecentTimelineEmptyState() {
  return (
    <div className="empty-state">
      <strong>No partner event matched this filter</strong>
      <p className="muted">Clear the date filter or choose a wider period.</p>
    </div>
  );
}
