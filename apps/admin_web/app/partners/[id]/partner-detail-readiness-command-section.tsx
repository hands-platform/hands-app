import Link from 'next/link';

export type PartnerOpsTone = 'blocked' | 'done' | 'pending';

export type PartnerReadinessSnapshotBadge = {
  readonly detail: string;
  readonly label: string;
  readonly tone: PartnerOpsTone;
};

export type PartnerReadinessSnapshotView = {
  readonly badges: readonly PartnerReadinessSnapshotBadge[];
  readonly gate: {
    readonly detail: string;
    readonly helper: string;
    readonly label: string;
    readonly title: string;
  };
  readonly status: string;
  readonly tone: PartnerOpsTone;
};

export type PartnerAcceptanceRepairCommandView = {
  readonly customerImpact: string;
  readonly marketplaceRouting: string;
  readonly operatorDecision: string;
  readonly partnerAppMessage: string;
  readonly status: string;
  readonly steps: readonly PartnerAcceptanceRepairStep[];
  readonly tone: PartnerOpsTone;
};

type PartnerAcceptanceRepairStep = {
  readonly actionLabel: string;
  readonly blocker: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly owner: string;
  readonly reason: string;
  readonly tone: PartnerOpsTone;
};

type PartnerDetailReadinessSnapshotSectionProps = {
  readonly snapshot: PartnerReadinessSnapshotView;
};

type PartnerAcceptanceRepairCommandSectionProps = {
  readonly command: PartnerAcceptanceRepairCommandView;
};

export function PartnerDetailReadinessSnapshotSection({
  snapshot,
}: PartnerDetailReadinessSnapshotSectionProps) {
  return (
    <div className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Partner readiness snapshot</h2>
          <p className="muted">
            Fast operating checks for dispatch, marketplace matching, cash settlement, KYC, payout, and
            service readiness.
          </p>
        </div>
        <span className={`pill ${pillClassForTone(snapshot.tone)}`}>{snapshot.status}</span>
      </div>
      <div className="participant-list admin-mt-12">
        {snapshot.badges.map((badge) => (
          <span className={`pill ${pillClassForTone(badge.tone)}`} key={badge.label} title={badge.detail}>
            {badge.label}
          </span>
        ))}
      </div>
      <div className="setup-stage-item admin-mt-16">
        <span>{snapshot.gate.label}</span>
        <div>
          <strong>{snapshot.gate.title}</strong>
          <p className="muted">{snapshot.gate.detail}</p>
        </div>
        <small>{snapshot.gate.helper}</small>
      </div>
    </div>
  );
}

export function PartnerAcceptanceRepairCommandSection({
  command,
}: PartnerAcceptanceRepairCommandSectionProps) {
  return (
    <div className={`card ${cardClassForTone(command.tone)} admin-mb-16`}>
      <div className="ops-section-header">
        <div>
          <h2>Marketplace repair command</h2>
          <p className="muted">
            Exact operator diagnosis for marketplace participation, customer handoff, app message, and finance
            repair.
          </p>
        </div>
        <span className={`pill ${pillClassForTone(command.tone)}`}>{command.status}</span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        <TraceSummaryItem
          helper="What support should expect the partner to see."
          label="Partner app block message"
          value={command.partnerAppMessage}
        />
        <TraceSummaryItem
          helper="How this affects customer choice and matching."
          label="Customer impact"
          value={command.customerImpact}
        />
        <TraceSummaryItem
          helper="Use this before manual override or dispatch."
          label="Operator decision"
          value={command.operatorDecision}
        />
        <TraceSummaryItem
          helper="Where live demand should go while blocked."
          label="Marketplace routing"
          value={command.marketplaceRouting}
        />
      </div>
      <div className="setup-stage-list admin-mt-16">
        {command.steps.map((step, index) => (
          <div className="setup-stage-item" key={`${step.owner}-${step.blocker}`}>
            <span>{index + 1}</span>
            <div>
              <strong>
                {step.owner}: {step.blocker}
              </strong>
              <p className="muted">{step.reason}</p>
              <p className="muted">{step.operatorAction}</p>
              <span className={`pill ${pillClassForTone(step.tone)}`}>{stepToneLabel(step.tone)}</span>
            </div>
            <Link className="text-link" href={step.href}>
              {step.actionLabel}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraceSummaryItem({
  helper,
  label,
  value,
}: {
  readonly helper: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function stepToneLabel(tone: PartnerOpsTone) {
  if (tone === 'done') {
    return 'Clear';
  }
  if (tone === 'blocked') {
    return 'Blocks booking';
  }
  return 'Operator check';
}

function pillClassForTone(tone: PartnerOpsTone) {
  if (tone === 'done') {
    return 'pill-success';
  }
  if (tone === 'blocked') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function cardClassForTone(tone: PartnerOpsTone) {
  if (tone === 'done') {
    return 'ops-task-done';
  }
  if (tone === 'blocked') {
    return 'ops-task-blocked';
  }
  return 'ops-task-pending';
}
