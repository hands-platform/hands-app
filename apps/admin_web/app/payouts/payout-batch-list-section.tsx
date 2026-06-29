import { PayoutBatchTable, type PayoutBatchTableRow } from './payout-batch-table';
import { AdminTableScroll } from '../../components/admin-data-table';
import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';
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
    <div className="card payout-batch-list-card">
      <div className="toolbar">
        <div>
          <p className="muted">
            Partner settlement batches ordered so unresolved money movement stays at the top.
          </p>
        </div>
        <div className="participant-list">
          <span className="pill pill-success">Newest active first</span>
          <span className="pill pill-info">Payout record</span>
          <span className="pill pill-warn">Reconciliation</span>
          <a className="pill" href="/earnings">
            Review earnings
          </a>
        </div>
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
    </div>
  );
}
