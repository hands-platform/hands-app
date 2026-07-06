import { ArrowLeft, ExternalLink, MessageSquareText, User, Users } from 'lucide-react';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFormControlLink } from '../../../components/admin-form-controls';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminMetricGrid } from '../../../components/admin-page-template';
import { AdminStageItem } from '../../../components/admin-stage-item';
import { AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';
import type { BookingCommandDecisionStrip } from '../../../lib/booking-command-decision-strip';

type SummaryLinkCard = {
  href: string;
  label: string;
  value: string;
  detail: string;
};

type SummaryMetricRow = {
  label: string;
  value: string;
  helper: string;
};

type SummaryLinkGridProps = {
  rows: SummaryLinkCard[];
};

type SummaryMetricGridProps = {
  rows: SummaryMetricRow[];
};

type MetricSummaryCard = SummaryMetricRow;

type MatchingRuleSnapshot = {
  status: string;
  tone: string;
  summary: string;
  rows: SummaryMetricRow[];
  actions: Array<{ label: string; href: string }>;
};

type AuthorityContractRow = {
  contract: string;
  scope: string;
  status: string;
  tone: string;
  evidence: string;
  operatorUse: string;
  href: string;
};

type RecentTimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  at?: string | null;
  status: string;
};

type PriorityBriefing = {
  status: string;
  tone: string;
  rows: SummaryMetricRow[];
  steps: Array<{
    id: string;
    label: string;
    title: string;
    detail: string;
    href: string;
    linkLabel: string;
  }>;
};

const MVP_AUTHORITY_CONTRACT_HEADERS = [
  'Contract',
  'Current state',
  'Evidence',
  'Operator use',
  'Open',
] as const;

export type BookingDetailToolbarProps = {
  bookingId: string;
  serviceLabel: string;
  status: string;
  customerProfileId?: string | null;
  finalPartnerId?: string | null;
  chatRoomId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
};

export function BookingCommandDecisionStripSection({
  commandDecisionStrip,
}: BookingCommandDecisionStripSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={statusBadgeToneFromPillClass(commandDecisionStrip.tone)}>
          {commandDecisionStrip.status}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Primary booking command and four-lane operator strip for address, matching, chat, and finance."
      id="booking-command-decision-strip"
      title="Booking command decision strip"
    >
      <div className="booking-command-primary">
        <strong>Primary booking command</strong>
        <p>{commandDecisionStrip.primaryAction}</p>
        <small>{commandDecisionStrip.primaryDetail}</small>
      </div>
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={commandDecisionStrip.rows.map((row) => ({
          detail: row.detail,
          href: row.href,
          key: row.lane,
          label: row.lane,
          value: row.state,
        }))}
      />
    </AdminSection>
  );
}

export type BookingCommandDecisionStripSectionProps = {
  commandDecisionStrip: BookingCommandDecisionStrip;
};

export function BookingDetailToolbar({
  bookingId,
  customerProfileId,
  finalPartnerId,
  chatRoomId,
  paymentId,
  refundId,
}: BookingDetailToolbarProps) {
  return (
    <>
      <AdminFormControlLink className="button-secondary admin-inline-action" href="/bookings">
        <ArrowLeft aria-hidden="true" size={14} />
        Back to booking monitor
      </AdminFormControlLink>
      {customerProfileId && (
        <AdminFormControlLink className="button-secondary admin-inline-action" href={`/customers/${customerProfileId}`}>
          <User aria-hidden="true" size={14} />
          Open customer
        </AdminFormControlLink>
      )}
      {customerProfileId && (
        <AdminFormControlLink
          className="button-secondary admin-inline-action"
          href={`/chat-archive?q=${encodeURIComponent(customerProfileId)}`}
        >
          <MessageSquareText aria-hidden="true" size={14} />
          All customer chats
        </AdminFormControlLink>
      )}
      {finalPartnerId && (
        <AdminFormControlLink className="button-secondary admin-inline-action" href={`/partners/${finalPartnerId}`}>
          <Users aria-hidden="true" size={14} />
          Open Partner
        </AdminFormControlLink>
      )}
      {finalPartnerId && (
        <AdminFormControlLink
          className="button-secondary admin-inline-action"
          href={`/chat-archive?q=${encodeURIComponent(finalPartnerId)}`}
        >
          <MessageSquareText aria-hidden="true" size={14} />
          All Partner chats
        </AdminFormControlLink>
      )}
      {chatRoomId && (
        <AdminFormControlLink
          className="button-secondary admin-inline-action"
          href={`/chat-archive?q=${encodeURIComponent(bookingId)}`}
        >
          <MessageSquareText aria-hidden="true" size={14} />
          Open chat archive
        </AdminFormControlLink>
      )}
      {paymentId && (
        <AdminTextLink href={`/payments#payment-${paymentId}`}>
          Open payment
        </AdminTextLink>
      )}
      {refundId && (
        <AdminTextLink href={`/refunds#refund-${refundId}`}>
          Open refund
        </AdminTextLink>
      )}
    </>
  );
}

export function BookingOperatorFirstReadSection({ rows }: BookingOperatorFirstReadSectionProps) {
  return (
    <AdminSection
      actions={<StatusBadge tone="info">Above-fold summary</StatusBadge>}
      className="admin-mb-16"
      description="The first facts an operator checks before opening the full booking evidence record."
      id="booking-operator-first-read"
      title="Booking operator first read"
    >
      <SummaryLinkGrid rows={rows} />
    </AdminSection>
  );
}

export type BookingOperatorFirstReadSectionProps = {
  rows: SummaryLinkCard[];
};

export function BookingMetricGridSection({ metrics }: BookingMetricGridSectionProps) {
  return <AdminMetricGrid className="admin-mb-16" metrics={metrics} />;
}

export type BookingMetricGridSectionProps = {
  metrics: MetricSummaryCard[];
};

export function BookingOperationsQuickRailSection({ rows }: BookingOperationsQuickRailSectionProps) {
  return (
    <AdminSection
      actions={<StatusBadge tone="info">{rows.length} shortcuts</StatusBadge>}
      className="admin-mb-16"
      description="Fast jumps for one booking. This keeps operations centered on address evidence, marketplace participants, customer choice, retained chat, payment, wallet, fee, tax, location, and staff records."
      id="booking-operations-quick-rail"
      title="Booking operations quick rail"
    >
      <SummaryLinkGrid rows={rows} />
    </AdminSection>
  );
}

export type BookingOperationsQuickRailSectionProps = {
  rows: SummaryLinkCard[];
};

export function BookingMatchingRuleSnapshotSection({
  matchingRuleSnapshot,
}: BookingMatchingRuleSnapshotSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={statusBadgeToneFromPillClass(matchingRuleSnapshot.tone)}>
          {matchingRuleSnapshot.status}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Current matching rule state and the linked policy actions for this booking."
      id="matching-rule-snapshot"
      title="Matching rule snapshot"
    >
      <p className="muted admin-mt-8">
        {matchingRuleSnapshot.summary}
      </p>
      <SummaryMetricGrid rows={matchingRuleSnapshot.rows} />
      <div className="actions admin-mt-12">
        {matchingRuleSnapshot.actions.map((action) => (
          <AdminFormControlLink className="button-secondary admin-inline-action" href={action.href} key={action.label}>
            <ExternalLink aria-hidden="true" size={14} />
            {action.label}
          </AdminFormControlLink>
        ))}
      </div>
    </AdminSection>
  );
}

export type BookingMatchingRuleSnapshotSectionProps = {
  matchingRuleSnapshot: MatchingRuleSnapshot;
};

export function BookingMvpAuthorityContractSection({ rows }: BookingMvpAuthorityContractSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary admin-inline-action" href="/operations-policy">
          <ExternalLink aria-hidden="true" size={14} />
          Open policy controls
        </AdminFormControlLink>
      }
      className="admin-mb-16"
      description="Authority source check for the booking decisions shown on this page."
      id="mvp-authority-contract"
      title="MVP authority contract"
    >
      <AdminTableScroll>
        <AdminDataTable emptyMessage={null} headers={MVP_AUTHORITY_CONTRACT_HEADERS} rowCount={rows.length}>
          {rows.map((row) => (
            <tr key={row.contract}>
              <td>
                <strong>{row.contract}</strong>
                <p className="muted">{row.scope}</p>
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(row.tone)}>{row.status}</StatusBadge>
              </td>
              <td>{row.evidence}</td>
              <td>{row.operatorUse}</td>
              <td>
                <AdminFormControlLink className="button-secondary admin-inline-action" href={row.href}>
                  <ExternalLink aria-hidden="true" size={14} />
                  Open
                </AdminFormControlLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}

export type BookingMvpAuthorityContractSectionProps = {
  rows: AuthorityContractRow[];
};

export function BookingRecentOperationsTimelineSection({
  operatingTimeline,
}: BookingRecentOperationsTimelineSectionProps) {
  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary admin-inline-action" href="#operating-timeline">
          <ExternalLink aria-hidden="true" size={14} />
          Open full operating timeline
        </AdminFormControlLink>
      }
      className="admin-mb-16"
      description="Latest factual booking steps before an operator decides the next action."
      id="booking-recent-operations-timeline"
      title="Booking recent operations timeline"
    >
      <div className="setup-stage-list admin-mt-12">
        {operatingTimeline.slice(0, 8).map((item) => (
          <AdminStageItem key={`recent-${item.id}`}>
            <span>{item.type}</span>
            <div>
              <strong>{item.title}</strong>
              <p className="muted">{item.detail}</p>
            </div>
            <small>
              <DateTimeText fallback={item.status} value={item.at} />
            </small>
          </AdminStageItem>
        ))}
      </div>
    </AdminSection>
  );
}

export type BookingRecentOperationsTimelineSectionProps = {
  operatingTimeline: RecentTimelineItem[];
};

export function BookingPriorityBriefingSection({
  operatorPriorityBriefing,
}: BookingPriorityBriefingSectionProps) {
  return (
    <AdminSection
      actions={
        <StatusBadge tone={statusBadgeToneFromPillClass(operatorPriorityBriefing.tone)}>
          {operatorPriorityBriefing.status}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="First-screen operator summary for handoff, chat, location, payment, and closeout. This shows factual state only, not customer or Partner judgment."
      id="booking-priority-briefing"
      title="Booking priority briefing"
    >
      <SummaryMetricGrid rows={operatorPriorityBriefing.rows} />
      <div className="setup-stage-list admin-mt-12">
        {operatorPriorityBriefing.steps.map((step) => (
          <AdminStageItem key={step.id}>
            <span>{step.label}</span>
            <div>
              <strong>{step.title}</strong>
              <p className="muted">{step.detail}</p>
            </div>
            <AdminFormControlLink className="button-secondary admin-inline-action" href={step.href}>
              <ExternalLink aria-hidden="true" size={14} />
              {step.linkLabel}
            </AdminFormControlLink>
          </AdminStageItem>
        ))}
      </div>
    </AdminSection>
  );
}

export type BookingPriorityBriefingSectionProps = {
  operatorPriorityBriefing: PriorityBriefing;
};

function SummaryLinkGrid({ rows }: SummaryLinkGridProps) {
  return (
    <AdminTraceSummary
      className="admin-mt-12"
      metrics={rows.map((item) => ({
        detail: item.detail,
        href: item.href,
        label: item.label,
        value: item.value,
      }))}
    />
  );
}

function SummaryMetricGrid({ rows }: SummaryMetricGridProps) {
  return (
    <AdminTraceSummary
      className="admin-mt-12"
      metrics={rows.map((row) => ({
        detail: row.helper,
        label: row.label,
        value: row.value,
      }))}
    />
  );
}
