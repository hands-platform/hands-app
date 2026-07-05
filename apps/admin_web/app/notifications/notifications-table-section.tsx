import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTableCard } from '../../components/admin-table-panel';
import { NotificationTableRowItem, type NotificationTableRow } from './notification-table-row';
import type { NotificationTablePagination } from './notification-page-model';

export type { NotificationTableRow } from './notification-table-row';

type NotificationsTableSectionProps = {
  readonly emptyMessage: string;
  readonly hrefForPage?: (page: number) => string;
  readonly pagination?: NotificationTablePagination;
  readonly rows: readonly NotificationTableRow[];
};

export function NotificationsTableSection({
  emptyMessage,
  hrefForPage,
  pagination,
  rows,
}: NotificationsTableSectionProps) {
  return (
    <AdminTableCard className="admin-section notification-table-shell">
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
      {pagination ? (
        <AdminTablePaginationFooter
          activePage={pagination.page}
          ariaLabel="Notification delivery pages"
          className="notification-table-footer"
          from={pagination.from}
          hrefForPage={hrefForPage}
          to={pagination.to}
          totalPages={pagination.totalPages}
          totalRows={pagination.totalRows}
        />
      ) : null}
    </AdminTableCard>
  );
}
