import Link from 'next/link';

type SummaryCard = {
  label: string;
  value: string;
  helper: string;
};

type PillBadge = {
  label: string;
  tone: string;
  detail?: string;
};

type OpsTaskCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

type StageSnapshot = {
  stage: string;
  pillClass: string;
  metrics: SummaryCard[];
  noteClassName: string;
  headline: string;
  detail: string;
  badges: PillBadge[];
  actionHref: string;
  actionLabel: string;
};

type CustomerWaitPanel = {
  signalTone: string;
  signalStatus: string;
  headline: string;
  detail: string;
  badges: PillBadge[];
  nextActionHref: string;
  nextActionLabel: string;
  cards: OpsTaskCard[];
};

type PolicySnapshot = {
  metrics: SummaryCard[];
  decisionTone: string;
  decisionStatus: string;
  decisionTitle: string;
  decisionDetail: string;
  decisionCards: Array<{
    key: string;
    label: string;
    value: string;
    helper: string;
    status: string;
    className: string;
    pillClass: string;
  }>;
};

type AddressRadiusContract = {
  tone: string;
  status: string;
  metrics: SummaryCard[];
  cards: OpsTaskCard[];
};

type BackupSupply = {
  candidateCommand: {
    tone: string;
    status: string;
    title: string;
    detail: string;
    href: string;
    action: string;
  };
  topCandidates: Array<{
    id: string;
    name: string;
    distance: string;
    locationAge: string;
  }>;
  excludedGroups: Array<{
    label: string;
    count: number;
    detail: string;
    samples: string[];
    href: string;
  }>;
  eligibleCount: number;
  metrics: SummaryCard[];
  decisionTone: string;
  decisionStatus: string;
  decisionTitle: string;
  decisionDetail: string;
  rows: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    locationAge: string;
    detail: string;
    eligible: boolean;
    distance: string;
  }>;
};

export function BookingStageSnapshotSection({ stageSnapshot }: { stageSnapshot: StageSnapshot }) {
  return (
    <section className="card" id="alerts" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Booking stage snapshot</h2>
          <p className="muted">
            Single operating readout for the first-pick timer, marketplace participation, customer choice, chat
            handoff, and closeout.
          </p>
        </div>
        <span className={`pill ${stageSnapshot.pillClass}`}>{stageSnapshot.stage}</span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {stageSnapshot.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className={`ops-task-note ${stageSnapshot.noteClassName}`} style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <strong>{stageSnapshot.headline}</strong>
            <p className="muted">{stageSnapshot.detail}</p>
            <div className="participant-list" style={{ marginTop: 8 }}>
              {stageSnapshot.badges.map((badge) => (
                <span className={`pill ${badge.tone}`} key={badge.label}>
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
          <Link className="text-link" href={stageSnapshot.actionHref}>
            {stageSnapshot.actionLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function BookingCustomerWaitPanelSection({
  customerWaitPanel,
}: {
  customerWaitPanel: CustomerWaitPanel;
}) {
  return (
    <section className="card" id="audit" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Customer wait and matching decision</h2>
          <p className="muted">
            First-pick timer, marketplace partner participation, customer final choice, and chat handoff in one
            operating view.
          </p>
        </div>
        <span className={`pill ${customerWaitPanel.signalTone}`}>{customerWaitPanel.signalStatus}</span>
      </div>
      <div className="ops-task-note" style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <strong>{customerWaitPanel.headline}</strong>
            <p className="muted">{customerWaitPanel.detail}</p>
            <div className="participant-list" style={{ marginTop: 8 }}>
              {customerWaitPanel.badges.map((badge) => (
                <span className={`pill ${badge.tone}`} key={badge.label} title={badge.detail}>
                  {badge.label}
                </span>
              ))}
            </div>
          </div>
          <Link className="text-link" href={customerWaitPanel.nextActionHref}>
            {customerWaitPanel.nextActionLabel}
          </Link>
        </div>
      </div>
      <div className="ops-task-grid" style={{ marginTop: 14 }}>
        {customerWaitPanel.cards.map((card) => (
          <div className={`ops-task-card ${card.className}`} key={card.title}>
            <span className={`pill ${card.pillClass}`}>{card.status}</span>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            <small>{card.action}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BookingAppliedPolicySection({ policySnapshot }: { policySnapshot: PolicySnapshot }) {
  return (
    <section className="card" id="backup-supply" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Applied operations policy</h2>
          <p className="muted">
            The live admin policy that operators should use when handling this booking. Existing bookings keep
            their saved timeout, while partner visibility and participation checks use the latest policy.
          </p>
        </div>
        <Link className="text-link" href="/operations-policy">
          Open policy
        </Link>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {policySnapshot.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-note" style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <span className={`pill ${policySnapshot.decisionTone}`}>{policySnapshot.decisionStatus}</span>
            <strong>{policySnapshot.decisionTitle}</strong>
            <p className="muted">{policySnapshot.decisionDetail}</p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Review decision
          </Link>
        </div>
      </div>
      <div className="ops-task-grid" style={{ marginTop: 14 }}>
        {policySnapshot.decisionCards.map((decision) => (
          <div className={`ops-task-card ${decision.className}`} key={decision.key}>
            <span className={`pill ${decision.pillClass}`}>{decision.status}</span>
            <h3>{decision.label}</h3>
            <p>{decision.value}</p>
            <small>{decision.helper}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BookingAddressRadiusContractSection({
  addressRadiusContract,
}: {
  addressRadiusContract: AddressRadiusContract;
}) {
  return (
    <section className="card" id="address-radius-contract" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Booking address radius contract</h2>
          <p className="muted">
            The immutable booking address snapshot is the source of truth for 10km marketplace eligibility.
          </p>
        </div>
        <span className={`pill ${addressRadiusContract.tone}`}>{addressRadiusContract.status}</span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {addressRadiusContract.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-grid" style={{ marginTop: 14 }}>
        {addressRadiusContract.cards.map((card) => (
          <div className={`ops-task-card ${card.className}`} key={card.title}>
            <span className={`pill ${card.pillClass}`}>{card.status}</span>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            <small>{card.action}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BookingDispatchCandidateDecisionMatrixSection({
  backupSupply,
}: {
  backupSupply: BackupSupply;
}) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Dispatch candidate decision matrix</h2>
          <p className="muted">
            Booking-specific readout for who can be used now, who is excluded, and what the operator should fix
            before extending customer wait time.
          </p>
        </div>
        <span className={`pill ${backupSupply.candidateCommand.tone}`}>
          {backupSupply.candidateCommand.status}
        </span>
      </div>
      <div className="ops-task-note" style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <strong>{backupSupply.candidateCommand.title}</strong>
            <p className="muted">{backupSupply.candidateCommand.detail}</p>
          </div>
          <Link className="text-link" href={backupSupply.candidateCommand.href}>
            {backupSupply.candidateCommand.action}
          </Link>
        </div>
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Top usable partners</h3>
          <p className="muted">
            Closest eligible partners under the booking pin, radius, online, verification, and location freshness
            gates.
          </p>
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {backupSupply.topCandidates.map((row) => (
              <div className="setup-stage-item" key={`candidate-${row.id}`}>
                <span>GO</span>
                <div>
                  <strong>{row.name}</strong>
                  <p className="muted">
                    {row.distance} / {row.locationAge}
                  </p>
                </div>
                <Link className="text-link" href={`/partners/${row.id}`}>
                  Open
                </Link>
              </div>
            ))}
            {backupSupply.topCandidates.length === 0 ? (
              <div className="setup-stage-item">
                <span>NONE</span>
                <div>
                  <strong>No usable partner candidate</strong>
                  <p className="muted">
                    Use the exclusion groups to decide whether to refresh location, widen policy, or contact
                    partners.
                  </p>
                </div>
                <Link className="text-link" href="/partners?review=marketplace-ready">
                  Open marketplace queue
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        <div className="card">
          <h3>Excluded partner groups</h3>
          <p className="muted">Grouped by the first operational reason they cannot participate in this booking.</p>
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {backupSupply.excludedGroups.map((group) => (
              <div className="setup-stage-item" key={group.label}>
                <span>{group.count ? 'FIX' : 'OK'}</span>
                <div>
                  <strong>{group.label}</strong>
                  <p className="muted">{group.detail}</p>
                  {group.samples.length ? <p className="muted">Sample: {group.samples.join(', ')}</p> : null}
                </div>
                <Link className="text-link" href={group.href}>
                  {group.count}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function BookingMarketplaceSupplySection({ backupSupply }: { backupSupply: BackupSupply }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Marketplace partner supply for this booking</h2>
          <p className="muted">
            Booking-pin view of who can participate as a marketplace partner, and exactly why others are
            excluded.
          </p>
        </div>
        <span className={`pill ${backupSupply.eligibleCount ? 'pill-success' : 'pill-warn'}`}>
          {backupSupply.eligibleCount} eligible
        </span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {backupSupply.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-note" style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <span className={`pill ${backupSupply.decisionTone}`}>{backupSupply.decisionStatus}</span>
            <strong>{backupSupply.decisionTitle}</strong>
            <p className="muted">{backupSupply.decisionDetail}</p>
          </div>
          <Link className="text-link" href="/partners">
            Open partners
          </Link>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 14 }}>
        {backupSupply.rows.map((row) => (
          <div className="ops-row" key={row.id}>
            <div>
              <strong>
                <Link className="text-link" href={`/partners/${row.id}`}>
                  {row.name}
                </Link>
              </strong>
              <p className="muted">
                {row.role} / {row.status} / {row.locationAge}
              </p>
              <p className="muted">{row.detail}</p>
            </div>
            <div>
              <span className={`pill ${row.eligible ? 'pill-success' : 'pill-warn'}`}>
                {row.eligible ? 'Can participate' : 'Excluded'}
              </span>
              <div className="muted">{row.distance}</div>
            </div>
          </div>
        ))}
        {backupSupply.rows.length === 0 ? (
          <p className="muted">No partner supply can be evaluated until the booking has a customer pin.</p>
        ) : null}
      </div>
    </section>
  );
}
