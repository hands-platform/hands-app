import Link from 'next/link';

import { CommandCopyRow } from '../../components/command-copy-row';
import type { NotificationPartnerAlertSmokeFallback } from './notification-page-model';

type NotificationChannelPolicySectionProps = {
  readonly inAppDeliveries: number;
  readonly fcmDeliveries: number;
  readonly partnerAlertCount: number;
  readonly partnerAlertSmokeFallback: NotificationPartnerAlertSmokeFallback | null;
  readonly policyLabel: string;
};

export function NotificationChannelPolicySection({
  inAppDeliveries,
  fcmDeliveries,
  partnerAlertCount,
  partnerAlertSmokeFallback,
  policyLabel,
}: NotificationChannelPolicySectionProps) {
  return (
    <div className="card soft-card admin-mb-16">
      <div className="toolbar">
        <div>
          <h3>Partner alert routing policy</h3>
          <p className="muted">
            Current decision: <strong>{policyLabel}</strong>. Use this to confirm whether partner booking
            requests are intentionally in-app only or routed to FCM push.
          </p>
        </div>
        <Link className="text-link" href="/operations-policy">
          Change alert policy
        </Link>
      </div>
      <div className="ops-task-grid">
        <div className="ops-task-card">
          <span className="pill pill-info">Partner booking alerts</span>
          <h3 className="admin-mt-10">{partnerAlertCount}</h3>
          <p className="muted">
            Direct requests, marketplace participation alerts, matching, and payout setup.
          </p>
        </div>
        <div className="ops-task-card">
          <span className="pill pill-success">In-app route</span>
          <h3 className="admin-mt-10">{inAppDeliveries}</h3>
          <p className="muted">Delivery attempts intentionally kept inside the app inbox.</p>
        </div>
        <div className="ops-task-card">
          <span className={fcmDeliveries ? 'pill pill-warn' : 'pill pill-neutral'}>FCM route</span>
          <h3 className="admin-mt-10">{fcmDeliveries}</h3>
          <p className="muted">FCM push delivery attempts created by the active policy.</p>
        </div>
        {partnerAlertSmokeFallback ? (
          <div className="ops-task-card">
            <span className="pill pill-warn">FCM smoke fallback</span>
            <h3 className="admin-mt-10">
              {partnerAlertSmokeFallback.suggestedNotificationId
                ? partnerAlertSmokeFallback.suggestedType
                : 'Needs candidate'}
            </h3>
            <p className="muted">{partnerAlertSmokeFallback.detail}</p>
            <p className="muted admin-mt-6">
              Partner alert {partnerAlertSmokeFallback.partnerAlertType} is currently routed by policy.
            </p>
            {partnerAlertSmokeFallback.preflightCommand ? (
              <CommandCopyRow command={partnerAlertSmokeFallback.preflightCommand} label="Copy preflight command" />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
