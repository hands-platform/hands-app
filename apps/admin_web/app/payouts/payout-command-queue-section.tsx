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
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Payout command queue</h2>
          <p className="muted">
            Finance-first view for review money, active transfers, payout holds, and reconciliation warnings.
          </p>
        </div>
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
    </div>
  );
}
