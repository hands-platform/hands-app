import type { ReactNode } from 'react';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
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
        <AdminTraceSummary
          className="partner-detail-summary-rail-grid"
          metrics={items.map((item) => ({
            detail: item.helperNode ?? item.helper,
            href: item.href,
            label: item.label,
            value: item.value,
          }))}
        />
      </div>
    </section>
  );
}
