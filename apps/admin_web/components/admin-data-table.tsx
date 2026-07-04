import type { ReactNode } from 'react';

import { AdminEmptyState } from './admin-empty-state';

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

export function AdminTableScroll({ children, className }: AdminTableScrollProps) {
  return <div className={joinClassNames('admin-table-scroll', className)}>{children}</div>;
}

export function AdminTableFooter({ children, className }: AdminTableFooterProps) {
  return <div className={joinClassNames('vuexy-booking-table-footer', className)}>{children}</div>;
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
