import Link from 'next/link';

import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminTaskCard } from '../../components/admin-surface';
import { PillClassBadge } from '../../components/status-badge';

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
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
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
            leading={<PillClassBadge pillClass={signal.pillClass}>{signal.status}</PillClassBadge>}
            title={signal.title}
          />
        ))}
      </div>
    </AdminFilterPanel>
  );
}
