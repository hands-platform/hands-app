import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminQueueMeta } from '../../components/admin-overview-card';
import { AdminActionCard, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { formatRelativeAge } from '../../lib/admin-format';
import { adminCountLabel } from '../../lib/admin-copy';
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
          {visibleActions.length > 0 ? adminCountLabel(visibleActions.length, 'issue lane') : 'No issue lanes'}
        </StatusBadge>
      }
      bodyClassName={visibleActions.length > 0 ? undefined : 'admin-section-empty-body'}
      className="admin-mb-16 operations-handoff-immediate-action-card"
      description="Past issue lanes that still need booking, chat, cash, alert, or note follow-up."
      id="operations-handoff-issue-signals"
      title="Historical issue signals"
    >
      {visibleActions.length > 0 ? (
        <AdminTaskGrid>
          {visibleActions.map((item) => (
            <AdminActionCard
              actionLabel={`Review ${item.title}`}
              detail={item.nextAction}
              href={item.href}
              key={item.id}
              signalClassName={toSignalModifierClass(item.className)}
              signalLabel={item.status}
              title={item.title}
              variant="ops-task"
            >
              <AdminQueueMeta
                impact={item.detail}
                oldest={item.oldestOpenAt ? formatRelativeAge(item.oldestOpenAt) : undefined}
                owner={item.owner}
              />
              <AdminFilterChipGroup>
                <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
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
