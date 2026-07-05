import Link from 'next/link';

import { AdminTaskCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';

export type EarningsFinanceSignal = {
  readonly action: string;
  readonly className: string;
  readonly detail: string;
  readonly pillClass: string;
  readonly status: string;
  readonly title: string;
};

type EarningsFinanceQueueSectionProps = {
  readonly signals: readonly EarningsFinanceSignal[];
};

export function EarningsFinanceQueueSection({ signals }: EarningsFinanceQueueSectionProps) {
  return (
    <AdminTablePanel
      description="Operator summary for Partner payout readiness, batched earnings, tax logs, and stale pending revenue."
      resultLabel={`${signals.length} signal(s)`}
      resultTone={signals.length > 0 ? 'info' : 'warning'}
      title="Finance queue"
    >
      <div className="participant-list admin-mb-12">
        <Link className="text-link" href="/payouts">
          Open payout batches
        </Link>
      </div>
      <div className="ops-task-grid">
        {signals.map((signal) => (
          <AdminTaskCard
            actionLabel={signal.action}
            className={signal.className}
            detail={signal.detail}
            key={signal.title}
            leading={
              <StatusBadge tone={statusBadgeToneFromPillClass(signal.pillClass)}>
                {signal.status}
              </StatusBadge>
            }
            title={signal.title}
          />
        ))}
      </div>
    </AdminTablePanel>
  );
}
