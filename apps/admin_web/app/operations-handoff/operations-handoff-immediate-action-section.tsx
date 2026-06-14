import Link from 'next/link';
import type { ImmediateActionQueueRow } from './operations-handoff-immediate-actions';

type OperationsHandoffImmediateActionSectionProps = {
  readonly actions: readonly ImmediateActionQueueRow[];
};

export function OperationsHandoffImmediateActionSection({
  actions,
}: OperationsHandoffImmediateActionSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="toolbar">
        <div>
          <h2>Immediate action queue</h2>
          <p className="muted">
            Ordered by operational state only: live booking stage, chat availability, cash settlement,
            notification delivery, and written handoff notes.
          </p>
        </div>
        <span className="pill pill-info">{actions.length} action lane(s)</span>
      </div>
      <div className="ops-task-grid">
        {actions.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.id}>
            <span className={item.className}>{item.owner}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <div className="participant-list">
              <span className="pill">{item.countLabel}</span>
              <span className={item.statusClass}>{item.status}</span>
            </div>
            <small>{item.nextAction}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
