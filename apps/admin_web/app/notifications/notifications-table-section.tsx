import { AdminDataTable, AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTableCard } from '../../components/admin-table-panel';
import { NotificationTableRowItem, type NotificationTableRow } from './notification-table-row';
import type { NotificationTablePagination } from './notification-page-model';

export type { NotificationTableRow } from './notification-table-row';

type NotificationsTableSectionProps = {
  readonly canViewDiagnostics?: boolean;
  readonly emptyMessage: string;
  readonly headers?: readonly string[];
  readonly hrefForPage?: (page: number) => string;
  readonly layout?: 'delivery' | 'failure-groups' | 'route-groups';
  readonly pagination?: NotificationTablePagination;
  readonly rows: readonly NotificationTableRow[];
};

export function NotificationsTableSection({
  canViewDiagnostics = false,
  emptyMessage,
  headers = ['Created', 'Recipient', 'Notification', 'Send status', 'Next action'],
  hrefForPage,
  layout = 'delivery',
  pagination,
  rows,
}: NotificationsTableSectionProps) {
  return (
    <AdminTableCard
      className={`admin-section notification-table-shell has-${headers.length}-columns is-${layout}${rows.length === 0 ? ' is-empty' : ''}`}
    >
      <AdminTableScroll ariaLabel="Notification delivery records">
        <AdminDataTable
          className="notification-delivery-table"
          emptyMessage={emptyMessage}
          headers={headers}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <NotificationTableRowItem
              canViewDiagnostics={canViewDiagnostics}
              key={row.id}
              row={row}
            />
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      {pagination && pagination.totalRows > 0 ? (
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
