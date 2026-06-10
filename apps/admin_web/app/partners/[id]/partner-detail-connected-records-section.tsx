import Link from 'next/link';

export type PartnerDetailConnectedRecordLink = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone: string;
  readonly value: string;
};

type PartnerDetailConnectedRecordsSectionProps = {
  readonly description: string;
  readonly id: string;
  readonly links: readonly PartnerDetailConnectedRecordLink[];
  readonly title: string;
};

export function PartnerDetailConnectedRecordsSection({
  description,
  id,
  links,
  title,
}: PartnerDetailConnectedRecordsSectionProps) {
  return (
    <div className="card" id={id} style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{links.length} links</span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {links.map((record) => (
          <div key={record.label}>
            <span>{record.label}</span>
            <strong>{record.value}</strong>
            <small>{record.detail}</small>
            <Link className={`pill ${record.tone}`} href={record.href}>
              Open
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
