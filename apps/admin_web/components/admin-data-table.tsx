import type { ReactNode } from 'react';

import { AdminEmptyState } from './admin-empty-state';
import { AdminRoundedPagination } from './admin-rounded-pagination';

type AdminDataTableProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly emptyMessage: ReactNode;
  readonly headers: readonly string[];
  readonly rowCount: number;
};

type AdminTableScrollProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

type AdminTableFooterProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

type AdminTablePaginationFooterProps = {
  readonly activePage: number;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly from: number;
  readonly hrefForPage?: (page: number) => string;
  readonly itemLabel?: string;
  readonly onPageChange?: (page: number) => void;
  readonly pageLinkClassName?: string;
  readonly paginationClassName?: string;
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

export function AdminTableScroll({ children, className }: AdminTableScrollProps) {
  return <div className={joinClassNames('admin-table-scroll', className)}>{children}</div>;
}

export function AdminTableFooter({ children, className }: AdminTableFooterProps) {
  return <div className={joinClassNames('vuexy-booking-table-footer', className)}>{children}</div>;
}

export function AdminTablePaginationFooter({
  activePage,
  ariaLabel,
  className,
  from,
  hrefForPage,
  itemLabel = 'entries',
  onPageChange,
  pageLinkClassName = 'vuexy-booking-page-link',
  paginationClassName,
  to,
  totalPages,
  totalRows,
}: AdminTablePaginationFooterProps) {
  return AdminTableFooter({
    className,
    children: (
      <>
        <span>
          Showing {from} to {to} of {totalRows} {itemLabel}
        </span>
        <AdminRoundedPagination
          activePage={activePage}
          ariaLabel={ariaLabel}
          className={joinClassNames('vuexy-booking-pagination', paginationClassName)}
          hrefForPage={hrefForPage}
          onPageChange={onPageChange}
          pageLinkClassName={pageLinkClassName}
          totalPages={totalPages}
        />
      </>
    ),
  });
}

export function AdminDataTable({
  children,
  className,
  emptyMessage,
  headers,
  rowCount,
}: AdminDataTableProps) {
  const tableClassName = joinClassNames('table vuexy-data-table vuexy-booking-table', className);

  return (
    <table className={tableClassName}>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {children}
        {rowCount === 0 && emptyMessage !== null ? (
          <tr>
            <td className="admin-data-table-empty-cell" colSpan={headers.length}>
              <div className="admin-data-table-empty">{renderEmptyMessage(emptyMessage)}</div>
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function renderEmptyMessage(emptyMessage: ReactNode) {
  if (typeof emptyMessage === 'string') {
    return AdminEmptyState({ framed: true, message: emptyMessage, title: null });
  }

  return emptyMessage;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  const tokens = new Set<string>();

  for (const className of classNames) {
    for (const token of className?.split(/\s+/) ?? []) {
      if (token) {
        tokens.add(token);
      }
    }
  }

  return Array.from(tokens).join(' ');
}
