import Link from 'next/link';
import { Settings2 } from 'lucide-react';

import { CommandCopyRow } from '../../components/command-copy-row';
import type {
  NotificationFcmSmokeReadiness,
  NotificationPartnerAlertSmokeFallback,
} from './notification-page-model';
import { FCM_TOKEN_RECOVERY_SMOKE_COMMAND } from './fcm-smoke-commands';

type NotificationChannelPolicySectionProps = {
  readonly inAppDeliveries: number;
  readonly fcmDeliveries: number;
  readonly fcmSmokeReadiness: NotificationFcmSmokeReadiness;
  readonly latestFcmSentAttemptLabel: string | null;
  readonly latestFcmSentDetail: string | null;
  readonly partnerAlertCount: number;
  readonly partnerAlertSmokeFallback: NotificationPartnerAlertSmokeFallback | null;
  readonly policyLabel: string;
};

export function NotificationChannelPolicySection({
  inAppDeliveries,
  fcmDeliveries,
  fcmSmokeReadiness,
  latestFcmSentAttemptLabel,
  latestFcmSentDetail,
  partnerAlertCount,
  partnerAlertSmokeFallback,
  policyLabel,
}: NotificationChannelPolicySectionProps) {
  const shouldShowFcmDiagnosis =
    fcmSmokeReadiness.status !== 'ready' || Boolean(fcmSmokeReadiness.deviceWarningLabel);
  const shouldShowAuditEvidence = Boolean(fcmSmokeReadiness.selectedNotificationId);

  return (
    <div className="card soft-card admin-mb-16">
      <div className="toolbar">
        <div>
          <h3>Partner alert routing policy</h3>
          <p className="muted">
            Current decision: <strong>{policyLabel}</strong>. Use this to confirm whether Partner booking
            requests are intentionally in-app only or routed to FCM push.
          </p>
        </div>
        <Link className="button button-secondary" href="/operations-policy">
          <Settings2 aria-hidden="true" size={16} />
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
          {latestFcmSentAttemptLabel ? (
            <>
              <p className="muted admin-mt-6">Recent FCM SENT: {latestFcmSentAttemptLabel}</p>
              <p className="muted admin-mt-6">{latestFcmSentDetail}</p>
            </>
          ) : (
            <p className="muted admin-mt-6">No FCM SENT delivery recorded yet.</p>
          )}
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
          {fcmSmokeReadiness.deviceWarningLabel ? (
            <p className="muted admin-mt-6">Device warning: {fcmSmokeReadiness.deviceWarningLabel}</p>
          ) : null}
          {fcmSmokeReadiness.latestAttemptLabel ? (
            <p className="muted admin-mt-6">Latest FCM attempt: {fcmSmokeReadiness.latestAttemptLabel}</p>
          ) : null}
          {fcmSmokeReadiness.preflightCommand ? (
            <CommandCopyRow command={fcmSmokeReadiness.preflightCommand} label="Copy FCM preflight command" />
          ) : null}
          {fcmSmokeReadiness.selectedNotificationId ? (
            <p className="muted admin-mt-6">
              After live push, rerun preflight and confirm retryAuditPreflight.evidence before broad FCM
              push.
            </p>
          ) : null}
          {shouldShowFcmDiagnosis ? (
            <p className="muted admin-mt-6">
              Credential issue: check setup. Token issue: review disabled or stale device queues. Worker
              issue: review pending sends.
            </p>
          ) : null}
          {shouldShowFcmDiagnosis || shouldShowAuditEvidence ? (
            <div className="participant-list admin-mt-6" aria-label="FCM diagnosis links">
              {shouldShowFcmDiagnosis ? (
                <>
                  <Link className="pill pill-info" href="/setup#notifications">
                    Credential setup
                  </Link>
                  <Link className="pill pill-warn" href="/notifications?review=disabled-device">
                    Disabled tokens
                  </Link>
                  <Link className="pill pill-warn" href="/notifications?review=stale-device">
                    Stale tokens
                  </Link>
                  <Link className="pill pill-neutral" href="/notifications?review=pending">
                    Worker queue
                  </Link>
                </>
              ) : null}
              {fcmSmokeReadiness.selectedNotificationId ? (
                <Link
                  className="pill pill-info"
                  href={`/audit-log?bucket=Notification&q=${encodeURIComponent(
                    fcmSmokeReadiness.selectedNotificationId,
                  )}&range=all`}
                >
                  Audit evidence
                </Link>
              ) : null}
            </div>
          ) : null}
          {shouldShowFcmDiagnosis ? (
            <>
              <p className="muted admin-mt-6">
                Verify disabled or reinstalled app tokens before broad FCM push.
              </p>
              <CommandCopyRow
                command={FCM_TOKEN_RECOVERY_SMOKE_COMMAND}
                label="Copy token recovery smoke command"
              />
            </>
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
