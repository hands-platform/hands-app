import Link from 'next/link';

import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';
import { AdminDataTable } from '../../components/admin-data-table';

export type NotificationDeliveryRow = {
  readonly attemptedAtLabel: string;
  readonly deviceStateLabel: string;
  readonly enableDeviceHref: string | null;
  readonly failureCodeLabel: string;
  readonly failureReasonLabel: string;
  readonly httpStatusLabel: string;
  readonly id: string;
  readonly platformLabel: string;
  readonly provider: string;
  readonly status: string;
};

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

type NotificationsTableSectionProps = {
  readonly emptyMessage: string;
  readonly rows: readonly NotificationTableRow[];
};

export function NotificationsTableSection({ emptyMessage, rows }: NotificationsTableSectionProps) {
  return (
    <AdminDataTable
      emptyMessage={emptyMessage}
      headers={['Time', 'User', 'Type', 'Title', 'Ops record', 'Delivery', 'Action']}
      rowCount={rows.length}
    >
      {rows.map((row) => (
        <tr id={row.id} key={row.id}>
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
            <div className="muted" style={{ marginTop: 6 }}>
              {row.body}
            </div>
            {row.bookingDataHint ? (
              <div className="muted" style={{ marginTop: 6 }}>
                {row.bookingDataHint}
              </div>
            ) : null}
          </td>
          <td>
            <span className={row.signalClassName}>{row.opsSignal}</span>
            <div className="muted" style={{ marginTop: 6 }}>
              {row.opsHint}
            </div>
          </td>
          <td>
            {row.deliveryRows.length > 0
              ? row.deliveryRows.map((delivery) => (
                  <div key={delivery.id} style={{ marginBottom: 10 }}>
                    <div>
                      <strong>{delivery.provider}</strong> - {delivery.status} - {delivery.platformLabel}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {delivery.deviceStateLabel} - Attempted {delivery.attemptedAtLabel}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Failure {delivery.failureCodeLabel} / HTTP {delivery.httpStatusLabel}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Reason {delivery.failureReasonLabel}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Token hidden
                    </div>
                    {delivery.enableDeviceHref ? (
                      <Link className="pill pill-warn" href={delivery.enableDeviceHref} style={{ marginTop: 6 }}>
                        Re-enable device
                      </Link>
                    ) : null}
                  </div>
                ))
              : 'No devices / not attempted'}
          </td>
          <td>
            <ActionMenu actions={row.actions} label={row.actionLabel} />
          </td>
        </tr>
      ))}
    </AdminDataTable>
  );
}
