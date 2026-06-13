import type { AdminNotification, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { shortId } from '../../lib/admin-format';
import { enablePushDevice, retryNotification } from './actions';
import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { NotificationCommandHeaderSection } from './notification-command-header-section';
import { NotificationDeliveryOpsQueueSection } from './notification-delivery-ops-queue-section';
import { NotificationFilterBoardSection } from './notification-filter-board-section';
import {
  emptyNotificationMessage,
  buildNotificationPageModel,
  notificationFilterDescription,
  notificationFilterLinks,
} from './notification-page-model';
import { NotificationsTableSection } from './notifications-table-section';

type NotificationsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: NotificationsPageSearchParams;
}) {
  const params = (await searchParams) ?? {};
  const [rawNotifications, operationalPolicies] = await Promise.all([
    adminGet<AdminNotification[]>('/admin/notifications', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const model = buildNotificationPageModel({
    notifications: rawNotifications,
    operationalPolicies,
    params,
  });

  return (
    <AdminPageTemplate
      description="Delivery board for push retries, disabled devices, and last-mile alert confidence."
      metrics={[
        { label: 'Total', value: model.allNotifications.length, helper: 'Notification rows loaded.' },
        {
          label: 'Needs retry',
          value: model.summary.needsRetry,
          helper: 'Failed or disabled delivery paths.',
        },
        { label: 'Sent', value: model.summary.sent, helper: 'Successful push delivery attempts.' },
        {
          label: 'Skipped',
          value: model.summary.skipped,
          helper: 'Intentionally skipped delivery attempts.',
        },
        { label: 'Pending', value: model.summary.pending, helper: 'Rows without delivery attempts.' },
        { label: 'Failed', value: model.summary.failed, helper: 'Push failures needing review.' },
        { label: 'Disabled devices', value: model.summary.disabledDevices, helper: 'Push devices disabled.' },
        {
          label: 'Stale devices',
          value: model.summary.staleDevices,
          helper: 'Old token timestamps at send.',
        },
        { label: 'Payout setup', value: model.summary.payoutSetup, helper: 'Partner payout setup alerts.' },
        {
          label: 'Partner alerts',
          value: model.channelSummary.partnerAlertCount,
          helper: 'Partner-facing alerts.',
        },
        { label: 'No-show alerts', value: model.summary.noShow, helper: 'No-show support review alerts.' },
        { label: 'FCM route', value: model.channelSummary.fcmDeliveries, helper: 'OS push attempts.' },
      ]}
      title="Notifications"
    >
      {model.confirmation ? (
        <ConfirmDialog
          action={model.confirmation.action === 'retry' ? retryNotification : enablePushDevice}
          cancelHref={model.confirmation.cancelHref}
          confirmLabel={model.confirmation.confirmLabel}
          description={model.confirmation.description}
          hiddenInputs={model.confirmation.hiddenInputs}
          id={`notification-action-${model.confirmation.action}-${model.confirmation.id}`}
          title={model.confirmation.title}
          tone={model.confirmation.tone}
        />
      ) : null}

      <div className="stack">
        <NotificationCommandHeaderSection />

        <NotificationChannelPolicySection
          inAppDeliveries={model.channelSummary.inAppDeliveries}
          fcmDeliveries={model.channelSummary.fcmDeliveries}
          partnerAlertSmokeFallback={model.partnerAlertSmokeFallback}
          partnerAlertCount={model.channelSummary.partnerAlertCount}
          policyLabel={model.channelSummary.policyLabel}
        />

        <NotificationDeliveryOpsQueueSection items={model.opsQueue} />

        <NotificationFilterBoardSection
          activeBookingLabel={model.activeBookingId ? shortId(model.activeBookingId) : null}
          activeFilterDescription={
            model.activeFilter?.review ? notificationFilterDescription(model.activeFilter.review) : null
          }
          activeFilterLabel={model.activeFilter?.review ? model.activeFilter.label : null}
          activeReview={model.filters.review}
          filteredCount={model.notifications.length}
          links={notificationFilterLinks}
          totalCount={model.allNotifications.length}
        />

        <NotificationsTableSection
          emptyMessage={emptyNotificationMessage(model.filters.review, model.filters.booking, shortId)}
          rows={model.notificationRows}
        />
      </div>
    </AdminPageTemplate>
  );
}
