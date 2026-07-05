import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { DateTimeText } from '../../../components/date-time-text';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

export type PartnerDetailDailyActivityRecord = {
  readonly at: string;
  readonly detail: string;
  readonly id: string;
  readonly title: string;
  readonly type: string;
};

export type PartnerDetailDailyActivityDigestDay = {
  readonly highlights: readonly PartnerDetailDailyActivityRecord[];
  readonly key: string;
  readonly label: string;
  readonly latestAt?: string;
  readonly total: number;
  readonly typeCounts: readonly { readonly count: number; readonly type: string }[];
};

type PartnerDetailDailyActivityDigestSectionProps = {
  readonly days: readonly PartnerDetailDailyActivityDigestDay[];
};

const dailyActivityDigestHeaders = ['Day', 'Events', 'Highlights', 'Latest'];

export function PartnerDetailDailyActivityDigestSection({
  days,
}: PartnerDetailDailyActivityDigestSectionProps) {
  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Date-grouped factual partner operations records for same-shift review before reading the full event timeline."
      id="partner-daily-digest"
      resultLabel={`${days.length} day(s)`}
      title="Partner daily activity digest"
    >
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
            className={partnerDetailReviewTableClassName}
            emptyMessage={<PartnerDailyActivityDigestEmptyState />}
            headers={dailyActivityDigestHeaders}
            rowCount={days.length}
          >
            {days.map((day) => (
              <tr key={day.key}>
                <td>
                  <strong>{day.label}</strong>
                </td>
                <td>
                  <strong>{day.total} event(s)</strong>
                  <p className="muted">{day.typeCounts.map((item) => `${item.type} ${item.count}`).join(' / ')}</p>
                </td>
                <td>
                  <div className="partner-daily-highlight-list">
                    {day.highlights.map((record, index) => (
                      <div
                        className="service-matrix-cell"
                        key={`${record.type}-${record.id}-${record.at}-${index}`}
                      >
                        <strong>{record.title}</strong>
                        <small>
                          {record.type} / <DateTimeText fallback="Missing" value={record.at} />
                        </small>
                        <p className="muted admin-m-0">{record.detail}</p>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <small>
                    <DateTimeText fallback="No date" value={day.latestAt} />
                  </small>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <PartnerDetailVuexyTableFooter rowCount={days.length} />
      </div>
    </AdminFilterPanel>
  );
}

function PartnerDailyActivityDigestEmptyState() {
  return (
    <AdminEmptyState
      framed
      message="Clear the date filter or choose a wider range."
      title="No partner daily activity matched this filter"
    />
  );
}
