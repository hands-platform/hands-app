import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
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

  return (
    <AdminSection
      actions={
        <StatusBadge tone={visibleActions.length > 0 ? 'info' : 'success'}>
          {visibleActions.length > 0 ? `${visibleActions.length} issue lane(s)` : 'No issue lanes'}
        </StatusBadge>
      }
      bodyClassName={visibleActions.length > 0 ? undefined : 'admin-section-empty-body'}
      className="admin-mb-16 operations-handoff-immediate-action-card"
      description="Historical issue lanes from the selected range: booking stage, chat availability, cash settlement, notification delivery, and written operations notes."
      id="operations-handoff-issue-signals"
      title="Historical issue signals"
    >
      {visibleActions.length > 0 ? (
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
              <AdminFilterChipGroup>
                <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
                <StatusBadgeFromPillClass pillClass={item.statusClass}>{item.status}</StatusBadgeFromPillClass>
              </AdminFilterChipGroup>
            </AdminActionCard>
          ))}
        </AdminTaskGrid>
      ) : (
        <AdminEmptyState
          framed
          message="The selected history window has no booking, chat, cash, notification, or written-note issue lanes."
          title="No historical issue lanes"
        />
      )}
    </AdminSection>
  );
}

function toSignalModifierClass(className: string) {
  return className.replace(/^signal\s+/, '');
}
