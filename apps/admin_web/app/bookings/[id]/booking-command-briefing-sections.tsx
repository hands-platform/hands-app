import Link from 'next/link';
import { AdminTableScroll } from '../../../components/admin-data-table';
import { MetricCard } from '../../../components/metric-card';
import type { BookingCommandDecisionStrip } from '../../../lib/booking-command-decision-strip';
import { formatDate, shortId } from './booking-formatters';

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
}: {
  commandDecisionStrip: BookingCommandDecisionStrip;
}) {
  return (
    <section className="card admin-mb-16" id="booking-command-decision-strip">
      <div className="ops-section-header">
        <div>
          <h2>Booking command decision strip</h2>
          <p className="muted">
            Primary booking command and four-lane operator strip for address, matching, chat, and finance.
          </p>
        </div>
        <span className={`pill ${commandDecisionStrip.tone}`}>{commandDecisionStrip.status}</span>
      </div>
      <div className="booking-command-primary">
        <strong>Primary booking command</strong>
        <p>{commandDecisionStrip.primaryAction}</p>
        <small>{commandDecisionStrip.primaryDetail}</small>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {commandDecisionStrip.rows.map((row) => (
          <a href={row.href} key={row.lane}>
            <span>{row.lane}</span>
            <strong>{row.state}</strong>
            <small>{row.detail}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

export function BookingDetailToolbar({
  bookingId,
  serviceLabel,
  status,
  customerProfileId,
  finalPartnerId,
  chatRoomId,
  paymentId,
  refundId,
}: BookingDetailToolbarProps) {
  return (
    <section className="toolbar">
      <div>
        <p className="muted">
          <Link className="text-link" href="/bookings">
            Back to booking monitor
          </Link>
        </p>
        <h1>Booking {shortId(bookingId)}</h1>
        <p className="muted">
          {serviceLabel} - {status}
        </p>
      </div>
      <div className="actions">
        {customerProfileId && (
          <Link className="text-link" href={`/customers/${customerProfileId}`}>
            Open customer
          </Link>
        )}
        {customerProfileId && (
          <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(customerProfileId)}`}>
            All customer chats
          </Link>
        )}
        {finalPartnerId && (
          <Link className="text-link" href={`/partners/${finalPartnerId}`}>
            Open Partner
          </Link>
        )}
        {finalPartnerId && (
          <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(finalPartnerId)}`}>
            All Partner chats
          </Link>
        )}
        {chatRoomId && (
          <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(bookingId)}`}>
            Open chat archive
          </Link>
        )}
        {paymentId && (
          <Link className="text-link" href={`/payments#payment-${paymentId}`}>
            Open payment
          </Link>
        )}
        {refundId && (
          <Link className="text-link" href={`/refunds#refund-${refundId}`}>
            Open refund
          </Link>
        )}
      </div>
    </section>
  );
}

export function BookingOperatorFirstReadSection({ rows }: BookingOperatorFirstReadSectionProps) {
  return (
    <section className="card admin-mb-16" id="booking-operator-first-read">
      <div className="ops-section-header">
        <div>
          <h2>Booking operator first read</h2>
          <p className="muted">
            The first facts an operator checks before opening the full booking evidence record.
          </p>
        </div>
        <span className="pill pill-info">Above-fold summary</span>
      </div>
      <SummaryLinkGrid rows={rows} />
    </section>
  );
}

export type BookingOperatorFirstReadSectionProps = {
  rows: SummaryLinkCard[];
};

export function BookingMetricGridSection({ metrics }: BookingMetricGridSectionProps) {
  return (
    <section className="grid admin-mb-16">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
      ))}
    </section>
  );
}

export type BookingMetricGridSectionProps = {
  metrics: MetricSummaryCard[];
};

export function BookingOperationsQuickRailSection({ rows }: { rows: SummaryLinkCard[] }) {
  return (
    <section className="card admin-mb-16" id="booking-operations-quick-rail">
      <div className="ops-section-header">
        <div>
          <h2>Booking operations quick rail</h2>
          <p className="muted">
            Fast jumps for one booking. This keeps operations centered on address evidence, marketplace
            participants, customer choice, retained chat, payment, wallet, fee, tax, location, and staff
            records.
          </p>
        </div>
        <span className="pill pill-info">{rows.length} shortcuts</span>
      </div>
      <SummaryLinkGrid rows={rows} />
    </section>
  );
}

export function BookingMatchingRuleSnapshotSection({
  matchingRuleSnapshot,
}: {
  matchingRuleSnapshot: MatchingRuleSnapshot;
}) {
  return (
    <section className="card admin-mb-16" id="matching-rule-snapshot">
      <div className="ops-section-header">
        <div>
          <h2>Matching rule snapshot</h2>
          <p className="muted">
            Detail-level rule readout for first-pick wait, booking-address marketplace radius, customer final
            choice, chat handoff, and wallet gate.
          </p>
        </div>
        <span className={`pill ${matchingRuleSnapshot.tone}`}>{matchingRuleSnapshot.status}</span>
      </div>
      <p className="muted admin-mt-8">
        {matchingRuleSnapshot.summary}
      </p>
      <SummaryMetricGrid rows={matchingRuleSnapshot.rows} />
      <div className="actions admin-mt-12">
        {matchingRuleSnapshot.actions.map((action) => (
          <Link className="text-link" href={action.href} key={action.label}>
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BookingMvpAuthorityContractSection({ rows }: { rows: AuthorityContractRow[] }) {
  return (
    <section className="card admin-mb-16" id="mvp-authority-contract">
      <div className="ops-section-header">
        <div>
          <h2>MVP authority contract</h2>
          <p className="muted">
            One-screen check against the HANDS MVP policy: NestJS business authority, address snapshot,
            first-pick priority, 10km marketplace, customer fallback Partner choice, chat retention, and wallet gate.
          </p>
        </div>
        <Link className="text-link" href="/operations-policy">
          Open policy controls
        </Link>
      </div>
      <AdminTableScroll>
        <table className="table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Current state</th>
              <th>Evidence</th>
              <th>Operator use</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.contract}>
                <td>
                  <strong>{row.contract}</strong>
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
    </section>
  );
}

export function BookingRecentOperationsTimelineSection({
  operatingTimeline,
}: {
  operatingTimeline: RecentTimelineItem[];
}) {
  return (
    <section className="card admin-mb-16" id="booking-recent-operations-timeline">
      <div className="ops-section-header">
        <div>
          <h2>Booking recent operations timeline</h2>
          <p className="muted">
            Latest factual booking steps before an operator decides: address, first-pick wait, 10km Partner
            participation, customer final choice, chat, location, payment, cash debt, and closeout.
          </p>
        </div>
        <Link className="text-link" href="#operating-timeline">
          Open full operating timeline
        </Link>
      </div>
      <div className="setup-stage-list admin-mt-12">
        {operatingTimeline.slice(0, 8).map((item) => (
          <div className="setup-stage-item" key={`recent-${item.id}`}>
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

export function BookingPriorityBriefingSection({
  operatorPriorityBriefing,
}: {
  operatorPriorityBriefing: PriorityBriefing;
}) {
  return (
    <section className="card admin-mb-16" id="booking-priority-briefing">
      <div className="ops-section-header">
        <div>
          <h2>Booking priority briefing</h2>
          <p className="muted">
            First-screen operator summary for handoff, chat, location, payment, and closeout. This shows
            factual state only, not customer or Partner judgment.
          </p>
        </div>
        <span className={`pill ${operatorPriorityBriefing.tone}`}>{operatorPriorityBriefing.status}</span>
      </div>
      <SummaryMetricGrid rows={operatorPriorityBriefing.rows} />
      <div className="setup-stage-list admin-mt-12">
        {operatorPriorityBriefing.steps.map((step) => (
          <div className="setup-stage-item" key={step.id}>
            <span>{step.label}</span>
            <div>
              <strong>{step.title}</strong>
              <p className="muted">{step.detail}</p>
            </div>
            <Link className="text-link" href={step.href}>
              {step.linkLabel}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryLinkGrid({ rows }: { rows: SummaryLinkCard[] }) {
  return (
    <div className="service-trace-summary admin-mt-12">
      {rows.map((item) => (
        <a href={item.href} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </a>
      ))}
    </div>
  );
}

function SummaryMetricGrid({ rows }: { rows: SummaryMetricRow[] }) {
  return (
    <div className="service-trace-summary admin-mt-12">
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          <small>{row.helper}</small>
        </div>
      ))}
    </div>
  );
}
