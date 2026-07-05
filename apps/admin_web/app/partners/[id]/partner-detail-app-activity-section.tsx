import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge } from '../../../components/status-badge';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerAppActivitySummaryItem = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export type PartnerAppActivityRow = {
  readonly at: string;
  readonly detail: string;
  readonly key: string;
  readonly title: string;
  readonly type: string;
};

type PartnerDetailAppActivitySectionProps = {
  readonly rows: readonly PartnerAppActivityRow[];
  readonly summary: readonly PartnerAppActivitySummaryItem[];
};

export function PartnerDetailAppActivitySection({
  rows,
  summary,
}: PartnerDetailAppActivitySectionProps) {
  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Date-ordered factual activity only: location updates, app sessions, devices, earnings, payouts, booking participation, and verification changes."
      id="app-activity"
      resultLabel={`${rows.length} event(s)`}
      title="Recent app and operations activity"
    >
      <div className="service-trace-summary admin-mt-14">
        {summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={
            <PartnerAppActivityEmptyState message="Clear the date filter or choose a wider range to review app, location, payout, and verification records." />
          }
          headers={activityHeaders}
          rowCount={rows.length}
        >
          {rows.map((record) => (
            <tr key={record.key}>
              <td>
                <StatusBadge tone="info">{record.type}</StatusBadge>
              </td>
              <td>
                <strong>{record.title}</strong>
                <p className="muted">{record.detail}</p>
              </td>
              <td>
                <span className="muted">
                  <DateTimeText fallback="Missing" value={record.at} />
                </span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={rows.length} />
    </AdminFilterPanel>
  );
}

const activityHeaders = ['Type', 'Activity', 'Timeline'] as const;

function PartnerAppActivityEmptyState({ message }: { readonly message: string }) {
  return <AdminEmptyState message={message} title="No activity matched this date filter" />;
}
