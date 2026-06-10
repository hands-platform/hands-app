import Link from 'next/link';

export type PartnerOperationsDigestRow = {
  readonly detail: string;
  readonly evidence: readonly string[];
  readonly href: string;
  readonly lane: string;
  readonly latestAt?: string;
  readonly status: string;
  readonly tone: string;
};

type PartnerDetailOperationsDigestSectionProps = {
  readonly description: string;
  readonly formatLatestAt: (value: string) => string;
  readonly id: string;
  readonly rows: readonly PartnerOperationsDigestRow[];
  readonly title: string;
};

export function PartnerDetailOperationsDigestSection({
  description,
  formatLatestAt,
  id,
  rows,
  title,
}: PartnerDetailOperationsDigestSectionProps) {
  return (
    <div className="card" id={id} style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{rows.length} lanes</span>
      </div>
      <div className="setup-stage-list" style={{ marginTop: 12 }}>
        {rows.map((row) => (
          <div className="setup-stage-item" key={row.lane}>
            <span>{row.lane}</span>
            <div>
              <Link className="text-link" href={row.href}>
                <strong>{row.status}</strong>
              </Link>
              <p className="muted">{row.detail}</p>
              <div className="participant-list" style={{ marginTop: 8 }}>
                {row.evidence.map((item) => (
                  <span className={`pill ${row.tone}`} key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <small>{row.latestAt ? formatLatestAt(row.latestAt) : 'No date'}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
