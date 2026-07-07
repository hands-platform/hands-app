import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { AdminMetricGrid } from '../../../components/admin-page-template';
import { AdminNotePanel, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import {
  AdminSignal,
  StatusBadge,
  StatusBadgeFromPillClass,
  type AdminSignalTone,
} from '../../../components/status-badge';
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
  totalBackupBatches?: number;
  totalRows?: number;
  backupBatches: Array<{
    id: string;
    createdAtLabel?: string | null;
    createdAtValue?: string | null;
    signal: string;
    title: string;
    detail: string;
    meta: string;
    providers?: string | null;
  }>;
  rows: Array<{
    id: string;
    createdAtLabel?: string | null;
    createdAtValue?: string | null;
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
        <StatusBadgeFromPillClass pillClass={attentionToneClass(flag.severity)}>
          {checkSeverityLabel(flag.severity)}
        </StatusBadgeFromPillClass>
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
  const totalRows = notificationTrace.totalRows ?? notificationTrace.rows.length;
  const totalBackupBatches =
    notificationTrace.totalBackupBatches ?? notificationTrace.backupBatches.length;
  const hiddenRows = Math.max(totalRows - notificationTrace.rows.length, 0);
  const hiddenBatches = Math.max(totalBackupBatches - notificationTrace.backupBatches.length, 0);

  return (
    <AdminSection
      actions={
        <AdminTextLink href={`/notifications?booking=${bookingId}`}>
          Open notification board
        </AdminTextLink>
      }
      className="admin-mb-16"
      description="Booking-specific notification history for first-pick, marketplace Partner visibility, retries, and disabled device checks."
      title="Booking alert trace"
    >
      <SummaryCardTrace cards={notificationTrace.metrics} />
      {notificationTrace.backupBatches.length > 0 ? (
        <div className="ops-check-list">
          {notificationTrace.backupBatches.map((batch) => (
            <div className="ops-check-item" key={batch.id}>
              <AdminSignal tone="info">{batch.signal}</AdminSignal>
              <div>
                <h3>{batch.title}</h3>
                <p>{batch.detail}</p>
                <TraceCreatedAt label={batch.createdAtLabel} value={batch.createdAtValue} />
                {batch.meta ? <small>{batch.meta}</small> : null}
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
              <AdminSignal tone={signalToneFromClass(row.signalClass)}>{row.signal}</AdminSignal>
              <div>
                <h3>{row.title}</h3>
                <p>{row.detail}</p>
                <TraceCreatedAt label={row.createdAtLabel} value={row.createdAtValue} />
                {row.meta ? <small>{row.meta}</small> : null}
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
      {hiddenRows + hiddenBatches > 0 && (
        <p className="muted admin-mt-10">
          Showing latest {notificationTrace.rows.length} of {totalRows} notification row(s) and latest{' '}
          {notificationTrace.backupBatches.length} of {totalBackupBatches} marketplace batch(es). Open the
          notification board for the full delivery history.
        </p>
      )}
    </AdminSection>
  );
}

function TraceCreatedAt({ label, value }: { label?: string | null; value?: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <small>
      Created <DateTimeText fallback={label ?? 'Not set'} value={value} />
    </small>
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
    <AdminSection
      actions={
        <AdminTextLink href={`/audit-log?q=${encodeURIComponent(bookingId)}`}>
          Open audit log
        </AdminTextLink>
      }
      className="admin-mb-16"
      description="Booking-specific operator actions plus policy updates that happened after this request opened."
      title="Operations audit trace"
    >
      <SummaryCardTrace cards={operationsTrace.metrics} />
      <AdminNotePanel className="admin-mt-14">
        <div className="ops-row">
          <div>
            <StatusBadgeFromPillClass pillClass={operationsTrace.statusTone}>
              {operationsTrace.status}
            </StatusBadgeFromPillClass>
            <strong>{operationsTrace.title}</strong>
            <p className="muted">{operationsTrace.detail}</p>
          </div>
          <AdminTextLink href="/operations-policy">
            Review policy
          </AdminTextLink>
        </div>
      </AdminNotePanel>
      {operationsTrace.rows.length > 0 ? (
        <div className="ops-check-list">
          {operationsTrace.rows.map((row) => (
            <div className="ops-check-item" key={row.id}>
              <AdminSignal tone={signalToneFromClass(row.signalClass)}>{row.signal}</AdminSignal>
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
    </AdminSection>
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
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={attentionSummary.tone}>
          {attentionSummary.label}
        </StatusBadgeFromPillClass>
      }
      className="ops-watch admin-mb-16"
      description="Automatic operational checks for bookings that need operator attention."
      title="Attention checks"
    >
      {attentionFlags.length > 0 ? (
        <div className="ops-check-list">
          {attentionFlags.map((flag) => (
            <BookingAttentionItem flag={flag} key={`${flag.severity}-${flag.title}`} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          framed
          message="No active attention checks. Continue normal monitoring from the timeline."
          title={null}
        />
      )}
    </AdminSection>
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
    <AdminSection
      actions={
        <StatusBadge tone={financeFlags.length ? 'warning' : 'success'}>
          {financeFlags.length ? `${financeFlags.length} finance check(s)` : 'Finance clear'}
        </StatusBadge>
      }
      className="ops-watch admin-mb-16"
      description="Booking finance summary and required checks."
      id="finance"
      title="Finance command center"
    >
      <AdminMetricGrid className="admin-mt-12" metrics={financeSummaryCards} />
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
    </AdminSection>
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
    <AdminSection
      actions={
        <StatusBadgeFromPillClass pillClass={payoutBatchEligibility.tone}>
          {payoutBatchEligibility.status}
        </StatusBadgeFromPillClass>
      }
      className="admin-mb-16"
      description="Booking readiness for Partner settlement batches."
      id="payout-batch-eligibility"
      title="Payout batch eligibility"
    >
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
            <StatusBadgeFromPillClass pillClass={row.pillClass}>{row.status}</StatusBadgeFromPillClass>
            <p>{row.detail}</p>
            <ActionLink href={row.href} label="Open" />
          </div>
        ))}
      </div>
    </AdminSection>
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
    <AdminSection
      actions={
        <StatusBadge tone={financeFlags.length ? 'warning' : 'success'}>
          {financeFlags.length ? `${financeFlags.length} pricing check(s)` : 'Pricing aligned'}
        </StatusBadge>
      }
      className="admin-mb-16"
      description="Booking price, payout, fee, and tax evidence."
      id="service-pricing-snapshot"
      title="Service pricing evidence"
    >
      <SummaryCardTrace cards={servicePricingSnapshotRows} />
    </AdminSection>
  );
}

export type BookingServicePricingSnapshotSectionProps = {
  financeFlags: AttentionFlag[];
  servicePricingSnapshotRows: SummaryCard[];
};

function signalToneFromClass(signalClass: string): AdminSignalTone {
  if (signalClass.includes('warn') || signalClass.includes('danger')) {
    return 'warn';
  }
  if (signalClass.includes('info')) {
    return 'info';
  }
  return 'ok';
}

function SummaryCardTrace({ cards }: { cards: SummaryCard[] }) {
  return (
    <AdminTraceSummary
      className="admin-mt-12"
      metrics={cards.map((card) => ({
        detail: card.helper,
        label: card.label,
        value: card.value,
      }))}
    />
  );
}
