import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminStageItem, AdminStageList } from '../../../components/admin-stage-item';
import {
  AdminBasicTimeline,
  AdminNotePanel,
  AdminSection,
  type AdminBasicTimelineItem,
} from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, StatusBadgeFromPillClass, type StatusBadgeTone } from '../../../components/status-badge';

type SummaryCard = {
  label: string;
  value: string;
  dateTimeValue?: string | null;
  helper: string;
  href?: string;
};

type LinkedSummaryCard = SummaryCard & { href: string };

type MarketplaceWalletEvidence = {
  status: string;
  tone: string;
  cards: LinkedSummaryCard[];
  commandStrip: LinkedSummaryCard[];
  rows: Array<{
    lane: string;
    scope: string;
    tone: string;
    status: string;
    record: string;
    operatorUse: string;
  }>;
};

export type OperatingLedgerRow = {
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

type TimelineMeta = {
  label: string;
  value: string;
};

type BookingVuexyTimelineItem = OperatingTimelineItem & {
  meta?: readonly TimelineMeta[];
  tone?: OperatingTimelineTone;
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

const BOOKING_OPERATING_LEDGER_HEADERS = ['Area', 'Status', 'Evidence', 'Open'] as const;

export function BookingMarketplaceWalletEvidenceSection({
  marketplaceWalletEvidence,
}: BookingMarketplaceWalletEvidenceSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={marketplaceWalletEvidence.tone}>
          {marketplaceWalletEvidence.status}
        </StatusBadgeFromPillClass>
      }
      className="admin-mb-16"
      description="Participant, customer choice, alert, and wallet evidence for this booking."
      id="marketplace-wallet-evidence"
      title="Marketplace participation and wallet evidence"
    >
      <SummaryCardTrace cards={marketplaceWalletEvidence.cards} />
      <div className="booking-settlement-ledger admin-mt-14" aria-label="Marketplace wallet command rows">
        {marketplaceWalletEvidence.commandStrip.map((command) => (
          <div className="booking-settlement-ledger-row is-command" key={command.label}>
            <span className="booking-settlement-ledger-label">{command.label}</span>
            <strong className="booking-settlement-ledger-value">{command.value}</strong>
            <p className="muted">{command.helper}</p>
            <AdminTextLink href={command.href}>
              Open
            </AdminTextLink>
          </div>
        ))}
      </div>
      <div className="booking-settlement-ledger admin-mt-12" aria-label="Marketplace wallet evidence rows">
        {marketplaceWalletEvidence.rows.map((row) => (
          <div className="booking-settlement-ledger-row" key={row.lane}>
            <div>
              <span className="booking-settlement-ledger-label">{row.lane}</span>
              <p className="muted">{row.scope}</p>
            </div>
            <StatusBadgeFromPillClass pillClass={row.tone}>{row.status}</StatusBadgeFromPillClass>
            <p>{row.record}</p>
            <p>{row.operatorUse}</p>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

export type BookingMarketplaceWalletEvidenceSectionProps = {
  marketplaceWalletEvidence: MarketplaceWalletEvidence;
};

export function BookingOperatingLedgerSection({
  operatingLedger,
}: BookingOperatingLedgerSectionProps) {
  return (
    <AdminSection
      actions={<StatusBadge tone="info">{operatingLedger.length} record areas</StatusBadge>}
      className="admin-mb-16"
      description="Compact operator ledger for the full booking record. Every row links to the deeper factual section below."
      id="booking-operating-ledger"
      title="Booking operating ledger"
    >
      <AdminTableScroll>
        <AdminDataTable emptyMessage={null} headers={BOOKING_OPERATING_LEDGER_HEADERS} rowCount={operatingLedger.length}>
          {operatingLedger.map((row) => (
            <tr key={row.area}>
              <td>{row.area}</td>
              <td>{row.status}</td>
              <td>{row.evidence}</td>
              <td>
                <AdminTextLink href={row.href}>
                  Open
                </AdminTextLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

export type BookingOperatingLedgerSectionProps = {
  operatingLedger: OperatingLedgerRow[];
};

export function BookingCloseoutReadinessSection({
  bookingStatus,
  closeoutReadiness,
}: BookingCloseoutReadinessSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={closeoutReadiness.tone}>
          {closeoutReadiness.status}
        </StatusBadgeFromPillClass>
      }
      className="admin-mb-16"
      description="Factual completeness check for booking closeout."
      id="booking-closeout-readiness"
      title="Closeout status"
    >
      <p className="muted admin-mt-8">
        {closeoutReadiness.helper}
      </p>
      <AdminNotePanel className="admin-mt-14">
        <AdminSectionHeader
          actions={(
            <StatusBadge tone={closeoutReadiness.openItems.length > 0 ? 'warning' : 'success'}>
              {closeoutReadiness.openItems.length > 0
                ? `${closeoutReadiness.openItems.length} open`
                : 'No exceptions'}
            </StatusBadge>
          )}
          description="Only items that still need admin attention are shown here."
          title="Closeout focus"
        />
        {closeoutReadiness.openItems.length > 0 ? (
          <AdminStageList className="admin-mt-12">
            {closeoutReadiness.openItems.map((item) => (
              <AdminStageItem key={`exception-${item.id}`}>
                <span>{item.owner}</span>
                <div>
                  <strong>{`${item.label}: ${item.status}`}</strong>
                  <p className="muted">{item.detail}</p>
                  <small>
                    {bookingStatus === 'COMPLETED'
                      ? 'Clear before completed closeout.'
                      : 'Clear before the next handoff.'}
                  </small>
                </div>
                <AdminTextLink href={item.href}>
                  Resolve
                </AdminTextLink>
              </AdminStageItem>
            ))}
          </AdminStageList>
        ) : (
          <p className="muted admin-mt-10">
            No closeout exceptions for the current booking stage.
          </p>
        )}
      </AdminNotePanel>
    </AdminSection>
  );
}

export type BookingCloseoutReadinessSectionProps = {
  bookingStatus: string;
  closeoutReadiness: CloseoutReadiness;
};

export function BookingOperatingSnapshotSection({
  operatingSnapshot,
}: BookingOperatingSnapshotSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={operatingSnapshot.tone}>
          {operatingSnapshot.status}
        </StatusBadgeFromPillClass>
      }
      className="admin-mb-16"
      description="Same-shift control view for the confirmed address, customer choice, Partner participation, chat, payment, wallet, and next operator action."
      id="operating-snapshot"
      title="Booking operating status"
    >
      <SummaryCardTrace cards={operatingSnapshot.facts} />
      <AdminNotePanel className={`${operatingSnapshot.noteClassName} admin-mt-14`}>
        <div className="ops-row">
          <div>
            <strong>{operatingSnapshot.nextAction}</strong>
            <p className="muted">{operatingSnapshot.nextDetail}</p>
          </div>
          <AdminTextLink href={operatingSnapshot.href}>
            {operatingSnapshot.hrefLabel}
          </AdminTextLink>
        </div>
      </AdminNotePanel>
    </AdminSection>
  );
}

export type BookingOperatingSnapshotSectionProps = {
  operatingSnapshot: OperatingSnapshot;
};

export function BookingOperatingTimelineSection({
  operatingTimeline,
}: BookingOperatingTimelineSectionProps) {
  return (
    <AdminSection
      actions={<StatusBadge tone="info">{operatingTimeline.length} step(s)</StatusBadge>}
      className="admin-mb-16"
      description="Time-ordered operating trail for address confirmation, Partner participation, customer final choice, chat, location, payment, wallet, tax, fee, and audit events."
      id="operating-timeline"
      title="Operating timeline"
    >
      <BookingVuexyTimelineList items={operatingTimeline} />
    </AdminSection>
  );
}

export type BookingOperatingTimelineSectionProps = {
  operatingTimeline: OperatingTimelineItem[];
};

type OperatingTimelineTone = 'danger' | 'info' | 'primary' | 'success' | 'warning';

function operatingTimelineTone(item: OperatingTimelineItem): OperatingTimelineTone {
  const searchable = `${item.type} ${item.title} ${item.status} ${item.detail}`.toLowerCase();

  if (/\b(failed|missing|blocked|no gateway ref)\b/.test(searchable)) {
    return 'danger';
  }

  if (/\b(pending|repair|needed|review|hold|debt)\b/.test(searchable)) {
    return 'warning';
  }

  if (/\b(completed|captured|ready|selected|logged|recorded)\b/.test(searchable)) {
    return 'success';
  }

  if (item.type === 'BOOK' || item.type === 'MATCH') {
    return 'primary';
  }

  return 'info';
}

function operatingTimelineStatusTone(tone: OperatingTimelineTone): StatusBadgeTone {
  if (tone === 'success') {
    return 'success';
  }
  if (tone === 'warning') {
    return 'warning';
  }
  if (tone === 'danger') {
    return 'danger';
  }
  return 'info';
}

function BookingVuexyTimelineList({ items }: { readonly items: readonly BookingVuexyTimelineItem[] }) {
  return (
    <AdminBasicTimeline
      className="booking-operating-timeline-list admin-mt-16"
      compactMeta
      items={bookingOperatingBasicTimelineItems(items)}
    />
  );
}

function bookingOperatingBasicTimelineItems(
  items: readonly BookingVuexyTimelineItem[],
): readonly AdminBasicTimelineItem[] {
  return items.map((item) => {
    const tone = item.tone ?? operatingTimelineTone(item);

    return {
      detail: item.detail,
      id: item.id,
      meta: item.meta ?? [
        { label: 'Type', value: item.type },
        { label: 'State', value: item.status },
      ],
      statusLabel: item.status,
      statusTone: operatingTimelineStatusTone(tone),
      time: <DateTimeText fallback={item.status} value={item.at} />,
      title: item.title,
      tone,
    };
  });
}

export function BookingHandoffChecklistSection({
  handoffChecklist,
}: BookingHandoffChecklistSectionProps) {
  return (
    <AdminSection
      actions={<StatusBadge tone="info">{handoffChecklist.length} stage(s)</StatusBadge>}
      className="admin-mb-16"
      description="One-row-per-stage view of the customer app, Partner app, admin archive, location, and finance handoff. This is factual state tracking only."
      id="booking-handoff-checklist"
      title="Booking handoff checklist"
    >
      <AdminStageList className="admin-mt-12">
        {handoffChecklist.map((item) => (
          <AdminStageItem key={item.id}>
            <span>{item.label}</span>
            <div>
              <strong>{item.title}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            {item.href ? (
              <AdminTextLink href={item.href}>
                {item.status}
              </AdminTextLink>
            ) : (
              <small>{item.status}</small>
            )}
          </AdminStageItem>
        ))}
      </AdminStageList>
    </AdminSection>
  );
}

export type BookingHandoffChecklistSectionProps = {
  handoffChecklist: BookingHandoffChecklistItem[];
};

export function BookingCommunicationMovementHandoffSection({
  communicationMovementHandoff,
}: BookingCommunicationMovementHandoffSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={communicationMovementHandoff.tone}>
          {communicationMovementHandoff.status}
        </StatusBadgeFromPillClass>
      }
      className="admin-mb-16"
      description="Focused booking trail for chat archive, Customer/Partner alerts, and Partner location sharing. This helps support confirm whether the assigned Partner and customer are connected."
      id="communication-movement-handoff"
      title="Communication and movement handoff"
    >
      <SummaryCardTrace cards={communicationMovementHandoff.metrics} />
      <AdminNotePanel className={`${communicationMovementHandoff.noteClassName} admin-mt-14`}>
        <div className="ops-row">
          <div>
            <strong>{communicationMovementHandoff.nextAction}</strong>
            <p className="muted">{communicationMovementHandoff.nextDetail}</p>
          </div>
          <AdminTextLink href={communicationMovementHandoff.href}>
            {communicationMovementHandoff.hrefLabel}
          </AdminTextLink>
        </div>
      </AdminNotePanel>
      {communicationMovementHandoff.events.length ? (
        <BookingVuexyTimelineList
          items={communicationMovementHandoff.events.map((event) => ({
            ...event,
            meta: [
              { label: 'Channel', value: event.type },
              { label: 'Evidence', value: communicationEventEvidenceLabel(event.type) },
            ],
            status: communicationEventStatusLabel(event.type),
            tone: communicationEventTone(event.type),
          }))}
        />
      ) : (
        <p className="muted admin-mt-12">
          No chat, alert, or Partner location event has been recorded yet.
        </p>
      )}
    </AdminSection>
  );
}

export type BookingCommunicationMovementHandoffSectionProps = {
  communicationMovementHandoff: CommunicationMovementHandoff;
};

function communicationEventStatusLabel(type: string) {
  if (type === 'CHAT') {
    return 'Chat';
  }
  if (type === 'ALERT') {
    return 'Alert';
  }
  if (type === 'LOC') {
    return 'Location';
  }
  return type;
}

function communicationEventTone(type: string): OperatingTimelineTone {
  if (type === 'ALERT') {
    return 'warning';
  }
  if (type === 'LOC') {
    return 'success';
  }
  if (type === 'CHAT') {
    return 'info';
  }
  return 'primary';
}

function communicationEventEvidenceLabel(type: string) {
  if (type === 'CHAT') {
    return 'Admin chat archive';
  }
  if (type === 'ALERT') {
    return 'Notification delivery';
  }
  if (type === 'LOC') {
    return 'Partner movement';
  }
  return 'Booking event';
}

export function BookingChatLifecycleSection({
  chatLifecycle,
  messageCount,
}: BookingChatLifecycleSectionProps) {
  const lifecycleItems = chatLifecycleTimelineItems(chatLifecycle, messageCount);

  return (
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={chatLifecycle.tone}>
          {chatLifecycle.status}
        </StatusBadgeFromPillClass>
      }
      className="admin-mb-16"
      description="Chat is a required operational handoff after matching/service start. Mobile apps may hide it after service closeout, but admin keeps the full archive for support and dispute review."
      id="structured-ops-status"
      title="Chat lifecycle and retention"
    >
      <BookingVuexyTimelineList items={lifecycleItems} />
    </AdminSection>
  );
}

export type BookingChatLifecycleSectionProps = {
  chatLifecycle: ChatLifecycle;
  messageCount: number;
};

function chatLifecycleTimelineItems(
  chatLifecycle: ChatLifecycle,
  messageCount: number,
): BookingVuexyTimelineItem[] {
  const roomMeta = [
    { label: 'Room', value: chatLifecycle.roomLabel },
    { label: 'Messages', value: `${messageCount} retained` },
  ] as const;

  return [
    {
      detail: chatLifecycle.customerDetail,
      id: 'chat-customer-app',
      meta: [{ label: 'Surface', value: 'Customer app' }, ...roomMeta],
      status: chatLifecycle.customerState,
      title: 'Mobile customer app',
      tone: chatLifecycleTone(chatLifecycle.customerState),
      type: 'CHAT',
    },
    {
      detail: chatLifecycle.partnerDetail,
      id: 'chat-partner-app',
      meta: [{ label: 'Surface', value: 'Partner app' }, ...roomMeta],
      status: chatLifecycle.partnerState,
      title: 'Mobile Partner app',
      tone: chatLifecycleTone(chatLifecycle.partnerState),
      type: 'CHAT',
    },
    {
      detail: chatLifecycle.adminDetail,
      id: 'chat-admin-archive',
      meta: [{ label: 'Surface', value: 'Admin archive' }, ...roomMeta],
      status: chatLifecycle.adminState,
      title: 'Admin archive',
      tone: chatLifecycleTone(chatLifecycle.adminState),
      type: 'CHAT',
    },
  ];
}

function chatLifecycleTone(state: string): OperatingTimelineTone {
  const searchable = state.toLowerCase();

  if (/\b(missing|not|hidden|failed|blocked|closed)\b/.test(searchable)) {
    return 'warning';
  }

  if (/\b(retained|ready|visible|active|created|open)\b/.test(searchable)) {
    return 'success';
  }

  return 'info';
}

function SummaryCardTrace({ cards }: { cards: SummaryCard[] }) {
  return (
    <AdminTraceSummary
      className="admin-mt-12"
      metrics={cards.map((card) => ({
        detail: card.helper,
        href: card.href,
        label: card.label,
        value: card.dateTimeValue ? (
          <DateTimeText fallback={card.value} value={card.dateTimeValue} />
        ) : (
          card.value
        ),
      }))}
    />
  );
}
