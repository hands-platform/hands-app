import { AdminFormControlButton, AdminFormShell } from '../../../components/admin-form-controls';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminDisclosure, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import { addBookingOpsNote } from './actions';

type EvidenceMetric = {
  label: string;
  value: string;
  dateTimeValue?: string | null;
  helper: string;
};

type EvidencePacketRecord = {
  id: string;
  label: string;
  title: string;
  detail: string;
  evidence: string;
  evidenceDateTimePrefix?: string;
  evidenceDateTimeSuffix?: string;
  evidenceDateTimeValue?: string | null;
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
  evidenceDateTimePrefix?: string;
  evidenceDateTimeSuffix?: string;
  evidenceDateTimeValue?: string | null;
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
  evidenceDateTimePrefix?: string;
  evidenceDateTimeSuffix?: string;
  evidenceDateTimeValue?: string | null;
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
  const attentionGuardrails = decisionEvidenceGuardrails.filter((row) => row.tone !== 'pill-success');
  const advancedRecordCount =
    evidencePacket.records.length +
    chatEvidenceDecisionBoard.rows.length +
    manualDecisionReadiness.length +
    bookingEvidenceBundleRows.length;

  return (
    <AdminSection
      actions={
        <div className="actions">
          <StatusBadgeFromPillClass pillClass={evidencePacket.tone}>{evidencePacket.status}</StatusBadgeFromPillClass>
          <AdminTextLink href="/bookings/post-match-cancellations?view=manual-decision">Open cancellation queue</AdminTextLink>
        </div>
      }
      className="admin-mb-16"
      description="Decision completeness, retained chat, location, payment, alerts, and operator notes in one factual view."
      id="booking-evidence-summary"
      title="Evidence summary"
    >
      <p className="muted admin-mt-8">{evidencePacket.summary}</p>
      <EvidenceMetricSummary metrics={evidencePacket.metrics} />
      {attentionGuardrails.length > 0 ? (
        <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Decision evidence guardrail rows">
          {attentionGuardrails.map((row) => (
            <div className="booking-settlement-ledger-row is-evidence-record" key={row.id}>
              <div>
                <span className="booking-settlement-ledger-label">{row.title}</span>
                <p className="muted">{row.scope}</p>
              </div>
              <StatusBadgeFromPillClass pillClass={row.tone}>{row.status}</StatusBadgeFromPillClass>
              <p>
                <DecisionGuardrailEvidence row={row} />
              </p>
              <p>{row.nextStep}</p>
              <AdminTextLink href={row.href}>Open {row.title.replace(/^(Required|Supporting|Finance|Operations):\s*/i, '')}</AdminTextLink>
            </div>
          ))}
        </div>
      ) : (
        <p className="admin-inline-notice is-success admin-mt-12" role="status">
          No evidence gaps are currently flagged.
        </p>
      )}

      <AdminDisclosure className="booking-detail-section-disclosure admin-mt-12" id="booking-evidence-advanced-records">
        <summary className="booking-detail-section-summary">
          <span className="booking-detail-section-summary-copy">
            <strong>Advanced records</strong>
            <small>Full evidence packet, chat rows, decision lanes, note presets, and retained bundle records.</small>
          </span>
          <span className="booking-detail-section-summary-meta">{advancedRecordCount} records</span>
        </summary>
        <div className="booking-detail-section-disclosure-body">
          <span aria-hidden="true" id="booking-decision-evidence-guardrails" />
          <span aria-hidden="true" id="booking-evidence-packet" />
          <div className="booking-settlement-ledger booking-evidence-ledger" aria-label="Evidence packet records">
            {evidencePacket.records.map((record) => (
              <div className="booking-settlement-ledger-row is-evidence-record" id={record.id} key={record.id}>
                <span className="booking-settlement-ledger-label">{record.label}</span>
                <div>
                  <strong>{record.title}</strong>
                  <p className="muted">{record.detail}</p>
                </div>
                <p><EvidenceRecordEvidence record={record} /></p>
                <StatusBadge tone="neutral">Record</StatusBadge>
                <AdminTextLink href={record.href}>Open {record.label.toLowerCase()} record</AdminTextLink>
              </div>
            ))}
          </div>

          <span aria-hidden="true" id="booking-chat-evidence-decision-board" />
          <p className="muted admin-mt-12">{chatEvidenceDecisionBoard.summary}</p>
          <EvidenceMetricSummary metrics={chatEvidenceDecisionBoard.metrics} />
          <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Chat evidence records">
            {chatEvidenceDecisionBoard.rows.map((row) => (
              <div className="booking-settlement-ledger-row is-evidence-record" key={row.lane}>
                <div>
                  <span className="booking-settlement-ledger-label">{row.lane}</span>
                  <p className="muted">{row.scope}</p>
                </div>
                <StatusBadgeFromPillClass pillClass={row.tone}>{row.state}</StatusBadgeFromPillClass>
                <p>{row.record}</p>
                <p>{row.operatorUse}</p>
                <AdminTextLink href={row.href}>Open {row.lane.toLowerCase()}</AdminTextLink>
              </div>
            ))}
          </div>

          <span aria-hidden="true" id="manual-decision-board" />
          <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Manual decision records">
            {manualDecisionReadiness.map((row) => (
              <div className="booking-settlement-ledger-row is-evidence-record" key={row.lane}>
                <div>
                  <span className="booking-settlement-ledger-label">{row.lane}</span>
                  <p className="muted">{row.scope}</p>
                </div>
                <StatusBadgeFromPillClass pillClass={row.tone}>{row.status}</StatusBadgeFromPillClass>
                <p>{row.evidence}</p>
                <p>{row.operatorUse}</p>
                <AdminTextLink href={row.href}>Open {row.lane.toLowerCase()}</AdminTextLink>
              </div>
            ))}
          </div>

          <div className="booking-decision-preset-list admin-mt-12" aria-label="Decision note presets">
            {decisionNotePresets.map((preset) => (
              <div className="booking-settlement-ledger-row is-evidence-record" key={preset.id}>
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
              </div>
            ))}
          </div>

          <span aria-hidden="true" id="booking-full-evidence-bundle" />
          <div className="booking-settlement-ledger booking-evidence-ledger admin-mt-12" aria-label="Booking evidence bundle records">
            {bookingEvidenceBundleRows.map((row) => (
              <div className="booking-settlement-ledger-row is-evidence-record" key={row.lane}>
                <div>
                  <span className="booking-settlement-ledger-label">{row.lane}</span>
                  <p className="muted">{row.recordLabel}</p>
                </div>
                <StatusBadgeFromPillClass pillClass={row.tone}>{row.status}</StatusBadgeFromPillClass>
                <p><EvidenceBundleRowEvidence row={row} /></p>
                <p>{row.operatorUse}</p>
                <AdminTextLink href={row.href}>Open {row.lane.toLowerCase()}</AdminTextLink>
              </div>
            ))}
          </div>
        </div>
      </AdminDisclosure>
    </AdminSection>
  );
}

function EvidenceMetricSummary({ metrics }: { metrics: EvidenceMetric[] }) {
  return (
    <AdminTraceSummary
      className="admin-mt-12"
      inferScope={false}
      metrics={metrics.map((metric) => ({
        detail: metric.helper,
        label: metric.label,
        value: metric.dateTimeValue ? (
          <DateTimeText fallback={metric.value} value={metric.dateTimeValue} />
        ) : (
          metric.value
        ),
      }))}
    />
  );
}

function EvidenceRecordEvidence({ record }: { record: EvidencePacketRecord }) {
  if (!record.evidenceDateTimeValue) {
    return record.evidence;
  }

  return (
    <>
      {record.evidenceDateTimePrefix}
      <DateTimeText fallback={record.evidence} value={record.evidenceDateTimeValue} />
      {record.evidenceDateTimeSuffix}
    </>
  );
}

function DecisionGuardrailEvidence({ row }: { row: DecisionGuardrailRow }) {
  if (!row.evidenceDateTimeValue) {
    return row.evidence;
  }

  return (
    <>
      {row.evidenceDateTimePrefix}
      <DateTimeText fallback={row.evidence} value={row.evidenceDateTimeValue} />
      {row.evidenceDateTimeSuffix}
    </>
  );
}

function EvidenceBundleRowEvidence({ row }: { row: EvidenceBundleRow }) {
  if (!row.evidenceDateTimeValue) {
    return row.evidence;
  }

  return (
    <>
      {row.evidenceDateTimePrefix}
      <DateTimeText fallback={row.evidence} value={row.evidenceDateTimeValue} />
      {row.evidenceDateTimeSuffix}
    </>
  );
}
