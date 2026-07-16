import { AdminTablePaginationFooter } from '../../components/admin-data-table';

export const OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE = 3;

export type OperationsHandoffPagination = {
  readonly activePage: number;
  readonly ariaLabel: string;
  readonly hrefForPage: (page: number) => string;
  readonly itemLabel: string;
  readonly totalRows: number;
};

export type OperationsHandoffPagedRows<T> = {
  readonly from: number;
  readonly rows: readonly T[];
  readonly to: number;
  readonly totalPages: number;
};

export function paginateOperationsHandoffRows<T>(
  rows: readonly T[],
  activePage: number,
  pageSize = OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
): OperationsHandoffPagedRows<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, activePage), totalPages);
  const start = (safePage - 1) * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);

  return {
    from: visibleRows.length === 0 ? 0 : start + 1,
    rows: visibleRows,
    to: visibleRows.length === 0 ? 0 : start + visibleRows.length,
    totalPages,
  };
}

export function OperationsHandoffPaginationFooter({
  from,
  pagination,
  to,
  totalPages,
}: {
  readonly pagination: OperationsHandoffPagination;
} & Pick<OperationsHandoffPagedRows<unknown>, 'from' | 'to' | 'totalPages'>) {
  if (pagination.totalRows <= OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE) {
    return null;
  }

  return (
    <AdminTablePaginationFooter
      activePage={pagination.activePage}
      ariaLabel={pagination.ariaLabel}
      from={from}
      hrefForPage={pagination.hrefForPage}
      itemLabel={pagination.itemLabel}
      to={to}
      totalPages={totalPages}
      totalRows={pagination.totalRows}
    />
  );
}
