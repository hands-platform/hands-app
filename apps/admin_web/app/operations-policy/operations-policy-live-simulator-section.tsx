import { ExternalLink } from 'lucide-react';

import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../components/status-badge';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';

type LivePolicySimulator = {
  readonly ready: boolean;
  readonly metrics: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
  readonly timeline: readonly {
    readonly step: string;
    readonly title: string;
    readonly detail: string;
    readonly className: string;
    readonly tags: readonly { readonly label: string; readonly tone: string }[];
  }[];
  readonly partnerRows: readonly {
    readonly id: string;
    readonly name: string;
    readonly distanceLabel: string;
    readonly locationAgeLabel: string;
    readonly status: string;
    readonly pillClass: string;
  }[];
  readonly checks: readonly {
    readonly status: string;
    readonly title: string;
    readonly detail: string;
    readonly operatorAction: string;
    readonly className: string;
    readonly pillClass: string;
  }[];
};

type OperationsPolicyLiveSimulatorSectionProps = {
  readonly simulation: LivePolicySimulator;
};

export function OperationsPolicyLiveSimulatorSection({
  simulation,
}: OperationsPolicyLiveSimulatorSectionProps) {
  return (
    <AdminSection
      className="admin-mb-16"
      description="Uses the current policy values, the latest booking/customer coordinate, and current Partner locations to preview who would see or participate in a new direct booking request."
      statusLabel={simulation.ready ? 'Ready for dispatch check' : 'Needs better location data'}
      statusTone={simulation.ready ? 'success' : 'warning'}
      title="Live policy simulator"
    >
      <div className="service-trace-summary admin-mt-12">
        {simulation.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.helper}</small>
          </div>
        ))}
      </div>
      <div className="detail-grid admin-mt-14">
        <div className="ops-task-note">
          <h3>Simulated booking path</h3>
          <div className="timeline admin-mt-12">
            {simulation.timeline.map((step) => (
              <div className={`timeline-step ${step.className}`} key={step.title}>
                <span>{step.step}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
                <div className="participant-list">
                  {step.tags.map((tag) => (
                    <PillClassBadge pillClass={tag.tone} key={`${step.title}-${tag.label}`}>
                      {tag.label}
                    </PillClassBadge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ops-task-note">
          <div className="ops-section-header">
            <div>
              <h3>Eligible Partner preview</h3>
              <p className="muted">
                Top nearby online Partners inside the current marketplace radius. Stale locations are
                excluded from the dispatch count.
              </p>
            </div>
            <StatusBadge tone="info">{simulation.partnerRows.length} shown</StatusBadge>
          </div>
          <div className="stack admin-mt-10">
            {simulation.partnerRows.map((partner) => (
              <div className="ops-row" key={partner.id}>
                <div>
                  <AdminFormControlLink
                    className="button-secondary policy-inline-action"
                    href={`/partners/${partner.id}`}
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    {displayOperationalWording(partner.name)}
                  </AdminFormControlLink>
                  <p className="muted">
                    {partner.distanceLabel} / location {partner.locationAgeLabel}
                  </p>
                </div>
                <PillClassBadge pillClass={partner.pillClass}>{partner.status}</PillClassBadge>
              </div>
            ))}
            {simulation.partnerRows.length === 0 ? (
              <p className="muted">
                No online Partner with a usable location is inside the current radius. Check Partner app
                location update and city supply before live launch.
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="ops-task-grid admin-mt-14">
        {simulation.checks.map((check) => (
          <div className={`ops-task-card ${check.className}`} key={check.title}>
            <PillClassBadge pillClass={check.pillClass}>{check.status}</PillClassBadge>
            <h3>{check.title}</h3>
            <p>{check.detail}</p>
            <small>{check.operatorAction}</small>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}
