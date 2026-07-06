import type { ReactNode } from 'react';

import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminCard } from '../../../components/admin-surface';
import { StatusBadge } from '../../../components/status-badge';

export type PartnerMasterFact = {
  readonly helper: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
  readonly valueDateTimeFallback?: string;
  readonly valueDateTimeValue?: string | null;
};

type PartnerDetailMasterFactsSectionProps = {
  readonly facts: readonly PartnerMasterFact[];
};

export function PartnerDetailMasterFactsSection({ facts }: PartnerDetailMasterFactsSectionProps) {
  return (
    <AdminCard className="admin-mb-16" id="partner-master-facts">
      <AdminSectionHeader
        actions={<StatusBadge tone="info">{facts.length} field(s)</StatusBadge>}
        description="Single-page operating sheet for identity, verification, service, booking, revenue, tax, location, review, and account facts."
        title="Partner master facts"
      />
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={facts.map((fact) => ({
          detail: fact.helper,
          label: fact.label,
          value: fact.value,
          valueDateTimeFallback: fact.valueDateTimeFallback,
          valueDateTimeValue: fact.valueDateTimeValue,
        }))}
      />
    </AdminCard>
  );
}
