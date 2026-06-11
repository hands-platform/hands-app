import Link from 'next/link';

type NotificationChannelPolicySectionProps = {
  readonly inAppDeliveries: number;
  readonly fcmDeliveries: number;
  readonly partnerAlertCount: number;
  readonly policyLabel: string;
};

export function NotificationChannelPolicySection({
  inAppDeliveries,
  fcmDeliveries,
  partnerAlertCount,
  policyLabel,
}: NotificationChannelPolicySectionProps) {
  return (
    <div className="card soft-card admin-mb-16">
      <div className="toolbar">
        <div>
          <h3>Partner alert routing policy</h3>
          <p className="muted">
            Current decision: <strong>{policyLabel}</strong>. Use this to confirm whether partner booking
            requests are intentionally in-app only or routed to FCM.
          </p>
        </div>
        <Link className="text-link" href="/operations-policy">
          Change alert policy
        </Link>
      </div>
      <div className="grid">
        <div className="card">
          <span className="pill pill-info">Partner booking alerts</span>
          <h3 className="admin-mt-10">{partnerAlertCount}</h3>
          <p className="muted">Direct requests, marketplace participation alerts, matching, and payout setup.</p>
        </div>
        <div className="card">
          <span className="pill pill-success">In-app route</span>
          <h3 className="admin-mt-10">{inAppDeliveries}</h3>
          <p className="muted">Delivery attempts intentionally kept inside the app inbox.</p>
        </div>
        <div className="card">
          <span className={fcmDeliveries ? 'pill pill-warn' : 'pill pill-neutral'}>
            FCM route
          </span>
          <h3 className="admin-mt-10">{fcmDeliveries}</h3>
          <p className="muted">OS push delivery attempts created by the active policy.</p>
        </div>
      </div>
    </div>
  );
}
