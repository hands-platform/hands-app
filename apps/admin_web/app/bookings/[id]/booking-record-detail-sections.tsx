import Link from 'next/link';

import { type AdminChatMessage } from '../../../lib/admin-api';
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

type ParticipantRow = {
  id: string;
  partner: string;
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
  timing: string;
  operatorUse: string;
};

type ParticipantLedger = {
  status: string;
  tone: string;
  cards: SummaryCard[];
  selectionTrace: SelectionTraceRow[];
  lifecycleRows: ParticipantLifecycleRow[];
  rows: ParticipantRow[];
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
  id: string;
  coordinate: string;
  recordedAt: string;
};

type BookingRecordDetailSectionsProps = {
  cashFeeSettlementPath: CashSettlementPath;
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
            {customerProfileId && (
              <Link className="text-link" href={`/customers/${customerProfileId}`}>
                Open customer record
              </Link>
            )}
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
              <Link className="text-link" href={`/partners/${finalPartnerId}`}>
                Open partner record
              </Link>
            ) : (
              <span className="pill pill-neutral">Partner record link pending</span>
            )}
          </div>
          <InfoRows rows={handoffRows} />
        </div>
      </section>

      <section className="detail-grid" style={{ marginTop: 16 }}>
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
            Admin archive for this booking. Customer and partner apps can hide the room after completion, but
            operations keeps the loaded transcript here.
          </p>
          <div className="stack">
            {chatMessages.map((message) => (
              <BookingChatBubble key={message.id} message={message} />
            ))}
            {chatMessages.length === 0 && <p className="muted">No chat messages yet.</p>}
          </div>
        </div>

        <div className="card" id="location">
          <h2>Location trail</h2>
          <div className="route-mini">
            <span className="route-dot route-customer">Customer</span>
            {hasLatestPartnerLocation && <span className="route-dot route-provider">Partner</span>}
          </div>
          <div className="stack" style={{ marginTop: 12 }}>
            {locationTrailRows.map((snapshot) => (
              <div className="ops-row" key={snapshot.id}>
                <div>
                  <strong>{snapshot.coordinate}</strong>
                  <div className="muted">{snapshot.recordedAt}</div>
                </div>
                <span className="pill">Partner</span>
              </div>
            ))}
            {locationTrailRows.length === 0 && (
              <p className="muted">No partner location snapshots linked to this booking yet.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function ParticipantLedgerSection({ participantLedger }: { participantLedger: ParticipantLedger }) {
  return (
    <div className="card" id="participants">
      <div className="ops-section-header">
        <div>
          <h2>Actual marketplace participant ledger</h2>
          <p className="muted">
            Every partner who actually participated, accepted, rejected, or became the customer-selected final
            partner stays here as booking evidence. Wallet-blocked partners who only viewed the marketplace
            list are not tracked as participants.
          </p>
        </div>
        <span className={`pill ${participantLedger.tone}`}>{participantLedger.status}</span>
      </div>
      <div className="participant-list" style={{ marginTop: 12 }}>
        <span className="pill pill-info">Participant rows only</span>
        <span className="pill pill-warn">Blocked wallet attempts are not participant records</span>
        <span className="pill">Partners may view marketplace demand before join gate</span>
        <span className="pill">Customer-selected final partner only</span>
        <span className="pill">No automatic final assignment</span>
      </div>
      <SummaryCards cards={participantLedger.cards} />
      <div className="setup-stage-list" style={{ marginTop: 14 }}>
        {participantLedger.selectionTrace.map((item) => (
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
      <table className="table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Lifecycle stage</th>
            <th>Current evidence</th>
            <th>Operator check</th>
          </tr>
        </thead>
        <tbody>
          {participantLedger.lifecycleRows.map((row) => (
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
        </tbody>
      </table>
      <h3 style={{ marginTop: 18 }}>Customer eligibility matrix</h3>
      <p className="muted">
        Shows who participated, who is customer-selectable, the Customer-selectable reason, and Why not
        selectable for evidence-only rows.
      </p>
      <table className="table" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Partner</th>
            <th>Source</th>
            <th>Participation</th>
            <th>Customer eligibility</th>
            <th>Reason and next step</th>
          </tr>
        </thead>
        <tbody>
          {participantLedger.rows.map((row) => (
            <tr key={`eligibility-${row.id}`}>
              <td>
                <strong>{row.partner}</strong>
                <p className="muted">{row.identity}</p>
              </td>
              <td>
                <span className={`pill ${row.roleTone}`}>{row.role}</span>
              </td>
              <td>
                <span className={`pill ${row.statusTone}`}>{row.status}</span>
                <p className="muted">{row.timing}</p>
              </td>
              <td>
                <span className={`pill ${row.eligibilityTone}`}>{row.eligibilityLabel}</span>
                <p className="muted">{row.choiceState}</p>
              </td>
              <td>
                <strong>{row.eligibilityReason}</strong>
                <p className="muted">{row.operatorStatus}</p>
                <p className="muted">{row.eligibilityNextStep}</p>
              </td>
            </tr>
          ))}
          {participantLedger.rows.length === 0 && (
            <tr>
              <td colSpan={5}>No participant eligibility rows are available yet.</td>
            </tr>
          )}
        </tbody>
      </table>
      <table className="table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Partner</th>
            <th>Participation evidence</th>
            <th>Role and status</th>
            <th>Timing and distance</th>
            <th>Operations record</th>
          </tr>
        </thead>
        <tbody>
          {participantLedger.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.partner}</strong>
                <p className="muted">{row.identity}</p>
                {row.href && (
                  <Link className="text-link" href={row.href}>
                    Open partner record
                  </Link>
                )}
              </td>
              <td>
                <span className={`pill ${row.evidenceTone}`}>{row.evidenceLabel}</span>
                <p className="muted">{row.evidenceDetail}</p>
              </td>
              <td>
                <div className="filter-row">
                  <span className={`pill ${row.roleTone}`}>{row.role}</span>
                  <span className={`pill ${row.statusTone}`}>{row.status}</span>
                  <span className={`pill ${row.choiceTone}`}>{row.choiceState}</span>
                </div>
                <p className="muted">{row.decision}</p>
              </td>
              <td>
                <strong>{row.distance}</strong>
                <p className="muted">{row.timing}</p>
              </td>
              <td>{row.operatorUse}</td>
            </tr>
          ))}
          {participantLedger.rows.length === 0 && (
            <tr>
              <td colSpan={5}>No partner participation has been recorded for this booking yet.</td>
            </tr>
          )}
        </tbody>
      </table>
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
            Operational view for cash bookings: customer cash collection, HANDS fee debt, tax/fee logs,
            partner wallet impact, and the exact unblock path for marketplace participation and payout.
          </p>
        </div>
        <span className={`pill ${cashFeeSettlementPath.tone}`}>{cashFeeSettlementPath.status}</span>
      </div>
      <SummaryCards cards={cashFeeSettlementPath.cards} />
      <table className="table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Settlement lane</th>
            <th>Status</th>
            <th>Evidence</th>
            <th>Operator next step</th>
          </tr>
        </thead>
        <tbody>
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
        </tbody>
      </table>
    </div>
  );
}

function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="service-trace-summary" style={{ marginTop: 12 }}>
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

function InfoRows({ rows }: { rows: InfoRowModel[] }) {
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
