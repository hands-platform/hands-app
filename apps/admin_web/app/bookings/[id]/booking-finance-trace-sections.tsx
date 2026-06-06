import Link from 'next/link';
import { MetricCard } from '../../../components/metric-card';
import { ActionLink } from './booking-operator-actions';

type SummaryCard = {
  label: string;
  value: string;
  helper: string;
};

type AttentionFlag = {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  action: string;
};

type NotificationTrace = {
  metrics: SummaryCard[];
  backupBatches: Array<{
    id: string;
    signal: string;
    title: string;
    detail: string;
    meta: string;
    providers?: string | null;
  }>;
  rows: Array<{
    id: string;
    signalClass: string;
    signal: string;
    title: string;
    detail: string;
    meta: string;
    delivery?: string | null;
  }>;
};

type OperationsTrace = {
  metrics: SummaryCard[];
  statusTone: string;
  status: string;
  title: string;
  detail: string;
  rows: Array<{
    id: string;
    signalClass: string;
    signal: string;
    title: string;
    detail: string;
    meta: string;
  }>;
};

type PayoutBatchEligibility = {
  tone: string;
  status: string;
  summary: string;
  rows: Array<{
    label: string;
    status: string;
    detail: string;
    operatorRule: string;
    href: string;
    className: string;
    pillClass: string;
  }>;
};

function checkSeverityLabel(severity: AttentionFlag['severity']) {
  if (severity === 'high') {
    return 'Action';
  }
  if (severity === 'medium') {
    return 'Monitor';
  }
  return 'Note';
}

function attentionToneClass(severity: AttentionFlag['severity']) {
  if (severity === 'high') {
    return 'pill-danger';
  }
  if (severity === 'medium') {
    return 'pill-warn';
  }
  return 'pill-info';
}

function BookingAttentionItem({ flag }: { flag: AttentionFlag }) {
  return (
    <div className={`ops-check-item ops-check-${flag.severity}`}>
      <div>
        <span className={`pill ${attentionToneClass(flag.severity)}`}>
          {checkSeverityLabel(flag.severity)}
        </span>
        <strong>{flag.title}</strong>
        <p className="muted">{flag.detail}</p>
      </div>
      <p>{flag.action}</p>
    </div>
  );
}

export function BookingAlertTraceSection({
  bookingId,
  notificationTrace,
}: {
  bookingId: string;
  notificationTrace: NotificationTrace;
}) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Booking alert trace</h2>
          <p className="muted">
            Booking-specific notification history for first-pick, marketplace partner visibility, retries, and
            disabled device checks.
          </p>
        </div>
        <Link className="text-link" href={`/notifications?booking=${bookingId}`}>
          Open notification board
        </Link>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {notificationTrace.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      {notificationTrace.backupBatches.length > 0 ? (
        <div className="ops-check-list">
          {notificationTrace.backupBatches.map((batch) => (
            <div className="ops-check-item" key={batch.id}>
              <span className="signal signal-info">{batch.signal}</span>
              <div>
                <h3>{batch.title}</h3>
                <p>{batch.detail}</p>
                <small>{batch.meta}</small>
                {batch.providers ? <small>{batch.providers}</small> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {notificationTrace.rows.length > 0 ? (
        <div className="ops-check-list">
          {notificationTrace.rows.map((row) => (
            <div className="ops-check-item" key={row.id}>
              <span className={`signal ${row.signalClass}`}>{row.signal}</span>
              <div>
                <h3>{row.title}</h3>
                <p>{row.detail}</p>
                <small>{row.meta}</small>
                {row.delivery ? <small>{row.delivery}</small> : null}
              </div>
            </div>
          ))}
        </div>
      ) : notificationTrace.backupBatches.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          No notification rows are tied to this booking yet. If a partner says they missed the request, check
          whether the booking created first-pick or marketplace availability alerts.
        </p>
      ) : null}
    </section>
  );
}

export function BookingOperationsAuditTraceSection({
  bookingId,
  operationsTrace,
}: {
  bookingId: string;
  operationsTrace: OperationsTrace;
}) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Operations audit trace</h2>
          <p className="muted">
            Booking-specific operator actions plus policy updates that happened after this request opened.
          </p>
        </div>
        <Link className="text-link" href={`/audit-log?q=${encodeURIComponent(bookingId)}`}>
          Open audit log
        </Link>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {operationsTrace.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-note" style={{ marginTop: 14 }}>
        <div className="ops-row">
          <div>
            <span className={`pill ${operationsTrace.statusTone}`}>{operationsTrace.status}</span>
            <strong>{operationsTrace.title}</strong>
            <p className="muted">{operationsTrace.detail}</p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Review policy
          </Link>
        </div>
      </div>
      {operationsTrace.rows.length > 0 ? (
        <div className="ops-check-list">
          {operationsTrace.rows.map((row) => (
            <div className="ops-check-item" key={row.id}>
              <span className={`signal ${row.signalClass}`}>{row.signal}</span>
              <div>
                <h3>{row.title}</h3>
                <p>{row.detail}</p>
                <small>{row.meta}</small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          No operator action has been recorded for this booking yet.
        </p>
      )}
    </section>
  );
}

export function BookingAttentionChecksSection({
  attentionFlags,
  attentionSummary,
}: {
  attentionFlags: AttentionFlag[];
  attentionSummary: { tone: string; label: string };
}) {
  return (
    <section className="card ops-watch" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Attention checks</h2>
          <p className="muted">Automatic operational checks for bookings that need operator attention.</p>
        </div>
        <span className={`pill ${attentionSummary.tone}`}>{attentionSummary.label}</span>
      </div>
      {attentionFlags.length > 0 ? (
        <div className="ops-check-list">
          {attentionFlags.map((flag) => (
            <BookingAttentionItem flag={flag} key={`${flag.severity}-${flag.title}`} />
          ))}
        </div>
      ) : (
        <p className="muted">No active attention checks. Continue normal monitoring from the timeline.</p>
      )}
    </section>
  );
}

export function BookingFinanceCommandCenterSection({
  financeFlags,
  financeSummaryCards,
}: {
  financeFlags: AttentionFlag[];
  financeSummaryCards: SummaryCard[];
}) {
  return (
    <section className="card ops-watch" id="finance" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Finance command center</h2>
          <p className="muted">
            One-booking money flow from customer price to partner payout, HANDS fee, tax, and wallet impact.
          </p>
        </div>
        <span className={`pill ${financeFlags.length ? 'pill-warn' : 'pill-success'}`}>
          {financeFlags.length ? `${financeFlags.length} finance check(s)` : 'Finance clear'}
        </span>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        {financeSummaryCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} helper={card.helper} />
        ))}
      </div>
      {financeFlags.length > 0 ? (
        <div className="ops-check-list">
          {financeFlags.map((flag) => (
            <BookingAttentionItem flag={flag} key={`${flag.severity}-${flag.title}`} />
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>
          Customer charge, payout rule, earning, and wallet impact are aligned for this booking.
        </p>
      )}
    </section>
  );
}

export function BookingPayoutBatchEligibilitySection({
  payoutBatchEligibility,
}: {
  payoutBatchEligibility: PayoutBatchEligibility;
}) {
  return (
    <section className="card" id="payout-batch-eligibility" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Payout batch eligibility</h2>
          <p className="muted">
            Booking-level release check before weekly, monthly, or admin-selected partner settlement batches.
          </p>
        </div>
        <span className={`pill ${payoutBatchEligibility.tone}`}>{payoutBatchEligibility.status}</span>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        {payoutBatchEligibility.summary}
      </p>
      <div className="ops-task-grid" style={{ marginTop: 12 }}>
        {payoutBatchEligibility.rows.map((row) => (
          <div className={`ops-task-card ${row.className}`} key={row.label}>
            <div>
              <span className={`pill ${row.pillClass}`}>{row.status}</span>
              <h3>{row.label}</h3>
              <p>{row.detail}</p>
              <small>{row.operatorRule}</small>
            </div>
            <ActionLink href={row.href} label="Open" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function BookingServicePricingSnapshotSection({
  financeFlags,
  servicePricingSnapshotRows,
}: {
  financeFlags: AttentionFlag[];
  servicePricingSnapshotRows: SummaryCard[];
}) {
  return (
    <section className="card" id="service-pricing-snapshot" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Service pricing snapshot</h2>
          <p className="muted">
            Booking-level price evidence for the selected service duration, partner payout, platform fee, tax,
            and wallet impact.
          </p>
        </div>
        <span className={`pill ${financeFlags.length ? 'pill-warn' : 'pill-success'}`}>
          {financeFlags.length ? `${financeFlags.length} pricing check(s)` : 'Pricing aligned'}
        </span>
      </div>
      <div className="service-trace-summary" style={{ marginTop: 12 }}>
        {servicePricingSnapshotRows.map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <small>{row.helper}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
