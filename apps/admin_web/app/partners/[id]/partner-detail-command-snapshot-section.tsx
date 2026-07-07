import type { ReactNode } from 'react';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminSection } from '../../../components/admin-surface';
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
    <AdminSection
      bodyClassName="partner-detail-section-band-body"
      className="partner-detail-section-band admin-mb-16"
      description={
        'Filter-aware facts for this partner: completed work, retained chat, marketplace participation, finance rows, latest location, app access, and staff records.'
      }
      eyebrow="Partner facts"
      headerClassName="partner-detail-section-band-header"
      id="partner-activity-command-snapshot"
      status={<StatusBadge tone="info">{items.length} fact groups</StatusBadge>}
      title="Partner command summary"
    >
      <AdminTraceSummary
        className="partner-detail-summary-rail-grid"
        metrics={items.map((item) => ({
          detail: item.helperNode ?? item.helper,
          href: item.href,
          label: item.label,
          value: item.value,
        }))}
      />
    </AdminSection>
  );
}
