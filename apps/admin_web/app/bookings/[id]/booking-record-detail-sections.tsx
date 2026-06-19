import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminPersonCell } from '../../../components/admin-person-cell';
import { type AdminChatMessage } from '../../../lib/admin-api';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import type { BookingPostMatchChatEvidenceRow } from '../booking-post-match-chat-evidence';
import { BookingChatBubble } from './booking-chat-bubble';

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

type ParticipantLifecycleTableProps = {
  rows: ParticipantLifecycleRow[];
};

type ParticipantLedgerTableProps = {
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

const PARTICIPANT_LIFECYCLE_HEADERS = [
  'Lifecycle stage',
  'Current evidence',
  'Operator check',
] as const;

const PARTICIPANT_ELIGIBILITY_HEADERS = [
  'Partner',
  'Participation evidence',
  'Customer eligibility',
  'Timing and distance',
  'Operations record',
] as const;

const CASH_FEE_SETTLEMENT_HEADERS = [
  'Settlement lane',
  'Status',
  'Evidence',
  'Operator next step',
] as const;

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
          <h2>Chat transcript</h2>
          <p className="muted">
            Admin archive for the booking transcript.
          </p>
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
          <div className="stack">
            {chatMessages.map((message) => (
              <BookingChatBubble key={message.id} message={message} />
            ))}
            {chatMessages.length === 0 && <p className="muted">No chat messages yet.</p>}
          </div>
        </div>

        <div className="card" id="location">
          <h2>Location trail</h2>
          <p className="muted">
            Partner location snapshots captured for booking actions and live movement checks.
          </p>
          <div className="route-mini">
            <span className="route-dot route-customer">Customer</span>
            {hasLatestPartnerLocation && <span className="route-dot route-provider">Partner</span>}
          </div>
          <div className="stack admin-mt-12">
            {locationTrailRows.map((snapshot) => (
              <div className="ops-row" key={snapshot.id}>
                <div>
                  <span className="muted">{snapshot.label}</span>
                  <div>
                    <strong>{snapshot.coordinate}</strong>
                  </div>
                  <div className="muted">{snapshot.recordedAt}</div>
                  <p className="muted admin-mt-6">{snapshot.detail}</p>
                </div>
                <span className={`pill ${snapshot.badgeTone}`}>{snapshot.badge}</span>
              </div>
            ))}
            {locationTrailRows.length === 0 && (
              <p className="muted">No Partner location snapshots linked to this booking yet.</p>
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
      <ParticipantLifecycleTable rows={lifecycleRows} />
      <h3 className="admin-mt-18">Customer eligibility matrix</h3>
      <p className="muted">
        One row per Partner with booking evidence, customer selection state, distance policy, and operator notes.
      </p>
      <ParticipantLedgerTable rows={rows} />
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
    <div className="setup-stage-list admin-mt-14">
      {rows.map((item) => (
        <div className="setup-stage-item" key={item.label}>
          <span>{item.label}</span>
          <div>
            <strong>{item.value}</strong>
            <p className="muted">{item.helper}</p>
          </div>
          <span className={`pill ${item.tone}`}>{item.status}</span>
        </div>
      ))}
    </div>
  );
}

function ParticipantLifecycleTable({ rows }: ParticipantLifecycleTableProps) {
  return (
    <AdminTableScroll>
      <AdminDataTable emptyMessage={null} headers={PARTICIPANT_LIFECYCLE_HEADERS} rowCount={rows.length}>
        {rows.map((row) => (
          <tr key={row.stage}>
            <td>
              <strong>{row.stage}</strong>
              <p className="muted">{row.scope}</p>
            </td>
            <td>
              <span className={`pill ${row.tone}`}>{row.status}</span>
              <p className="muted">{row.evidence}</p>
            </td>
            <td>{row.operatorUse}</td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableScroll>
  );
}

function ParticipantLedgerTable({ rows }: ParticipantLedgerTableProps) {
  return (
    <AdminTableScroll>
      <AdminDataTable
        className="admin-mt-10"
        emptyMessage="No Partner participation has been recorded for this booking yet."
        headers={PARTICIPANT_ELIGIBILITY_HEADERS}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <AdminPersonCell
                avatarClassName="vuexy-booking-avatar is-partner"
                avatarStatus={row.avatarStatus}
                className="vuexy-booking-person"
                helper={row.identity}
                href={row.href}
                label={row.partner}
                linkClassName="table-link"
              />
            </td>
            <td>
              <div className="filter-row">
                <span className={`pill ${row.evidenceTone}`}>{row.evidenceLabel}</span>
                <span className={`pill ${row.roleTone}`}>{row.role}</span>
                <span className={`pill ${row.statusTone}`}>{row.status}</span>
              </div>
              <p className="muted admin-mt-6">{row.evidenceDetail}</p>
              <p className="muted">{row.decision}</p>
            </td>
            <td>
              <div className="filter-row">
                <span className={`pill ${row.eligibilityTone}`}>{row.eligibilityLabel}</span>
                <span className={`pill ${row.choiceTone}`}>{row.choiceState}</span>
              </div>
              <p className="muted admin-mt-6">{row.eligibilityReason}</p>
              <p className="muted">{row.operatorStatus}</p>
              <p className="muted">{row.eligibilityNextStep}</p>
            </td>
            <td>
              <strong>{row.distance}</strong>
              <div className="filter-row admin-mt-6">
                <span className={`pill ${row.distancePolicyTone}`}>{row.distancePolicyLabel}</span>
              </div>
              <p className="muted">{row.distancePolicyHelper}</p>
              <p className="muted">{row.timing}</p>
            </td>
            <td>
              <div className="filter-row">
                {row.facts.map((fact) => (
                  <span className={`pill ${fact.tone}`} key={`${row.id}-${fact.label}`}>
                    {fact.label}: {fact.value}
                  </span>
                ))}
              </div>
              <p className="muted admin-mt-8">{row.operatorUse}</p>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableScroll>
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
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={null}
          headers={CASH_FEE_SETTLEMENT_HEADERS}
          rowCount={cashFeeSettlementPath.rows.length}
        >
          {cashFeeSettlementPath.rows.map((row) => (
            <tr key={row.lane}>
              <td>
                <strong>{row.lane}</strong>
                <p className="muted">{row.scope}</p>
              </td>
              <td>
                <span className={`pill ${row.tone}`}>{row.status}</span>
              </td>
              <td>{row.evidence}</td>
              <td>{row.nextStep}</td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
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
