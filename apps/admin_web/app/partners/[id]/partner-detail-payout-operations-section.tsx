import Link from 'next/link';

export type PartnerPayoutOperationsTone = 'done' | 'pending' | 'blocked';

export type PartnerPayoutOperationsCard = {
  readonly action: string;
  readonly detail: string;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerPayoutOperationsTone;
};

export type PartnerPayoutOperationsView = {
  readonly blockers: readonly string[];
  readonly cards: readonly PartnerPayoutOperationsCard[];
  readonly hold?: {
    readonly expiresAtLabel: string;
    readonly reason?: string | null;
    readonly startsAtLabel: string;
  } | null;
  readonly status: string;
  readonly tone: PartnerPayoutOperationsTone;
};

export type PartnerPayoutEarningRow = {
  readonly amountLine: string;
  readonly detailLine: string;
  readonly id: string;
  readonly settlementNotes?: string | null;
  readonly settlementRef?: string | null;
  readonly smallLabel: string;
  readonly statusLabel: string;
  readonly title: string;
  readonly walletLines: readonly string[];
};

export type PartnerPayoutBatchRow = {
  readonly createdLine: string;
  readonly href: string;
  readonly id: string;
  readonly paidLine?: string | null;
  readonly status: string;
  readonly totalNetLabel: string;
};

type PartnerDetailPayoutOperationsSectionProps = {
  readonly cardClassForTone: (tone: PartnerPayoutOperationsTone) => string;
  readonly earningsRows: readonly PartnerPayoutEarningRow[];
  readonly hasCashFeeDebt: boolean;
  readonly operations: PartnerPayoutOperationsView;
  readonly partnerControlsHref: string;
  readonly payoutBatchRows: readonly PartnerPayoutBatchRow[];
  readonly pillClassForTone: (tone: PartnerPayoutOperationsTone) => string;
};

export function PartnerDetailPayoutOperationsSection({
  cardClassForTone,
  earningsRows,
  hasCashFeeDebt,
  operations,
  partnerControlsHref,
  payoutBatchRows,
  pillClassForTone,
}: PartnerDetailPayoutOperationsSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Payout operations</h2>
          <p className="muted">
            Settlement view for unpaid earnings, withholding, payout batches, and payout holds.
          </p>
        </div>
        <span className={`pill ${pillClassForTone(operations.tone)}`}>{operations.status}</span>
      </div>
      <div className="ops-task-grid">
        {operations.cards.map((card) => (
          <div className={`ops-task-card ${cardClassForTone(card.tone)}`} key={card.title}>
            <div>
              <span className={`pill ${pillClassForTone(card.tone)}`}>{card.status}</span>
              <h3>{card.title}</h3>
              <p className="muted">{card.detail}</p>
            </div>
            <small>{card.action}</small>
          </div>
        ))}
      </div>
      {operations.hold ? (
        <div className="setup-stage-item admin-mt-16">
          <span>HELD</span>
          <div>
            <strong>Active payout hold</strong>
            <p className="muted">{operations.hold.reason}</p>
            <p className="muted">
              Started {operations.hold.startsAtLabel} / expires {operations.hold.expiresAtLabel}
            </p>
          </div>
          <Link className="text-link" href={partnerControlsHref}>
            Reports desk
          </Link>
        </div>
      ) : null}
      {operations.blockers.length ? (
        <div className="setup-stage-list">
          {operations.blockers.map((blocker) => (
            <div className="setup-stage-item" key={blocker}>
              <span>GATE</span>
              <div>
                <strong>Payout blocker</strong>
                <p className="muted">{blocker}</p>
              </div>
              <small>Resolve</small>
            </div>
          ))}
        </div>
      ) : null}
      <div className="detail-grid admin-mt-16">
        <div>
          <div className="ops-section-header">
            <h3>Recent earnings</h3>
            <div className="actions">
              {hasCashFeeDebt ? (
                <Link className="text-link" href="/cash-settlements">
                  Cash debt queue
                </Link>
              ) : null}
              <Link className="text-link" href="/earnings">
                Open earnings
              </Link>
            </div>
          </div>
          {earningsRows.length ? (
            <div className="setup-stage-list">
              {earningsRows.map((earning) => (
                <div className="setup-stage-item" key={earning.id}>
                  <span>{earning.statusLabel}</span>
                  <div>
                    <strong>{earning.title}</strong>
                    <p className="muted">{earning.amountLine}</p>
                    <p className="muted">{earning.detailLine}</p>
                    {earning.settlementRef ? (
                      <p className="muted">Settlement ref {earning.settlementRef}</p>
                    ) : null}
                    {earning.settlementNotes ? (
                      <p className="muted">{earning.settlementNotes}</p>
                    ) : null}
                    {earning.walletLines.map((line, index) => (
                      <p className="muted" key={`${earning.id}-wallet-${index}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <small>{earning.smallLabel}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              No earnings yet. Payout eligibility starts after the first completed service.
            </p>
          )}
        </div>
        <div>
          <div className="ops-section-header">
            <h3>Recent payout batches</h3>
            <Link className="text-link" href="/payouts">
              Open payouts
            </Link>
          </div>
          {payoutBatchRows.length ? (
            <div className="setup-stage-list">
              {payoutBatchRows.map((batch) => (
                <div className="setup-stage-item" key={batch.id}>
                  <span>{batch.status}</span>
                  <div>
                    <strong>{batch.totalNetLabel}</strong>
                    <p className="muted">{batch.createdLine}</p>
                    {batch.paidLine ? <p className="muted">{batch.paidLine}</p> : null}
                  </div>
                  <Link className="text-link" href={batch.href}>
                    View
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No payout batch has been created for this partner yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
