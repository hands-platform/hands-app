import type {
  AdminNotification,
  AdminNotificationBoardSummary,
  AdminOperationalPolicySetting,
  AdminUser,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { shortId } from '../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { canViewAdminDeveloperSystem } from '../../components/admin-developer-system-section';
import { assignFinanceReview, enablePushDevice, retryNotification, reviewLegacyNotification } from './actions';
import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { NotificationCommandHeaderSection } from './notification-command-header-section';
import { NotificationDeliveryOpsQueueSection } from './notification-delivery-ops-queue-section';
import { NotificationFilterBoardSection } from './notification-filter-board-section';
import { filterNotificationActionConfirmationSupportingLinks } from './notification-action-confirmation';
import {
  emptyNotificationMessage,
  buildNotificationApiHref,
  buildNotificationFilters,
  buildNotificationPolicyApiHref,
  buildNotificationSummaryApiHref,
  buildNotificationPageModel,
  notificationFilterDescription,
  notificationFilterLinks,
  notificationFinanceAgeLinks,
  notificationIncidentStateLinks,
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
  const requestedFilters = buildNotificationFilters(params);
  const requestedFinanceReview =
    requestedFilters.review === 'finance-overdue' || requestedFilters.review === 'finance-overdue-history';
  const [rawNotifications, notificationSummary, operationalPolicies, financeOwners] = await Promise.all([
    adminGet<AdminNotification[]>(buildNotificationApiHref(params), []),
    adminGet<AdminNotificationBoardSummary | null>(buildNotificationSummaryApiHref(params), null),
    adminGet<AdminOperationalPolicySetting[]>(buildNotificationPolicyApiHref(), []),
    requestedFinanceReview
      ? adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
      : Promise.resolve([]),
  ]);
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const canViewDiagnostics = canViewAdminDeveloperSystem(operatorAccess);
  const requestedDiagnosticsMode = readSearchParam(params.diagnostics);
  const diagnosticsMode =
    requestedDiagnosticsMode === 'full' && canViewDiagnostics ? 'full' : 'compact';
  const currentFinanceOwner = findCurrentFinanceOwner(financeOwners, operatorAccess);
  const financeOwnerOptions = buildFinanceOwnerOptions(financeOwners, requestedFilters.financeOwner);
  const financeAssigneeOptions = financeOwnerOptions.filter((option) => (
    option.value && option.value !== 'unassigned'
  ));
  const model = buildNotificationPageModel({
    financeAssigneeAdminId: currentFinanceOwner?.id,
    financeAssigneeOptions,
    notificationSummary,
    notifications: rawNotifications,
    operationalPolicies,
    params,
  });
  const confirmation = filterNotificationActionConfirmationSupportingLinks(
    model.confirmation,
    canViewDiagnostics,
  );
  const isSystemIncidentReview = model.filters.review === 'system-incidents';
  const isFinanceOverdueReview = model.filters.review === 'finance-overdue';
  const isFinanceOverdueHistory = model.filters.review === 'finance-overdue-history';
  const isOperationalReview =
    isSystemIncidentReview || isFinanceOverdueReview || isFinanceOverdueHistory;
  const visibleNotificationFilterLinks = isFinanceOverdueReview || isFinanceOverdueHistory
    ? notificationFilterLinks.filter((link) => (
        link.review === 'all' ||
        link.review === 'finance-overdue' ||
        link.review === 'finance-overdue-history'
      ))
    : notificationFilterLinks;
  const ownerCounts = new Map(
    (notificationSummary?.financeReviewOwnerSummary ?? []).map((row) => [row.ownerAdminId, row.count]),
  );
  const countedFinanceOwnerOptions = financeOwnerOptions.map((option) => ({
    ...option,
    label: `${option.label} (${financeOwnerOptionCount(option.value, ownerCounts)})`,
  }));
  const financeOwnerLinks = isFinanceOverdueReview || isFinanceOverdueHistory
    ? buildFinanceOwnerLinks(model.filters, currentFinanceOwner?.id ?? null, ownerCounts)
    : [];

  return (
    <AdminPageTemplate
      description={isSystemIncidentReview
        ? 'Review open, recovered, and legacy Admin system incidents with retained audit evidence.'
        : isFinanceOverdueReview
          ? 'Resolve bank reconciliation records that exceeded the 48-hour review SLA.'
          : isFinanceOverdueHistory
            ? 'Review resolved bank reconciliation SLA alerts retained as audit history.'
          : 'Delivery board for push retries, disabled devices, and last-mile alert confidence.'}
      metrics={model.metrics}
      title="Notifications"
    >
      {confirmation ? (
        <ConfirmDialog
          action={confirmation.action === 'retry'
            ? retryNotification
            : confirmation.action === 'assign-finance-review'
              ? assignFinanceReview
            : confirmation.action === 'review-legacy'
              ? reviewLegacyNotification
              : enablePushDevice}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmation.hiddenInputs}
          id={`notification-action-${confirmation.action}-${confirmation.id}`}
          selectInputs={confirmation.selectInputs}
          supportingLinks={confirmation.supportingLinks}
          textInputs={confirmation.textInputs}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      {readSearchParam(params.financeAssignmentNotice) === 'assigned' ? (
        <AdminInlineNotice role="status" tone="success">
          Finance review owner updated. The original SLA evidence remains in the audit trail.
        </AdminInlineNotice>
      ) : readSearchParam(params.financeAssignmentNotice) === 'failed' ? (
        <AdminInlineNotice role="alert" tone="danger">
          Finance review assignment failed. Confirm the record is still open and your operator has Bank Reconciliation access.
        </AdminInlineNotice>
      ) : null}

      <div className="stack notification-monitor">
        {!isOperationalReview ? (
          <>
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
          </>
        ) : null}

        <NotificationFilterBoardSection
          activeBookingLabel={model.activeBookingId ? shortId(model.activeBookingId) : null}
          activeFilterDescription={
            model.activeFilter?.review ? notificationFilterDescription(model.activeFilter.review) : null
          }
          activeFilterLabel={model.activeFilter?.review ? model.activeFilter.label : null}
          activeIncidentState={model.filters.incidentState}
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
          activeFinanceAge={model.filters.financeAge}
          financeAgeLinks={isFinanceOverdueReview || isFinanceOverdueHistory
            ? notificationFinanceAgeLinks.map((link) => ({
                ...link,
                href: buildNotificationListHref({ ...model.filters, financeAge: link.value }),
              }))
            : []}
          financeOwner={model.filters.financeOwner}
          financeOwnerLinks={financeOwnerLinks}
          financeOwnerOptions={isFinanceOverdueReview || isFinanceOverdueHistory ? countedFinanceOwnerOptions : []}
          incidentStateLinks={model.filters.review === 'system-incidents'
            ? notificationIncidentStateLinks.map((link) => ({
                ...link,
                href: buildNotificationListHref({
                  ...model.filters,
                  incidentState: link.state,
                }),
              }))
            : []}
          links={visibleNotificationFilterLinks.map((link) => ({
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
          headers={isFinanceOverdueReview || isFinanceOverdueHistory
            ? ['SLA started', 'Owner', 'Source', 'Review', 'SLA status', 'Alert evidence', 'Action']
            : undefined}
          hrefForPage={(page) => buildNotificationListHref(model.filters, { page })}
          pagination={model.notificationPagination}
          rows={model.notificationRows}
        />
      </div>
    </AdminPageTemplate>
  );
}

function buildFinanceOwnerOptions(users: readonly AdminUser[], activeOwner: string) {
  const options = users
    .filter(hasFinanceReviewOwnershipAccess)
    .map((user) => {
      const identity = user.email ?? user.phone ?? user.id;
      return {
        label: user.fullName && user.fullName !== identity ? `${user.fullName} · ${identity}` : identity,
        value: user.id,
      };
    });
  if (activeOwner && activeOwner !== 'unassigned' && !options.some((option) => option.value === activeOwner)) {
    options.push({ label: `Operator ${shortId(activeOwner)}`, value: activeOwner });
  }
  return [
    { label: 'All owners', value: '' },
    { label: 'Unassigned', value: 'unassigned' },
    ...options,
  ];
}

function hasFinanceReviewOwnershipAccess(user: AdminUser) {
  const roles = user.roles ?? [];
  return roles.includes('MASTER_ADMIN') ||
    Boolean(user.adminOperatorPermission?.categories.includes('FINANCE_BANK_RECONCILIATION')) ||
    (!user.adminOperatorPermission && roles.includes('FINANCE_APPROVER'));
}

function findCurrentFinanceOwner(
  users: readonly AdminUser[],
  operatorAccess: Awaited<ReturnType<typeof getCurrentAdminOperatorAccess>>,
) {
  if (!operatorAccess) return null;
  const identity = (operatorAccess.email ?? operatorAccess.phone ?? '').trim().toLowerCase();
  return users.find((user) => (
    user.id === operatorAccess.id ||
    Boolean(identity && [user.email, user.phone].some((value) => value?.trim().toLowerCase() === identity))
  )) ?? null;
}

function financeOwnerOptionCount(value: string, counts: ReadonlyMap<string | null, number>) {
  if (!value) return Array.from(counts.values()).reduce((total, count) => total + count, 0);
  return counts.get(value === 'unassigned' ? null : value) ?? 0;
}

function buildFinanceOwnerLinks(
  filters: ReturnType<typeof buildNotificationFilters>,
  currentOwnerId: string | null,
  counts: ReadonlyMap<string | null, number>,
) {
  const options = [
    {
      label: `All (${financeOwnerOptionCount('', counts)})`,
      value: '',
    },
    ...(currentOwnerId
      ? [{ label: `My reviews (${financeOwnerOptionCount(currentOwnerId, counts)})`, value: currentOwnerId }]
      : []),
    {
      label: `Unassigned (${financeOwnerOptionCount('unassigned', counts)})`,
      value: 'unassigned',
    },
  ];
  return options.map((option) => ({
    ...option,
    href: buildNotificationListHref({ ...filters, financeOwner: option.value }),
  }));
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
