import { AdminFormControlLink } from '../../components/admin-form-controls';

export type NotificationDeliveryRow = {
  readonly attemptedAtLabel: string;
  readonly deviceFreshnessLabel: string;
  readonly deviceLastSeenAtLabel: string;
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
    return <span className="muted">No devices / not attempted</span>;
  }

  if (deliveryRows.length === 1) {
    return <NotificationDeliveryAttempt delivery={deliveryRows[0]} />;
  }

  const latest = deliveryRows[0];
  const previous = deliveryRows[1];
  const attempts = totalAttemptCount ?? deliveryRows.length;
  const hiddenAttempts = Math.max(0, attempts - deliveryRows.length);

  return (
    <details className="notification-delivery-disclosure">
      <summary className="notification-delivery-summary">
        <span className={latest.statusClassName}>{latest.status}</span>{' '}
        <strong>{attempts} attempts</strong>{' '}
        <span className="muted">
          / latest {latest.provider} / {latest.platformLabel} / {latest.attemptedAtLabel}
          {previous ? ` / previous ${previous.status} at ${previous.attemptedAtLabel}` : ''}
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
    </details>
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
        <span className={delivery.statusClassName}>{delivery.status}</span>{' '}
        <span className="muted">/ {delivery.platformLabel}</span>
      </div>
      <div className="muted admin-mt-4">
        {delivery.deviceStateLabel} - Attempted {delivery.attemptedAtLabel}
      </div>
      <div className="muted admin-mt-4">
        Device last seen {delivery.deviceLastSeenAtLabel} / {delivery.deviceFreshnessLabel}
      </div>
      <div className="muted admin-mt-4">
        Failure {delivery.failureCodeLabel} / HTTP {delivery.httpStatusLabel}
      </div>
      <div className="muted admin-mt-4">Reason {delivery.failureReasonLabel}</div>
      {delivery.recoveryHintLabel ? (
        <div className="muted admin-mt-4">Next {delivery.recoveryHintLabel}</div>
      ) : null}
      {delivery.enableDeviceHref ? (
        <AdminFormControlLink className="pill pill-warn admin-mt-6" href={delivery.enableDeviceHref}>
          Re-enable device
        </AdminFormControlLink>
      ) : null}
    </div>
  );
}
