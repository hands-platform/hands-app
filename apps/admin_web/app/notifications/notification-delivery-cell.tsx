import Link from 'next/link';

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
};

export function NotificationDeliveryCell({ deliveryRows }: NotificationDeliveryCellProps) {
  if (deliveryRows.length === 0) {
    return <span className="muted">No devices / not attempted</span>;
  }

  if (deliveryRows.length === 1) {
    return <NotificationDeliveryAttempt delivery={deliveryRows[0]} />;
  }

  const latest = deliveryRows[0];

  return (
    <details className="notification-delivery-disclosure">
      <summary className="notification-delivery-summary">
        <span className={latest.statusClassName}>{latest.status}</span>{' '}
        <strong>{deliveryRows.length} attempts</strong>{' '}
        <span className="muted">
          / latest {latest.provider} / {latest.platformLabel} / {latest.attemptedAtLabel}
        </span>
      </summary>
      <div className="admin-mt-6">
        {deliveryRows.map((delivery) => (
          <NotificationDeliveryAttempt delivery={delivery} key={delivery.id} />
        ))}
      </div>
    </details>
  );
}

function NotificationDeliveryAttempt({ delivery }: { readonly delivery: NotificationDeliveryRow }) {
  return (
    <div className="notification-delivery-attempt admin-mb-10">
      <div>
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
      <div className="muted admin-mt-4">Token hidden</div>
      {delivery.enableDeviceHref ? (
        <Link className="pill pill-warn admin-mt-6" href={delivery.enableDeviceHref}>
          Re-enable device
        </Link>
      ) : null}
    </div>
  );
}
