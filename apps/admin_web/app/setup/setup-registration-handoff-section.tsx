import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass, StatusBadgeLink } from '../../components/status-badge';

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
  readonly visibleLimit?: number;
};

export function SetupRegistrationHandoffSection({
  registrationPlan,
  visibleLimit,
}: SetupRegistrationHandoffSectionProps) {
  const visibleItems = visibleLimit ? registrationPlan.slice(0, visibleLimit) : registrationPlan;
  const hiddenCount = Math.max(registrationPlan.length - visibleItems.length, 0);

  return (
    <AdminSection
      bodyClassName="setup-backlog"
      className="admin-mb-16"
      description="Account ownership, service consoles, and credential status in one place. Secret values are never printed here; this page only shows whether each integration is ready, deferred, or needs a human setup step."
      footer={
        hiddenCount > 0 ? (
          <StatusBadgeLink href="/setup?details=all#external-registration-handoff" tone="info">
            Open full setup details
          </StatusBadgeLink>
        ) : null
      }
      id="external-registration-handoff"
      statusLabel={
        hiddenCount > 0
          ? `Showing ${visibleItems.length} of ${registrationPlan.length} services`
          : `${registrationPlan.length} services tracked`
      }
      statusTone="info"
      title="External registration handoff"
    >
      {visibleItems.map((item) => (
        <a className="setup-backlog-item" href={`#${item.groupId}`} key={item.id}>
          <span>{item.provider}</span>
          <strong>{item.title}</strong>
          <p className="muted">{item.detail}</p>
          <AdminFilterChipGroup>
            <StatusBadgeFromPillClass pillClass={item.statusClass}>{item.status}</StatusBadgeFromPillClass>
            <StatusBadge tone="neutral">{item.owner}</StatusBadge>
          </AdminFilterChipGroup>
          <AdminFilterChipGroup className="admin-mt-8">
            {item.env.map((name) => (
              <StatusBadge key={`${item.id}-${name}`} tone="info">
                {name}
              </StatusBadge>
            ))}
          </AdminFilterChipGroup>
        </a>
      ))}
    </AdminSection>
  );
}
