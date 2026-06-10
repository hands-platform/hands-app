import Link from 'next/link';

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
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ops-section-header">
        <div>
          <h2>Finance queue</h2>
          <p className="muted">
            Operator summary for partner payout readiness, batched earnings, tax logs, and stale pending
            revenue.
          </p>
        </div>
        <Link className="text-link" href="/payouts">
          Open payout batches
        </Link>
      </div>
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
    </div>
  );
}
