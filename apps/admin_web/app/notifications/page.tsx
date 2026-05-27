import { AdminNotification, adminGet } from '../../lib/admin-api';
import Link from 'next/link';
import { enablePushDevice, retryNotification } from './actions';

type NotificationsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: NotificationsPageSearchParams;
}) {
  const filters = buildNotificationFilters((await searchParams) ?? {});
  const allNotifications = sortNotifications(await adminGet<AdminNotification[]>('/admin/notifications', []));
  const notifications = filterNotifications(allNotifications, filters);
  const summary = buildSummary(allNotifications);
  const opsQueue = buildDeliveryOpsQueue(allNotifications);
  const activeFilter = notificationFilterLinks.find((item) => item.review === filters.review);

  return (
    <>
      <h1>Notifications</h1>
      <section className="grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <p>Total</p>
          <h2>{allNotifications.length}</h2>
        </div>
        <div className="card">
          <p>Needs retry</p>
          <h2>{summary.needsRetry}</h2>
        </div>
        <div className="card">
          <p>Sent</p>
          <h2>{summary.sent}</h2>
        </div>
        <div className="card">
          <p>Skipped</p>
          <h2>{summary.skipped}</h2>
        </div>
        <div className="card">
          <p>Failed</p>
          <h2>{summary.failed}</h2>
        </div>
        <div className="card">
          <p>Disabled devices</p>
          <h2>{summary.disabledDevices}</h2>
        </div>
        <div className="card">
          <p>Payout setup</p>
          <h2>{summary.payoutSetup}</h2>
        </div>
      </section>
      <div className="card">
        <div className="toolbar">
          <div>
            <p className="muted">
              Delivery board for push retries, disabled devices, and last-mile alert confidence.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-success">Latest failures first</span>
            <span className="pill pill-info">Delivery signal</span>
            <span className="pill pill-warn">Retry readiness</span>
          </div>
        </div>

        <div className="card soft-card" style={{ marginBottom: 16 }}>
          <div className="toolbar">
            <div>
              <h3>Delivery operations queue</h3>
              <p className="muted">
                Fix disabled tokens and push-provider setup before retrying, so failed alerts do not loop.
              </p>
            </div>
            <span className={`pill ${opsQueue.length ? 'pill-warn' : 'pill-success'}`}>
              {opsQueue.length ? `${opsQueue.length} issue(s)` : 'No delivery blockers'}
            </span>
          </div>
          <div className="grid">
            {opsQueue.length ? (
              opsQueue.map((item) => (
                <div className="card" key={item.key}>
                  <span className={`pill ${item.tone}`}>{item.label}</span>
                  <h3 style={{ marginTop: 10 }}>{item.count}</h3>
                  <p className="muted">{item.detail}</p>
                  <Link className="pill pill-neutral" href={item.href}>
                    Open queue
                  </Link>
                </div>
              ))
            ) : (
              <div className="card">
                <span className="pill pill-success">Ready</span>
                <h3 style={{ marginTop: 10 }}>Delivery path is clean</h3>
                <p className="muted">
                  Keep monitoring failed sends after OneSignal/Vonage production credentials are enabled.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="card soft-card" style={{ marginBottom: 16 }}>
          <div className="toolbar">
            <div>
              <h3>Notification operation filters</h3>
              <p className="muted">
                Open each queue directly from the command dashboard without hunting through rows.
              </p>
              {activeFilter?.review ? (
                <p className="muted">
                  Active queue: <strong>{activeFilter.label}</strong> -{' '}
                  {notificationFilterDescription(activeFilter.review)}
                </p>
              ) : null}
            </div>
            <span className={`pill ${filters.review ? 'pill-warn' : 'pill-success'}`}>
              Showing {notifications.length} of {allNotifications.length}
            </span>
          </div>
          <div className="participant-list">
            {filters.review ? (
              <Link className="pill pill-success" href="/notifications">
                Clear filter
              </Link>
            ) : null}
            {notificationFilterLinks.map((link) => (
              <Link
                key={link.href}
                className={`pill ${filters.review === link.review ? 'pill-warn' : 'pill-neutral'}`}
                href={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Type</th>
              <th>Title</th>
              <th>Ops signal</th>
              <th>Delivery</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => (
              <tr key={notification.id}>
                <td>
                  <div>{new Date(notification.createdAt).toLocaleString()}</div>
                  <div className="muted">{relativeTime(notification.createdAt)}</div>
                </td>
                <td>
                  <div>{notification.user?.fullName ?? notification.user?.phone ?? '-'}</div>
                  <div className="muted">{notification.user?.phone ?? 'No phone on file'}</div>
                </td>
                <td>
                  <div>{humanizeType(notification.type)}</div>
                  <div className="muted">{typeMeaning(notification.type)}</div>
                </td>
                <td>
                  <div>{notification.title}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {notification.body}
                  </div>
                  {notificationDataHint(notification) ? (
                    <div className="muted" style={{ marginTop: 6 }}>
                      {notificationDataHint(notification)}
                    </div>
                  ) : null}
                </td>
                <td>
                  <span className={signalClass(notification)}>{opsSignal(notification)}</span>
                  <div className="muted" style={{ marginTop: 6 }}>
                    {opsHint(notification)}
                  </div>
                </td>
                <td>
                  {notification.deliveries && notification.deliveries.length > 0
                    ? notification.deliveries.map((delivery) => (
                        <div
                          key={delivery.id ?? `${notification.id}-${delivery.attemptedAt}`}
                          style={{ marginBottom: 10 }}
                        >
                          <div>
                            <strong>{delivery.provider}</strong> - {delivery.status} -{' '}
                            {delivery.pushDevice?.platform ?? 'device'}
                          </div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            {delivery.pushDevice?.enabled === false ? 'Device disabled' : 'Device enabled'} -
                            Attempted {new Date(delivery.attemptedAt).toLocaleString()}
                          </div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            Failure {readFailureCode(delivery) ?? '-'} / HTTP{' '}
                            {delivery.response?.statusCode ?? '-'}
                          </div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            Reason {readFailureReason(delivery) ?? '-'}
                          </div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            Token {delivery.pushDevice?.token ? maskToken(delivery.pushDevice.token) : '-'}
                          </div>
                          {delivery.pushDevice?.enabled === false && delivery.pushDevice.id ? (
                            <form action={enablePushDevice} style={{ marginTop: 6 }}>
                              <input type="hidden" name="pushDeviceId" value={delivery.pushDevice.id} />
                              <button type="submit">Re-enable device</button>
                            </form>
                          ) : null}
                        </div>
                      ))
                    : 'No devices / not attempted'}
                </td>
                <td>
                  <form action={retryNotification}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button type="submit">Retry</button>
                  </form>
                </td>
              </tr>
            ))}
            {notifications.length === 0 && (
              <tr>
                <td colSpan={7}>{emptyNotificationMessage(filters.review)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function sortNotifications(notifications: AdminNotification[]) {
  return [...notifications].sort((left, right) => {
    const signalDiff = notificationPriority(right) - notificationPriority(left);
    if (signalDiff !== 0) {
      return signalDiff;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function notificationPriority(notification: AdminNotification) {
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED')) {
    return 4;
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false)) {
    return 3;
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SKIPPED')) {
    return 2;
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SENT')) {
    return 1;
  }
  return 0;
}

function buildSummary(notifications: AdminNotification[]) {
  return {
    needsRetry: notifications.filter((notification) => needsRetry(notification)).length,
    sent: countDeliveries(notifications, 'SENT'),
    skipped: countDeliveries(notifications, 'SKIPPED'),
    failed: countDeliveries(notifications, 'FAILED'),
    disabledDevices: countDisabledDevices(notifications),
    payoutSetup: notifications.filter(
      (notification) => notification.type === 'provider.payout_setup_required',
    ).length,
  };
}

const notificationFilterLinks = [
  { label: 'All notifications', href: '/notifications', review: '' },
  { label: 'Failed sends', href: '/notifications?review=failed', review: 'failed' },
  {
    label: 'Disabled devices',
    href: '/notifications?review=disabled-device',
    review: 'disabled-device',
  },
  { label: 'Needs retry', href: '/notifications?review=needs-retry', review: 'needs-retry' },
  { label: 'Skipped', href: '/notifications?review=skipped', review: 'skipped' },
  { label: 'Sent', href: '/notifications?review=sent', review: 'sent' },
  { label: 'Pending', href: '/notifications?review=pending', review: 'pending' },
  {
    label: 'Payout setup',
    href: '/notifications?review=payout-setup',
    review: 'payout-setup',
  },
];

function buildNotificationFilters(params: Record<string, string | string[] | undefined>) {
  return {
    review: readParam(params.review),
  };
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function filterNotifications(notifications: AdminNotification[], filters: { review: string }) {
  return notifications.filter((notification) => notificationMatchesReview(notification, filters.review));
}

function notificationMatchesReview(notification: AdminNotification, review: string) {
  const deliveries = notification.deliveries ?? [];
  if (!review) {
    return true;
  }
  if (review === 'failed') {
    return deliveries.some((delivery) => delivery.status === 'FAILED');
  }
  if (review === 'disabled-device') {
    return deliveries.some((delivery) => delivery.pushDevice?.enabled === false);
  }
  if (review === 'needs-retry') {
    return needsRetry(notification);
  }
  if (review === 'skipped') {
    return deliveries.some((delivery) => delivery.status === 'SKIPPED');
  }
  if (review === 'sent') {
    return deliveries.some((delivery) => delivery.status === 'SENT');
  }
  if (review === 'pending') {
    return deliveries.length === 0;
  }
  if (review === 'payout-setup') {
    return notification.type === 'provider.payout_setup_required';
  }
  return true;
}

function notificationFilterDescription(review: string) {
  if (review === 'failed') {
    return 'delivery attempts that returned a push provider failure.';
  }
  if (review === 'disabled-device') {
    return 'users or partners with disabled push devices.';
  }
  if (review === 'needs-retry') {
    return 'notifications whose delivery path should be reviewed before retry.';
  }
  if (review === 'skipped') {
    return 'alerts that were intentionally skipped or had no available send path.';
  }
  if (review === 'sent') {
    return 'successfully delivered push notifications.';
  }
  if (review === 'pending') {
    return 'notifications without a captured delivery attempt yet.';
  }
  if (review === 'payout-setup') {
    return 'partners who earned revenue and now need tax/address/agreement setup before payout.';
  }
  return 'all notification records.';
}

function emptyNotificationMessage(review: string) {
  if (!review) {
    return 'No notifications loaded.';
  }
  return `No notifications currently match this queue. ${notificationFilterDescription(review)}`;
}

function countDeliveries(notifications: AdminNotification[], status: string) {
  return notifications.reduce(
    (total, notification) =>
      total + (notification.deliveries ?? []).filter((delivery) => delivery.status === status).length,
    0,
  );
}

function readFailureCode(delivery: NonNullable<AdminNotification['deliveries']>[number]) {
  const body = asRecord(delivery.response?.body);
  const error = asRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = asRecord(details[0]);
  return readString(firstDetail?.errorCode) ?? readString(body?.code) ?? readString(error?.code);
}

function readFailureReason(delivery: NonNullable<AdminNotification['deliveries']>[number]) {
  const body = asRecord(delivery.response?.body);
  const error = asRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = asRecord(details[0]);
  const errors = Array.isArray(body?.errors) ? body.errors.map(String).join(', ') : undefined;
  return (
    readString(body?.reason) ??
    readString(body?.message) ??
    readString(error?.message) ??
    readString(firstDetail?.errorMessage) ??
    readString(firstDetail?.errorCode) ??
    errors
  );
}

function maskToken(token: string) {
  if (token.length <= 10) {
    return token;
  }
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
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

function humanizeType(type: string) {
  return type
    .toLowerCase()
    .split(/[_\-.]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function typeMeaning(type: string) {
  if (type.includes('booking')) {
    return 'Booking lifecycle alert';
  }
  if (type.includes('payment')) {
    return 'Payment or refund alert';
  }
  if (type.includes('payout') || type.includes('tax')) {
    return 'Partner tax or payout setup alert';
  }
  if (type.includes('chat')) {
    return 'Realtime conversation alert';
  }
  return 'Operational customer or partner alert';
}

function notificationDataHint(notification: AdminNotification) {
  if (notification.type !== 'provider.payout_setup_required') {
    return null;
  }
  const data = asRecord(notification.data);
  const missing = asRecord(data?.missing);
  if (!missing) {
    return 'Missing payout setup details were not included.';
  }
  const parts = [];
  if (missing.taxProfileApproved === true) {
    parts.push('tax profile approval');
  }
  if (missing.residentialAddress === true) {
    parts.push('residential address');
  }
  if (Array.isArray(missing.agreements) && missing.agreements.length > 0) {
    parts.push(`agreements: ${missing.agreements.map(String).join(', ')}`);
  }
  return parts.length ? `Missing: ${parts.join(' / ')}` : 'Payout setup appears complete.';
}

function needsRetry(notification: AdminNotification) {
  return (notification.deliveries ?? []).some(
    (delivery) => delivery.status === 'FAILED' || delivery.pushDevice?.enabled === false,
  );
}

function signalClass(notification: AdminNotification) {
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED')) {
    return 'signal signal-warn';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false)) {
    return 'signal signal-warn';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SENT')) {
    return 'signal signal-ok';
  }
  return 'signal signal-info';
}

function opsSignal(notification: AdminNotification) {
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED')) {
    return 'Retry needed';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false)) {
    return 'Device disabled';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SKIPPED')) {
    return 'Skipped delivery';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SENT')) {
    return 'Delivered';
  }
  return 'Pending';
}

function opsHint(notification: AdminNotification) {
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED')) {
    return 'Review failure code, confirm token health, then retry only after the device path makes sense.';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false)) {
    return 'This user has at least one disabled push device. Re-enable only if a fresh token arrives.';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SKIPPED')) {
    return 'Skipped alerts usually mean no available push path or a delivery decision to avoid duplicate sends.';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SENT')) {
    return 'Delivery path is healthy. Use this row as a reference if the user still reports a miss.';
  }
  return 'Notification exists, but no delivery attempt was captured yet.';
}

function countDisabledDevices(notifications: AdminNotification[]) {
  const ids = new Set<string>();
  for (const notification of notifications) {
    for (const delivery of notification.deliveries ?? []) {
      if (delivery.pushDevice?.enabled === false) {
        ids.add(delivery.pushDevice.id ?? `${notification.id}-${delivery.id ?? delivery.attemptedAt}`);
      }
    }
  }
  return ids.size;
}

function buildDeliveryOpsQueue(notifications: AdminNotification[]) {
  const failed = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  ).length;
  const disabledDevices = countDisabledDevices(notifications);
  const skipped = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'SKIPPED'),
  ).length;
  const pending = notifications.filter((notification) => (notification.deliveries ?? []).length === 0).length;

  return [
    failed
      ? {
          key: 'failed',
          label: 'Failed sends',
          count: failed,
          detail: 'Push provider returned an error. Check failure reason, token freshness, and credentials.',
          href: '/notifications?review=failed',
          tone: 'pill-warn',
        }
      : null,
    disabledDevices
      ? {
          key: 'disabled-devices',
          label: 'Disabled devices',
          count: disabledDevices,
          detail:
            'Re-enable only when the app has registered a fresh token or the operator confirms the device.',
          href: '/notifications?review=disabled-device',
          tone: 'pill-warn',
        }
      : null,
    skipped
      ? {
          key: 'skipped',
          label: 'Skipped',
          count: skipped,
          detail:
            'Usually means push is intentionally inactive, no enabled device exists, or credentials are pending.',
          href: '/notifications?review=skipped',
          tone: 'pill-info',
        }
      : null,
    pending
      ? {
          key: 'pending',
          label: 'Pending',
          count: pending,
          detail: 'Notification rows exist without delivery attempts. Confirm workers and queue processing.',
          href: '/notifications?review=pending',
          tone: 'pill-neutral',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
