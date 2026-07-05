import Link from 'next/link';
import { AdminFormControlButton, AdminFormShell } from '../../../components/admin-form-controls';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminCard, AdminNotePanel, AdminSection } from '../../../components/admin-surface';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
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

export type BookingEvidenceSectionsProps = {
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
      <AdminSection
        actions={<StatusBadge tone="info">{decisionEvidenceGuardrails.length} guardrail row(s)</StatusBadge>}
        className="admin-mb-16"
        description="Required, supporting, and finance records for admin-only outcome work. Use this before cancellation, no-show, refund, release, cash settlement, or completed-service closeout."
        id="booking-decision-evidence-guardrails"
        title="Decision evidence guardrails"
      >
        <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Decision evidence guardrail rows">
          {decisionEvidenceGuardrails.map((row) => (
            <div className="booking-settlement-ledger-row is-evidence-record" key={row.id}>
              <div>
                <span className="booking-settlement-ledger-label">{row.title}</span>
                <p className="muted">{row.scope}</p>
              </div>
              <StatusBadge tone={statusBadgeToneFromPillClass(row.tone)}>{row.status}</StatusBadge>
              <p>{row.evidence}</p>
              <p>{row.nextStep}</p>
              <Link className="text-link" href={row.href}>
                Open
              </Link>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        actions={
          <StatusBadge tone={statusBadgeToneFromPillClass(evidencePacket.tone)}>
            {evidencePacket.status}
          </StatusBadge>
        }
        className="admin-mb-16"
        description="Cancellation, no-show, refund, and settlement decisions should use retained booking evidence. This packet groups chat, location, payment, alerts, notes, and audit records as factual decision context for the Customer and Partner."
        id="booking-evidence-packet"
        title="Evidence packet for admin decision"
      >
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
        <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Evidence packet records">
          {evidencePacket.records.map((record) => (
            <div className="booking-settlement-ledger-row is-evidence-record" id={record.id} key={record.id}>
              <span className="booking-settlement-ledger-label">{record.label}</span>
              <div>
                <strong>{record.title}</strong>
                <p className="muted">{record.detail}</p>
              </div>
              <p>{record.evidence}</p>
              <StatusBadge tone="neutral">Record</StatusBadge>
              <a className="text-link" href={record.href}>
                Open
              </a>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        actions={
          <StatusBadge tone={statusBadgeToneFromPillClass(chatEvidenceDecisionBoard.tone)}>
            {chatEvidenceDecisionBoard.status}
          </StatusBadge>
        }
        className="admin-mb-16"
        description="Retained chat evidence is the first place operators should look before cancellation, no-show, refund, release, or completed-work closeout. This board keeps the view limited to factual records and operator context."
        id="booking-chat-evidence-decision-board"
        title="Chat evidence decision board"
      >
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
        <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Chat evidence decision rows">
          {chatEvidenceDecisionBoard.rows.map((row) => (
            <div className="booking-settlement-ledger-row is-evidence-record" key={row.lane}>
              <div>
                <span className="booking-settlement-ledger-label">{row.lane}</span>
                <p className="muted">{row.scope}</p>
              </div>
              <StatusBadge tone={statusBadgeToneFromPillClass(row.tone)}>{row.state}</StatusBadge>
              <p>{row.record}</p>
              <p>{row.operatorUse}</p>
              <Link className="text-link" href={row.href}>
                Open
              </Link>
            </div>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        actions={
          <div className="actions">
            <Link className="text-link" href="/bookings?view=manual-decision">
              Open manual queue
            </Link>
            <StatusBadge tone="info">{manualDecisionReadiness.length} decision lane(s)</StatusBadge>
          </div>
        }
        className="admin-mb-16"
        description="Operations-only decision board for cancellation, no-show, refund/release, cash fee settlement, and completed closeout. It keeps the decision factual and evidence-based."
        id="manual-decision-readiness"
        title="Manual outcome decision readiness"
      >
        <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Manual decision readiness rows">
          {manualDecisionReadiness.map((row) => (
            <div className="booking-settlement-ledger-row is-evidence-record" key={row.lane}>
              <div>
                <span className="booking-settlement-ledger-label">{row.lane}</span>
                <p className="muted">{row.scope}</p>
              </div>
              <StatusBadge tone={statusBadgeToneFromPillClass(row.tone)}>{row.status}</StatusBadge>
              <p>{row.evidence}</p>
              <p>{row.operatorUse}</p>
              <Link className="text-link" href={row.href}>
                Open
              </Link>
            </div>
          ))}
        </div>
        <AdminNotePanel className="admin-mt-14">
          <AdminSectionHeader
            actions={<StatusBadge tone="info">{decisionNotePresets.length} preset(s)</StatusBadge>}
            description="Fast factual notes for missing evidence, payment review, cash fee settlement, and closeout handling. Use these before changing booking outcomes."
            title="Decision note presets"
          />
          <div className="booking-decision-preset-list admin-mt-12">
            {decisionNotePresets.map((preset) => (
              <AdminCard className="booking-decision-preset-card" key={preset.id}>
                <StatusBadge tone="neutral">{preset.label}</StatusBadge>
                <div>
                  <strong>{preset.title}</strong>
                  <p className="muted">{preset.detail}</p>
                </div>
                <AdminFormShell action={addBookingOpsNote}>
                  <input type="hidden" name="bookingId" value={bookingId} />
                  <input type="hidden" name="preset" value={preset.preset} />
                  <AdminFormControlButton type="submit">Add note</AdminFormControlButton>
                </AdminFormShell>
              </AdminCard>
            ))}
          </div>
        </AdminNotePanel>
      </AdminSection>

      <AdminSection
        actions={<StatusBadge tone="info">{bookingEvidenceBundleRows.length} evidence lane(s)</StatusBadge>}
        className="admin-mb-16"
        description="Single booking command view that ties the customer, Partner, address snapshot, chat archive, payment, earning, wallet, location, alerts, and operator notes into one factual bundle."
        id="booking-full-evidence-bundle"
        title="Booking full evidence bundle"
      >
        <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Booking full evidence bundle rows">
          {bookingEvidenceBundleRows.map((row) => (
            <div className="booking-settlement-ledger-row is-evidence-record" key={row.lane}>
              <div>
                <span className="booking-settlement-ledger-label">{row.lane}</span>
                <p className="muted">{row.recordLabel}</p>
              </div>
              <StatusBadge tone={statusBadgeToneFromPillClass(row.tone)}>{row.status}</StatusBadge>
              <p>{row.evidence}</p>
              <p>{row.operatorUse}</p>
              <Link className="text-link" href={row.href}>
                Open
              </Link>
            </div>
          ))}
        </div>
      </AdminSection>
    </>
  );
}
