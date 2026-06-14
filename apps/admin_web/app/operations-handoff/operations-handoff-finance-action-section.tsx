import Link from 'next/link';
import type { FinanceHandoffActionRow } from './operations-handoff-finance-actions';

type OperationsHandoffFinanceActionSectionProps = {
  readonly actions: readonly FinanceHandoffActionRow[];
};

export function OperationsHandoffFinanceActionSection({
  actions,
}: OperationsHandoffFinanceActionSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="toolbar">
        <div>
          <h2>Finance handoff action map</h2>
          <p className="muted">
            Money-flow lanes the next operator should verify before continuing the shift: payment state,
            refund rows, cash wallet debt, payout release, and tax/reference trace.
          </p>
        </div>
        <Link className="text-link" href="/finance-closeout">
          Open Finance Closeout
        </Link>
      </div>
      <div className="ops-task-grid">
        {actions.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.id}>
            <span className={item.className}>{item.owner}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <div className="participant-list">
              <span className={item.statusClass}>{item.status}</span>
              <span className="pill">{item.countLabel}</span>
            </div>
            <small>{item.nextAction}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
