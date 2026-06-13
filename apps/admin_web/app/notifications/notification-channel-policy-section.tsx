import Link from 'next/link';

import { CommandCopyRow } from '../../components/command-copy-row';
import type {
  NotificationFcmSmokeReadiness,
  NotificationPartnerAlertSmokeFallback,
} from './notification-page-model';

type NotificationChannelPolicySectionProps = {
  readonly inAppDeliveries: number;
  readonly fcmDeliveries: number;
  readonly fcmSmokeReadiness: NotificationFcmSmokeReadiness;
  readonly partnerAlertCount: number;
  readonly partnerAlertSmokeFallback: NotificationPartnerAlertSmokeFallback | null;
  readonly policyLabel: string;
};

export function NotificationChannelPolicySection({
  inAppDeliveries,
  fcmDeliveries,
  fcmSmokeReadiness,
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
        <div className="ops-task-card">
          <span
            className={
              fcmSmokeReadiness.status === 'ready'
                ? 'pill pill-success'
                : fcmSmokeReadiness.status === 'needs-device'
                  ? 'pill pill-warn'
                  : 'pill pill-neutral'
            }
          >
            {fcmSmokeReadiness.statusLabel}
          </span>
          <h3 className="admin-mt-10">{fcmSmokeReadiness.selectedNotificationLabel ?? 'No candidate'}</h3>
          <p className="muted">{fcmSmokeReadiness.detail}</p>
          {fcmSmokeReadiness.pushDeviceLabel ? (
            <p className="muted admin-mt-6">Enabled device: {fcmSmokeReadiness.pushDeviceLabel}</p>
          ) : null}
          {fcmSmokeReadiness.latestAttemptLabel ? (
            <p className="muted admin-mt-6">Latest FCM attempt: {fcmSmokeReadiness.latestAttemptLabel}</p>
          ) : null}
          {fcmSmokeReadiness.preflightCommand ? (
            <CommandCopyRow command={fcmSmokeReadiness.preflightCommand} label="Copy FCM preflight command" />
          ) : null}
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
              {partnerAlertSmokeFallback.partnerAlertTypeLabel} remains on the current Partner alert policy
              route.
            </p>
            {partnerAlertSmokeFallback.preflightCommand ? (
              <CommandCopyRow
                command={partnerAlertSmokeFallback.preflightCommand}
                label="Copy preflight command"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
