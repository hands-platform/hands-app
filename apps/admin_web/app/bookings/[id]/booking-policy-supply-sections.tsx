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

type MarketplaceSupply = {
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

export function BookingStageSnapshotSection({ stageSnapshot }: BookingStageSnapshotSectionProps) {
  return (
    <section className="card admin-mb-16" id="alerts">
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
      <SummaryCardGrid cards={stageSnapshot.metrics} />
      <div className={`ops-task-note ${stageSnapshot.noteClassName} admin-mt-14`}>
        <div className="ops-row">
          <div>
            <strong>{stageSnapshot.headline}</strong>
            <p className="muted">{stageSnapshot.detail}</p>
            <PillBadgeList badges={stageSnapshot.badges} />
          </div>
          <Link className="text-link" href={stageSnapshot.actionHref}>
            {stageSnapshot.actionLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export type BookingStageSnapshotSectionProps = {
  stageSnapshot: StageSnapshot;
};

export function BookingCustomerWaitPanelSection({
  customerWaitPanel,
}: BookingCustomerWaitPanelSectionProps) {
  return (
    <section className="card admin-mb-16" id="audit">
      <div className="ops-section-header">
        <div>
          <h2>Customer wait and matching decision</h2>
          <p className="muted">
            First-pick timer, marketplace Partner participation, customer final choice, and chat handoff in one
            operating view.
          </p>
        </div>
        <span className={`pill ${customerWaitPanel.signalTone}`}>{customerWaitPanel.signalStatus}</span>
      </div>
      <div className="ops-task-note admin-mt-14">
        <div className="ops-row">
          <div>
            <strong>{customerWaitPanel.headline}</strong>
            <p className="muted">{customerWaitPanel.detail}</p>
            <PillBadgeList badges={customerWaitPanel.badges} showDetailTitle />
          </div>
          <Link className="text-link" href={customerWaitPanel.nextActionHref}>
            {customerWaitPanel.nextActionLabel}
          </Link>
        </div>
      </div>
      <OpsTaskCardGrid cards={customerWaitPanel.cards} />
    </section>
  );
}

export type BookingCustomerWaitPanelSectionProps = {
  customerWaitPanel: CustomerWaitPanel;
};

export function BookingAppliedPolicySection({ policySnapshot }: { policySnapshot: PolicySnapshot }) {
  return (
    <section className="card admin-mb-16" id="applied-operations-policy">
      <div className="ops-section-header">
        <div>
          <h2>Applied operations policy</h2>
          <p className="muted">
            The live admin policy that operators should use when handling this booking. Existing bookings keep
            their saved timeout, while Partner visibility and participation checks use the latest policy.
          </p>
        </div>
        <Link className="text-link" href="/operations-policy">
          Open policy
        </Link>
      </div>
      <SummaryCardGrid cards={policySnapshot.metrics} />
      <div className="ops-task-note admin-mt-14">
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
      <div className="ops-task-grid admin-mt-14">
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
    <section className="card admin-mb-16" id="address-radius-contract">
      <div className="ops-section-header">
        <div>
          <h2>Booking address radius contract</h2>
          <p className="muted">
            The immutable booking address snapshot is the source of truth for 10km marketplace eligibility.
          </p>
        </div>
        <span className={`pill ${addressRadiusContract.tone}`}>{addressRadiusContract.status}</span>
      </div>
      <SummaryCardGrid cards={addressRadiusContract.metrics} />
      <OpsTaskCardGrid cards={addressRadiusContract.cards} />
    </section>
  );
}

export function BookingDispatchCandidateDecisionMatrixSection({
  marketplaceSupply,
}: {
  marketplaceSupply: MarketplaceSupply;
}) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Booking-address supply check</h2>
          <p className="muted">
            Booking-specific readout for usable marketplace supply and operational blockers. Actual
            participation evidence stays in the participant ledger; wallet-debt Partners are repaired from
            Partner and Finance lanes instead of being listed as booking candidates.
          </p>
        </div>
        <span className={`pill ${marketplaceSupply.candidateCommand.tone}`}>
          {marketplaceSupply.candidateCommand.status}
        </span>
      </div>
      <div className="ops-task-note admin-mt-14">
        <div className="ops-row">
          <div>
            <strong>{marketplaceSupply.candidateCommand.title}</strong>
            <p className="muted">{marketplaceSupply.candidateCommand.detail}</p>
          </div>
          <Link className="text-link" href={marketplaceSupply.candidateCommand.href}>
            {marketplaceSupply.candidateCommand.action}
          </Link>
        </div>
      </div>
      <div className="grid admin-mt-14">
        <div className="card">
          <h3>Top usable Partners</h3>
          <p className="muted">
            Closest eligible Partners under the booking pin, radius, online, verification, and location freshness
            gates.
          </p>
          <div className="setup-stage-list admin-mt-12">
            {marketplaceSupply.topCandidates.map((row) => (
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
            {marketplaceSupply.topCandidates.length === 0 ? (
              <div className="setup-stage-item">
                <span>NONE</span>
                <div>
                  <strong>No usable marketplace participant</strong>
                  <p className="muted">
                    Use the exclusion groups to decide whether to refresh location, widen policy, or contact
                    Partners.
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
          <h3>Operational supply blockers</h3>
          <p className="muted">
            Non-wallet supply repair groups for this booking pin. Wallet debt repair is handled outside the
            booking candidate list.
          </p>
          <div className="setup-stage-list admin-mt-12">
            {marketplaceSupply.excludedGroups.map((group) => (
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

export function BookingMarketplaceSupplySection({ marketplaceSupply }: { marketplaceSupply: MarketplaceSupply }) {
  return (
    <section className="card admin-mb-16" id="marketplace-supply">
      <div className="ops-section-header">
        <div>
          <h2>Marketplace Partner supply for this booking</h2>
          <p className="muted">
            Booking-pin view of currently usable marketplace supply. This is not an activity log; participant
            history and customer choice evidence are retained in the participant ledger.
          </p>
        </div>
        <span className={`pill ${marketplaceSupply.eligibleCount ? 'pill-success' : 'pill-warn'}`}>
          {marketplaceSupply.eligibleCount} eligible
        </span>
      </div>
      <SummaryCardGrid cards={marketplaceSupply.metrics} />
      <div className="ops-task-note admin-mt-14">
        <div className="ops-row">
          <div>
            <span className={`pill ${marketplaceSupply.decisionTone}`}>{marketplaceSupply.decisionStatus}</span>
            <strong>{marketplaceSupply.decisionTitle}</strong>
            <p className="muted">{marketplaceSupply.decisionDetail}</p>
          </div>
          <Link className="text-link" href="/partners">
            Open Partners
          </Link>
        </div>
      </div>
      <div className="stack admin-mt-14">
        {marketplaceSupply.rows.map((row) => (
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
        {marketplaceSupply.rows.length === 0 ? (
          <p className="muted">
            No displayable Partner supply can be evaluated until the booking has a customer pin or an
            eligible non-wallet-blocked Partner.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SummaryCardGrid({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="service-trace-summary admin-mt-12">
      {cards.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.helper}</small>
        </div>
      ))}
    </div>
  );
}

function PillBadgeList({
  badges,
  showDetailTitle = false,
}: {
  badges: PillBadge[];
  showDetailTitle?: boolean;
}) {
  return (
    <div className="participant-list admin-mt-8">
      {badges.map((badge) => (
        <span className={`pill ${badge.tone}`} key={badge.label} title={showDetailTitle ? badge.detail : undefined}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function OpsTaskCardGrid({ cards }: { cards: OpsTaskCard[] }) {
  return (
    <div className="ops-task-grid admin-mt-14">
      {cards.map((card) => (
        <div className={`ops-task-card ${card.className}`} key={card.title}>
          <span className={`pill ${card.pillClass}`}>{card.status}</span>
          <h3>{card.title}</h3>
          <p>{card.detail}</p>
          <small>{card.action}</small>
        </div>
      ))}
    </div>
  );
}
