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
      metrics={model.metrics}
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
          supportingLinks={model.confirmation.supportingLinks}
          title={model.confirmation.title}
          tone={model.confirmation.tone}
        />
      ) : null}

      <div className="stack">
        <NotificationCommandHeaderSection />

        <NotificationChannelPolicySection
          inAppDeliveries={model.channelSummary.inAppDeliveries}
          fcmDeliveries={model.channelSummary.fcmDeliveries}
          fcmSmokeReadiness={model.fcmSmokeReadiness}
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
