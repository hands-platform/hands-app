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
      <div className="setup-stage-list admin-mt-16">
        {days.length ? (
          days.map((day) => (
            <div className="setup-stage-item" key={day.key}>
              <span>{day.label}</span>
              <div>
                <strong>{day.total} event(s)</strong>
                <p className="muted">{day.typeCounts.map((item) => `${item.type} ${item.count}`).join(' / ')}</p>
                <div className="setup-stage-list admin-mt-10">
                  {day.highlights.map((record, index) => (
                    <div
                      className="service-matrix-cell"
                      key={`${record.type}-${record.id}-${record.at}-${index}`}
                    >
                      <strong>{record.title}</strong>
                      <small>
                        {record.type} / {formatDate(record.at)}
                      </small>
                      <p className="muted admin-m-0">
                        {record.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <small>{day.latestAt ? formatDate(day.latestAt) : 'No date'}</small>
            </div>
          ))
        ) : (
          <div className="setup-stage-item">
            <span>NONE</span>
            <div>
              <strong>No partner daily activity matched this filter</strong>
              <p className="muted">Clear the date filter or choose a wider range.</p>
            </div>
            <small>0</small>
          </div>
        )}
      </div>
    </div>
  );
}
