import type { ReactNode } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
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
      <AdminFilterChipGroup ariaLabel="Payout command queue links" className="admin-mb-12">
        <AdminTextLink href="/earnings">
          Review earnings queue
        </AdminTextLink>
      </AdminFilterChipGroup>
      {signals.length ? (
        <AdminTaskGrid>
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
        </AdminTaskGrid>
      ) : (
        <AdminEmptyState framed message="No payout command signal is visible for this range." />
      )}
    </AdminTablePanel>
  );
}
