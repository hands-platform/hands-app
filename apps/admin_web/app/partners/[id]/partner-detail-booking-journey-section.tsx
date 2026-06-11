import Link from 'next/link';

export type PartnerBookingJourneyRow = {
  readonly detail: string;
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
    readonly value: string;
  }[];
};

type PartnerDetailBookingJourneySectionProps = {
  readonly description: string;
  readonly emptyDetail: string;
  readonly emptyTitle: string;
  readonly formatLatestAt: (value: string) => string;
  readonly id: string;
  readonly rows: readonly PartnerBookingJourneyRow[];
  readonly title: string;
};

export function PartnerDetailBookingJourneySection({
  description,
  emptyDetail,
  emptyTitle,
  formatLatestAt,
  id,
  rows,
  title,
}: PartnerDetailBookingJourneySectionProps) {
  return (
    <div className="card admin-mb-16" id={id}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{rows.length} journey row(s)</span>
      </div>
      <div className="setup-stage-list admin-mt-12">
        {rows.length ? (
          rows.map((row) => (
            <div className="setup-stage-item" key={`partner-journey-${row.id}-${row.relation}`}>
              <span>{row.relation}</span>
              <div>
                <Link className="text-link" href={`/bookings/${row.id}`}>
                  <strong>{row.heading}</strong>
                </Link>
                <p className="muted">{row.detail}</p>
                <div className="participant-list admin-mt-8">
                  {row.steps.map((step) => (
                    <span className={`pill ${step.tone}`} key={`${row.id}-${step.label}`}>
                      {step.label}: {step.value}
                    </span>
                  ))}
                </div>
                <div className="participant-list admin-mt-8">
                  {row.links.map((link) => (
                    <Link className="text-link" href={link.href} key={link.label}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
              <small>{row.latestAt ? formatLatestAt(row.latestAt) : 'No date'}</small>
            </div>
          ))
        ) : (
          <div className="setup-stage-item">
            <span>NONE</span>
            <div>
              <strong>{emptyTitle}</strong>
              <p className="muted">{emptyDetail}</p>
            </div>
            <small>0</small>
          </div>
        )}
      </div>
    </div>
  );
}
