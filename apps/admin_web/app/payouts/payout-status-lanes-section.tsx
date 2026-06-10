import { formatMoney, shortRecordId } from '../../lib/admin-format';

export type PayoutStatusLaneBatch = {
  readonly amount: number;
  readonly currency: string;
  readonly earningCount: number;
  readonly id: string;
  readonly opsHint: string;
  readonly partnerLabel: string;
};

export type PayoutStatusLane = {
  readonly batches: readonly PayoutStatusLaneBatch[];
  readonly emptyText: string;
  readonly pillClass: string;
  readonly title: string;
};

type PayoutStatusLanesSectionProps = {
  readonly batchCount: number;
  readonly lanes: readonly PayoutStatusLane[];
};

export function PayoutStatusLanesSection({ batchCount, lanes }: PayoutStatusLanesSectionProps) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Payout status lanes</h2>
          <p className="muted">
            Work from blocked and failed lanes first, then draft review, processing confirmation, and paid
            reconciliation.
          </p>
        </div>
        <span className="pill pill-info">{batchCount} batch(es)</span>
      </div>
      <div className="detail-grid" style={{ marginTop: 16 }}>
        {lanes.map((lane) => (
          <div key={lane.title}>
            <div className="ops-section-header">
              <h3>{lane.title}</h3>
              <span className={`pill ${lane.pillClass}`}>{lane.batches.length}</span>
            </div>
            {lane.batches.length ? (
              <div className="setup-stage-list">
                {lane.batches.slice(0, 4).map((batch) => (
                  <div className="setup-stage-item" key={`${lane.title}-${batch.id}`}>
                    <span>{shortRecordId(batch.id)}</span>
                    <div>
                      <strong>{batch.partnerLabel}</strong>
                      <p className="muted">
                        {formatMoney(batch.amount, batch.currency)} / {batch.earningCount} earning(s)
                      </p>
                      <p className="muted">{batch.opsHint}</p>
                    </div>
                    <a className="text-link" href={`#${batch.id}`}>
                      Row
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{lane.emptyText}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
