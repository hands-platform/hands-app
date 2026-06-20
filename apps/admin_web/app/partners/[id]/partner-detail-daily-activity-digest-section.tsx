import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

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
  readonly formatDate: (value: string) => string;
};

const dailyActivityDigestHeaders = ['Day', 'Events', 'Highlights', 'Latest'];

export function PartnerDetailDailyActivityDigestSection({
  days,
  formatDate,
}: PartnerDetailDailyActivityDigestSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-daily-digest">
      <div className="ops-section-header">
        <div>
          <h2>Partner daily activity digest</h2>
          <p className="muted">
            Date-grouped factual partner operations records for same-shift review before reading the full
            event timeline.
          </p>
        </div>
        <span className="pill pill-info">{days.length} day(s)</span>
      </div>
      <div className="admin-mt-16">
        <AdminTableScroll>
          <AdminDataTable
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
                          {record.type} / {formatDate(record.at)}
                        </small>
                        <p className="muted admin-m-0">{record.detail}</p>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <small>{day.latestAt ? formatDate(day.latestAt) : 'No date'}</small>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </div>
    </div>
  );
}

function PartnerDailyActivityDigestEmptyState() {
  return (
    <div className="empty-state">
      <strong>No partner daily activity matched this filter</strong>
      <p className="muted">Clear the date filter or choose a wider range.</p>
    </div>
  );
}
