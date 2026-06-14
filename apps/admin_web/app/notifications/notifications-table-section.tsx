import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { NotificationTableRowItem, type NotificationTableRow } from './notification-table-row';

export type { NotificationTableRow } from './notification-table-row';

type NotificationsTableSectionProps = {
  readonly emptyMessage: string;
  readonly rows: readonly NotificationTableRow[];
};

export function NotificationsTableSection({ emptyMessage, rows }: NotificationsTableSectionProps) {
  return (
    <div className="notification-table-shell">
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={emptyMessage}
          headers={['Time', 'User', 'Type', 'Title', 'Ops record', 'Delivery', 'Action']}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <NotificationTableRowItem key={row.id} row={row} />
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}
