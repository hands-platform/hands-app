import type {
  AdminNotification,
  AdminNotificationBoardSummary,
  AdminOperationalPolicySetting,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { shortId } from '../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { canViewAdminDeveloperSystem } from '../../components/admin-developer-system-section';
import { enablePushDevice, retryNotification } from './actions';
import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { NotificationCommandHeaderSection } from './notification-command-header-section';
import { NotificationDeliveryOpsQueueSection } from './notification-delivery-ops-queue-section';
import { NotificationFilterBoardSection } from './notification-filter-board-section';
import { filterNotificationActionConfirmationSupportingLinks } from './notification-action-confirmation';
import {
  emptyNotificationMessage,
  buildNotificationApiHref,
  buildNotificationPolicyApiHref,
  buildNotificationSummaryApiHref,
  buildNotificationPageModel,
  notificationFilterDescription,
  notificationFilterLinks,
  buildNotificationListHref,
  notificationDateRangeLabel,
  notificationDateRangeLinks,
} from './notification-page-model';
import { NotificationsTableSection } from './notifications-table-section';

type NotificationsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: NotificationsPageSearchParams;
}) {
  const params = (await searchParams) ?? {};
  const [rawNotifications, notificationSummary, operationalPolicies] = await Promise.all([
    adminGet<AdminNotification[]>(buildNotificationApiHref(params), []),
    adminGet<AdminNotificationBoardSummary | null>(buildNotificationSummaryApiHref(params), null),
    adminGet<AdminOperationalPolicySetting[]>(buildNotificationPolicyApiHref(), []),
  ]);
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const canViewDiagnostics = canViewAdminDeveloperSystem(operatorAccess);
  const requestedDiagnosticsMode = readSearchParam(params.diagnostics);
  const diagnosticsMode =
    requestedDiagnosticsMode === 'full' && canViewDiagnostics ? 'full' : 'compact';
  const model = buildNotificationPageModel({
    notificationSummary,
    notifications: rawNotifications,
    operationalPolicies,
    params,
  });
  const confirmation = filterNotificationActionConfirmationSupportingLinks(
    model.confirmation,
    canViewDiagnostics,
  );

  return (
    <AdminPageTemplate
      description="Delivery board for push retries, disabled devices, and last-mile alert confidence."
      metrics={model.metrics}
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
          supportingLinks={confirmation.supportingLinks}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <div className="stack notification-monitor">
        <NotificationCommandHeaderSection canViewDiagnostics={canViewDiagnostics} />

        <NotificationChannelPolicySection
          canViewDiagnostics={canViewDiagnostics}
          density={diagnosticsMode}
          inAppDeliveries={model.channelSummary.inAppDeliveries}
          fcmDeliveries={model.channelSummary.fcmDeliveries}
          fcmSmokeReadiness={model.fcmSmokeReadiness}
          latestFcmSentAttemptLabel={model.channelSummary.latestFcmSentAttemptLabel}
          latestFcmSentDetail={model.channelSummary.latestFcmSentDetail}
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
          activeReviewRunbook={model.reviewRunbook}
          activeRange={model.filters.range}
          activeRangeLabel={notificationDateRangeLabel(model.filters.range)}
          clearHref={buildNotificationListHref({
            booking: '',
            range: model.filters.range,
            review: 'all',
          })}
          filteredCount={model.notifications.length}
          links={notificationFilterLinks.map((link) => ({
            ...link,
            href: buildNotificationListHref({
              ...model.filters,
              review: link.review,
            }),
          }))}
          rangeLinks={notificationDateRangeLinks.map((link) => ({
            ...link,
            href: buildNotificationListHref({
              ...model.filters,
              range: link.range,
            }),
          }))}
          totalCount={model.totalCount}
        />

        <NotificationsTableSection
          emptyMessage={emptyNotificationMessage(model.filters.review, model.filters.booking, shortId)}
          hrefForPage={(page) => buildNotificationListHref(model.filters, { page })}
          pagination={model.notificationPagination}
          rows={model.notificationRows}
        />
      </div>
    </AdminPageTemplate>
  );
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
