import Link from 'next/link';
import { AdminTableScroll } from '../../../components/admin-data-table';
import { addBookingOpsNote } from './actions';

type EvidenceMetric = {
  label: string;
  value: string;
  helper: string;
};

type EvidencePacketRecord = {
  id: string;
  label: string;
  title: string;
  detail: string;
  evidence: string;
  href: string;
};

type EvidencePacket = {
  status: string;
  tone: string;
  summary: string;
  metrics: EvidenceMetric[];
  records: EvidencePacketRecord[];
};

type DecisionGuardrailRow = {
  id: string;
  title: string;
  scope: string;
  status: string;
  tone: string;
  evidence: string;
  nextStep: string;
  href: string;
};

type ChatEvidenceDecisionBoard = {
  status: string;
  tone: string;
  summary: string;
  metrics: EvidenceMetric[];
  rows: Array<{
    lane: string;
    scope: string;
    state: string;
    tone: string;
    record: string;
    operatorUse: string;
    href: string;
  }>;
};

type ManualDecisionReadinessRow = {
  lane: string;
  scope: string;
  status: string;
  tone: string;
  evidence: string;
  operatorUse: string;
  href: string;
};

type DecisionNotePreset = {
  id: string;
  label: string;
  title: string;
  detail: string;
  preset: string;
};

type EvidenceBundleRow = {
  lane: string;
  recordLabel: string;
  status: string;
  tone: string;
  evidence: string;
  operatorUse: string;
  href: string;
};

type BookingEvidenceSectionsProps = {
  bookingId: string;
  decisionEvidenceGuardrails: DecisionGuardrailRow[];
  evidencePacket: EvidencePacket;
  chatEvidenceDecisionBoard: ChatEvidenceDecisionBoard;
  manualDecisionReadiness: ManualDecisionReadinessRow[];
  decisionNotePresets: DecisionNotePreset[];
  bookingEvidenceBundleRows: EvidenceBundleRow[];
};

export function BookingEvidenceSections({
  bookingId,
  decisionEvidenceGuardrails,
  evidencePacket,
  chatEvidenceDecisionBoard,
  manualDecisionReadiness,
  decisionNotePresets,
  bookingEvidenceBundleRows,
}: BookingEvidenceSectionsProps) {
  return (
    <>
      <section className="card admin-mb-16" id="booking-decision-evidence-guardrails">
        <div className="ops-section-header">
          <div>
            <h2>Decision evidence guardrails</h2>
            <p className="muted">
              Required, supporting, and finance records for admin-only outcome work. Use this before
              cancellation, no-show, refund, release, cash settlement, or completed-service closeout.
            </p>
          </div>
          <span className="pill pill-info">{decisionEvidenceGuardrails.length} guardrail row(s)</span>
        </div>
        <AdminTableScroll>
          <table className="table">
            <thead>
              <tr>
                <th>Guardrail</th>
                <th>Status</th>
                <th>Loaded record</th>
                <th>Next operator step</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {decisionEvidenceGuardrails.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title}</strong>
                    <p className="muted">{row.scope}</p>
                  </td>
                  <td>
                    <span className={`pill ${row.tone}`}>{row.status}</span>
                  </td>
                  <td>{row.evidence}</td>
                  <td>{row.nextStep}</td>
                  <td>
                    <Link className="text-link" href={row.href}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableScroll>
      </section>

      <section className="card admin-mb-16" id="booking-evidence-packet">
        <div className="ops-section-header">
          <div>
            <h2>Evidence packet for admin decision</h2>
            <p className="muted">
              Cancellation, no-show, refund, and settlement decisions should use retained booking evidence.
              This packet groups chat, location, payment, alerts, notes, and audit records as factual decision
              context for the Customer and Partner.
            </p>
          </div>
          <span className={`pill ${evidencePacket.tone}`}>{evidencePacket.status}</span>
        </div>
        <p className="muted admin-mt-8">
          {evidencePacket.summary}
        </p>
        <div className="service-trace-summary admin-mt-12">
          {evidencePacket.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list admin-mt-12">
          {evidencePacket.records.map((record) => (
            <div className="setup-stage-item" id={record.id} key={record.id}>
              <span>{record.label}</span>
              <div>
                <strong>{record.title}</strong>
                <p className="muted">{record.detail}</p>
                <small>{record.evidence}</small>
              </div>
              <a className="text-link" href={record.href}>
                Open
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="card admin-mb-16" id="booking-chat-evidence-decision-board">
        <div className="ops-section-header">
          <div>
            <h2>Chat evidence decision board</h2>
            <p className="muted">
              Retained chat evidence is the first place operators should look before cancellation, no-show,
              refund, release, or completed-work closeout. This board keeps the view limited to factual
              records and operator context.
            </p>
          </div>
          <span className={`pill ${chatEvidenceDecisionBoard.tone}`}>{chatEvidenceDecisionBoard.status}</span>
        </div>
        <p className="muted admin-mt-8">
          {chatEvidenceDecisionBoard.summary}
        </p>
        <div className="service-trace-summary admin-mt-12">
          {chatEvidenceDecisionBoard.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </div>
          ))}
        </div>
        <AdminTableScroll>
          <table className="table">
            <thead>
              <tr>
                <th>Evidence lane</th>
                <th>State</th>
                <th>Factual record</th>
                <th>Operator use</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {chatEvidenceDecisionBoard.rows.map((row) => (
                <tr key={row.lane}>
                  <td>
                    <strong>{row.lane}</strong>
                    <p className="muted">{row.scope}</p>
                  </td>
                  <td>
                    <span className={`pill ${row.tone}`}>{row.state}</span>
                  </td>
                  <td>{row.record}</td>
                  <td>{row.operatorUse}</td>
                  <td>
                    <Link className="text-link" href={row.href}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableScroll>
      </section>

      <section className="card admin-mb-16" id="manual-decision-readiness">
        <div className="ops-section-header">
          <div>
            <h2>Manual outcome decision readiness</h2>
            <p className="muted">
              Operations-only decision board for cancellation, no-show, refund/release, cash fee settlement,
              and completed closeout. It keeps the decision factual and evidence-based.
            </p>
          </div>
          <div className="actions">
            <Link className="text-link" href="/bookings?view=manual-decision">
              Open manual queue
            </Link>
            <span className="pill pill-info">{manualDecisionReadiness.length} decision lane(s)</span>
          </div>
        </div>
        <AdminTableScroll>
          <table className="table">
            <thead>
              <tr>
                <th>Decision lane</th>
                <th>Status</th>
                <th>Evidence loaded</th>
                <th>Operator use</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {manualDecisionReadiness.map((row) => (
                <tr key={row.lane}>
                  <td>
                    <strong>{row.lane}</strong>
                    <p className="muted">{row.scope}</p>
                  </td>
                  <td>
                    <span className={`pill ${row.tone}`}>{row.status}</span>
                  </td>
                  <td>{row.evidence}</td>
                  <td>{row.operatorUse}</td>
                  <td>
                    <Link className="text-link" href={row.href}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableScroll>
        <div className="ops-task-note admin-mt-14">
          <div className="ops-section-header">
            <div>
              <strong>Decision note presets</strong>
              <p className="muted">
                Fast factual notes for missing evidence, payment review, cash fee settlement, and closeout
                handling. Use these before changing booking outcomes.
              </p>
            </div>
            <span className="pill pill-info">{decisionNotePresets.length} preset(s)</span>
          </div>
          <div className="setup-stage-list admin-mt-12">
            {decisionNotePresets.map((preset) => (
              <div className="setup-stage-item" key={preset.id}>
                <span>{preset.label}</span>
                <div>
                  <strong>{preset.title}</strong>
                  <p className="muted">{preset.detail}</p>
                </div>
                <form action={addBookingOpsNote}>
                  <input type="hidden" name="bookingId" value={bookingId} />
                  <input type="hidden" name="preset" value={preset.preset} />
                  <button type="submit">Add note</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card admin-mb-16" id="booking-full-evidence-bundle">
        <div className="ops-section-header">
          <div>
            <h2>Booking full evidence bundle</h2>
            <p className="muted">
              Single booking command view that ties the customer, partner, address snapshot, chat archive,
              payment, earning, wallet, location, alerts, and operator notes into one factual bundle.
            </p>
          </div>
          <span className="pill pill-info">{bookingEvidenceBundleRows.length} evidence lane(s)</span>
        </div>
        <AdminTableScroll>
          <table className="table">
            <thead>
              <tr>
                <th>Lane</th>
                <th>Current state</th>
                <th>Evidence</th>
                <th>Operator use</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {bookingEvidenceBundleRows.map((row) => (
                <tr key={row.lane}>
                  <td>
                    <strong>{row.lane}</strong>
                    <p className="muted">{row.recordLabel}</p>
                  </td>
                  <td>
                    <span className={`pill ${row.tone}`}>{row.status}</span>
                  </td>
                  <td>{row.evidence}</td>
                  <td>{row.operatorUse}</td>
                  <td>
                    <Link className="text-link" href={row.href}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableScroll>
      </section>
    </>
  );
}
