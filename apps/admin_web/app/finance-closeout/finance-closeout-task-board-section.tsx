import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import type { FinanceCloseoutTask } from '../../lib/finance-closeout';

type FinanceCloseoutTaskBoardSectionProps = {
  readonly tasks: readonly FinanceCloseoutTask[];
};

export function FinanceCloseoutTaskBoardSection({ tasks }: FinanceCloseoutTaskBoardSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminTextLink href="/operations-handoff">
          Open handoff
        </AdminTextLink>
      }
      bodyClassName="ops-task-grid"
      className="admin-mb-16"
      description="One pass across the finance queues. Work the red and yellow cards first, then leave a handoff note from Operations Handoff."
      title="Closeout reconciliation board"
    >
      {tasks.length ? (
        tasks.map((task) => (
          <AdminActionCard
            actionLabel={task.action}
            className={task.className}
            detail={task.detail}
            href={task.href}
            key={task.title}
            leading={
              <StatusBadgeFromPillClass pillClass={task.pillClass}>
                {task.status}
              </StatusBadgeFromPillClass>
            }
            title={task.title}
            variant="ops-task"
          />
        ))
      ) : (
        <AdminEmptyState framed message="No finance closeout task is visible for this range." />
      )}
    </AdminSection>
  );
}
