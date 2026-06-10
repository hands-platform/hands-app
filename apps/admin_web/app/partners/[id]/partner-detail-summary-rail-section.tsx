import Link from 'next/link';

export type PartnerDetailSummaryRailItem = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

type PartnerDetailSummaryRailSectionProps = {
  readonly description: string;
  readonly id: string;
  readonly items: readonly PartnerDetailSummaryRailItem[];
  readonly statusLabel: string;
  readonly title: string;
};

export function PartnerDetailSummaryRailSection({
  description,
  id,
  items,
  statusLabel,
  title,
}: PartnerDetailSummaryRailSectionProps) {
  return (
    <div className="card" id={id} style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{statusLabel}</span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {items.map((item) => (
          <Link href={item.href} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </div>
    </div>
  );
}
