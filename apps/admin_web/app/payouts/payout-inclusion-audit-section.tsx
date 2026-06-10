export type PayoutInclusionAuditCard = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export type PayoutInclusionAuditRow = {
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly operatorRule: string;
  readonly status: 'Batched' | 'Hold' | 'Ready';
  readonly title: string;
};

export type PayoutInclusionAudit = {
  readonly blockedCount: number;
  readonly cards: readonly PayoutInclusionAuditCard[];
  readonly readyCount: number;
  readonly rows: readonly PayoutInclusionAuditRow[];
};

type PayoutInclusionAuditSectionProps = {
  readonly audit: PayoutInclusionAudit;
};

export function PayoutInclusionAuditSection({ audit }: PayoutInclusionAuditSectionProps) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Payout inclusion audit</h2>
          <p className="muted">
            Unbatched earning review before finance creates the next weekly, monthly, or admin-selected partner
            settlement batch.
          </p>
        </div>
        <span className={`pill ${audit.blockedCount ? 'pill-warn' : 'pill-success'}`}>
          {audit.readyCount} ready / {audit.blockedCount} held
        </span>
      </div>
      <div className="service-trace-summary">
        {audit.cards.map((card) => (
          <div key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </div>
        ))}
      </div>
      <div className="setup-stage-list" style={{ marginTop: 14 }}>
        {audit.rows.map((row) => (
          <div className="setup-stage-item" key={row.id}>
            <span>{row.status}</span>
            <div>
              <strong>{row.title}</strong>
              <p className="muted">{row.detail}</p>
              <p className="muted">{row.operatorRule}</p>
            </div>
            <a className="text-link" href={row.href}>
              Open
            </a>
          </div>
        ))}
        {audit.rows.length === 0 ? (
          <div className="setup-stage-item">
            <span>OK</span>
            <div>
              <strong>No unbatched earning in this range</strong>
              <p className="muted">All visible earning rows are already batched, paid, cancelled, or absent.</p>
            </div>
            <small>Clear</small>
          </div>
        ) : null}
      </div>
    </div>
  );
}
