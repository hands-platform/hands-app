import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminActionCard, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';
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
        <AdminTextLink href="/finance-closeout">
          Open Finance Closeout
        </AdminTextLink>
      }
      className="admin-mb-16 operations-handoff-finance-action-card"
      description="Money-flow history lanes for the selected range: payment state, refund rows, cash wallet debt, payout release, and tax/reference trace."
      title="Finance history review"
    >
      <AdminTaskGrid>
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
          <AdminFilterChipGroup>
            <StatusBadgeFromPillClass pillClass={item.statusClass}>{item.status}</StatusBadgeFromPillClass>
            <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
          </AdminFilterChipGroup>
          </AdminActionCard>
        ))}
      </AdminTaskGrid>
    </AdminSection>
  );
}

function toSignalModifierClass(className: string) {
  return className.replace(/^signal\s+/, '');
}
