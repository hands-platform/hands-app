import { AdminAuditLog, adminGet } from '../../lib/admin-api';

type AuditLogFilters = {
  q: string;
  bucket: string;
  priority: string;
};
type AuditLogPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AuditLogPage({ searchParams }: { searchParams?: AuditLogPageSearchParams }) {
  const filters = buildAuditFilters(searchParams ? await searchParams : {});
  const allLogs = sortLogs(await adminGet<AdminAuditLog[]>('/admin/audit-logs', []));
  const logs = filterAuditLogs(allLogs, filters);
  const summary = buildSummary(logs);

  return (
    <>
      <h1>Audit Log</h1>
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p>Total events</p>
          <h2>{summary.total}</h2>
        </div>
        <div className="card">
          <p>Dispatch actions</p>
          <h2>{summary.dispatch}</h2>
        </div>
        <div className="card">
          <p>Payment actions</p>
          <h2>{summary.payments}</h2>
        </div>
        <div className="card">
          <p>Service pricing</p>
          <h2>{summary.servicePricing}</h2>
        </div>
        <div className="card">
          <p>Notification actions</p>
          <h2>{summary.notifications}</h2>
        </div>
        <div className="card">
          <p>Needs review</p>
          <h2>{summary.needsReview}</h2>
        </div>
        <div className="card">
          <p>Recent hour</p>
          <h2>{summary.recentHour}</h2>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <form className="form-grid" action="/audit-log">
          <label>
            Search
            <input name="q" defaultValue={filters.q} placeholder="Action, target, actor, metadata" />
          </label>
          <label>
            Bucket
            <select name="bucket" defaultValue={filters.bucket}>
              <option value="">All</option>
              <option value="Dispatch">Dispatch</option>
              <option value="Payment">Payment</option>
              <option value="Service/Pricing">Service/Pricing</option>
              <option value="Notification">Notification</option>
              <option value="Provider">Partner</option>
              <option value="Tax">Tax</option>
              <option value="System">System</option>
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue={filters.priority}>
              <option value="">All</option>
              <option value="4">Review this first</option>
              <option value="3">Check before close</option>
              <option value="2">Trace related flow</option>
              <option value="1">Reference event</option>
            </select>
          </label>
          <div className="actions full-span">
            <button type="submit">Apply filters</button>
            <a className="text-link" href="/audit-log">
              Clear filters
            </a>
            <span className="muted">
              Showing {logs.length} of {allLogs.length} events
            </span>
          </div>
        </form>
      </section>

      <div className="card">
        <div className="toolbar">
          <div>
            <p className="muted">
              Recent operational trail for bookings, payments, refunds, partner review, and alerts.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-success">Newest first</span>
            <span className="pill pill-info">Action grouped</span>
            <span className="pill pill-warn">Metadata preview</span>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Related board</th>
              <th>Ops signal</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>
                  <div>{new Date(log.createdAt).toLocaleString()}</div>
                  <div className="muted">{relativeTime(log.createdAt)}</div>
                </td>
                <td>
                  <div style={{ marginBottom: 6 }}>{humanizeAction(log.action)}</div>
                  <span className={signalClass(log.action)}>{actionBucketLabel(log.action)}</span>
                </td>
                <td>{log.actor?.fullName ?? log.actor?.phone ?? 'System'}</td>
                <td>
                  <div>{shortTarget(log.target)}</div>
                  <div className="muted">{log.target}</div>
                </td>
                <td>
                  <a className="pill pill-info" href={relatedBoardHref(log)}>
                    {relatedBoardLabel(log)}
                  </a>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {reviewPriorityLabel(log.action)}
                  </div>
                </td>
                <td>
                  <div>{opsHint(log.action, log.target)}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {opsDetail(log.action)}
                  </div>
                </td>
                <td>
                  {metadataHighlights(log).length > 0 && (
                    <div className="participant-list" style={{ marginBottom: 8 }}>
                      {metadataHighlights(log).map((item, index) => (
                        <span className={item.className} key={`${item.label}-${index}`}>
                          {item.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 12,
                      color: '#475569',
                    }}
                  >
                    {metadataPreview(log.metadata)}
                  </pre>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7}>No audit logs loaded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function sortLogs(logs: AdminAuditLog[]) {
  return [...logs].sort((left, right) => {
    const priorityDiff = auditPriority(right.action) - auditPriority(left.action);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    return rightTime - leftTime;
  });
}

function buildSummary(logs: AdminAuditLog[]) {
  const now = Date.now();
  return {
    total: logs.length,
    dispatch: logs.filter((log) => isDispatchAction(log.action)).length,
    payments: logs.filter((log) => isPaymentAction(log.action)).length,
    servicePricing: logs.filter((log) => isServicePricingAction(log.action)).length,
    notifications: logs.filter((log) => isNotificationAction(log.action)).length,
    needsReview: logs.filter((log) => auditPriority(log.action) >= 3).length,
    recentHour: logs.filter((log) => now - Date.parse(log.createdAt) <= 60 * 60 * 1000).length,
  };
}

function buildAuditFilters(params: Record<string, string | string[] | undefined>): AuditLogFilters {
  return {
    q: readParam(params.q),
    bucket: readParam(params.bucket),
    priority: readParam(params.priority),
  };
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
}

function filterAuditLogs(logs: AdminAuditLog[], filters: AuditLogFilters) {
  const query = filters.q.toLowerCase();
  return logs.filter((log) => {
    if (query && !auditSearchText(log).includes(query)) {
      return false;
    }
    if (filters.bucket && actionBucketLabel(log.action) !== filters.bucket) {
      return false;
    }
    if (filters.priority && String(auditPriority(log.action)) !== filters.priority) {
      return false;
    }
    return true;
  });
}

function auditSearchText(log: AdminAuditLog) {
  return [log.action, log.target, log.actor?.fullName, log.actor?.phone, metadataPreview(log.metadata)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function auditPriority(action: string) {
  if (action.startsWith('service_payout_rule.')) {
    return 4;
  }
  if (action.startsWith('service.')) {
    return 3;
  }
  if (action.endsWith('.refund') || action.includes('reject') || action.endsWith('.retry')) {
    return 4;
  }
  if (action.startsWith('payment.') || action.startsWith('refund.')) {
    return 3;
  }
  if (action.startsWith('booking.') || action.startsWith('notification.')) {
    return 2;
  }
  return 1;
}

function isDispatchAction(action: string) {
  return (
    action.startsWith('booking.') ||
    action.startsWith('provider.') ||
    action.startsWith('provider_') ||
    action.startsWith('provider-')
  );
}

function isPaymentAction(action: string) {
  return action.startsWith('payment.') || action.startsWith('refund.');
}

function isNotificationAction(action: string) {
  return action.startsWith('notification.');
}

function isServicePricingAction(action: string) {
  return action.startsWith('service.') || action.startsWith('service_payout_rule.');
}

function actionBucketLabel(action: string) {
  if (isServicePricingAction(action)) {
    return 'Service/Pricing';
  }
  if (action.startsWith('tax_')) {
    return 'Tax';
  }
  if (isProviderReviewAction(action)) {
    return 'Partner';
  }
  if (isDispatchAction(action)) {
    return 'Dispatch';
  }
  if (isPaymentAction(action)) {
    return 'Payment';
  }
  if (isNotificationAction(action)) {
    return 'Notification';
  }
  if (isProviderReviewAction(action)) {
    return 'Partner';
  }
  return 'System';
}

function isProviderReviewAction(action: string) {
  return (
    action.startsWith('provider_') ||
    action.startsWith('provider-') ||
    action.startsWith('provider-verification.')
  );
}

function signalClass(action: string) {
  if (isServicePricingAction(action)) {
    return 'signal signal-warn';
  }
  if (isDispatchAction(action)) {
    return 'signal signal-info';
  }
  if (isPaymentAction(action)) {
    return 'signal signal-warn';
  }
  if (isNotificationAction(action)) {
    return 'signal signal-ok';
  }
  return 'signal';
}

function humanizeAction(action: string) {
  if (action === 'booking.ops_note.add') {
    return 'Booking / Operator note added';
  }
  if (action === 'booking.ops_task.update') {
    return 'Booking / Ops status updated';
  }

  return action
    .split('.')
    .map((part) => part.replace(/[-_]/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function shortTarget(target: string) {
  if (!target) {
    return '-';
  }
  const [scope, id] = target.split(':');
  if (!id) {
    return target;
  }
  return `${scope}:${id.slice(0, 8)}`;
}

function metadataPreview(metadata: unknown) {
  if (!metadata) {
    return 'No metadata';
  }
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return 'Metadata could not be rendered';
  }
}

type MetadataHighlight = {
  label: string;
  className: string;
};

function metadataHighlights(log: AdminAuditLog): MetadataHighlight[] {
  if (!isServicePricingAction(log.action)) {
    return [];
  }

  const metadata = readMetadataObject(log.metadata);
  const highlights: MetadataHighlight[] = [];
  const service = firstRecord(metadata.service, metadata.after, metadata.before, metadata);
  const before = readRecord(metadata.before);
  const after = readRecord(metadata.after);
  const changedFields = readStringList(metadata.changedFields);

  const serviceLabel = serviceOptionLabel(service);
  if (serviceLabel) {
    highlights.push({ label: serviceLabel, className: 'pill pill-info' });
  }

  if (log.action === 'service.duration_set.create') {
    const durations = readNumberList(metadata.durationMins);
    if (durations.length > 0) {
      highlights.push({
        label: `Durations ${durations.map((duration) => `${duration}m`).join(', ')}`,
        className: 'pill pill-success',
      });
    }
  }

  const customerPrice = readNumber(after.customerPrice ?? after.basePrice ?? metadata.customerPrice);
  const previousCustomerPrice = readNumber(before.customerPrice ?? before.basePrice);
  const currency = readString(after.currency ?? before.currency) ?? 'VND';
  if (customerPrice !== null) {
    highlights.push({
      label:
        previousCustomerPrice !== null && previousCustomerPrice !== customerPrice
          ? `Customer ${money(previousCustomerPrice, currency)} -> ${money(customerPrice, currency)}`
          : `Customer ${money(customerPrice, currency)}`,
      className: 'pill pill-warn',
    });
  }

  const providerPayout = readNumber(after.providerPayoutAmount);
  const previousProviderPayout = readNumber(before.providerPayoutAmount);
  if (providerPayout !== null) {
    highlights.push({
      label:
        previousProviderPayout !== null && previousProviderPayout !== providerPayout
          ? `Partner ${money(previousProviderPayout, currency)} -> ${money(providerPayout, currency)}`
          : `Partner ${money(providerPayout, currency)}`,
      className: 'pill pill-success',
    });
  }

  const vatBps = readNumber(after.vatBps);
  const otherCost = readNumber(after.otherCostAmount);
  if (vatBps !== null || otherCost !== null) {
    highlights.push({
      label: `VAT ${formatBps(vatBps)} / other ${money(otherCost ?? 0, currency)}`,
      className: 'pill pill-info',
    });
  }

  const adjustedProviderPrices = readNumber(metadata.adjustedProviderPrices);
  if (adjustedProviderPrices !== null && adjustedProviderPrices > 0) {
    highlights.push({
      label: `${adjustedProviderPrices} partner price(s) adjusted`,
      className: 'pill pill-warn',
    });
  }

  if (changedFields.length > 0) {
    highlights.push({
      label: `Changed ${changedFields.join(', ')}`,
      className: 'pill pill-info',
    });
  }

  return highlights.slice(0, 6);
}

function relatedBoardHref(log: AdminAuditLog) {
  const targetId = log.target?.split(':')[1];
  const metadata = readMetadataObject(log.metadata);
  if (log.action.startsWith('booking.')) {
    return targetId ? `/bookings/${targetId}` : '/bookings';
  }
  if (log.action.startsWith('payment.')) {
    return targetId ? `/payments#payment-${targetId}` : '/payments';
  }
  if (log.action.startsWith('refund.')) {
    return targetId ? `/refunds#refund-${targetId}` : '/refunds';
  }
  if (log.action.startsWith('notification.')) {
    return '/notifications';
  }
  if (isServicePricingAction(log.action)) {
    return '/services';
  }
  if (isDispatchAction(log.action)) {
    const providerId =
      targetId && log.target?.startsWith('provider:')
        ? targetId
        : typeof metadata.providerProfileId === 'string'
          ? metadata.providerProfileId
          : null;
    return providerId ? `/providers/${providerId}` : '/providers';
  }
  if (log.action.startsWith('coupon.')) {
    return '/coupons';
  }
  if (log.action.startsWith('tax_') || log.action.startsWith('tax.')) {
    return '/tax-policy';
  }
  return '/audit-log';
}

function relatedBoardLabel(log: AdminAuditLog) {
  const href = relatedBoardHref(log);
  if (href === '/audit-log') {
    return 'Audit';
  }
  if (href.startsWith('/providers/')) {
    return 'partner detail';
  }
  if (href.startsWith('/bookings/')) {
    return 'booking detail';
  }
  return href.slice(1).replace('-', ' ');
}

function readMetadataObject(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function firstRecord(...values: unknown[]) {
  for (const value of values) {
    const record = readRecord(value);
    if (Object.keys(record).length > 0) {
      return record;
    }
  }
  return {};
}

function readRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => readString(item)).filter((item): item is string => Boolean(item))
    : [];
}

function readNumberList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => readNumber(item)).filter((item): item is number => item !== null)
    : [];
}

function serviceOptionLabel(value: Record<string, unknown>) {
  const name = readString(value.name);
  const duration = readNumber(value.durationMin);
  if (!name) {
    return null;
  }
  return duration ? `${name} / ${duration} min` : name;
}

function money(amount: number, currency = 'VND') {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function formatBps(value: number | null) {
  if (value === null) {
    return '-';
  }
  return `${(value / 100).toFixed(2).replace(/\.00$/, '')}%`;
}

function reviewPriorityLabel(action: string) {
  const priority = auditPriority(action);
  if (priority >= 4) {
    return 'Review this first';
  }
  if (priority >= 3) {
    return 'Check before close';
  }
  if (priority >= 2) {
    return 'Trace related flow';
  }
  return 'Reference event';
}

function relativeTime(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs)) {
    return 'Unknown time';
  }
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'Updated just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function opsHint(action: string, target: string) {
  if (action === 'booking.ops_note.add') {
    return 'Internal operator note was added to the booking handoff trail.';
  }
  if (action === 'booking.ops_task.update') {
    return 'Structured booking handling status was updated by an operator.';
  }
  if (action.startsWith('booking.')) {
    return 'Trace booking state changes and verify customer/partner handoff.';
  }
  if (action.startsWith('payment.')) {
    return 'Confirm the money state matches the booking state before closing the loop.';
  }
  if (action.startsWith('notification.')) {
    return 'Check retry or delivery health if the customer or partner missed an alert.';
  }
  if (isServicePricingAction(action)) {
    return 'Review service price, partner payout, VAT, costs, and before/after changes.';
  }
  if (action.startsWith('provider.')) {
    return 'Review partner readiness, moderation, or queue movement.';
  }
  return `Audit trail for ${target || 'system'} activity.`;
}

function opsDetail(action: string) {
  if (action === 'booking.ops_note.add') {
    return 'Use the note to understand customer/partner contact history before taking the next action.';
  }
  if (action === 'booking.ops_task.update') {
    return 'Use the status to see which handoff checks are done, pending, or blocked.';
  }
  if (action.endsWith('.refund')) {
    return 'Refund actions should line up with booking cancellation or service failure notes.';
  }
  if (action.endsWith('.capture')) {
    return 'Capture should only happen once service completion is confirmed.';
  }
  if (action.endsWith('.retry')) {
    return 'Retry events are useful when push, SMS, or webhook delivery needed another pass.';
  }
  if (isServicePricingAction(action)) {
    return 'Price policy changes affect customer price, partner payout, tax withholding, cash debt, and payout batches.';
  }
  if (action.endsWith('.approve') || action.endsWith('.reject')) {
    return 'Partner review actions should match verification evidence and moderation notes.';
  }
  return 'Use this row to confirm who acted, when they acted, and what object changed.';
}
