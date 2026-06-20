import Link from 'next/link';

type PartnerReviewPanelTone = 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';

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

export type PartnerReviewControlPanelMetric = {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
};

export type PartnerReviewControlPanelItem = {
  readonly detail: string;
  readonly href?: string;
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerReviewPanelTone;
};

export type PartnerReviewControlPanelView = {
  readonly items: readonly PartnerReviewControlPanelItem[];
  readonly metrics: readonly PartnerReviewControlPanelMetric[];
  readonly status: string;
  readonly tone: PartnerReviewPanelTone;
};

type PartnerDetailLevelPathSectionProps = {
  readonly plan: PartnerLevelPlanView;
};

type PartnerDetailReviewControlPanelSectionProps = {
  readonly panel: PartnerReviewControlPanelView;
};

type PartnerDetailResubmissionGuidanceSectionProps = {
  readonly plan: PartnerResubmissionPlanView;
};

type PartnerDetailReviewHistorySectionProps = {
  readonly rows: readonly PartnerReviewHistoryRow[];
  readonly totalCount: number;
};

export function PartnerDetailReviewControlPanelSection({
  panel,
}: PartnerDetailReviewControlPanelSectionProps) {
  return (
    <div className="card admin-mb-16" id="partner-review-control-panel">
      <div className="ops-section-header">
        <div>
          <h2>Partner review control panel</h2>
          <p className="muted">
            One-screen review map for submitted Partner information, active hold reason, resubmission
            needs, and the latest admin decision trail.
          </p>
        </div>
        <span className={`pill ${panel.tone}`}>{panel.status}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {panel.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.helper}</small>
          </div>
        ))}
      </div>
      <div className="setup-stage-list admin-mt-16">
        {panel.items.map((item) => (
          <div className="setup-stage-item" key={item.id}>
            <span>{item.label}</span>
            <div>
              <strong>{item.title}</strong>
              <p className="muted">{item.detail}</p>
              <span className={`pill ${item.tone}`}>{item.status}</span>
            </div>
            {item.href ? (
              <Link className="text-link" href={item.href}>
                Open
              </Link>
            ) : (
              <small>Review</small>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

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
    <div className="card admin-mb-16" id="partner-review-history">
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
