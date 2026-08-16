import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { DateTimeText } from '../../components/date-time-text';
import { AdminSignal, StatusBadge, StatusBadgeLink, adminSignalToneFromClassName } from '../../components/status-badge';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import { NotificationDeliveryCell, type NotificationDeliveryRow } from './notification-delivery-cell';

export type NotificationTableRow = {
  readonly actionLabel: string;
  readonly actions: readonly ActionMenuItem[];
  readonly body: string;
  readonly bookingDataHint: string | null;
  readonly createdAt: string | null;
  readonly deliveryAttemptCount: number;
  readonly deliveryRows: readonly NotificationDeliveryRow[];
  readonly id: string;
  readonly incident?: {
    readonly affectedUserCount: number;
    readonly failureCode: string;
    readonly failureCodeLabel: string;
    readonly firstOccurredAt: string;
    readonly historical: boolean;
    readonly href: string;
    readonly lastOccurredAt: string;
    readonly notificationCount: number;
    readonly ownerLabel: string;
    readonly provider: string;
    readonly retryCondition: string;
    readonly technicalAction: string;
    readonly windowMinutes: number;
  };
  readonly primaryAction?: ActionMenuItem;
  readonly routeGroup?: {
    readonly firstOccurredAt: string;
    readonly latestOccurredAt: string;
    readonly notificationCount: number;
    readonly targetRole: string;
  };
  readonly opsHint: string;
  readonly opsSignal: string;
  readonly partnerHref: string | null;
  readonly partnerLabel: string | null;
  readonly partnerStatus: string | null;
  readonly relativeCreatedAtLabel: string;
  readonly signalClassName: string;
  readonly title: string;
  readonly typeLabel: string;
  readonly typeMeaning: string;
  readonly userAvatarStatus: AdminAvatarStatus;
  readonly userHref: string | null;
  readonly userLabel: string;
  readonly userPhone: string;
};

type NotificationTableRowItemProps = {
  readonly canViewDiagnostics?: boolean;
  readonly row: NotificationTableRow;
};

export function NotificationTableRowItem({ canViewDiagnostics = false, row }: NotificationTableRowItemProps) {
  if (row.incident) {
    return <NotificationIncidentTableRow canViewDiagnostics={canViewDiagnostics} row={row} />;
  }
  if (row.routeGroup) return <NotificationRouteGroupTableRow row={row} />;
  const personLabel = row.partnerLabel ?? row.userLabel;
  const personHelper = notificationPersonHelper(row);

  return (
    <tr id={row.id}>
      <td data-label="Created">
        <div>
          <DateTimeText value={row.createdAt} />
        </div>
        <div className="muted">{row.relativeCreatedAtLabel}</div>
      </td>
      <td data-label="Recipient">
        <AdminPersonCell
          avatarClassName={`vuexy-booking-avatar${row.partnerHref ? ' is-partner' : ''}`}
          avatarStatus={row.userAvatarStatus}
          avatarStatusLabel={notificationPushRouteStatusLabel(row.userAvatarStatus)}
          className="vuexy-booking-person"
          helper={personHelper}
          href={row.userHref}
          label={personLabel}
          linkClassName="table-link"
        />
      </td>
      <td data-label="Notification">
        <div className="muted">{row.typeLabel}</div>
        <strong>{row.title}</strong>
        <div className="muted admin-mt-6">{row.body}</div>
        {row.bookingDataHint ? <div className="muted admin-mt-6">{row.bookingDataHint}</div> : null}
      </td>
      <td data-label="Send status">
        <AdminSignal className={row.signalClassName} tone={adminSignalToneFromClassName(row.signalClassName)}>
          {row.opsSignal}
        </AdminSignal>
        <div className="muted admin-mt-6">{row.opsHint}</div>
        <NotificationDeliveryCell
          deliveryRows={row.deliveryRows}
          emptyLabel={notificationEmptyDeliveryLabel(row.opsSignal)}
          totalAttemptCount={row.deliveryAttemptCount}
        />
      </td>
      <td data-label="Next action">
        <NotificationRowActions row={row} />
      </td>
    </tr>
  );
}

function NotificationIncidentTableRow({
  canViewDiagnostics,
  row,
}: {
  readonly canViewDiagnostics: boolean;
  readonly row: NotificationTableRow;
}) {
  const incident = row.incident!;

  return (
    <tr id={row.id}>
      <td data-label="Cause">
        <strong>{incident.failureCodeLabel}</strong>
        <div className="muted admin-mt-6">{incident.provider}</div>
        <code aria-label={incident.failureCode} className="notification-failure-code">
          {technicalCodeWithBreaks(incident.failureCode)}
        </code>
      </td>
      <td data-label="Affected">
        <strong>{incident.affectedUserCount} affected user{incident.affectedUserCount === 1 ? '' : 's'}</strong>
        <div className="muted admin-mt-6">
          {incident.notificationCount} notification{incident.notificationCount === 1 ? '' : 's'}
        </div>
      </td>
      <td data-label="First / latest">
        <div><span className="muted">First </span><DateTimeText value={incident.firstOccurredAt} /></div>
        <div className="admin-mt-6"><span className="muted">Latest </span><DateTimeText value={incident.lastOccurredAt} /></div>
        <div className="muted admin-mt-6">Age {row.relativeCreatedAtLabel}</div>
      </td>
      <td data-label="Technical next step">
        <strong>{incident.technicalAction}</strong>
        <div className="muted admin-mt-6">Owner · {incident.ownerLabel}</div>
        <div className="muted admin-mt-6">{incident.retryCondition}</div>
        {canViewDiagnostics ? (
          <div className="admin-mt-6">
            <StatusBadgeLink href="/setup?commands=all#notifications" tone="neutral">Developer checks</StatusBadgeLink>
          </div>
        ) : null}
      </td>
      <td data-label="Open affected records">
        <StatusBadgeLink href={incident.href} tone="warning">Open this group</StatusBadgeLink>
      </td>
    </tr>
  );
}

function NotificationRouteGroupTableRow({ row }: { readonly row: NotificationTableRow }) {
  const group = row.routeGroup!;
  const personLabel = row.partnerLabel ?? row.userLabel;
  const notificationCountLabel = `${group.notificationCount.toLocaleString()} notification${group.notificationCount === 1 ? '' : 's'}`;
  return (
    <tr id={row.id}>
      <td data-label="Recipient / route">
        <AdminPersonCell
          avatarClassName={`vuexy-booking-avatar${row.partnerHref ? ' is-partner' : ''}`}
          avatarStatus={row.userAvatarStatus}
          avatarStatusLabel="Push route: inactive"
          className="vuexy-booking-person"
          helper={`${group.targetRole === 'PROVIDER' ? 'Partner' : group.targetRole} · Push route: inactive`}
          href={row.userHref}
          label={personLabel}
          linkClassName="table-link"
        />
        {row.partnerStatus ? <div className="muted admin-mt-6">Partner now: {partnerStatusLabel(row.partnerStatus)}</div> : null}
      </td>
      <td data-label="Latest notification">
        <div className="muted">{row.typeLabel}</div>
        <strong>{row.title}</strong>
        <div className="muted admin-mt-6"><DateTimeText value={group.latestOccurredAt} /></div>
      </td>
      <td data-label="First / latest">
        <div><span className="muted">First </span><DateTimeText value={group.firstOccurredAt} /></div>
        <div className="admin-mt-6"><span className="muted">Latest </span><DateTimeText value={group.latestOccurredAt} /></div>
      </td>
      <td data-label="Unresolved">
        <strong>{notificationCountLabel}</strong>
        <div className="muted admin-mt-6">One recipient route recovery unit</div>
      </td>
      <td data-label="Next action"><NotificationRowActions row={row} /></td>
    </tr>
  );
}

function notificationPushRouteStatusLabel(status: AdminAvatarStatus) {
  return status === 'online' ? 'Push route: active' : 'Push route: inactive';
}

function NotificationRowActions({ row }: { readonly row: NotificationTableRow }) {
  const blockedRetry = row.actions.find(
    (action) => action.disabled && ['Retry blocked', 'Retry cooldown'].includes(action.label),
  );
  return (
    <div className="notification-row-actions">
      {row.primaryAction ? (
        <ActionMenu actions={[row.primaryAction]} label={`Primary ${row.actionLabel}`} variant="button-list" />
      ) : null}
      {row.actions.length > 0 ? (
        <ActionMenu actions={row.actions} label={row.actionLabel} managedDropdown variant="dropdown" />
      ) : null}
      {blockedRetry ? (
        <p className="notification-retry-block-reason">
          <StatusBadge tone="neutral">{blockedRetry.label}</StatusBadge>
          <span>{typeof blockedRetry.description === 'string' ? blockedRetry.description : 'Recovery evidence is required before retry.'}</span>
        </p>
      ) : null}
    </div>
  );
}

function technicalCodeWithBreaks(value: string) {
  return value.split(/([_/:.-]+)/).map((part, index) => (
    <span key={`${part}-${index}`}>
      {part}
      {/[_/:.-]+/.test(part) ? <wbr /> : null}
    </span>
  ));
}

function notificationEmptyDeliveryLabel(signal: string) {
  if (signal === 'No send attempt after 15m') return 'No send attempt after 15m';
  if (signal === 'No active push route') return 'No active push route';
  if (signal === 'Delivery pending') return 'First delivery attempt pending';
  return 'No devices / not attempted';
}

function notificationPersonHelper(row: NotificationTableRow) {
  if (!row.partnerLabel) {
    return row.userPhone;
  }
  return [row.userLabel, row.userPhone, partnerStatusLabel(row.partnerStatus)].filter(Boolean).join(' / ');
}

function partnerStatusLabel(value: string | null) {
  if (value === 'ONLINE_AVAILABLE') return 'available';
  if (value === 'ONLINE_BUSY') return 'busy';
  if (value === 'OFFLINE') return 'offline';
  return value?.toLowerCase().replaceAll('_', ' ') ?? null;
}
