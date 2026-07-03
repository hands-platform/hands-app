import Link from 'next/link';
import { AdminSection } from '../../components/admin-surface';
import type { FinanceHandoffActionRow } from './operations-handoff-finance-actions';

type OperationsHandoffFinanceActionSectionProps = {
  readonly actions: readonly FinanceHandoffActionRow[];
};

export function OperationsHandoffFinanceActionSection({
  actions,
}: OperationsHandoffFinanceActionSectionProps) {
  return (
    <AdminSection
      actions={
        <Link className="text-link" href="/finance-closeout">
          Open Finance Closeout
        </Link>
      }
      className="admin-mb-16 operations-handoff-finance-action-card"
      description="Money-flow lanes the next operator should verify before continuing the shift: payment state, refund rows, cash wallet debt, payout release, and tax/reference trace."
      title="Finance handoff action map"
    >
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
    </AdminSection>
  );
}
