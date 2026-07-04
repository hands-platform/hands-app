import { AdminTablePaginationFooter } from '../../components/admin-data-table';

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
  return AdminTablePaginationFooter({
    activePage: pagination.page,
    ariaLabel,
    from: pagination.from,
    hrefForPage,
    to: pagination.to,
    totalPages: pagination.totalPages,
    totalRows: pagination.totalRows,
  });
}
