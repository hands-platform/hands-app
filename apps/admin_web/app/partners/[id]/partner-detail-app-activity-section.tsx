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
      <div className="setup-stage-list admin-mt-16">
        {rows.length ? (
          rows.map((record) => (
            <div className="setup-stage-item" key={record.key}>
              <span>{record.type}</span>
              <div>
                <strong>{record.title}</strong>
                <p className="muted">{record.detail}</p>
              </div>
              <small>{record.atLabel}</small>
            </div>
          ))
        ) : (
          <div className="setup-stage-item">
            <span>NONE</span>
            <div>
              <strong>No activity matched this date filter</strong>
              <p className="muted">
                Clear the date filter or choose a wider range to review app, location, payout, and
                verification records.
              </p>
            </div>
            <small>0</small>
          </div>
        )}
      </div>
    </div>
  );
}
