import Link from 'next/link';

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

export function PartnerDetailRecentTimelineSection({
  formatDate,
  records,
}: PartnerDetailRecentTimelineSectionProps) {
  return (
    <div className="card" id="partner-recent-operations-timeline" style={{ marginBottom: 16 }}>
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
      <div className="setup-stage-list" style={{ marginTop: 12 }}>
        {records.length ? (
          records.slice(0, 8).map((record, index) => (
            <div
              className="setup-stage-item"
              key={`recent-${record.type}-${record.id}-${record.at}-${index}`}
            >
              <span>{record.type}</span>
              <div>
                <Link className="text-link" href={record.href}>
                  <strong>{record.title}</strong>
                </Link>
                <p className="muted">{record.detail}</p>
              </div>
              <small>{formatDate(record.at)}</small>
            </div>
          ))
        ) : (
          <div className="setup-stage-item">
            <span>NONE</span>
            <div>
              <strong>No partner event matched this filter</strong>
              <p className="muted">Clear the date filter or choose a wider period.</p>
            </div>
            <small>0</small>
          </div>
        )}
      </div>
    </div>
  );
}
