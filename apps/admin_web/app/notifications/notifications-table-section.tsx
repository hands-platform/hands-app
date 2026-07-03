import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import { AdminCard } from '../../components/admin-surface';
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
    <AdminCard className="admin-section vuexy-booking-table-card vuexy-booking-table-group notification-table-shell">
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
        <div className="vuexy-booking-table-footer notification-table-footer">
          <span>
            Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
          </span>
          <AdminRoundedPagination
            activePage={pagination.page}
            ariaLabel="Notification delivery pages"
            className="vuexy-booking-pagination"
            hrefForPage={hrefForPage}
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={pagination.totalPages}
          />
        </div>
      ) : null}
    </AdminCard>
  );
}
