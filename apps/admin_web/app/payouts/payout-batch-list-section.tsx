import { PayoutBatchTable, type PayoutBatchTableRow } from './payout-batch-table';
import { AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
import { StatusBadge, StatusBadgeLink } from '../../components/status-badge';
import type { PayoutServerPagination } from './payouts-page-model';

type FormAction = (formData: FormData) => void | Promise<void>;

type PayoutBatchListSectionProps = {
  readonly pagination: PayoutServerPagination<PayoutBatchTableRow>;
  readonly paginationHrefForPage: (page: number) => string;
  readonly rows: readonly PayoutBatchTableRow[];
  readonly updateTransferRefAction: FormAction;
};

export function PayoutBatchListSection({
  pagination,
  paginationHrefForPage,
  rows,
  updateTransferRefAction,
}: PayoutBatchListSectionProps) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Partner settlement batches ordered so unresolved money movement stays at the top."
      resultLabel={`${pagination.totalRows} row(s)`}
      resultTone={pagination.totalRows > 0 ? 'info' : 'warning'}
      title="Payout batch list"
    >
      <div className="participant-list admin-mb-12">
        <StatusBadge tone="success">Newest active first</StatusBadge>
        <StatusBadge tone="info">Payout record</StatusBadge>
        <StatusBadge tone="warning">Reconciliation</StatusBadge>
        <StatusBadgeLink href="/earnings" tone="neutral">
          Review earnings
        </StatusBadgeLink>
      </div>

      <AdminTableScroll>
        <PayoutBatchTable rows={rows} updateTransferRefAction={updateTransferRefAction} />
      </AdminTableScroll>
      <div className="vuexy-booking-table-footer">
        <span>
          Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
        </span>
        <AdminRoundedPagination
          activePage={pagination.page}
          ariaLabel="Payout batch pages"
          className="vuexy-booking-pagination"
          hrefForPage={paginationHrefForPage}
          pageLinkClassName="vuexy-booking-page-link"
          totalPages={pagination.totalPages}
        />
      </div>
    </AdminFilterPanel>
  );
}
