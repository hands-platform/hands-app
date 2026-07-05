import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminPersonCell } from '../../components/admin-person-cell';
import { DateTimeText } from '../../components/date-time-text';
import { AdminSignal, adminSignalToneFromClassName } from '../../components/status-badge';
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
  readonly row: NotificationTableRow;
};

export function NotificationTableRowItem({ row }: NotificationTableRowItemProps) {
  const personLabel = row.partnerLabel ?? row.userLabel;
  const personHelper = notificationPersonHelper(row);

  return (
    <tr id={row.id}>
      <td>
        <div>
          <DateTimeText value={row.createdAt} />
        </div>
        <div className="muted">{row.relativeCreatedAtLabel}</div>
      </td>
      <td>
        <AdminPersonCell
          avatarClassName={`vuexy-booking-avatar${row.partnerHref ? ' is-partner' : ''}`}
          avatarStatus={row.userAvatarStatus}
          className="vuexy-booking-person"
          helper={personHelper}
          href={row.userHref}
          label={personLabel}
          linkClassName="table-link"
        />
      </td>
      <td>
        <div>{row.typeLabel}</div>
        <div className="muted">{row.typeMeaning}</div>
      </td>
      <td>
        <div>{row.title}</div>
        <div className="muted admin-mt-6">{row.body}</div>
        {row.bookingDataHint ? <div className="muted admin-mt-6">{row.bookingDataHint}</div> : null}
      </td>
      <td>
        <AdminSignal className={row.signalClassName} tone={adminSignalToneFromClassName(row.signalClassName)}>
          {row.opsSignal}
        </AdminSignal>
        <div className="muted admin-mt-6">{row.opsHint}</div>
      </td>
      <td>
        <NotificationDeliveryCell deliveryRows={row.deliveryRows} totalAttemptCount={row.deliveryAttemptCount} />
      </td>
      <td>
        <ActionMenu actions={row.actions} label={row.actionLabel} variant="dropdown" />
      </td>
    </tr>
  );
}

function notificationPersonHelper(row: NotificationTableRow) {
  if (!row.partnerLabel) {
    return row.userPhone;
  }
  return [row.userLabel, row.userPhone, row.partnerStatus].filter(Boolean).join(' / ');
}
