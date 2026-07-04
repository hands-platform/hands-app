import Link from 'next/link';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge } from '../../components/status-badge';
import type { FinanceCloseoutTask } from '../../lib/finance-closeout';

type FinanceCloseoutTaskBoardSectionProps = {
  readonly tasks: readonly FinanceCloseoutTask[];
};

export function FinanceCloseoutTaskBoardSection({ tasks }: FinanceCloseoutTaskBoardSectionProps) {
  return (
    <AdminSection
      actions={
        <Link className="text-link" href="/operations-handoff">
          Open handoff
        </Link>
      }
      bodyClassName="ops-task-grid"
      className="admin-mb-16"
      description="One pass across the finance queues. Work the red and yellow cards first, then leave a handoff note from Operations Handoff."
      title="Closeout reconciliation board"
    >
      {tasks.length ? (
        tasks.map((task) => (
          <Link className={`ops-task-card ${task.className}`} href={task.href} key={task.title}>
            <div>
              <PillClassBadge pillClass={task.pillClass}>{task.status}</PillClassBadge>
              <h3>{task.title}</h3>
              <p className="muted">{task.detail}</p>
            </div>
            <small>{task.action}</small>
          </Link>
        ))
      ) : (
        <AdminEmptyState framed message="No finance closeout task is visible for this range." />
      )}
    </AdminSection>
  );
}
