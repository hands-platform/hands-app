import type { ReactNode } from 'react';
import { StatusBadge } from '../../../components/status-badge';

export type PartnerDetailCommandSnapshotItem = {
  readonly helper: string;
  readonly helperNode?: ReactNode;
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

type PartnerDetailCommandSnapshotSectionProps = {
  readonly items: readonly PartnerDetailCommandSnapshotItem[];
};

export function PartnerDetailCommandSnapshotSection({
  items,
}: PartnerDetailCommandSnapshotSectionProps) {
  return (
    <section className="partner-detail-section-band admin-mb-16" id="partner-activity-command-snapshot">
      <div className="partner-detail-section-band-header">
        <div>
          <span>Partner facts</span>
          <h2>Partner command snapshot</h2>
          <p className="muted">
            Filter-aware facts for this partner: completed work, retained chat, marketplace participation,
            finance rows, latest location, app access, and staff records.
          </p>
        </div>
        <StatusBadge tone="info">{items.length} fact groups</StatusBadge>
      </div>
      <div className="partner-detail-section-band-body">
        <div className="service-trace-summary partner-detail-summary-rail-grid">
          {items.map((item) => (
            <a href={item.href} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helperNode ?? item.helper}</small>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
