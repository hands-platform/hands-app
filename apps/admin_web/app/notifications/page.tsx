import type { AdminNotification, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { enablePushDevice, retryNotification } from './actions';
import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { NotificationCommandHeaderSection } from './notification-command-header-section';
import { NotificationDeliveryOpsQueueSection } from './notification-delivery-ops-queue-section';
import { NotificationFilterBoardSection } from './notification-filter-board-section';
import {
  buildNotificationChannelSummary,
  buildNotificationDeliveryOpsQueue,
  buildNotificationFilters,
  buildNotificationSummary,
  buildNotificationTableRows,
  emptyNotificationMessage,
  filterNotifications,
  notificationFilterDescription,
  notificationFilterLinks,
  sortNotifications,
} from './notification-page-model';
import {
  buildNotificationActionConfirmation,
  readNotificationConfirmationAction,
} from './notification-action-confirmation';
import { NotificationsTableSection } from './notifications-table-section';

type NotificationsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: NotificationsPageSearchParams;
}) {
  const params = (await searchParams) ?? {};
  const filters = buildNotificationFilters(params);
  const [rawNotifications, operationalPolicies] = await Promise.all([
    adminGet<AdminNotification[]>('/admin/notifications', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const allNotifications = sortNotifications(rawNotifications);
  const notifications = filterNotifications(allNotifications, filters);
  const summary = buildNotificationSummary(allNotifications);
  const channelSummary = buildNotificationChannelSummary(allNotifications, operationalPolicies);
  const opsQueue = buildNotificationDeliveryOpsQueue(allNotifications);
  const notificationRows = buildNotificationTableRows(notifications);
  const activeFilter = notificationFilterLinks.find((item) => item.review === filters.review);
  const activeBookingId = filters.booking;
  const confirmation = buildNotificationActionConfirmation(
    allNotifications,
    readNotificationConfirmationAction(readSearchParam(params.confirm)),
    {
      notificationId: readSearchParam(params.notificationId),
      pushDeviceId: readSearchParam(params.pushDeviceId),
    },
  );

  return (
    <AdminPageTemplate
      description="Delivery board for push retries, disabled devices, and last-mile alert confidence."
      metrics={[
        { label: 'Total', value: allNotifications.length, helper: 'Notification rows loaded.' },
        { label: 'Needs retry', value: summary.needsRetry, helper: 'Failed or disabled delivery paths.' },
        { label: 'Sent', value: summary.sent, helper: 'Successful push delivery attempts.' },
        { label: 'Skipped', value: summary.skipped, helper: 'Intentionally skipped delivery attempts.' },
        { label: 'Pending', value: summary.pending, helper: 'Rows without delivery attempts.' },
        { label: 'Failed', value: summary.failed, helper: 'Push failures needing review.' },
        { label: 'Disabled devices', value: summary.disabledDevices, helper: 'Push devices disabled.' },
        { label: 'Stale devices', value: summary.staleDevices, helper: 'Old token timestamps at send.' },
        { label: 'Payout setup', value: summary.payoutSetup, helper: 'Partner payout setup alerts.' },
        {
          label: 'Partner alerts',
          value: channelSummary.partnerAlertCount,
          helper: 'Partner-facing alerts.',
        },
        { label: 'No-show alerts', value: summary.noShow, helper: 'No-show support review alerts.' },
        { label: 'FCM route', value: channelSummary.fcmDeliveries, helper: 'OS push attempts.' },
      ]}
      title="Notifications"
    >
      {confirmation ? (
        <ConfirmDialog
          action={confirmation.action === 'retry' ? retryNotification : enablePushDevice}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmation.hiddenInputs}
          id={`notification-action-${confirmation.action}-${confirmation.id}`}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <div className="card">
        <NotificationCommandHeaderSection />

        <NotificationChannelPolicySection
          inAppDeliveries={channelSummary.inAppDeliveries}
          fcmDeliveries={channelSummary.fcmDeliveries}
          partnerAlertCount={channelSummary.partnerAlertCount}
          policyLabel={channelSummary.policyLabel}
        />

        <NotificationDeliveryOpsQueueSection items={opsQueue} />

        <NotificationFilterBoardSection
          activeBookingLabel={activeBookingId ? shortId(activeBookingId) : null}
          activeFilterDescription={
            activeFilter?.review ? notificationFilterDescription(activeFilter.review) : null
          }
          activeFilterLabel={activeFilter?.review ? activeFilter.label : null}
          activeReview={filters.review}
          filteredCount={notifications.length}
          links={notificationFilterLinks}
          totalCount={allNotifications.length}
        />

        <NotificationsTableSection
          emptyMessage={emptyNotificationMessage(filters.review, filters.booking, shortId)}
          rows={notificationRows}
        />
      </div>
    </AdminPageTemplate>
  );
}
