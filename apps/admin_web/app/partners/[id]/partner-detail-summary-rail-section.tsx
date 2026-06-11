import Link from 'next/link';
import type { PartnerDetailSummaryRailItem } from './partner-detail-summary-rail-model';

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
    <div className="card admin-mb-16" id={id}>
      <div className="ops-section-header">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="pill pill-info">{statusLabel}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
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
