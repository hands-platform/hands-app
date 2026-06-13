import Link from 'next/link';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { NotificationDeliveryCell, type NotificationDeliveryRow } from './notification-delivery-cell';

export type NotificationTableRow = {
  readonly actionLabel: string;
  readonly actions: readonly ActionMenuItem[];
  readonly body: string;
  readonly bookingDataHint: string | null;
  readonly createdAtLabel: string;
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
  readonly userLabel: string;
  readonly userPhone: string;
};

type NotificationTableRowItemProps = {
  readonly row: NotificationTableRow;
};

export function NotificationTableRowItem({ row }: NotificationTableRowItemProps) {
  return (
    <tr id={row.id}>
      <td>
        <div>{row.createdAtLabel}</div>
        <div className="muted">{row.relativeCreatedAtLabel}</div>
      </td>
      <td>
        <div>{row.userLabel}</div>
        <div className="muted">{row.userPhone}</div>
        {row.partnerHref && row.partnerLabel ? (
          <div className="muted">
            <Link className="text-link" href={row.partnerHref}>
              {row.partnerLabel}
            </Link>{' '}
            / {row.partnerStatus ?? 'status unknown'}
          </div>
        ) : null}
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
        <span className={row.signalClassName}>{row.opsSignal}</span>
        <div className="muted admin-mt-6">{row.opsHint}</div>
      </td>
      <td>
        <NotificationDeliveryCell deliveryRows={row.deliveryRows} />
      </td>
      <td>
        <ActionMenu actions={row.actions} label={row.actionLabel} />
      </td>
    </tr>
  );
}
