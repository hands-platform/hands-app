import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminDisclosure } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import {
  StatusBadge,
  StatusBadgeLink,
  statusBadgeToneFromPillClass,
} from '../../components/status-badge';

export type NotificationDeliveryRow = {
  readonly attemptedAt: string | null;
  readonly deviceFreshnessLabel: string;
  readonly deviceLastSeenAt: string | null;
  readonly deviceStateLabel: string;
  readonly enableDeviceHref: string | null;
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
  readonly totalAttemptCount?: number;
};

export function NotificationDeliveryCell({ deliveryRows, totalAttemptCount }: NotificationDeliveryCellProps) {
  if (deliveryRows.length === 0) {
    return <AdminInlineFallback>No devices / not attempted</AdminInlineFallback>;
  }

  if (deliveryRows.length === 1) {
    return <NotificationDeliveryAttempt delivery={deliveryRows[0]} />;
  }

  const latest = deliveryRows[0];
  const previous = deliveryRows[1];
  const attempts = totalAttemptCount ?? deliveryRows.length;
  const hiddenAttempts = Math.max(0, attempts - deliveryRows.length);

  return (
    <AdminDisclosure className="notification-delivery-disclosure">
      <summary className="notification-delivery-summary">
        <StatusBadge tone={statusBadgeToneFromPillClass(latest.statusClassName)}>
          {latest.status}
        </StatusBadge>{' '}
        <strong>{attempts} attempts</strong>{' '}
        <span className="muted">
          / latest {latest.provider} / {latest.platformLabel} / <DateTimeText value={latest.attemptedAt} />
          {previous ? (
            <>
              {' '}
              / previous {previous.status} at <DateTimeText value={previous.attemptedAt} />
            </>
          ) : null}
          {hiddenAttempts ? ` / ${hiddenAttempts} older in audit` : ''}
        </span>
      </summary>
      <div className="admin-mt-6">
        <NotificationDeliveryAttempt delivery={latest} sequenceLabel="Latest attempt" />
        {deliveryRows.length > 1 ? (
          <p className="muted admin-mt-4">
            Previous delivery evidence is summarized above. Open the Notification audit trail for the full
            attempt history.
          </p>
        ) : null}
      </div>
    </AdminDisclosure>
  );
}

function NotificationDeliveryAttempt({
  delivery,
  sequenceLabel,
}: {
  readonly delivery: NotificationDeliveryRow;
  readonly sequenceLabel?: string;
}) {
  return (
    <div className="notification-delivery-attempt admin-mb-10">
      <div>
        {sequenceLabel ? <strong>{sequenceLabel} / </strong> : null}
        <strong>{delivery.provider}</strong>{' '}
        <StatusBadge tone={statusBadgeToneFromPillClass(delivery.statusClassName)}>
          {delivery.status}
        </StatusBadge>{' '}
        <span className="muted">/ {delivery.platformLabel}</span>
      </div>
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
      {delivery.enableDeviceHref ? (
        <StatusBadgeLink className="admin-mt-6" href={delivery.enableDeviceHref} tone="warning">
          Re-enable device
        </StatusBadgeLink>
      ) : null}
    </div>
  );
}
