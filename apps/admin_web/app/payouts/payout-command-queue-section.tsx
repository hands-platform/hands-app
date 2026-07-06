import type { ReactNode } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTaskCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../components/status-badge';

export type PayoutCommandSignal = {
  readonly action: string;
  readonly className: string;
  readonly detail: ReactNode;
  readonly pillClass: string;
  readonly status: string;
  readonly title: string;
};

type PayoutCommandQueueSectionProps = {
  readonly signals: readonly PayoutCommandSignal[];
};

export function PayoutCommandQueueSection({ signals }: PayoutCommandQueueSectionProps) {
  return (
    <AdminTablePanel
      description="Finance-first view for review money, active transfers, payout holds, and reconciliation warnings."
      resultLabel={`${signals.length} signal(s)`}
      resultTone={signals.length > 0 ? 'warning' : 'success'}
      title="Payout command queue"
    >
      <div className="participant-list admin-mb-12">
        <AdminTextLink href="/earnings">
          Review earnings queue
        </AdminTextLink>
      </div>
      {signals.length ? (
        <div className="ops-task-grid">
          {signals.map((signal) => (
            <AdminTaskCard
              actionLabel={signal.action}
              className={signal.className}
              detail={signal.detail}
              key={signal.title}
              leading={
                <StatusBadgeFromPillClass pillClass={signal.pillClass}>
                  {signal.status}
                </StatusBadgeFromPillClass>
              }
              title={signal.title}
            />
          ))}
        </div>
      ) : (
        <AdminEmptyState framed message="No payout command signal is visible for this range." />
      )}
    </AdminTablePanel>
  );
}
