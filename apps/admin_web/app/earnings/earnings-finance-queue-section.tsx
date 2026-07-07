import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadgeFromPillClass } from '../../components/status-badge';

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
      <AdminFilterChipGroup ariaLabel="Earnings finance queue links" className="admin-mb-12">
        <AdminTextLink href="/payouts">
          Open payout batches
        </AdminTextLink>
      </AdminFilterChipGroup>
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
    </AdminTablePanel>
  );
}
