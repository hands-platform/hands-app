import Link from 'next/link';

import type { FinanceCloseoutTask } from '../../lib/finance-closeout';

type FinanceCloseoutTaskBoardSectionProps = {
  readonly tasks: readonly FinanceCloseoutTask[];
};

export function FinanceCloseoutTaskBoardSection({ tasks }: FinanceCloseoutTaskBoardSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Closeout reconciliation board</h2>
          <p className="muted">
            One pass across the finance queues. Work the red and yellow cards first, then leave a handoff note
            from Operations Handoff.
          </p>
        </div>
        <Link className="text-link" href="/operations-handoff">
          Open handoff
        </Link>
      </div>
      {tasks.length ? (
        <div className="ops-task-grid">
          {tasks.map((task) => (
            <Link className={`ops-task-card ${task.className}`} href={task.href} key={task.title}>
              <div>
                <span className={`pill ${task.pillClass}`}>{task.status}</span>
                <h3>{task.title}</h3>
                <p className="muted">{task.detail}</p>
              </div>
              <small>{task.action}</small>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted">No finance closeout task is visible for this range.</p>
      )}
    </section>
  );
}
