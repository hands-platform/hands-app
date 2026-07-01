import { AdminFilterPanel } from '../../components/admin-filter-panel';

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
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card"
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
                <span className={`pill ${signal.pillClass}`}>{signal.status}</span>
                <h3>{signal.title}</h3>
                <p className="muted">{signal.detail}</p>
              </div>
              <small>{signal.action}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No payout command signal is visible for this range.</p>
      )}
    </AdminFilterPanel>
  );
}
