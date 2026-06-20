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
}: BookingAlertTraceSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Booking alert trace</h2>
          <p className="muted">
            Booking-specific notification history for first-pick, marketplace Partner visibility, retries, and
            disabled device checks.
          </p>
        </div>
        <Link className="text-link" href={`/notifications?booking=${bookingId}`}>
          Open notification board
        </Link>
      </div>
      <div className="service-trace-summary admin-mt-12">
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
        <p className="muted admin-mt-12">
          No notification rows are tied to this booking yet. If a Partner says they missed the request, check
          whether the booking created first-pick or marketplace availability alerts.
        </p>
      ) : null}
    </section>
  );
}

export type BookingAlertTraceSectionProps = {
  bookingId: string;
  notificationTrace: NotificationTrace;
};

export function BookingOperationsAuditTraceSection({
  bookingId,
  operationsTrace,
}: BookingOperationsAuditTraceSectionProps) {
  return (
    <section className="card admin-mb-16">
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
      <div className="service-trace-summary admin-mt-12">
        {operationsTrace.metrics.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-note admin-mt-14">
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
        <p className="muted admin-mt-12">
          No operator action has been recorded for this booking yet.
        </p>
      )}
    </section>
  );
}

export type BookingOperationsAuditTraceSectionProps = {
  bookingId: string;
  operationsTrace: OperationsTrace;
};

export function BookingAttentionChecksSection({
  attentionFlags,
  attentionSummary,
}: BookingAttentionChecksSectionProps) {
  return (
    <section className="card ops-watch admin-mb-16">
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

export type BookingAttentionChecksSectionProps = {
  attentionFlags: AttentionFlag[];
  attentionSummary: { tone: string; label: string };
};

export function BookingFinanceCommandCenterSection({
  financeFlags,
  financeSummaryCards,
}: BookingFinanceCommandCenterSectionProps) {
  return (
    <section className="card ops-watch admin-mb-16" id="finance">
      <div className="ops-section-header">
        <div>
          <h2>Finance command center</h2>
          <p className="muted">
            Booking finance summary and required checks.
          </p>
        </div>
        <span className={`pill ${financeFlags.length ? 'pill-warn' : 'pill-success'}`}>
          {financeFlags.length ? `${financeFlags.length} finance check(s)` : 'Finance clear'}
        </span>
      </div>
      <div className="grid admin-mt-12">
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
        <p className="muted admin-mt-12">
          Finance checks are aligned for this booking.
        </p>
      )}
    </section>
  );
}

export type BookingFinanceCommandCenterSectionProps = {
  financeFlags: AttentionFlag[];
  financeSummaryCards: SummaryCard[];
};

export function BookingPayoutBatchEligibilitySection({
  payoutBatchEligibility,
}: BookingPayoutBatchEligibilitySectionProps) {
  return (
    <section className="card admin-mb-16" id="payout-batch-eligibility">
      <div className="ops-section-header">
        <div>
          <h2>Payout batch eligibility</h2>
          <p className="muted">
            Booking readiness for Partner settlement batches.
          </p>
        </div>
        <span className={`pill ${payoutBatchEligibility.tone}`}>{payoutBatchEligibility.status}</span>
      </div>
      <p className="muted admin-mt-8">
        {payoutBatchEligibility.summary}
      </p>
      <div className="booking-settlement-ledger admin-mt-12" aria-label="Payout batch eligibility rows">
        {payoutBatchEligibility.rows.map((row) => (
          <div className={`booking-settlement-ledger-row ${row.className}`} key={row.label}>
            <div>
              <span className="booking-settlement-ledger-label">{row.label}</span>
              <p className="muted">{row.operatorRule}</p>
            </div>
            <span className={`pill ${row.pillClass}`}>{row.status}</span>
            <p>{row.detail}</p>
            <ActionLink href={row.href} label="Open" />
          </div>
        ))}
      </div>
    </section>
  );
}

export type BookingPayoutBatchEligibilitySectionProps = {
  payoutBatchEligibility: PayoutBatchEligibility;
};

export function BookingServicePricingSnapshotSection({
  financeFlags,
  servicePricingSnapshotRows,
}: BookingServicePricingSnapshotSectionProps) {
  return (
    <section className="card admin-mb-16" id="service-pricing-snapshot">
      <div className="ops-section-header">
        <div>
          <h2>Service pricing snapshot</h2>
          <p className="muted">
            Booking price, payout, fee, and tax evidence.
          </p>
        </div>
        <span className={`pill ${financeFlags.length ? 'pill-warn' : 'pill-success'}`}>
          {financeFlags.length ? `${financeFlags.length} pricing check(s)` : 'Pricing aligned'}
        </span>
      </div>
      <div className="service-trace-summary admin-mt-12">
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

export type BookingServicePricingSnapshotSectionProps = {
  financeFlags: AttentionFlag[];
  servicePricingSnapshotRows: SummaryCard[];
};
