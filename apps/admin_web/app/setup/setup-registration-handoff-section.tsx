import { AdminSection } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';

type SetupRegistrationHandoffItem = {
  readonly id: string;
  readonly provider: string;
  readonly title: string;
  readonly detail: string;
  readonly groupId: string;
  readonly status: string;
  readonly statusClass: string;
  readonly owner: string;
  readonly env: readonly string[];
};

type SetupRegistrationHandoffSectionProps = {
  readonly registrationPlan: readonly SetupRegistrationHandoffItem[];
};

export function SetupRegistrationHandoffSection({
  registrationPlan,
}: SetupRegistrationHandoffSectionProps) {
  return (
    <AdminSection
      bodyClassName="setup-backlog"
      className="admin-mb-16"
      description="Account ownership, service consoles, and credential status in one place. Secret values are never printed here; this page only shows whether each integration is ready, deferred, or needs a human setup step."
      statusLabel={`${registrationPlan.length} services tracked`}
      statusTone="info"
      title="External registration handoff"
    >
      {registrationPlan.map((item) => (
        <a className="setup-backlog-item" href={`#${item.groupId}`} key={item.id}>
          <span>{item.provider}</span>
          <strong>{item.title}</strong>
          <p className="muted">{item.detail}</p>
          <div className="participant-list">
            <StatusBadgeFromPillClass pillClass={item.statusClass}>{item.status}</StatusBadgeFromPillClass>
            <StatusBadge tone="neutral">{item.owner}</StatusBadge>
          </div>
          <div className="participant-list admin-mt-8">
            {item.env.map((name) => (
              <StatusBadge key={`${item.id}-${name}`} tone="info">
                {name}
              </StatusBadge>
            ))}
          </div>
        </a>
      ))}
    </AdminSection>
  );
}
