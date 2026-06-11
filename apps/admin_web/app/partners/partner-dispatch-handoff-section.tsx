import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';
import type { PartnerCommandLane } from './partner-command-center';
import type { PartnerDispatchHandoff } from './partner-dispatch-handoff';

export type PartnerDispatchHandoffSectionModel = PartnerDispatchHandoff;

type PartnerDispatchHandoffSectionProps = {
  readonly handoff: PartnerDispatchHandoffSectionModel;
};

export function PartnerDispatchHandoffSection({ handoff }: PartnerDispatchHandoffSectionProps) {
  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        actions={
          <Link className="text-link" href="/operations-policy">
            {handoff.policyLabel}
          </Link>
        }
        description={
          <>
            <span>{handoff.headline}</span>
            <br />
            <span>{handoff.detail}</span>
          </>
        }
        title="Dispatch handoff links"
      />
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
    </section>
  );
}

function partnerDashboardTone(tone: PartnerCommandLane['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'ok';
}
