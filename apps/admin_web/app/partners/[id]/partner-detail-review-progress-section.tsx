export type PartnerLevelPlanItem = {
  readonly blocked: boolean;
  readonly detail: string;
  readonly level: string;
  readonly operatorAction: string;
  readonly ready: boolean;
  readonly status: string;
};

export type PartnerLevelPlanView = {
  readonly currentLevel: string;
  readonly items: readonly PartnerLevelPlanItem[];
};

export type PartnerResubmissionItem = {
  readonly operatorAction: string;
  readonly providerInstruction: string;
  readonly reason: string;
  readonly status: string;
  readonly target: string;
};

export type PartnerResubmissionPlanView = {
  readonly items: readonly PartnerResubmissionItem[];
};

export type PartnerReviewHistoryRow = {
  readonly action: string;
  readonly actorLabel: string;
  readonly atLabel: string;
  readonly id: string;
  readonly preview?: string | null;
  readonly statusLabel: string;
  readonly title: string;
};

type PartnerDetailLevelPathSectionProps = {
  readonly plan: PartnerLevelPlanView;
};

type PartnerDetailResubmissionGuidanceSectionProps = {
  readonly plan: PartnerResubmissionPlanView;
};

type PartnerDetailReviewHistorySectionProps = {
  readonly rows: readonly PartnerReviewHistoryRow[];
  readonly totalCount: number;
};

export function PartnerDetailLevelPathSection({ plan }: PartnerDetailLevelPathSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Partner level path</h2>
          <p className="muted">
            Operator view of Level 1 signup, Level 2 activity, Level 3 payout, and optional profile review
            gates.
          </p>
        </div>
        <span className="pill pill-info">{plan.currentLevel}</span>
      </div>
      <div className="setup-stage-list">
        {plan.items.map((item) => (
          <div className="setup-stage-item" key={item.level}>
            <span>{item.status}</span>
            <div>
              <strong>{item.level}</strong>
              <p className="muted">{item.detail}</p>
              <p className="muted">{item.operatorAction}</p>
            </div>
            <small>{item.ready ? 'Clear' : item.blocked ? 'Blocked' : 'Next'}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PartnerDetailResubmissionGuidanceSection({
  plan,
}: PartnerDetailResubmissionGuidanceSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Resubmission guidance</h2>
          <p className="muted">
            Use this when a partner asks what to fix after rejection. Keep the message specific and
            auditable.
          </p>
        </div>
        <span className={`pill ${plan.items.length ? 'pill-danger' : 'pill-success'}`}>
          {plan.items.length} item(s)
        </span>
      </div>
      <div className="setup-stage-list">
        {plan.items.length ? (
          plan.items.map((item) => (
            <div className="setup-stage-item" key={item.target}>
              <span>{item.status}</span>
              <div>
                <strong>{item.target}</strong>
                <p className="muted">{item.reason}</p>
                <p className="muted">{item.providerInstruction}</p>
              </div>
              <small>{item.operatorAction}</small>
            </div>
          ))
        ) : (
          <div className="setup-stage-item">
            <span>CLEAR</span>
            <div>
              <strong>No resubmission request needed</strong>
              <p className="muted">
                There are no rejected partner documents, bank accounts, KYC, or tax profiles.
              </p>
            </div>
            <small>OK</small>
          </div>
        )}
      </div>
    </div>
  );
}

export function PartnerDetailReviewHistorySection({
  rows,
  totalCount,
}: PartnerDetailReviewHistorySectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Review history</h2>
          <p className="muted">
            Partner, KYC, document, bank, and tax review decisions are shown here for handoff and audit.
          </p>
        </div>
        <span className="pill pill-info">{totalCount} recent event(s)</span>
      </div>
      {rows.length ? (
        <div className="setup-stage-list">
          {rows.map((row) => (
            <div className="setup-stage-item" key={row.id}>
              <span>{row.title}</span>
              <div>
                <strong>{row.statusLabel}</strong>
                <p className="muted">
                  {row.atLabel} / {row.actorLabel}
                </p>
                {row.preview ? <p className="muted">{row.preview}</p> : null}
              </div>
              <small>{row.action}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          No partner review logs yet. New approval, rejection, and resubmission actions will appear here.
        </p>
      )}
    </div>
  );
}
