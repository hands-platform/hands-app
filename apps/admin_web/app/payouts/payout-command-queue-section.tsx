import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { PillClassBadge } from '../../components/status-badge';

export type PayoutCommandSignal = {
  readonly action: string;
  readonly className: string;
  readonly detail: string;
  readonly pillClass: string;
  readonly status: string;
  readonly title: string;
};

type PayoutCommandQueueSectionProps = {
  readonly signals: readonly PayoutCommandSignal[];
};

export function PayoutCommandQueueSection({ signals }: PayoutCommandQueueSectionProps) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Finance-first view for review money, active transfers, payout holds, and reconciliation warnings."
      resultLabel={`${signals.length} signal(s)`}
      resultTone={signals.length > 0 ? 'warning' : 'success'}
      title="Payout command queue"
    >
      <div className="participant-list admin-mb-12">
        <a className="text-link" href="/earnings">
          Review earnings queue
        </a>
      </div>
      {signals.length ? (
        <div className="ops-task-grid">
          {signals.map((signal) => (
            <div className={`ops-task-card ${signal.className}`} key={signal.title}>
              <div>
                <PillClassBadge pillClass={signal.pillClass}>{signal.status}</PillClassBadge>
                <h3>{signal.title}</h3>
                <p className="muted">{signal.detail}</p>
              </div>
              <small>{signal.action}</small>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState framed message="No payout command signal is visible for this range." />
      )}
    </AdminFilterPanel>
  );
}
