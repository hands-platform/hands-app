import Link from 'next/link';
import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../components/status-badge';
import type { ImmediateActionQueueRow } from './operations-handoff-immediate-actions';

type OperationsHandoffImmediateActionSectionProps = {
  readonly actions: readonly ImmediateActionQueueRow[];
};

export function OperationsHandoffImmediateActionSection({
  actions,
}: OperationsHandoffImmediateActionSectionProps) {
  const visibleActions = actions.filter((item) => !item.statusClass.includes('success'));

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <AdminSection
      actions={
        <StatusBadge tone="info">{visibleActions.length} action lane(s)</StatusBadge>
      }
      className="admin-mb-16 operations-handoff-immediate-action-card"
      description="Ordered by operational state only: live booking stage, chat availability, cash settlement, notification delivery, and written handoff notes."
      title="Immediate action queue"
    >
      <div className="ops-task-grid">
        {visibleActions.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.id}>
            <span className={item.className}>{item.owner}</span>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <div className="participant-list">
              <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
              <PillClassBadge pillClass={item.statusClass}>{item.status}</PillClassBadge>
            </div>
            <small>{item.nextAction}</small>
          </Link>
        ))}
      </div>
    </AdminSection>
  );
}
