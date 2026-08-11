import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminQueueMeta } from '../../components/admin-overview-card';
import { AdminActionCard, AdminDisclosure, AdminSection, AdminTaskGrid } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { adminCountLabel } from '../../lib/admin-copy';

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
  const completedRows = rows.filter((item) => item.tone === 'success');

  return (
    <AdminSection
      className="admin-mb-16"
      description="Past checks that still need booking, chat, cash, alert, customer, or note review."
      status={
        <StatusBadge tone={openCount ? 'warning' : 'success'}>
          {openCount ? `${adminCountLabel(openCount, 'check')} open` : 'Ready to hand over'}
        </StatusBadge>
      }
      id="operations-handoff-review-checklist"
      title="Operations review checklist"
    >
      {visibleRows.length > 0 ? (
        <AdminTaskGrid>
          {visibleRows.map((item) => (
            <AdminActionCard
              actionLabel={`Review ${item.title}`}
              detail={item.operatorAction}
              href={item.href}
              key={item.id}
              signalClassName={badgeClassToSignalClass(item.badgeClass)}
              signalLabel={item.status}
              title={item.title}
              variant="ops-task"
            >
              <AdminQueueMeta impact={item.detail} owner={item.owner} />
              <AdminFilterChipGroup>
                <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
              </AdminFilterChipGroup>
            </AdminActionCard>
          ))}
        </AdminTaskGrid>
      ) : (
        <AdminEmptyState
          framed
          message="The selected history window has no handoff review items."
          title="No open review checks"
        />
      )}
      {completedRows.length > 0 ? (
        <AdminDisclosure className="admin-mt-12">
          <summary>Completed checks ({completedRows.length})</summary>
          <AdminTaskGrid>
            {completedRows.map((item) => (
              <AdminActionCard
                actionLabel="Open record"
                detail={item.operatorAction}
                href={item.href}
                key={item.id}
                signalClassName="signal-ok"
                signalLabel={item.status}
                title={item.title}
                variant="ops-task"
              >
                <AdminQueueMeta impact={item.detail} owner={item.owner} />
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

function badgeClassToSignalClass(badgeClass: string) {
  if (badgeClass.includes('success')) {
    return 'signal-ok';
  }
  if (badgeClass.includes('warn')) {
    return 'signal-warn';
  }
  return 'signal-info';
}
