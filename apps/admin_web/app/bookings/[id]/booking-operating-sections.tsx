import Link from 'next/link';
import { formatDate } from './booking-formatters';

type SummaryCard = {
  label: string;
  value: string;
  helper: string;
  href?: string;
};

type MarketplaceWalletEvidence = {
  status: string;
  tone: string;
  cards: Array<Required<SummaryCard>>;
  commandStrip: Array<Required<SummaryCard>>;
  rows: Array<{
    lane: string;
    scope: string;
    tone: string;
    status: string;
    record: string;
    operatorUse: string;
  }>;
};

type OperatingLedgerRow = {
  area: string;
  status: string;
  evidence: string;
  href: string;
};

type CloseoutReadinessItem = {
  id: string;
  label: string;
  status: string;
  detail: string;
  owner: string;
  href: string;
};

type CloseoutReadiness = {
  status: string;
  tone: string;
  helper: string;
  items: CloseoutReadinessItem[];
  openItems: CloseoutReadinessItem[];
};

type OperatingSnapshot = {
  status: string;
  tone: string;
  facts: SummaryCard[];
  noteClassName: string;
  nextAction: string;
  nextDetail: string;
  href: string;
  hrefLabel: string;
};

type OperatingTimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  at?: string | null;
  status: string;
};

type BookingHandoffChecklistItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  status: string;
  href?: string;
};

type CommunicationMovementHandoff = {
  status: string;
  tone: string;
  metrics: SummaryCard[];
  noteClassName: string;
  nextAction: string;
  nextDetail: string;
  href: string;
  hrefLabel: string;
  events: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    at: string;
  }>;
};

type ChatLifecycle = {
  status: string;
  tone: string;
  customerState: string;
  customerDetail: string;
  partnerState: string;
  partnerDetail: string;
  adminState: string;
  adminDetail: string;
  roomLabel: string;
};

export function BookingMarketplaceWalletEvidenceSection({
  marketplaceWalletEvidence,
}: {
  marketplaceWalletEvidence: MarketplaceWalletEvidence;
}) {
  return (
    <section className="card" id="marketplace-wallet-evidence" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Marketplace participation and wallet evidence</h2>
          <p className="muted">
            One booking view for actual participant records, customer final choice, marketplace alert batches,
            and cash-fee wallet impact. View-only marketplace exposure is not stored as participation.
            Partner app message when wallet debt blocks participation: Unpaid HANDS fees must be settled before
            you can participate in marketplace bookings.
          </p>
        </div>
        <span className={`pill ${marketplaceWalletEvidence.tone}`}>
          {marketplaceWalletEvidence.status}
        </span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {marketplaceWalletEvidence.cards.map((card) => (
          <a href={card.href} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </a>
        ))}
      </div>
      <div className="setup-stage-list" style={{ marginTop: 14 }}>
        {marketplaceWalletEvidence.commandStrip.map((command) => (
          <div className="setup-stage-item" key={command.label}>
            <span>{command.label}</span>
            <div>
              <strong>{command.value}</strong>
              <p className="muted">{command.helper}</p>
            </div>
            <a className="text-link" href={command.href}>
              Open
            </a>
          </div>
        ))}
      </div>
      <table className="table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Evidence lane</th>
            <th>Status</th>
            <th>Record</th>
            <th>Operator use</th>
          </tr>
        </thead>
        <tbody>
          {marketplaceWalletEvidence.rows.map((row) => (
            <tr key={row.lane}>
              <td>
                <strong>{row.lane}</strong>
                <p className="muted">{row.scope}</p>
              </td>
              <td>
                <span className={`pill ${row.tone}`}>{row.status}</span>
              </td>
              <td>{row.record}</td>
              <td>{row.operatorUse}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function BookingOperatingLedgerSection({
  operatingLedger,
}: {
  operatingLedger: OperatingLedgerRow[];
}) {
  return (
    <section className="card" id="booking-operating-ledger" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Booking operating ledger</h2>
          <p className="muted">
            Compact operator ledger for the full booking record. Every row links to the deeper factual
            section below.
          </p>
        </div>
        <span className="pill pill-info">{operatingLedger.length} record areas</span>
      </div>
      <table className="table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Area</th>
            <th>Status</th>
            <th>Evidence</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {operatingLedger.map((row) => (
            <tr key={row.area}>
              <td>{row.area}</td>
              <td>{row.status}</td>
              <td>{row.evidence}</td>
              <td>
                <a className="text-link" href={row.href}>
                  Open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function BookingCloseoutReadinessSection({
  bookingStatus,
  closeoutReadiness,
}: {
  bookingStatus: string;
  closeoutReadiness: CloseoutReadiness;
}) {
  return (
    <section className="card" id="booking-closeout-readiness" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Closeout readiness</h2>
          <p className="muted">
            End-to-end readiness check for support, dispatch, finance, tax, wallet, location, and admin
            evidence. This shows factual completeness only.
          </p>
        </div>
        <span className={`pill ${closeoutReadiness.tone}`}>{closeoutReadiness.status}</span>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        {closeoutReadiness.helper}
      </p>
      <div className="setup-stage-list" style={{ marginTop: 12 }}>
        {closeoutReadiness.items.map((item) => (
          <div className="setup-stage-item" key={item.id}>
            <span>{item.label}</span>
            <div>
              <strong>{item.status}</strong>
              <p className="muted">{item.detail}</p>
              <small>{item.owner}</small>
            </div>
            <a className="text-link" href={item.href}>
              Open
            </a>
          </div>
        ))}
      </div>
      <div className="ops-task-note" style={{ marginTop: 14 }}>
        <div className="ops-section-header">
          <div>
            <strong>Closeout exception register</strong>
            <p className="muted">
              Only unresolved factual items appear here, so the operator can clear the booking without hunting
              through every section.
            </p>
          </div>
          <span className={`pill ${closeoutReadiness.openItems.length > 0 ? 'pill-warn' : 'pill-success'}`}>
            {closeoutReadiness.openItems.length > 0
              ? `${closeoutReadiness.openItems.length} open`
              : 'No exceptions'}
          </span>
        </div>
        {closeoutReadiness.openItems.length > 0 ? (
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {closeoutReadiness.openItems.map((item) => (
              <div className="setup-stage-item" key={`exception-${item.id}`}>
                <span>{item.owner}</span>
                <div>
                  <strong>
                    {item.label}: {item.status}
                  </strong>
                  <p className="muted">{item.detail}</p>
                  <small>
                    {bookingStatus === 'COMPLETED'
                      ? 'Clear before completed closeout.'
                      : 'Clear before the next handoff.'}
                  </small>
                </div>
                <a className="text-link" href={item.href}>
                  Resolve
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 10 }}>
            Customer, partner, chat, payment, finance, cash, location, and audit records are aligned for the
            current booking stage.
          </p>
        )}
      </div>
    </section>
  );
}

export function BookingOperatingSnapshotSection({
  operatingSnapshot,
}: {
  operatingSnapshot: OperatingSnapshot;
}) {
  return (
    <section className="card" id="operating-snapshot" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Booking operating snapshot</h2>
          <p className="muted">
            Same-shift control view for the confirmed address, customer choice, partner participation, chat,
            payment, wallet, and next operator action.
          </p>
        </div>
        <span className={`pill ${operatingSnapshot.tone}`}>{operatingSnapshot.status}</span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {operatingSnapshot.facts.map((fact) => (
          <div key={fact.label}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
            <small>{fact.helper}</small>
          </div>
        ))}
      </div>
      <div className={`ops-task-note ${operatingSnapshot.noteClassName}`} style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <strong>{operatingSnapshot.nextAction}</strong>
            <p className="muted">{operatingSnapshot.nextDetail}</p>
          </div>
          <Link className="text-link" href={operatingSnapshot.href}>
            {operatingSnapshot.hrefLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function BookingOperatingTimelineSection({
  operatingTimeline,
}: {
  operatingTimeline: OperatingTimelineItem[];
}) {
  return (
    <section className="card" id="operating-timeline" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Operating timeline</h2>
          <p className="muted">
            Time-ordered operating trail for address confirmation, partner participation, customer final choice,
            chat, location, payment, wallet, tax, fee, and audit events.
          </p>
        </div>
        <span className="pill pill-info">{operatingTimeline.length} step(s)</span>
      </div>
      <div className="setup-stage-list" style={{ marginTop: 12 }}>
        {operatingTimeline.map((item) => (
          <div className="setup-stage-item" key={item.id}>
            <span>{item.type}</span>
            <div>
              <strong>{item.title}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            <small>{item.at ? formatDate(item.at) : item.status}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BookingHandoffChecklistSection({
  handoffChecklist,
}: {
  handoffChecklist: BookingHandoffChecklistItem[];
}) {
  return (
    <section className="card" id="booking-handoff-checklist" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Booking handoff checklist</h2>
          <p className="muted">
            One-row-per-stage view of the customer app, partner app, admin archive, location, and finance
            handoff. This is factual state tracking only.
          </p>
        </div>
        <span className="pill pill-info">{handoffChecklist.length} stage(s)</span>
      </div>
      <div className="setup-stage-list" style={{ marginTop: 12 }}>
        {handoffChecklist.map((item) => (
          <div className="setup-stage-item" key={item.id}>
            <span>{item.label}</span>
            <div>
              <strong>{item.title}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            {item.href ? (
              <Link className="text-link" href={item.href}>
                {item.status}
              </Link>
            ) : (
              <small>{item.status}</small>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function BookingCommunicationMovementHandoffSection({
  communicationMovementHandoff,
}: {
  communicationMovementHandoff: CommunicationMovementHandoff;
}) {
  return (
    <section className="card" id="communication-movement-handoff" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Communication and movement handoff</h2>
          <p className="muted">
            Focused booking trail for chat archive, customer/partner alerts, and partner location sharing. This
            helps support confirm whether the assigned partner and customer are connected.
          </p>
        </div>
        <span className={`pill ${communicationMovementHandoff.tone}`}>
          {communicationMovementHandoff.status}
        </span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {communicationMovementHandoff.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className={`ops-task-note ${communicationMovementHandoff.noteClassName}`} style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <strong>{communicationMovementHandoff.nextAction}</strong>
            <p className="muted">{communicationMovementHandoff.nextDetail}</p>
          </div>
          <Link className="text-link" href={communicationMovementHandoff.href}>
            {communicationMovementHandoff.hrefLabel}
          </Link>
        </div>
      </div>
      <div className="setup-stage-list" style={{ marginTop: 12 }}>
        {communicationMovementHandoff.events.length ? (
          communicationMovementHandoff.events.map((event) => (
            <div className="setup-stage-item" key={event.id}>
              <span>{event.type}</span>
              <div>
                <strong>{event.title}</strong>
                <p className="muted">{event.detail}</p>
              </div>
              <small>{formatDate(event.at)}</small>
            </div>
          ))
        ) : (
          <p className="muted">No chat, alert, or partner location event has been recorded yet.</p>
        )}
      </div>
    </section>
  );
}

export function BookingChatLifecycleSection({
  chatLifecycle,
  messageCount,
}: {
  chatLifecycle: ChatLifecycle;
  messageCount: number;
}) {
  return (
    <section className="card" id="structured-ops-status" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Chat lifecycle and retention</h2>
          <p className="muted">
            Chat is a required operational handoff after matching/service start. Mobile apps may hide it after
            service closeout, but admin keeps the full archive for support and dispute review.
          </p>
        </div>
        <span className={`pill ${chatLifecycle.tone}`}>{chatLifecycle.status}</span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        <div>
          <span>Mobile customer app</span>
          <strong>{chatLifecycle.customerState}</strong>
          <small>{chatLifecycle.customerDetail}</small>
        </div>
        <div>
          <span>Mobile partner app</span>
          <strong>{chatLifecycle.partnerState}</strong>
          <small>{chatLifecycle.partnerDetail}</small>
        </div>
        <div>
          <span>Admin archive</span>
          <strong>{chatLifecycle.adminState}</strong>
          <small>{chatLifecycle.adminDetail}</small>
        </div>
        <div>
          <span>Room</span>
          <strong>{chatLifecycle.roomLabel}</strong>
          <small>{messageCount} message(s) retained.</small>
        </div>
      </div>
    </section>
  );
}
