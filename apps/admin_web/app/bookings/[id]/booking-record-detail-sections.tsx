import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminPersonCell } from '../../../components/admin-person-cell';
import { AdminCard, AdminDetailGrid, AdminSection } from '../../../components/admin-surface';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import { type AdminChatMessage } from '../../../lib/admin-api';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import type { BookingPostMatchChatEvidenceRow } from '../booking-post-match-chat-evidence';

type InfoRowModel = {
  label: string;
  value: string;
  dateTimeValue?: string | null;
  dateTimeStartLabel?: string;
  dateTimeStartValue?: string | null;
  dateTimeEndLabel?: string;
  dateTimeEndValue?: string | null;
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
  timingJoinedAtLabel?: string;
  timingJoinedAtValue?: string | null;
  timingRespondedAtLabel?: string;
  timingRespondedAtValue?: string | null;
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
  recordedAtValue?: string | null;
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
  showOverviewSections?: boolean;
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
  showOverviewSections = true,
  timelineStages,
}: BookingRecordDetailSectionsProps) {
  return (
    <>
      {showOverviewSections ? (
        <AdminDetailGrid>
          <AdminSection id="booking-record-flow" title="Operations timeline">
            <div className="timeline">
              {timelineStages.map((stage) => (
                <div className={`timeline-step ${stage.done ? 'timeline-done' : ''}`} key={stage.label}>
                  <span>{stage.label}</span>
                  <strong>{stage.value}</strong>
                  <p className="muted">{stage.hint}</p>
                </div>
              ))}
            </div>
          </AdminSection>

          <AdminSection
            actions={customerProfileId ? <StatusBadge tone="neutral">Linked in toolbar</StatusBadge> : null}
            id="booking-record-customer"
            title="Customer"
          >
            <InfoRows rows={customerRows} />
          </AdminSection>

          <AdminSection id="booking-record-service" title="Service">
            <InfoRows rows={serviceRows} />
          </AdminSection>

          <AdminSection
            actions={
              finalPartnerId ? (
                <StatusBadge tone="neutral">Linked in toolbar</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Partner record link pending</StatusBadge>
              )
            }
            id="booking-record-handoff"
            title="Partner handoff"
          >
            <InfoRows rows={handoffRows} />
          </AdminSection>
        </AdminDetailGrid>
      ) : null}

      <AdminDetailGrid className="admin-mt-16">
        <ParticipantLedgerSection participantLedger={participantLedger} />

        <AdminSection id="booking-record-payment" title="Payment and refund">
          <InfoRows rows={paymentRows} />
        </AdminSection>

        <CashFeeSettlementPathSection cashFeeSettlementPath={cashFeeSettlementPath} />

        <AdminSection id="booking-record-finance" title="Finance evidence">
          <InfoRows rows={financeRows} />
        </AdminSection>

        <AdminSection
          actions={<StatusBadge tone="info">{countLabel(chatMessages.length, 'message')}</StatusBadge>}
          description="Compact archive state. The full retained transcript stays in the chat history panel."
          id="booking-record-chat"
          title="Chat evidence"
        >
          {chatEvidenceRows.length > 0 && (
            <div className="booking-chat-evidence-grid is-detail" aria-label="Booking chat evidence records">
              {chatEvidenceRows.map((row) => (
                <div className="booking-chat-evidence-item" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  <p>{row.helper}</p>
                </div>
              ))}
            </div>
          )}
          {chatEvidenceRows.length === 0 && (
            <AdminEmptyState framed message="No chat evidence linked to this booking yet." />
          )}
        </AdminSection>

        <AdminSection
          actions={<StatusBadge tone="neutral">{countLabel(locationTrailRows.length, 'record')}</StatusBadge>}
          description="Partner location records captured only for booking actions and live movement checks."
          id="booking-record-location"
          title="Location evidence"
        >
          <div className="route-mini">
            <span className="route-dot route-customer">Customer</span>
            {hasLatestPartnerLocation && <span className="route-dot route-provider">Partner</span>}
          </div>
          <div className="booking-settlement-ledger booking-location-evidence-ledger admin-mt-12" aria-label="Booking location evidence rows">
            {locationTrailRows.map((snapshot) => (
              <div className="booking-settlement-ledger-row is-location-evidence" key={snapshot.id}>
                <div>
                  <span className="booking-settlement-ledger-label">{snapshot.label}</span>
                  <p className="muted">
                    <DateTimeText fallback={snapshot.recordedAt} value={snapshot.recordedAtValue} />
                  </p>
                </div>
                <strong className="booking-settlement-ledger-value">{snapshot.coordinate}</strong>
                <p className="muted">{snapshot.detail}</p>
                <StatusBadgeFromPillClass pillClass={snapshot.badgeTone}>{snapshot.badge}</StatusBadgeFromPillClass>
              </div>
            ))}
            {locationTrailRows.length === 0 && (
              <AdminEmptyState framed message="No Partner location records linked to this booking yet." />
            )}
          </div>
        </AdminSection>
      </AdminDetailGrid>
    </>
  );
}

function ParticipantLedgerSection({ participantLedger }: ParticipantLedgerSectionProps) {
  const { boundary, cards, lifecycleRows, rows, selectionTrace, status, tone } = participantLedger;

  return (
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={tone}>{status}</StatusBadgeFromPillClass>
      }
      description="Booking participation evidence only; marketplace supply visibility is tracked separately."
      id="booking-record-participants"
      title="Actual marketplace participant ledger"
    >
      <ParticipantBoundary boundary={boundary} />
      <SummaryCards cards={cards} />
      <ParticipantSelectionTrace rows={selectionTrace} />
      <ParticipantLifecycleLedger rows={lifecycleRows} />
      <h3 className="admin-mt-18">Partner participation rows</h3>
      <p className="muted">
        One row per Partner with booking evidence, customer selection state, distance policy, and operator notes.
      </p>
      <ParticipantRows rows={rows} />
    </AdminSection>
  );
}

function ParticipantBoundary({ boundary }: ParticipantBoundaryProps) {
  return (
    <>
      <AdminFilterChipGroup ariaLabel="Participant ledger boundary" className="admin-mt-12">
        {boundary.pills.map((pill, index) => (
          <StatusBadgeFromPillClass pillClass={getParticipantBoundaryPillClass(index)} key={pill}>
            {pill}
          </StatusBadgeFromPillClass>
        ))}
      </AdminFilterChipGroup>
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
    <div className="booking-settlement-ledger admin-mt-14" aria-label="Participant selection record rows">
      {rows.map((item) => (
        <div className="booking-settlement-ledger-row is-command" key={item.label}>
          <span className="booking-settlement-ledger-label">{item.label}</span>
          <strong className="booking-settlement-ledger-value">{item.value}</strong>
          <p className="muted">{item.helper}</p>
          <StatusBadgeFromPillClass pillClass={item.tone}>{item.status}</StatusBadgeFromPillClass>
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
          <StatusBadgeFromPillClass pillClass={row.tone}>{row.status}</StatusBadgeFromPillClass>
          <p>{row.evidence}</p>
          <p>{row.operatorUse}</p>
        </div>
      ))}
    </div>
  );
}

function ParticipantRows({ rows }: ParticipantRowsProps) {
  if (rows.length === 0) {
    return <AdminEmptyState framed message="No Partner participation has been recorded for this booking yet." />;
  }

  return (
    <div className="booking-participant-row-list admin-mt-10">
      {rows.map((row) => (
        <AdminCard className="booking-participant-row-card" key={row.id}>
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
            <AdminFilterChipGroup ariaLabel={`${row.partner} participation evidence`}>
              <StatusBadgeFromPillClass pillClass={row.evidenceTone}>{row.evidenceLabel}</StatusBadgeFromPillClass>
              <StatusBadgeFromPillClass pillClass={row.roleTone}>{row.role}</StatusBadgeFromPillClass>
              <StatusBadgeFromPillClass pillClass={row.statusTone}>{row.status}</StatusBadgeFromPillClass>
            </AdminFilterChipGroup>
            <p className="muted admin-mt-6">{row.evidenceDetail}</p>
            <p className="muted">{row.decision}</p>
          </div>
          <div>
            <AdminFilterChipGroup ariaLabel={`${row.partner} eligibility decision`}>
              <StatusBadgeFromPillClass pillClass={row.eligibilityTone}>{row.eligibilityLabel}</StatusBadgeFromPillClass>
              <StatusBadgeFromPillClass pillClass={row.choiceTone}>{row.choiceState}</StatusBadgeFromPillClass>
            </AdminFilterChipGroup>
            <p className="muted admin-mt-6">{row.eligibilityReason}</p>
            <p className="muted">{row.operatorStatus}</p>
            <p className="muted">{row.eligibilityNextStep}</p>
          </div>
          <div>
            <strong className="booking-settlement-ledger-value">{row.distance}</strong>
            <AdminFilterChipGroup ariaLabel={`${row.partner} distance policy`} className="admin-mt-6">
              <StatusBadgeFromPillClass pillClass={row.distancePolicyTone}>
                {row.distancePolicyLabel}
              </StatusBadgeFromPillClass>
            </AdminFilterChipGroup>
            <p className="muted">{row.distancePolicyHelper}</p>
            <p className="muted">{participantTiming(row)}</p>
          </div>
          <div>
            <AdminFilterChipGroup ariaLabel={`${row.partner} participation facts`}>
              {row.facts.map((fact) => (
                <StatusBadgeFromPillClass pillClass={fact.tone} key={`${row.id}-${fact.label}`}>
                  {fact.label}: {fact.value}
                </StatusBadgeFromPillClass>
              ))}
            </AdminFilterChipGroup>
            <p className="muted admin-mt-8">{row.operatorUse}</p>
          </div>
        </AdminCard>
      ))}
    </div>
  );
}

function participantTiming(row: ParticipantRow) {
  if (row.timingJoinedAtValue || row.timingRespondedAtValue) {
    return (
      <>
        Participated{' '}
        <DateTimeText fallback={row.timingJoinedAtLabel ?? 'Not set'} value={row.timingJoinedAtValue} /> / responded{' '}
        <DateTimeText fallback={row.timingRespondedAtLabel ?? 'Not set'} value={row.timingRespondedAtValue} />
      </>
    );
  }

  return row.timing;
}

function CashFeeSettlementPathSection({
  cashFeeSettlementPath,
}: {
  cashFeeSettlementPath: CashSettlementPath;
}) {
  return (
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={cashFeeSettlementPath.tone}>
          {cashFeeSettlementPath.status}
        </StatusBadgeFromPillClass>
      }
      description="Cash settlement and wallet unblock evidence for this booking."
      title="Cash fee settlement path"
    >
      <SummaryCards cards={cashFeeSettlementPath.cards} />
      <div className="booking-settlement-ledger admin-mt-12" aria-label="Cash fee settlement rows">
        {cashFeeSettlementPath.rows.map((row) => (
          <div className="booking-settlement-ledger-row" key={row.lane}>
            <div>
              <span className="booking-settlement-ledger-label">{row.lane}</span>
              <p className="muted">{row.scope}</p>
            </div>
            <StatusBadgeFromPillClass pillClass={row.tone}>{row.status}</StatusBadgeFromPillClass>
            <p>{row.evidence}</p>
            <p>{row.nextStep}</p>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <AdminTraceSummary
      className="admin-mt-12"
      metrics={cards.map((card) => ({
        detail: card.helper,
        href: card.href,
        label: card.label,
        value: card.value,
      }))}
    />
  );
}

function InfoRows({ rows }: InfoRowsProps) {
  return (
    <>
      {rows.map((row) => (
        <div className="info-row" key={row.label}>
          <span>{row.label}</span>
          <strong>{infoRowValue(row)}</strong>
        </div>
      ))}
    </>
  );
}

function infoRowValue(row: InfoRowModel) {
  if (row.dateTimeStartValue || row.dateTimeEndValue) {
    return (
      <>
        <DateTimeText fallback={row.dateTimeStartLabel ?? row.value} value={row.dateTimeStartValue} /> / updated{' '}
        <DateTimeText fallback={row.dateTimeEndLabel ?? row.value} value={row.dateTimeEndValue} />
      </>
    );
  }

  return row.dateTimeValue ? <DateTimeText fallback={row.value} value={row.dateTimeValue} /> : row.value;
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }

  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
