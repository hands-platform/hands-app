import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminQueueMeta } from '../../components/admin-overview-card';
import { AdminActionCard, AdminDisclosure, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { formatRelativeAge } from '../../lib/admin-format';
import { StatusBadge } from '../../components/status-badge';
import type { FinanceHandoffActionRow } from './operations-handoff-finance-actions';

type OperationsHandoffFinanceActionSectionProps = {
  readonly actions: readonly FinanceHandoffActionRow[];
};

export function OperationsHandoffFinanceActionSection({
  actions,
}: OperationsHandoffFinanceActionSectionProps) {
  const openActions = actions.filter((item) => !item.statusClass.includes('success'));
  const completedActions = actions.filter((item) => item.statusClass.includes('success'));

  return (
    <AdminSection
      actions={
        <AdminTextLink href="/finance-overview">
          Open Finance Overview
        </AdminTextLink>
      }
      className="admin-mb-16 operations-handoff-finance-action-card"
      description="Money-flow history lanes for the selected range: payment state, refund rows, cash wallet debt, payout release, and tax/reference trace."
      id="operations-handoff-finance-review"
      status={
        <StatusBadge tone={openActions.length > 0 ? 'warning' : 'success'}>
          {openActions.length > 0
            ? `${openActions.length} finance ${openActions.length === 1 ? 'lane' : 'lanes'} open`
            : 'Finance clear'}
        </StatusBadge>
      }
      title="Finance history review"
    >
      {openActions.length > 0 ? (
        <AdminTaskGrid>
          {openActions.map((item) => (
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
                assignee={item.assignee}
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
      ) : null}
      {completedActions.length > 0 ? (
        <AdminDisclosure className="admin-mt-12">
          <summary>Completed finance checks ({completedActions.length})</summary>
          <AdminTaskGrid>
            {completedActions.map((item) => (
              <AdminActionCard
                actionLabel="Open record"
                detail={item.nextAction}
                href={item.href}
                key={item.id}
                signalClassName="signal-ok"
                signalLabel={item.status}
                title={item.title}
                variant="ops-task"
              >
                <AdminQueueMeta
                  assignee={item.assignee}
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
        </AdminDisclosure>
      ) : null}
    </AdminSection>
  );
}

function toSignalModifierClass(className: string) {
  return className.replace(/^signal\s+/, '');
}
