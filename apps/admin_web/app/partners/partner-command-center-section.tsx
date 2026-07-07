import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminActionCard, AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

export type PartnerCommandCenterSectionTone = 'danger' | 'info' | 'ok' | 'warn';

export type PartnerCommandCenterSectionLane = {
  readonly detail: string;
  readonly href: string;
  readonly metrics: readonly { readonly label: string; readonly value: string }[];
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerCommandCenterSectionTone;
};

type PartnerCommandCenterSectionProps = {
  readonly lanes: readonly PartnerCommandCenterSectionLane[];
};

export function PartnerCommandCenterSection({ lanes }: PartnerCommandCenterSectionProps) {
  return (
    <AdminSection
      actions={<StatusBadge tone="info">Daily control view</StatusBadge>}
      className="admin-mb-16 partner-command-center-card"
      description="Operator overview across onboarding, dispatch readiness, withdrawal profile, and report follow-up."
      title="Partner command center"
    >
      <AdminDetailGrid className="admin-mt-12">
        {lanes.map((lane) => (
          <AdminActionCard
            detail={lane.detail}
            href={lane.href}
            key={lane.title}
            signalClassName={partnerCommandCenterToneClass(lane.tone)}
            signalLabel={partnerCommandCenterToneLabel(lane.tone)}
            title={lane.title}
            value={lane.status}
          >
            <AdminFilterChipGroup ariaLabel={`${lane.title} metrics`} className="admin-mt-10">
              {lane.metrics.map((item) => (
                <StatusBadge key={item.label} tone="neutral">
                  {item.label}: {item.value}
                </StatusBadge>
              ))}
            </AdminFilterChipGroup>
          </AdminActionCard>
        ))}
      </AdminDetailGrid>
    </AdminSection>
  );
}

function partnerCommandCenterToneClass(tone: PartnerCommandCenterSectionTone) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}

function partnerCommandCenterToneLabel(tone: PartnerCommandCenterSectionTone) {
  if (tone === 'danger') {
    return 'Immediate check';
  }
  if (tone === 'warn') {
    return 'Monitor';
  }
  if (tone === 'info') {
    return 'Info';
  }
  return 'Clear';
}
