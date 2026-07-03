import { AdminActionCard, AdminSection } from '../../components/admin-surface';

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
      actions={<span className="pill pill-info">Daily control view</span>}
      className="admin-mb-16 partner-command-center-card"
      description="Operator overview across onboarding, dispatch readiness, withdrawal setup, and report follow-up."
      title="Partner command center"
    >
      <div className="grid admin-mt-12">
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
            <div className="participant-list admin-mt-10">
              {lane.metrics.map((item) => (
                <span className="pill" key={item.label}>
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
          </AdminActionCard>
        ))}
      </div>
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
