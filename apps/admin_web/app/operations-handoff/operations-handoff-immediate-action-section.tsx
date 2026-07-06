import { AdminActionCard, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
import type { ImmediateActionQueueRow } from './operations-handoff-immediate-actions';

type OperationsHandoffImmediateActionSectionProps = {
  readonly actions: readonly ImmediateActionQueueRow[];
};

export function OperationsHandoffImmediateActionSection({
  actions,
}: OperationsHandoffImmediateActionSectionProps) {
  const visibleActions = actions.filter((item) => !item.statusClass.includes('success'));

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <AdminSection
      actions={
        <StatusBadge tone="info">{visibleActions.length} action lane(s)</StatusBadge>
      }
      className="admin-mb-16 operations-handoff-immediate-action-card"
      description="Ordered by operational state only: live booking stage, chat availability, cash settlement, notification delivery, and written handoff notes."
      title="Immediate action queue"
    >
      <AdminTaskGrid>
        {visibleActions.map((item) => (
          <AdminActionCard
            actionLabel={item.nextAction}
            detail={item.detail}
            href={item.href}
            key={item.id}
            signalClassName={toSignalModifierClass(item.className)}
            signalLabel={item.owner}
            title={item.title}
            variant="ops-task"
          >
            <div className="participant-list">
              <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
              <StatusBadgeFromPillClass pillClass={item.statusClass}>{item.status}</StatusBadgeFromPillClass>
            </div>
          </AdminActionCard>
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}

function toSignalModifierClass(className: string) {
  return className.replace(/^signal\s+/, '');
}
