import { PayoutBatchTable, type PayoutBatchTableRow } from './payout-batch-table';
import { AdminTablePaginationFooter, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTablePanel } from '../../components/admin-table-panel';
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
    <AdminTablePanel
      description="Partner settlement batches ordered so unresolved money movement stays at the top."
      resultLabel={`${pagination.totalRows} row(s)`}
      resultTone={pagination.totalRows > 0 ? 'info' : 'warning'}
      title="Payout batch list"
    >
      <AdminFilterChipGroup ariaLabel="Payout batch toolbar" className="admin-mb-12">
        <StatusBadge tone="success">Newest active first</StatusBadge>
        <StatusBadge tone="info">Payout record</StatusBadge>
        <StatusBadge tone="warning">Reconciliation</StatusBadge>
        <StatusBadgeLink href="/earnings" tone="neutral">
          Review earnings
        </StatusBadgeLink>
      </AdminFilterChipGroup>

      <AdminTableScroll>
        <PayoutBatchTable rows={rows} updateTransferRefAction={updateTransferRefAction} />
      </AdminTableScroll>
      <AdminTablePaginationFooter
        activePage={pagination.page}
        ariaLabel="Payout batch pages"
        from={pagination.from}
        hrefForPage={paginationHrefForPage}
        to={pagination.to}
        totalPages={pagination.totalPages}
        totalRows={pagination.totalRows}
      />
    </AdminTablePanel>
  );
}
