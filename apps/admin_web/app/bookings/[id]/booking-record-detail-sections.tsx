import { AdminPersonCell } from '../../../components/admin-person-cell';
import { type AdminChatMessage } from '../../../lib/admin-api';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import type { BookingPostMatchChatEvidenceRow } from '../booking-post-match-chat-evidence';

type InfoRowModel = {
  label: string;
  value: string;
};

type TimelineStage = {
  label: string;
  value: string;
  hint: string;
  done: boolean;
};

type SummaryCard = {
  href: string;
  label: string;
  value: string;
  helper: string;
};

type SelectionTraceRow = {
  label: string;
  value: string;
  helper: string;
  status: string;
  tone: string;
};

type ParticipantLifecycleRow = {
  stage: string;
  scope: string;
  status: string;
  evidence: string;
  operatorUse: string;
  tone: string;
};

type ParticipantFact = {
  label: string;
  value: string;
  tone: string;
};

type ParticipantRow = {
  id: string;
  partner: string;
  avatarStatus: AdminAvatarStatus;
  identity: string;
  href?: string | null;
  evidenceTone: string;
  evidenceLabel: string;
  evidenceDetail: string;
  roleTone: string;
  role: string;
  statusTone: string;
  status: string;
  choiceTone: string;
  choiceState: string;
  operatorStatus: string;
  decision: string;
  eligibilityLabel: string;
  eligibilityTone: string;
  eligibilityReason: string;
  eligibilityNextStep: string;
  distance: string;
  distancePolicyLabel: string;
  distancePolicyTone: string;
  distancePolicyHelper: string;
  facts: ParticipantFact[];
  timing: string;
  operatorUse: string;
};

type ParticipantLedger = {
  status: string;
  tone: string;
  boundary: {
    helper: string;
    pills: string[];
  };
  cards: SummaryCard[];
  selectionTrace: SelectionTraceRow[];
  lifecycleRows: ParticipantLifecycleRow[];
  rows: ParticipantRow[];
};

type ParticipantLedgerSectionProps = {
  participantLedger: ParticipantLedger;
};

type ParticipantBoundaryProps = {
  boundary: ParticipantLedger['boundary'];
};

type ParticipantSelectionTraceProps = {
  rows: SelectionTraceRow[];
};

type ParticipantLifecycleLedgerProps = {
  rows: ParticipantLifecycleRow[];
};

type ParticipantRowsProps = {
  rows: ParticipantRow[];
};

type SummaryCardsProps = {
  cards: SummaryCard[];
};

type InfoRowsProps = {
  rows: InfoRowModel[];
};

type CashSettlementRow = {
  lane: string;
  scope: string;
  status: string;
  tone: string;
  evidence: string;
  nextStep: string;
};

type CashSettlementPath = {
  status: string;
  tone: string;
  cards: SummaryCard[];
  rows: CashSettlementRow[];
};

type LocationTrailRow = {
  badge: string;
  badgeTone: string;
  id: string;
  label: string;
  coordinate: string;
  detail: string;
  recordedAt: string;
};

export type BookingRecordDetailSectionsProps = {
  cashFeeSettlementPath: CashSettlementPath;
  chatEvidenceRows: readonly BookingPostMatchChatEvidenceRow[];
  chatMessages: AdminChatMessage[];
  customerProfileId?: string | null;
  customerRows: InfoRowModel[];
  finalPartnerId?: string | null;
  financeRows: InfoRowModel[];
  hasLatestPartnerLocation: boolean;
  handoffRows: InfoRowModel[];
  locationTrailRows: LocationTrailRow[];
  participantLedger: ParticipantLedger;
  paymentRows: InfoRowModel[];
  serviceRows: InfoRowModel[];
  timelineStages: TimelineStage[];
};

export function BookingRecordDetailSections({
  cashFeeSettlementPath,
  chatEvidenceRows,
  chatMessages,
  customerProfileId,
  customerRows,
  finalPartnerId,
  financeRows,
  hasLatestPartnerLocation,
  handoffRows,
  locationTrailRows,
  participantLedger,
  paymentRows,
  serviceRows,
  timelineStages,
}: BookingRecordDetailSectionsProps) {
  return (
    <>
      <section className="detail-grid">
        <div className="card" id="flow">
          <h2>Operations timeline</h2>
          <div className="timeline">
            {timelineStages.map((stage) => (
              <div className={`timeline-step ${stage.done ? 'timeline-done' : ''}`} key={stage.label}>
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
                <p className="muted">{stage.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card" id="customer">
          <div className="ops-section-header">
            <h2>Customer</h2>
            {customerProfileId && <span className="pill pill-neutral">Linked in toolbar</span>}
          </div>
          <InfoRows rows={customerRows} />
        </div>

        <div className="card" id="service">
          <h2>Service</h2>
          <InfoRows rows={serviceRows} />
        </div>

        <div className="card" id="handoff">
          <div className="ops-section-header">
            <h2>Partner handoff</h2>
            {finalPartnerId ? (
              <span className="pill pill-neutral">Linked in toolbar</span>
            ) : (
              <span className="pill pill-neutral">Partner record link pending</span>
            )}
          </div>
          <InfoRows rows={handoffRows} />
        </div>
      </section>

      <section className="detail-grid admin-mt-16">
        <ParticipantLedgerSection participantLedger={participantLedger} />

        <div className="card" id="payment">
          <h2>Payment and refund</h2>
          <InfoRows rows={paymentRows} />
        </div>

        <CashFeeSettlementPathSection cashFeeSettlementPath={cashFeeSettlementPath} />

        <div className="card" id="finance">
          <h2>Finance trace</h2>
          <InfoRows rows={financeRows} />
        </div>

        <div className="card" id="chat">
          <div className="ops-section-header">
            <div>
              <h2>Chat evidence</h2>
              <p className="muted">Compact archive state. The full retained transcript stays in the chat history panel.</p>
            </div>
            <span className="pill pill-info">{countLabel(chatMessages.length, 'message')}</span>
          </div>
          {chatEvidenceRows.length > 0 && (
            <div className="booking-chat-evidence-grid is-detail" aria-label="Booking chat evidence snapshot">
              {chatEvidenceRows.map((row) => (
                <div className="booking-chat-evidence-item" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  <p>{row.helper}</p>
                </div>
              ))}
            </div>
          )}
          {chatEvidenceRows.length === 0 && <p className="muted">No chat evidence snapshot linked to this booking yet.</p>}
        </div>

        <div className="card" id="location">
          <div className="ops-section-header">
            <div>
              <h2>Location evidence</h2>
              <p className="muted">Partner snapshots captured only for booking actions and live movement checks.</p>
            </div>
            <span className="pill pill-neutral">{countLabel(locationTrailRows.length, 'snapshot')}</span>
          </div>
          <div className="route-mini">
            <span className="route-dot route-customer">Customer</span>
            {hasLatestPartnerLocation && <span className="route-dot route-provider">Partner</span>}
          </div>
          <div className="booking-settlement-ledger booking-location-evidence-ledger admin-mt-12" aria-label="Booking location evidence rows">
            {locationTrailRows.map((snapshot) => (
              <div className="booking-settlement-ledger-row is-location-evidence" key={snapshot.id}>
                <div>
                  <span className="booking-settlement-ledger-label">{snapshot.label}</span>
                  <p className="muted">{snapshot.recordedAt}</p>
                </div>
                <strong className="booking-settlement-ledger-value">{snapshot.coordinate}</strong>
                <p className="muted">{snapshot.detail}</p>
                <span className={`pill ${snapshot.badgeTone}`}>{snapshot.badge}</span>
              </div>
            ))}
            {locationTrailRows.length === 0 && (
              <p className="muted booking-location-evidence-empty">
                No Partner location snapshots linked to this booking yet.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function ParticipantLedgerSection({ participantLedger }: ParticipantLedgerSectionProps) {
  const { boundary, cards, lifecycleRows, rows, selectionTrace, status, tone } = participantLedger;

  return (
    <div className="card" id="participants">
      <div className="ops-section-header">
        <div>
          <h2>Actual marketplace participant ledger</h2>
          <p className="muted">
            Booking participation evidence only; marketplace supply visibility is tracked separately.
          </p>
        </div>
        <span className={`pill ${tone}`}>{status}</span>
      </div>
      <ParticipantBoundary boundary={boundary} />
      <SummaryCards cards={cards} />
      <ParticipantSelectionTrace rows={selectionTrace} />
      <ParticipantLifecycleLedger rows={lifecycleRows} />
      <h3 className="admin-mt-18">Partner participation rows</h3>
      <p className="muted">
        One row per Partner with booking evidence, customer selection state, distance policy, and operator notes.
      </p>
      <ParticipantRows rows={rows} />
    </div>
  );
}

function ParticipantBoundary({ boundary }: ParticipantBoundaryProps) {
  return (
    <>
      <div className="participant-list admin-mt-12">
        {boundary.pills.map((pill, index) => (
          <span className={getParticipantBoundaryPillClass(index)} key={pill}>
            {pill}
          </span>
        ))}
      </div>
      <p className="muted admin-mt-10">{boundary.helper}</p>
    </>
  );
}

function getParticipantBoundaryPillClass(index: number) {
  if (index === 0) {
    return 'pill pill-info';
  }

  if (index === 1) {
    return 'pill pill-warn';
  }

  return 'pill';
}

function ParticipantSelectionTrace({ rows }: ParticipantSelectionTraceProps) {
  return (
    <div className="booking-settlement-ledger admin-mt-14" aria-label="Participant selection trace rows">
      {rows.map((item) => (
        <div className="booking-settlement-ledger-row is-command" key={item.label}>
          <span className="booking-settlement-ledger-label">{item.label}</span>
          <strong className="booking-settlement-ledger-value">{item.value}</strong>
          <p className="muted">{item.helper}</p>
          <span className={`pill ${item.tone}`}>{item.status}</span>
        </div>
      ))}
    </div>
  );
}

function ParticipantLifecycleLedger({ rows }: ParticipantLifecycleLedgerProps) {
  return (
    <div className="booking-settlement-ledger admin-mt-12" aria-label="Participant lifecycle rows">
      {rows.map((row) => (
        <div className="booking-settlement-ledger-row" key={row.stage}>
          <div>
            <span className="booking-settlement-ledger-label">{row.stage}</span>
            <p className="muted">{row.scope}</p>
          </div>
          <span className={`pill ${row.tone}`}>{row.status}</span>
          <p>{row.evidence}</p>
          <p>{row.operatorUse}</p>
        </div>
      ))}
    </div>
  );
}

function ParticipantRows({ rows }: ParticipantRowsProps) {
  if (rows.length === 0) {
    return <p className="muted admin-mt-10">No Partner participation has been recorded for this booking yet.</p>;
  }

  return (
    <div className="booking-participant-row-list admin-mt-10">
      {rows.map((row) => (
        <div className="booking-participant-row-card" key={row.id}>
          <AdminPersonCell
            avatarClassName="vuexy-booking-avatar is-partner"
            avatarStatus={row.avatarStatus}
            className="vuexy-booking-person"
            helper={row.identity}
            href={row.href}
            label={row.partner}
            linkClassName="table-link"
          />
          <div>
            <div className="filter-row">
              <span className={`pill ${row.evidenceTone}`}>{row.evidenceLabel}</span>
              <span className={`pill ${row.roleTone}`}>{row.role}</span>
              <span className={`pill ${row.statusTone}`}>{row.status}</span>
            </div>
            <p className="muted admin-mt-6">{row.evidenceDetail}</p>
            <p className="muted">{row.decision}</p>
          </div>
          <div>
            <div className="filter-row">
              <span className={`pill ${row.eligibilityTone}`}>{row.eligibilityLabel}</span>
              <span className={`pill ${row.choiceTone}`}>{row.choiceState}</span>
            </div>
            <p className="muted admin-mt-6">{row.eligibilityReason}</p>
            <p className="muted">{row.operatorStatus}</p>
            <p className="muted">{row.eligibilityNextStep}</p>
          </div>
          <div>
            <strong className="booking-settlement-ledger-value">{row.distance}</strong>
            <div className="filter-row admin-mt-6">
              <span className={`pill ${row.distancePolicyTone}`}>{row.distancePolicyLabel}</span>
            </div>
            <p className="muted">{row.distancePolicyHelper}</p>
            <p className="muted">{row.timing}</p>
          </div>
          <div>
            <div className="filter-row">
              {row.facts.map((fact) => (
                <span className={`pill ${fact.tone}`} key={`${row.id}-${fact.label}`}>
                  {fact.label}: {fact.value}
                </span>
              ))}
            </div>
            <p className="muted admin-mt-8">{row.operatorUse}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CashFeeSettlementPathSection({
  cashFeeSettlementPath,
}: {
  cashFeeSettlementPath: CashSettlementPath;
}) {
  return (
    <div className="card">
      <div className="ops-section-header">
        <div>
          <h2>Cash fee settlement path</h2>
          <p className="muted">
            Cash settlement and wallet unblock evidence for this booking.
          </p>
        </div>
        <span className={`pill ${cashFeeSettlementPath.tone}`}>{cashFeeSettlementPath.status}</span>
      </div>
      <SummaryCards cards={cashFeeSettlementPath.cards} />
      <div className="booking-settlement-ledger admin-mt-12" aria-label="Cash fee settlement rows">
        {cashFeeSettlementPath.rows.map((row) => (
          <div className="booking-settlement-ledger-row" key={row.lane}>
            <div>
              <span className="booking-settlement-ledger-label">{row.lane}</span>
              <p className="muted">{row.scope}</p>
            </div>
            <span className={`pill ${row.tone}`}>{row.status}</span>
            <p>{row.evidence}</p>
            <p>{row.nextStep}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <div className="service-trace-summary admin-mt-12">
      {cards.map((card) => (
        <a href={card.href} key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
        </a>
      ))}
    </div>
  );
}

function InfoRows({ rows }: InfoRowsProps) {
  return (
    <>
      {rows.map((row) => (
        <div className="info-row" key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </>
  );
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }

  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
