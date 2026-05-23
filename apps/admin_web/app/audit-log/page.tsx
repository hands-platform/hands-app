import { AdminAuditLog, adminGet } from '../../lib/admin-api';

export default async function AuditLogPage() {
  const logs = sortLogs(await adminGet<AdminAuditLog[]>('/admin/audit-logs', []));
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

      <div className="card">
        <div className="toolbar">
          <div>
            <p className="muted">Recent operational trail for bookings, payments, refunds, provider review, and alerts.</p>
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
                  <a className="pill pill-info" href={relatedBoardHref(log.action, log.target)}>
                    {relatedBoardLabel(log.action)}
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
    notifications: logs.filter((log) => isNotificationAction(log.action)).length,
    needsReview: logs.filter((log) => auditPriority(log.action) >= 3).length,
    recentHour: logs.filter((log) => now - Date.parse(log.createdAt) <= 60 * 60 * 1000).length,
  };
}

function auditPriority(action: string) {
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
  return action.startsWith('booking.') || action.startsWith('provider.');
}

function isPaymentAction(action: string) {
  return action.startsWith('payment.') || action.startsWith('refund.');
}

function isNotificationAction(action: string) {
  return action.startsWith('notification.');
}

function actionBucketLabel(action: string) {
  if (isDispatchAction(action)) {
    return 'Dispatch';
  }
  if (isPaymentAction(action)) {
    return 'Payment';
  }
  if (isNotificationAction(action)) {
    return 'Notification';
  }
  if (action.startsWith('provider-verification.') || action.startsWith('provider.')) {
    return 'Provider';
  }
  return 'System';
}

function signalClass(action: string) {
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

function relatedBoardHref(action: string, target?: string) {
  const targetId = target?.split(':')[1];
  if (action.startsWith('booking.')) {
    return targetId ? `/bookings/${targetId}` : '/bookings';
  }
  if (action.startsWith('payment.')) {
    return targetId ? `/payments#payment-${targetId}` : '/payments';
  }
  if (action.startsWith('refund.')) {
    return targetId ? `/refunds#refund-${targetId}` : '/refunds';
  }
  if (action.startsWith('notification.')) {
    return '/notifications';
  }
  if (action.startsWith('provider-verification.') || action.startsWith('provider.')) {
    return '/providers';
  }
  if (action.startsWith('coupon.')) {
    return '/coupons';
  }
  return '/audit-log';
}

function relatedBoardLabel(action: string) {
  const href = relatedBoardHref(action);
  if (href === '/audit-log') {
    return 'Audit';
  }
  return href.slice(1).replace('-', ' ');
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
    return 'Trace booking state changes and verify customer/provider handoff.';
  }
  if (action.startsWith('payment.')) {
    return 'Confirm the money state matches the booking state before closing the loop.';
  }
  if (action.startsWith('notification.')) {
    return 'Check retry or delivery health if the customer or therapist missed an alert.';
  }
  if (action.startsWith('provider.')) {
    return 'Review therapist readiness, moderation, or queue movement.';
  }
  return `Audit trail for ${target || 'system'} activity.`;
}

function opsDetail(action: string) {
  if (action === 'booking.ops_note.add') {
    return 'Use the note to understand customer/provider contact history before taking the next action.';
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
  if (action.endsWith('.approve') || action.endsWith('.reject')) {
    return 'Provider review actions should match verification evidence and moderation notes.';
  }
  return 'Use this row to confirm who acted, when they acted, and what object changed.';
}
