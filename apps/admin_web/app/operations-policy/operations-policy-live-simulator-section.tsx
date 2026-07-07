import { ExternalLink } from 'lucide-react';

import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminSectionHeader } from '../../components/admin-page-template';
import {
  AdminDetailGrid,
  AdminNotePanel,
  AdminSection,
  AdminTaskCard,
  AdminTaskGrid,
} from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
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
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={simulation.metrics.map((metric) => ({
          detail: metric.helper,
          label: metric.label,
          value: metric.value,
        }))}
      />
      <AdminDetailGrid className="admin-mt-14">
        <AdminNotePanel>
          <h3>Simulated booking path</h3>
          <div className="timeline admin-mt-12">
            {simulation.timeline.map((step) => (
              <div className={`timeline-step ${step.className}`} key={step.title}>
                <span>{step.step}</span>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              <AdminFilterChipGroup>
                {step.tags.map((tag) => (
                  <StatusBadgeFromPillClass pillClass={tag.tone} key={`${step.title}-${tag.label}`}>
                    {tag.label}
                  </StatusBadgeFromPillClass>
                ))}
              </AdminFilterChipGroup>
              </div>
            ))}
          </div>
        </AdminNotePanel>
        <AdminNotePanel>
          <AdminSectionHeader
            actions={<StatusBadge tone="info">{simulation.partnerRows.length} shown</StatusBadge>}
            description="Top nearby online Partners inside the current marketplace radius. Stale locations are excluded from the dispatch count."
            title="Eligible Partner preview"
          />
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
                <StatusBadgeFromPillClass pillClass={partner.pillClass}>
                  {partner.status}
                </StatusBadgeFromPillClass>
              </div>
            ))}
            {simulation.partnerRows.length === 0 ? (
              <p className="muted">
                No online Partner with a usable location is inside the current radius. Check Partner app
                location update and city supply before live launch.
              </p>
            ) : null}
          </div>
        </AdminNotePanel>
      </AdminDetailGrid>
      <AdminTaskGrid className="admin-mt-14">
        {simulation.checks.map((check) => (
          <AdminTaskCard
            actionLabel={check.operatorAction}
            className={check.className}
            detail={check.detail}
            key={check.title}
            leading={
              <StatusBadgeFromPillClass pillClass={check.pillClass}>{check.status}</StatusBadgeFromPillClass>
            }
            title={check.title}
          />
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}
