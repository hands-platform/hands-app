import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
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
      <div className="service-trace-summary admin-mt-14">
        {handoff.links.map((item) => (
          <Link
            className={`ops-task-breakdown-item ops-task-breakdown-${partnerDashboardTone(item.tone)}`}
            href={item.href}
            key={item.title}
          >
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </Link>
        ))}
      </div>
    </AdminSection>
  );
}

function partnerDashboardTone(tone: PartnerCommandLane['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'ok';
}
