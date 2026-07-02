import { AdminRoundedPagination } from '../../components/admin-rounded-pagination';

type FinanceTablePagination = {
  readonly from: number;
  readonly page: number;
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

type FinanceTablePaginationFooterProps = {
  readonly ariaLabel: string;
  readonly hrefForPage: (page: number) => string;
  readonly pagination: FinanceTablePagination;
};

export function FinanceTablePaginationFooter({
  ariaLabel,
  hrefForPage,
  pagination,
}: FinanceTablePaginationFooterProps) {
  return (
    <div className="vuexy-booking-table-footer">
      <span>
        Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries
      </span>
      <AdminRoundedPagination
        activePage={pagination.page}
        ariaLabel={ariaLabel}
        className="vuexy-booking-pagination"
        hrefForPage={hrefForPage}
        pageLinkClassName="vuexy-booking-page-link"
        totalPages={pagination.totalPages}
      />
    </div>
  );
}
