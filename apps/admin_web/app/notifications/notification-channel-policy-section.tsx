import { Settings2 } from 'lucide-react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminSection, AdminTaskCard, AdminTaskGrid } from '../../components/admin-surface';
import { CommandCopyRow } from '../../components/command-copy-row';
import { StatusBadge, StatusBadgeLink, type StatusBadgeTone } from '../../components/status-badge';
import type {
  NotificationFcmSmokeReadiness,
  NotificationPartnerAlertSmokeFallback,
} from './notification-page-model';
import { FCM_TOKEN_RECOVERY_SMOKE_COMMAND } from './fcm-smoke-commands';

type NotificationChannelPolicySectionProps = {
  readonly density?: 'compact' | 'full';
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
  density = 'full',
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
  const isCompact = density === 'compact';

  return (
    <AdminSection
      actions={
        <AdminFormControlLink className="button-secondary" href="/operations-policy">
          <Settings2 aria-hidden="true" size={16} />
          Change alert policy
        </AdminFormControlLink>
      }
      className="soft-card admin-mb-16"
      description={
        <>
          Current decision: <strong>{policyLabel}</strong>. Use this to confirm whether Partner booking
          requests are intentionally in-app only or routed to FCM push.
        </>
      }
      title="Partner alert routing policy"
    >
      {isCompact ? (
        <div className="participant-list admin-mt-10">
          <StatusBadge tone="info">Partner alerts {partnerAlertCount}</StatusBadge>
          <StatusBadge tone="success">In-app {inAppDeliveries}</StatusBadge>
          <StatusBadge tone={fcmDeliveries ? 'warning' : 'neutral'}>
            FCM {fcmDeliveries}
          </StatusBadge>
          <StatusBadge tone={fcmSmokeReadinessTone(fcmSmokeReadiness.status)}>
            {fcmSmokeReadiness.statusLabel}
          </StatusBadge>
          <StatusBadgeLink href="/notifications?diagnostics=full" tone="neutral">
            Show FCM diagnostics
          </StatusBadgeLink>
        </div>
      ) : (
        <AdminTaskGrid>
          <AdminTaskCard
            detail="Direct requests, marketplace participation alerts, matching, and payout setup."
            leading={<StatusBadge tone="info">Partner booking alerts</StatusBadge>}
            title={partnerAlertCount}
          />
          <AdminTaskCard
            detail="Delivery attempts intentionally kept inside the app inbox."
            leading={<StatusBadge tone="success">In-app route</StatusBadge>}
            title={inAppDeliveries}
          />
          <AdminTaskCard
            detail="FCM push delivery attempts created by the active policy."
            leading={<StatusBadge tone={fcmDeliveries ? 'warning' : 'neutral'}>FCM route</StatusBadge>}
            title={fcmDeliveries}
          >
            {latestFcmSentAttemptLabel ? (
              <>
                <p className="muted admin-mt-6">Recent FCM SENT: {latestFcmSentAttemptLabel}</p>
                <p className="muted admin-mt-6">{latestFcmSentDetail}</p>
              </>
            ) : (
              <AdminEmptyState framed message="No FCM SENT delivery recorded yet." title={null} />
            )}
          </AdminTaskCard>
          <AdminTaskCard
            detail={fcmSmokeReadiness.detail}
            leading={
              <StatusBadge tone={fcmSmokeReadinessTone(fcmSmokeReadiness.status)}>
                {fcmSmokeReadiness.statusLabel}
              </StatusBadge>
            }
            title={fcmSmokeReadiness.selectedNotificationLabel ?? 'No candidate'}
          >
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
              <CommandCopyRow
                command={fcmSmokeReadiness.preflightCommand}
                label="Copy FCM preflight command"
              />
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
                    <StatusBadgeLink href="/setup#notifications" tone="info">
                      Credential setup
                    </StatusBadgeLink>
                    <StatusBadgeLink href="/notifications?review=disabled-device" tone="warning">
                      Disabled tokens
                    </StatusBadgeLink>
                    <StatusBadgeLink href="/notifications?review=stale-device" tone="warning">
                      Stale tokens
                    </StatusBadgeLink>
                    <StatusBadgeLink href="/notifications?review=pending" tone="neutral">
                      Worker queue
                    </StatusBadgeLink>
                  </>
                ) : null}
                {fcmSmokeReadiness.selectedNotificationId ? (
                  <StatusBadgeLink
                    href={`/audit-log?bucket=Notification&q=${encodeURIComponent(
                      fcmSmokeReadiness.selectedNotificationId,
                    )}&range=all`}
                    tone="info"
                  >
                    Audit evidence
                  </StatusBadgeLink>
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
          </AdminTaskCard>
          {partnerAlertSmokeFallback ? (
            <AdminTaskCard
              detail={partnerAlertSmokeFallback.detail}
              leading={<StatusBadge tone="warning">FCM smoke fallback</StatusBadge>}
              title={
                partnerAlertSmokeFallback.suggestedNotificationId
                  ? partnerAlertSmokeFallback.suggestedType
                  : 'Needs candidate'
              }
            >
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
            </AdminTaskCard>
          ) : null}
        </AdminTaskGrid>
      )}
    </AdminSection>
  );
}

function fcmSmokeReadinessTone(status: NotificationFcmSmokeReadiness['status']): StatusBadgeTone {
  if (status === 'ready') {
    return 'success';
  }

  if (status === 'needs-device') {
    return 'warning';
  }

  return 'neutral';
}
