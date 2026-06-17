import Link from 'next/link';
import type { HandoffReadinessChecklistRow } from './operations-handoff-readiness-checklist';

type OperationsHandoffReadinessChecklistSectionProps = {
  readonly openCount: number;
  readonly rows: readonly HandoffReadinessChecklistRow[];
};

export function OperationsHandoffReadinessChecklistSection({
  openCount,
  rows,
}: OperationsHandoffReadinessChecklistSectionProps) {
  const visibleRows = rows.filter((item) => item.tone !== 'success');

  if (visibleRows.length === 0) {
    return null;
  }

  return (
    <section className="card admin-mb-16">
      <div className="toolbar">
        <div>
          <h2>Shift handoff checklist</h2>
          <p className="muted">
            A factual close-of-shift list for the next operator: live bookings, chat continuity, cash
            settlement, alerts, app presence, customer context, and written notes.
          </p>
        </div>
        <span className={openCount ? 'pill pill-warn' : 'pill pill-success'}>
          {openCount ? `${openCount} check(s) open` : 'Ready to hand over'}
        </span>
      </div>
      <div className="ops-task-grid">
        {visibleRows.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.id}>
            <span className={item.badgeClass}>{item.status}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <div className="participant-list">
              <span className="pill">{item.countLabel}</span>
              <span className={item.badgeClass}>{item.owner}</span>
            </div>
            <small>{item.operatorAction}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
