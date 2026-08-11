import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminDisclosure } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';

export type NotificationDeliveryRow = {
  readonly attemptedAt: string | null;
  readonly deviceFreshnessLabel: string;
  readonly deviceIdLabel: string;
  readonly deviceLastSeenAt: string | null;
  readonly deviceStateLabel: string;
  readonly failureCodeLabel: string;
  readonly failureReasonLabel: string;
  readonly httpStatusLabel: string;
  readonly id: string;
  readonly platformLabel: string;
  readonly provider: string;
  readonly recoveryHintLabel: string | null;
  readonly status: string;
  readonly statusClassName: string;
};

type NotificationDeliveryCellProps = {
  readonly deliveryRows: readonly NotificationDeliveryRow[];
  readonly emptyLabel?: string;
  readonly totalAttemptCount?: number;
};

export function NotificationDeliveryCell({
  deliveryRows,
  emptyLabel = 'No devices / not attempted',
  totalAttemptCount,
}: NotificationDeliveryCellProps) {
  if (deliveryRows.length === 0) {
    return <AdminInlineFallback>{emptyLabel}</AdminInlineFallback>;
  }

  const failed = deliveryRows.filter((row) => row.status === 'FAILED').length;
  const accepted = deliveryRows.filter((row) => row.status === 'SENT').length;
  const skipped = deliveryRows.filter((row) => row.status === 'SKIPPED').length;
  const summary = [
    failed ? `${failed} failed` : null,
    accepted ? `${accepted} accepted` : null,
    skipped ? `${skipped} skipped` : null,
  ].filter(Boolean).join(' · ') || 'Pending';
  const attempts = totalAttemptCount ?? deliveryRows.length;
  const hiddenAttempts = Math.max(0, attempts - deliveryRows.length);

  return (
    <AdminDisclosure className="notification-delivery-disclosure">
      <summary className="notification-delivery-summary">
        <strong>{summary}</strong>
        <span className="muted">{attempts} attempt{attempts === 1 ? '' : 's'}{hiddenAttempts ? ` · ${hiddenAttempts} older in audit` : ''}</span>
      </summary>
      <div className="admin-mt-6">
        {deliveryRows.map((delivery) => <NotificationDeliveryAttempt delivery={delivery} key={delivery.id} />)}
        <p className="muted admin-mt-4">Open the audit trail for older attempt history.</p>
      </div>
    </AdminDisclosure>
  );
}

function NotificationDeliveryAttempt({
  delivery,
}: {
  readonly delivery: NotificationDeliveryRow;
}) {
  return (
    <div className="notification-delivery-attempt admin-mb-10">
      <div>
        <strong>{delivery.provider}</strong>{' '}
        <StatusBadgeFromPillClass pillClass={delivery.statusClassName}>
          {notificationDeliveryStatusLabel(delivery.status, delivery.provider)}
        </StatusBadgeFromPillClass>{' '}
        <span className="muted">/ {delivery.platformLabel}</span>
      </div>
      <div className="muted admin-mt-4">Path {delivery.deviceIdLabel}</div>
      <div className="muted admin-mt-4">
        {delivery.deviceStateLabel} - Attempted <DateTimeText value={delivery.attemptedAt} />
      </div>
      <div className="muted admin-mt-4">
        Device last seen <DateTimeText fallback="-" value={delivery.deviceLastSeenAt} /> /{' '}
        {delivery.deviceFreshnessLabel}
      </div>
      <div className="muted admin-mt-4">
        Failure {delivery.failureCodeLabel} / HTTP {delivery.httpStatusLabel}
      </div>
      <div className="muted admin-mt-4">Reason {delivery.failureReasonLabel}</div>
      {delivery.recoveryHintLabel ? (
        <div className="muted admin-mt-4">Next {delivery.recoveryHintLabel}</div>
      ) : null}
    </div>
  );
}

function notificationDeliveryStatusLabel(status: string, provider: string) {
  if (status === 'SENT') return provider === 'FCM' ? 'Accepted by FCM' : 'Sent to push provider';
  if (status === 'SKIPPED') return 'Push not sent';
  if (status === 'FAILED') return 'Failed';
  return status;
}
