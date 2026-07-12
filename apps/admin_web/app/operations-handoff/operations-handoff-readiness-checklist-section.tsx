import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { StatusBadge, StatusBadgeFromPillClass } from '../../components/status-badge';

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
    <AdminSection
      bodyClassName="ops-task-grid"
      className="admin-mb-16"
      description="A dated operations review list: matching outcomes, active service records, chat continuity, cash settlement, alerts, customer context, and written notes."
      status={
        <StatusBadge tone={openCount ? 'warning' : 'success'}>
          {openCount ? `${openCount} check(s) open` : 'Ready to hand over'}
        </StatusBadge>
      }
      id="operations-handoff-review-checklist"
      title="Operations review checklist"
    >
      {visibleRows.map((item) => (
        <AdminActionCard
          actionLabel={item.operatorAction}
          detail={item.detail}
          href={item.href}
          key={item.id}
          signalClassName={badgeClassToSignalClass(item.badgeClass)}
          signalLabel={item.status}
          title={item.title}
          variant="ops-task"
        >
        <AdminFilterChipGroup>
          <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
          <StatusBadgeFromPillClass pillClass={item.badgeClass}>{item.owner}</StatusBadgeFromPillClass>
        </AdminFilterChipGroup>
        </AdminActionCard>
      ))}
    </AdminSection>
  );
}

function badgeClassToSignalClass(badgeClass: string) {
  if (badgeClass.includes('success')) {
    return 'signal-ok';
  }
  if (badgeClass.includes('warn')) {
    return 'signal-warn';
  }
  return 'signal-info';
}
