import { SlidersHorizontal } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSection } from '../../components/admin-surface';
import type { PartnerCommandLane } from './partner-command-center';
import type { PartnerDispatchHandoff } from './partner-dispatch-handoff';

export type PartnerDispatchHandoffSectionModel = PartnerDispatchHandoff;

type PartnerDispatchHandoffSectionProps = {
  readonly handoff: PartnerDispatchHandoffSectionModel;
};

export function PartnerDispatchHandoffSection({ handoff }: PartnerDispatchHandoffSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href="/operations-policy">
          <SlidersHorizontal aria-hidden="true" size={16} />
          {handoff.policyLabel}
        </AdminFormControlLink>
      }
      className="admin-mb-16 partner-dispatch-handoff-card"
      description={
        <>
          <span>{handoff.headline}</span>
          <br />
          <span>{handoff.detail}</span>
        </>
      }
      title="Dispatch handoff links"
    >
      <AdminTraceSummary
        className="admin-mt-14"
        itemClassName="ops-task-breakdown-item"
        metrics={handoff.links.map((item) => ({
          className: `ops-task-breakdown-${partnerDashboardTone(item.tone)}`,
          detail: item.detail,
          href: item.href,
          label: item.title,
          value: item.value,
        }))}
      />
    </AdminSection>
  );
}

function partnerDashboardTone(tone: PartnerCommandLane['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'ok';
}
