import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormControlStack,
  AdminFormGrid,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminErrorState, AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import {
  adminGetResult,
  type AdminNotification,
  type AdminNotificationBoardSummary,
} from '../../lib/admin-api';
import { canViewAdminDeveloperSystem } from '../../components/admin-developer-system-section';
import { formatDateTime } from '../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../lib/admin-operator-access-model';
import { readSearchParam } from '../../lib/date-range';
import { retryNotification } from './actions';
import { filterNotificationActionConfirmationSupportingLinks } from './notification-action-confirmation';
import { notificationFailureCodeLabel } from './notification-failure-copy';
import {
  buildNotificationApiHref,
  buildNotificationDeliveryHref,
  buildNotificationDeliveryView,
  buildNotificationPageModel,
  buildNotificationSummaryApiHref,
  legacyNotificationDestination,
  notificationDeliveryModelParams,
  notificationDeliveryHealthState,
  normalizeNotificationFailureCode,
  normalizeNotificationFailureProvider,
  type NotificationDeliveryIssue,
  type NotificationDeliveryView,
} from './notification-page-model';
import { NotificationsTableSection } from './notifications-table-section';
import { NotificationRefreshButton } from './notification-refresh-button';

type NotificationsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: NotificationsPageSearchParams;
}) {
  const params = (await searchParams) ?? {};
  const legacyDestination = legacyNotificationDestination(params);
  if (legacyDestination) redirect(legacyDestination);

  const view = buildNotificationDeliveryView(params);
  const rawPage = readSearchParam(params.page);
  if (rawPage && (!/^\d+$/.test(rawPage) || Number(rawPage) < 1)) {
    redirect(buildNotificationDeliveryHref(view, { page: 1 }));
  }

  const modelParams = notificationDeliveryModelParams(params, view);
  const [notificationsResult, summaryResult, operatorAccess] = await Promise.all([
    adminGetResult<AdminNotification[]>(buildNotificationApiHref(modelParams), []),
    adminGetResult<AdminNotificationBoardSummary | null>(buildNotificationSummaryApiHref(modelParams), null),
    getCurrentAdminOperatorAccess(),
  ]);
  const canRetry = hasAdminOperatorCategory(operatorAccess, 'NOTIFICATIONS_RETRY');
  const canViewDiagnostics = canViewAdminDeveloperSystem(operatorAccess);
  const model = buildNotificationPageModel({
    canRetry,
    notificationSummary: summaryResult.data,
    notifications: notificationsResult.data,
    operationalPolicies: [],
    params: modelParams,
  });
  if (model.notificationPagination.totalRows > 0 && view.page > model.notificationPagination.totalPages) {
    redirect(buildNotificationDeliveryHref(view, { page: model.notificationPagination.totalPages }));
  }

  const confirmation = filterNotificationActionConfirmationSupportingLinks(
    model.confirmation,
    canViewDiagnostics,
  );
  const invalidFilter = hasInvalidNotificationDeliveryFilter(params);
  const sectionTitle = view.mode === 'action' ? notificationIssueTitle(view.issue) : 'Delivery records';
  const recordsBoard = notificationsResult.ok ? (
    <NotificationsTableSection
      emptyMessage={notificationEmptyMessage(view)}
      headers={
        view.mode === 'action' && view.issue === 'groups'
          ? ['Cause', 'Affected', 'First / latest', 'Technical next step', 'Open affected records']
          : view.mode === 'action' && view.issue === 'no-route'
            ? ['Recipient / route', 'Latest notification', 'First / latest', 'Unresolved', 'Next action']
            : undefined
      }
      hrefForPage={(page) => buildNotificationDeliveryHref(view, { page })}
      pagination={model.notificationPagination}
      rows={model.notificationRows}
      canViewDiagnostics={canViewDiagnostics}
      layout={
        view.mode === 'action' && view.issue === 'groups'
          ? 'failure-groups'
          : view.mode === 'action' && view.issue === 'no-route'
            ? 'route-groups'
            : 'delivery'
      }
    />
  ) : (
    <AdminErrorState
      action={
        <AdminTextLink href={buildNotificationDeliveryHref(view)}>Retry notification records</AdminTextLink>
      }
      message="Notification records could not be loaded. No empty queue is shown while the record source is unavailable."
      title="Notification records unavailable"
    />
  );

  return (
    <AdminPageTemplate
      description="Review unresolved mobile send issues and inspect delivery records."
      title="Notification Delivery"
    >
      {confirmation ? (
        <ConfirmDialog
          action={retryNotification}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmation.hiddenInputs}
          id={`notification-action-${confirmation.action}-${confirmation.id}`}
          requireValidForm={Boolean(
            confirmation.textInputs?.some((input) => input.required || (input.minLength ?? 0) > 0),
          )}
          supportingLinks={confirmation.supportingLinks}
          textInputs={confirmation.textInputs}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <NotificationRetryNotice params={params} />
      {invalidFilter ? (
        <AdminInlineNotice role="alert" tone="warning">
          One or more unsupported delivery filters were ignored.{' '}
          <AdminTextLink href={view.mode === 'records' ? '/notifications?mode=records' : '/notifications'}>
            Reset filters
          </AdminTextLink>
        </AdminInlineNotice>
      ) : null}

      <div className="stack notification-monitor notification-delivery-workspace">
        <NotificationDeliveryToolbar summary={summaryResult.data} view={view} />

        {!summaryResult.ok ? (
          <AdminErrorState
            action={
              <AdminTextLink href={buildNotificationDeliveryHref(view)}>Retry delivery summary</AdminTextLink>
            }
            message="Delivery counts are unavailable. Loaded records remain visible, but their totals must not be treated as zero."
            title="Notification summary unavailable"
          />
        ) : null}

        {view.mode === 'action' ? (
          <>
            <NotificationDeliveryHealthOverview summary={summaryResult.data} />
            <NotificationIssueSelector summary={summaryResult.data} view={view} />
                {view.issue === 'failed' && view.failureProvider && view.failureCode ? (
                  <div className="admin-filter-chip-group" aria-label="Active failure group filter">
                    <StatusBadge tone="warning">
                      {view.failureProvider} · {notificationFailureCodeLabel(view.failureCode)}
                    </StatusBadge>
                    <AdminTextLink
                      href={buildNotificationDeliveryHref(view, {
                        failureCode: '',
                        failureProvider: '',
                        page: 1,
                      })}
                    >
                      Clear group
                    </AdminTextLink>
                  </div>
                ) : null}
                <NotificationResultsSection
                  action={
                    view.issue === 'groups' ? null : (
                      <AdminTextLink
                        href={buildNotificationDeliveryHref(view, {
                          failureCode: '',
                          failureProvider: '',
                          issue: 'groups',
                          page: 1,
                        })}
                      >
                        Open failure groups
                      </AdminTextLink>
                    )
                  }
                  description={notificationIssueDescription(view.issue)}
                  id="notification-delivery-results"
                  statusLabel={notificationIssueResultLabel(view.issue, model.totalCount, summaryResult.data)}
                  statusTone={model.totalCount > 0 ? 'warning' : 'success'}
                  title={sectionTitle}
                >
                  {recordsBoard}
                </NotificationResultsSection>
          </>
        ) : (
          <>
            <NotificationRecordFilters view={view} />
            <NotificationResultsSection
                  description="FCM acceptance is push service acknowledgement, not proof that the device received or opened the notification."
                  id="notification-delivery-results"
                  statusLabel={`${model.totalCount} notification${model.totalCount === 1 ? '' : 's'}`}
                  statusTone="info"
                  title={sectionTitle}
                >
                  {recordsBoard}
            </NotificationResultsSection>
          </>
        )}
      </div>
    </AdminPageTemplate>
  );
}

function NotificationResultsSection({
  action,
  children,
  description,
  id,
  statusLabel,
  statusTone,
  title,
}: {
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly description: string;
  readonly id: string;
  readonly statusLabel: string;
  readonly statusTone: StatusBadgeTone;
  readonly title: string;
}) {
  const headingId = `${id}-title`;
  return (
    <section aria-labelledby={headingId} className="notification-results-section" id={id}>
      <div className="ops-section-header notification-results-header">
        <div>
          <h2 id={headingId}>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <div className="participant-list admin-section-actions">
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

function NotificationDeliveryToolbar({
  summary,
  view,
}: {
  readonly summary: AdminNotificationBoardSummary | null;
  readonly view: NotificationDeliveryView;
}) {
  return (
    <section aria-label="Notification delivery controls" className="notification-delivery-toolbar">
      <div className="notification-delivery-toolbar-controls">
        <div className="notification-delivery-toolbar-group">
          <span>Source</span>
          <NotificationDataScopeSelector view={view} />
        </div>
        <div className="notification-delivery-toolbar-group">
          <span>View</span>
          <AdminSegmentedControl
            activeValue={view.mode}
            ariaLabel="Notification Delivery mode"
            options={[
              {
                href: buildNotificationDeliveryHref(view, { mode: 'action', page: 1 }),
                label: 'Needs action',
                value: 'action',
              },
              {
                href: buildNotificationDeliveryHref(view, { mode: 'records', page: 1 }),
                label: 'Delivery records',
                value: 'records',
              },
            ]}
          />
        </div>
        {view.mode === 'action' ? (
          <div className="notification-delivery-toolbar-group notification-delivery-toolbar-scope">
            <span>Age</span>
            <NotificationActionScopeSelector view={view} />
          </div>
        ) : null}
      </div>
      <div
        aria-label="Notification delivery data status"
        className="admin-filter-chip-group notification-delivery-data-status"
      >
        <StatusBadge tone="info">
          {view.mode === 'action' ? notificationScopeLabel(view.scope) : notificationRangeLabel(view.range)}
        </StatusBadge>
        <StatusBadge tone="neutral">Asia/Ho_Chi_Minh</StatusBadge>
        <NotificationRefreshButton generatedLabel={formatDateTime(summary?.generatedAt, 'unavailable')} />
        <NotificationDataScopeStatus summary={summary} view={view} />
      </div>
    </section>
  );
}

function NotificationIssueSelector({
  summary,
  view,
}: {
  readonly summary: AdminNotificationBoardSummary | null;
  readonly view: NotificationDeliveryView;
}) {
  const failureGroupCount =
    view.scope === 'history'
      ? summary?.historicalDeliveryIncidentCount
      : view.scope === 'all'
        ? addKnownCounts(summary?.openDeliveryIncidentCount, summary?.historicalDeliveryIncidentCount)
        : summary?.openDeliveryIncidentCount;
  const options: Array<{
    issue: NotificationDeliveryIssue;
    label: string;
    count?: number;
    countLabel?: string;
  }> = [
    {
      issue: 'groups',
      label: 'Failure groups',
      count: failureGroupCount,
      countLabel:
        failureGroupCount === undefined ? undefined : `${failureGroupCount.toLocaleString()} groups`,
    },
    { issue: 'failed', label: 'Failed', count: summary?.failed },
    { issue: 'no-attempt', label: 'No send attempt after 15m', count: summary?.deliveryGaps },
    {
      issue: 'no-route',
      label: 'No active push route',
      count: summary?.noPushPathRecipientCount,
      countLabel:
        summary?.noPushPathRecipientCount === undefined
          ? undefined
          : `${summary.noPushPathRecipientCount.toLocaleString()} recipients · ${(summary.noPushPathNotificationCount ?? summary.noPushPath ?? 0).toLocaleString()} notifications`,
    },
    { issue: 'stale-route', label: 'App route needs refresh', count: summary?.staleRouteNotifications },
  ];
  return (
    <AdminSegmentedControl
      activeValue={view.issue}
      ariaLabel="Notification delivery issue"
      className="notification-delivery-issue-control"
      options={options.map((option) => ({
        href: buildNotificationDeliveryHref(view, {
          failureCode: '',
          failureProvider: '',
          issue: option.issue,
          page: 1,
          scope:
            option.issue === 'no-attempt' || !['15-60m', '1-24h'].includes(view.scope)
              ? view.scope
              : 'current',
        }),
        label:
          view.issue === 'groups' || view.issue === option.issue
            ? `${option.label} · ${option.countLabel ?? (option.count === undefined ? 'Unavailable' : `${option.count.toLocaleString()} notifications`)}`
            : option.label,
        value: option.issue,
      }))}
    />
  );
}

function NotificationDataScopeStatus({
  summary,
  view,
}: {
  readonly summary: AdminNotificationBoardSummary | null;
  readonly view: NotificationDeliveryView;
}) {
  const selectedCount =
    view.dataScope === 'synthetic'
      ? summary?.syntheticDataCount
      : view.dataScope === 'unknown'
        ? summary?.unknownDataCount
        : summary?.productionDataCount;
  const label =
    view.dataScope === 'synthetic'
      ? 'Synthetic test records'
      : view.dataScope === 'unknown'
        ? 'Unknown source records'
        : 'Explicit production records';
  return (
    <>
      <StatusBadge tone={view.dataScope === 'production' ? 'info' : 'warning'}>
        {label}{selectedCount === undefined ? '' : ` · ${selectedCount.toLocaleString()}`}
      </StatusBadge>
      {view.dataScope === 'production' && (summary?.unknownDataCount ?? 0) > 0 ? (
        <StatusBadge tone="warning">
          Unknown source backlog · {summary?.unknownDataCount?.toLocaleString()}
        </StatusBadge>
      ) : null}
    </>
  );
}

function NotificationDataScopeSelector({ view }: { readonly view: NotificationDeliveryView }) {
  return (
    <AdminSegmentedControl
      activeValue={view.dataScope}
      ariaLabel="Notification data source"
      className="notification-data-scope-control"
      options={[
        {
          href: buildNotificationDeliveryHref(view, { dataScope: 'production', page: 1 }),
          label: 'Production',
          value: 'production',
        },
        {
          href: buildNotificationDeliveryHref(view, { dataScope: 'unknown', page: 1 }),
          label: 'Unknown source',
          value: 'unknown',
        },
        {
          href: buildNotificationDeliveryHref(view, { dataScope: 'synthetic', page: 1 }),
          label: 'Synthetic',
          value: 'synthetic',
        },
      ]}
    />
  );
}

function NotificationDeliveryHealthOverview({
  summary,
}: {
  readonly summary: AdminNotificationBoardSummary | null;
}) {
  const current = [
    ['Failure groups', summary?.openDeliveryIncidentCount, 'groups'],
    ['Failed', summary?.currentFailed, 'failed'],
    ['No attempt', summary?.currentDeliveryGaps, 'no-attempt'],
    ['No route recipients', summary?.currentNoPushPathRecipientCount, 'no-route'],
    ['Stale routes', summary?.currentStaleRouteNotifications, 'stale-route'],
  ] as const;
  const history = [
    ['Failure groups', summary?.historicalDeliveryIncidentCount, 'groups'],
    ['Failed', summary?.historicalFailed, 'failed'],
    ['No attempt', summary?.historicalDeliveryGaps, 'no-attempt'],
    ['No route recipients', summary?.historicalNoPushPathRecipientCount, 'no-route'],
    ['Stale routes', summary?.historicalStaleRouteNotifications, 'stale-route'],
  ] as const;
  const { current: currentHealth, history: historyHealth } = notificationDeliveryHealthState(summary);
  const healthUnavailable = currentHealth === 'unavailable' || historyHealth === 'unavailable';
  const needsAttention = currentHealth === 'attention' || historyHealth === 'attention';

  return (
    <AdminSection
      description="Current delivery debt and 24h+ backlog stay visible together. Counts are scoped to the selected data source."
      id="notification-delivery-health"
      statusLabel={
        healthUnavailable
          ? 'Status unavailable'
          : needsAttention
            ? 'Delivery debt requires attention'
            : 'No measured delivery debt'
      }
      statusTone={
        healthUnavailable
          ? 'warning'
          : needsAttention
            ? 'warning'
            : 'success'
      }
      title="Delivery health"
    >
      <div className="notification-delivery-health-grid">
        <section aria-labelledby="notification-current-health-title" className="notification-delivery-health-band">
          <div className="notification-delivery-health-heading">
            <div>
              <p className="eyebrow">CURRENT · UNDER 24H</p>
              <h3 id="notification-current-health-title">Current delivery debt</h3>
            </div>
            <StatusBadge tone={currentHealth === 'clear' ? 'success' : 'warning'}>
              {currentHealth === 'unavailable'
                ? 'Status unavailable'
                : currentHealth === 'attention'
                  ? 'Review current debt'
                  : 'No new delivery issues in the last 24 hours'}
            </StatusBadge>
          </div>
          <NotificationDeliveryHealthMetrics items={current} scope="current" />
        </section>

        <section aria-labelledby="notification-history-health-title" className="notification-delivery-health-band">
          <div className="notification-delivery-health-heading">
            <div>
              <p className="eyebrow">HISTORY · 24H+</p>
              <h3 id="notification-history-health-title">Historical delivery debt</h3>
            </div>
            <StatusBadge tone={historyHealth === 'clear' ? 'success' : 'warning'}>
              {historyHealth === 'unavailable'
                ? 'Status unavailable'
                : historyHealth === 'attention'
                  ? 'Open history debt'
                  : 'No history debt'}
            </StatusBadge>
          </div>
          <NotificationDeliveryHealthMetrics items={history} scope="history" />
          {historyHealth === 'attention' ? (
            <p className="muted notification-history-meta">
              Oldest failure group: {formatDateTime(summary?.historicalDeliveryOldestAt, 'unavailable')} · lifecycle is read-only because Notification records do not have a persistent assignment or resolution field.
            </p>
          ) : null}
        </section>
      </div>
    </AdminSection>
  );
}

function NotificationDeliveryHealthMetrics({
  items,
  scope,
}: {
  readonly items: readonly (readonly [string, number | undefined, NotificationDeliveryIssue])[];
  readonly scope: 'current' | 'history';
}) {
  return (
    <dl className="notification-delivery-health-metrics">
      {items.map(([label, count, issue]) => (
        <div key={`${scope}-${issue}`}>
          <dt>{label}</dt>
          <dd>{count === undefined ? 'Unavailable' : count.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

function addKnownCounts(first: number | undefined, second: number | undefined) {
  return first === undefined || second === undefined ? undefined : first + second;
}

function NotificationActionScopeSelector({ view }: { readonly view: NotificationDeliveryView }) {
  const options =
    view.issue === 'no-attempt'
      ? [
          { label: 'Current · under 24h', value: 'current' },
          { label: '15–60m', value: '15-60m' },
          { label: '1–24h', value: '1-24h' },
          { label: '24h+ history', value: 'history' },
          { label: 'All ages', value: 'all' },
        ]
      : [
          { label: 'Current · under 24h', value: 'current' },
          { label: '24h+ history', value: 'history' },
          { label: 'All ages', value: 'all' },
        ];
  return (
    <AdminSegmentedControl
      activeValue={view.scope}
      ariaLabel="Notification action age scope"
      className="notification-delivery-scope-control"
      options={options.map((option) => ({
        ...option,
        href: buildNotificationDeliveryHref(view, {
          page: 1,
          scope: option.value as NotificationDeliveryView['scope'],
        }),
      }))}
    />
  );
}

function NotificationRecordFilters({ view }: { readonly view: NotificationDeliveryView }) {
  const appliedFilters = notificationRecordFilterLabels(view);
  const resetHref = buildNotificationDeliveryHref({
    ...view,
    age: '',
    booking: '',
    channel: 'all',
    page: 1,
    q: '',
    range: 'today',
    recipientRole: 'all',
    sort: 'newest',
    status: 'all',
    type: '',
    user: '',
  });
  return (
    <AdminFilterPanel
      description="Search server-side delivery records. Page size is fixed at 10."
      title="Delivery record filters"
    >
      <AdminFormGrid action="/notifications" className="notification-delivery-filter-form" method="get">
        <input name="mode" type="hidden" value="records" />
        {view.dataScope !== 'production' ? (
          <input name="dataScope" type="hidden" value={view.dataScope} />
        ) : null}
        {view.booking ? <input name="booking" type="hidden" value={view.booking} /> : null}
        {view.user ? <input name="user" type="hidden" value={view.user} /> : null}
        {view.type ? <input name="type" type="hidden" value={view.type} /> : null}
        <AdminFormSearch
          defaultValue={view.q}
          label="Search"
          name="q"
          placeholder="Notification ID, booking ID, recipient name or ID"
        />
        <AdminFormSelect
          defaultValue={view.recipientRole}
          label="Recipient role"
          name="recipientRole"
          options={[
            { label: 'All roles', value: 'all' },
            { label: 'Customer', value: 'customer' },
            { label: 'Partner', value: 'provider' },
            { label: 'Admin', value: 'admin' },
          ]}
        />
        <AdminFormSelect
          defaultValue={view.channel}
          label="Channel"
          name="channel"
          options={[
            { label: 'All channels', value: 'all' },
            { label: 'FCM', value: 'fcm' },
            { label: 'In-app', value: 'in-app' },
          ]}
        />
        <AdminFormSelect
          defaultValue={view.status}
          label="Send status"
          name="status"
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Accepted by FCM', value: 'accepted' },
            { label: 'Failed', value: 'failed' },
            { label: 'Skipped', value: 'skipped' },
            { label: 'Not attempted', value: 'not-attempted' },
          ]}
        />
        <AdminFormSelect
          defaultValue={view.range}
          label="Date"
          name="range"
          options={[
            { label: 'Today', value: 'today' },
            { label: 'Previous day', value: 'yesterday' },
            { label: '7 days', value: '7d' },
            { label: '30 days', value: '30d' },
            { label: 'All', value: 'all' },
          ]}
        />
        <AdminFormSelect
          defaultValue={view.sort}
          label="Sort"
          name="sort"
          options={[
            { label: 'Newest', value: 'newest' },
            { label: 'Oldest', value: 'oldest' },
          ]}
        />
        <AdminFormControlStack>
          <AdminFormControlButton type="submit">Apply filters</AdminFormControlButton>
          <AdminFormControlLink href={resetHref}>Reset</AdminFormControlLink>
        </AdminFormControlStack>
      </AdminFormGrid>
      {appliedFilters.length ? (
        <div className="notification-delivery-applied-filters" role="status">
          <strong>Applied filters</strong>
          <ul aria-label="Applied notification record filters">
            {appliedFilters.map((label) => <li key={label}>{label}</li>)}
          </ul>
          <AdminTextLink href={resetHref}>Clear record filters</AdminTextLink>
        </div>
      ) : null}
    </AdminFilterPanel>
  );
}

function notificationRecordFilterLabels(view: NotificationDeliveryView) {
  return [
    view.q ? `Search: ${view.q}` : null,
    view.recipientRole !== 'all'
      ? `Role: ${view.recipientRole === 'provider' ? 'Partner' : view.recipientRole}`
      : null,
    view.channel !== 'all' ? `Channel: ${view.channel === 'in-app' ? 'In-app' : 'FCM'}` : null,
    view.status !== 'all' ? `Status: ${view.status}` : null,
    view.range !== 'today' ? `Date: ${view.range}` : null,
    view.sort !== 'newest' ? 'Sort: oldest' : null,
    view.booking ? `Booking: ${view.booking}` : null,
    view.user ? `Recipient: ${view.user}` : null,
    view.type ? `Type: ${view.type}` : null,
    view.age ? `Age: ${view.age}` : null,
  ].filter((label): label is string => Boolean(label));
}

function NotificationRetryNotice({
  params,
}: {
  readonly params: Record<string, string | string[] | undefined>;
}) {
  const notice = readSearchParam(params.retryNotice);
  const job = readSearchParam(params.retryJob);
  const notices: Record<
    string,
    { message: string; role: 'alert' | 'status'; tone: 'danger' | 'success' | 'warning' }
  > = {
    queued: {
      message: `Retry queued${job ? ` · job ${job}` : ''}. Successful device paths remain excluded.`,
      role: 'status',
      tone: 'success',
    },
    'queued-audit-pending': {
      message: `Retry queued${job ? ` · job ${job}` : ''} · audit confirmation pending. Do not enqueue another retry while the audit outcome is being checked.`,
      role: 'alert',
      tone: 'warning',
    },
    'permission-denied': {
      message: 'Permission denied. Notification retry requires explicit Notification retry access.',
      role: 'alert',
      tone: 'danger',
    },
    'state-changed': {
      message: 'The notification state changed before retry. Reload the record and review the latest paths.',
      role: 'alert',
      tone: 'warning',
    },
    'no-eligible-path': {
      message: 'No eligible unresolved push path remains. Nothing was queued.',
      role: 'alert',
      tone: 'warning',
    },
    'queue-unavailable': {
      message: 'The notification queue is unavailable. Nothing was queued or recorded as a successful retry.',
      role: 'alert',
      tone: 'danger',
    },
    'unknown-failure': {
      message:
        'Notification retry failed. Review the audit trail and try again only after confirming the current state.',
      role: 'alert',
      tone: 'danger',
    },
  };
  const item = notices[notice];
  return item ? (
    <AdminInlineNotice role={item.role} tone={item.tone}>
      {item.message}
    </AdminInlineNotice>
  ) : null;
}

function notificationIssueTitle(issue: NotificationDeliveryIssue) {
  if (issue === 'failed') return 'Failed';
  if (issue === 'no-attempt') return 'No send attempt after 15m';
  if (issue === 'no-route') return 'No active push route';
  if (issue === 'stale-route') return 'App route needs refresh';
  return 'Open failure groups';
}

function notificationIssueDescription(issue: NotificationDeliveryIssue) {
  if (issue === 'groups')
    return 'Latest unresolved paths grouped by push provider and normalized failure code.';
  if (issue === 'failed')
    return 'Notifications with at least one latest failed device path. Recovered paths are excluded.';
  if (issue === 'no-attempt')
    return 'Enabled target routes with no send attempt recorded 15 minutes after creation.';
  if (issue === 'no-route')
    return 'Notifications without an enabled target-role push route and not already successful.';
  return 'Enabled target routes older than the current freshness threshold and not already successful.';
}

function notificationIssueResultLabel(
  issue: NotificationDeliveryIssue,
  count: number,
  summary: AdminNotificationBoardSummary | null,
) {
  if (issue === 'no-route') {
    const notifications = summary?.noPushPathNotificationCount ?? summary?.noPushPath ?? 0;
    return `${count.toLocaleString()} recipients · ${notifications.toLocaleString()} notifications`;
  }
  const unit = issue === 'groups' ? 'failure group' : 'notification';
  return `${count.toLocaleString()} ${unit}${count === 1 ? '' : 's'}`;
}

function notificationScopeLabel(scope: NotificationDeliveryView['scope']) {
  if (scope === '15-60m') return 'Current · 15–60 minutes';
  if (scope === '1-24h') return 'Current · 1–24 hours';
  if (scope === 'history') return 'History · 24h+';
  if (scope === 'all') return 'All ages';
  return 'Current · under 24h';
}

function notificationRangeLabel(range: NotificationDeliveryView['range']) {
  if (range === 'yesterday') return 'Previous day · Vietnam time';
  if (range === '7d') return '7 days · Vietnam time';
  if (range === '30d') return '30 days · Vietnam time';
  if (range === 'all') return 'All dates';
  return 'Today · Vietnam time';
}

function notificationEmptyMessage(view: NotificationDeliveryView) {
  if (view.mode === 'action') {
    return view.issue === 'groups'
      ? 'No open failure groups match this scope.'
      : `No notifications currently match ${notificationIssueTitle(view.issue)}.`;
  }
  const filtered = Boolean(
    view.q || view.recipientRole !== 'all' || view.channel !== 'all' || view.status !== 'all',
  );
  return filtered ? 'No delivery records match these filters.' : 'No delivery records exist for this period.';
}

function hasInvalidNotificationDeliveryFilter(params: Record<string, string | string[] | undefined>) {
  const checks: Array<[string, readonly string[]]> = [
    [readSearchParam(params.mode), ['action', 'records']],
    [readSearchParam(params.issue), ['groups', 'failed', 'no-attempt', 'no-route', 'stale-route']],
    [readSearchParam(params.status), ['all', 'accepted', 'failed', 'skipped', 'not-attempted']],
    [readSearchParam(params.recipientRole), ['all', 'customer', 'provider', 'admin']],
    [readSearchParam(params.channel), ['all', 'fcm', 'in-app']],
    [readSearchParam(params.range), ['all', 'today', 'yesterday', '7d', '30d']],
    [readSearchParam(params.sort), ['newest', 'oldest']],
    [readSearchParam(params.scope), ['current', '15-60m', '1-24h', 'history', 'all']],
    [readSearchParam(params.dataScope), ['production', 'unknown', 'synthetic']],
  ];
  const failureProvider = readSearchParam(params.failureProvider);
  const failureCode = readSearchParam(params.failureCode);
  return (
    checks.some(([value, allowed]) => value && !allowed.includes(value)) ||
    Boolean(failureProvider && !normalizeNotificationFailureProvider(failureProvider)) ||
    Boolean(failureCode && !normalizeNotificationFailureCode(failureCode))
  );
}
