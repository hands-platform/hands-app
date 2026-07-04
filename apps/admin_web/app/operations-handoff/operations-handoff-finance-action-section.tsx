import Link from 'next/link';
import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../components/status-badge';
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
              <PillClassBadge pillClass={item.statusClass}>{item.status}</PillClassBadge>
              <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
            </div>
          </AdminActionCard>
        ))}
      </div>
    </AdminSection>
  );
}

function toSignalModifierClass(className: string) {
  return className.replace(/^signal\s+/, '');
}
