import Link from 'next/link';

import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../components/status-badge';

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
      description="A factual close-of-shift list for the next operator: live bookings, chat continuity, cash settlement, alerts, app presence, customer context, and written notes."
      status={
        <StatusBadge tone={openCount ? 'warning' : 'success'}>
          {openCount ? `${openCount} check(s) open` : 'Ready to hand over'}
        </StatusBadge>
      }
      title="Shift handoff checklist"
    >
        {visibleRows.map((item) => (
          <Link className="ops-task-card" href={item.href} key={item.id}>
            <PillClassBadge pillClass={item.badgeClass}>{item.status}</PillClassBadge>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <div className="participant-list">
              <StatusBadge tone="neutral">{item.countLabel}</StatusBadge>
              <PillClassBadge pillClass={item.badgeClass}>{item.owner}</PillClassBadge>
            </div>
            <small>{item.operatorAction}</small>
          </Link>
        ))}
    </AdminSection>
  );
}
