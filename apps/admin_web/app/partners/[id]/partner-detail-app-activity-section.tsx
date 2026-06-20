import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';

export type PartnerAppActivitySummaryItem = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export type PartnerAppActivityRow = {
  readonly atLabel: string;
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
    <div className="card admin-mb-16" id="app-activity">
      <div className="ops-section-header">
        <div>
          <h2>Recent app and operations activity</h2>
          <p className="muted">
            Date-ordered factual activity only: location updates, app sessions, devices, earnings, payouts,
            booking participation, and verification changes.
          </p>
        </div>
        <span className="pill pill-info">{rows.length} event(s)</span>
      </div>
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
          emptyMessage={
            <PartnerAppActivityEmptyState message="Clear the date filter or choose a wider range to review app, location, payout, and verification records." />
          }
          headers={activityHeaders}
          rowCount={rows.length}
        >
          {rows.map((record) => (
            <tr key={record.key}>
              <td>
                <span className="pill pill-info">{record.type}</span>
              </td>
              <td>
                <strong>{record.title}</strong>
                <p className="muted">{record.detail}</p>
              </td>
              <td>
                <span className="muted">{record.atLabel}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

const activityHeaders = ['Type', 'Activity', 'Timeline'] as const;

function PartnerAppActivityEmptyState({ message }: { readonly message: string }) {
  return (
    <>
      <strong>No activity matched this date filter</strong>
      <p className="muted">{message}</p>
    </>
  );
}
